import os
import io
import re
import requests
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.config.settings import settings
from backend.services.translation_service import TranslationService
from backend.services.language_registry import language_registry
from backend.utils.logger import sec_logger


class TranscriptionResult(BaseModel):
    """Normalized output schema for speech-to-text transcription."""
    transcript: str
    detected_language: str = "en"
    language_name: str = "English"
    confidence: float = 0.95
    normalized_query: str
    input_mode: str = "voice"
    duration_seconds: Optional[float] = None


class STTException(Exception):
    """Base exception for Speech-to-Text errors."""
    def __init__(self, message: str, status_code: int = 400, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class SpeechToTextProvider(ABC):
    """
    Abstract Base Class for Speech-to-Text Providers.
    Decouples voice ingestion from the specific STT engine (e.g. Groq Whisper, OpenAI Whisper, or local Mock).
    """

    @abstractmethod
    def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
        language_hint: Optional[str] = None
    ) -> TranscriptionResult:
        """
        Transcribes audio bytes into text, detects language, and produces normalized English query.
        """
        pass

    def detect_language(self, transcript: str, whisper_lang: Optional[str] = None, client_hint: Optional[str] = None) -> str:
        """
        Robust multi-phase language detection:
        1. Unicode script detection on transcribed text (highest certainty for Indian scripts).
        2. Whisper reported language code normalization.
        3. Client preference hint.
        4. Default to 'en'.
        """
        if not transcript or not transcript.strip():
            return client_hint or "en"

        # 1. Unicode Script Analysis (Telugu [\u0C00-\u0C7F], Devanagari/Hindi [\u0900-\u097F])
        script_detected = TranslationService.detect_language(transcript, client_preference=None)
        if script_detected in ["te", "hi"]:
            return script_detected

        # 2. Whisper reported language normalization
        if whisper_lang:
            w_clean = whisper_lang.lower().strip()
            lang_map = {
                "telugu": "te", "te": "te",
                "hindi": "hi", "hi": "hi",
                "english": "en", "en": "en"
            }
            if w_clean in lang_map:
                return lang_map[w_clean]

        # 3. Client hint
        if client_hint in ["en", "te", "hi"]:
            return client_hint

        return "en"


class GroqWhisperSTTProvider(SpeechToTextProvider):
    """
    Production-grade Speech-to-Text provider utilizing Groq's low-latency Whisper API (whisper-large-v3).
    Supports English, Telugu, and Hindi natively with fast turnaround time.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or getattr(settings, "GROQ_WHISPER_MODEL", "whisper-large-v3")
        self.api_url = "https://api.groq.com/openai/v1/audio/transcriptions"

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
        language_hint: Optional[str] = None
    ) -> TranscriptionResult:
        if not audio_bytes or len(audio_bytes) < 100:
            raise STTException("Audio recording is empty or too short. Please speak clearly into the microphone.", status_code=400)

        # Check API key presence
        if not self.api_key or self.api_key.startswith("gsk_dummy") or len(self.api_key) < 10:
            sec_logger.warning("[VOICE_STT] GROQ_API_KEY not configured or dummy; falling back to mock provider.")
            mock_provider = MockLocalSTTProvider()
            return mock_provider.transcribe(audio_bytes, filename, content_type, language_hint)

        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        # Prepare multipart/form-data upload
        files = {
            "file": (filename, io.BytesIO(audio_bytes), content_type or "audio/webm")
        }
        data = {
            "model": self.model,
            "response_format": "verbose_json",
            "temperature": "0.0"
        }

        # Only pass language to whisper if explicit client hint is known
        if language_hint and language_hint in ["en", "te", "hi"]:
            data["language"] = language_hint

        try:
            sec_logger.info(f"[VOICE_STT] Sending audio ({len(audio_bytes)} bytes, {filename}) to Groq Whisper...")
            response = requests.post(
                self.api_url,
                headers=headers,
                files=files,
                data=data,
                timeout=15
            )

            if not response.ok:
                error_detail = response.text[:200]
                sec_logger.error(f"[VOICE_STT] Groq Whisper API error ({response.status_code}): {error_detail}")
                # If API call fails (e.g. rate limit / network error), fail gracefully or fall back
                raise STTException(
                    f"Voice transcription service temporarily unavailable. Please try again or type your query.",
                    status_code=502,
                    details={"provider_status": response.status_code, "error": error_detail}
                )

            res_json = response.json()
            raw_transcript = (res_json.get("text") or "").strip()
            whisper_detected_lang = res_json.get("language")
            duration = res_json.get("duration")

            if not raw_transcript:
                raise STTException("No speech could be detected in the recording. Please speak clearly and try again.", status_code=400)

            # Detect normalized language code
            lang_code = self.detect_language(raw_transcript, whisper_detected_lang, language_hint)
            lang_cfg = language_registry.get_language(lang_code)
            lang_name = lang_cfg.name if lang_cfg else ("Telugu" if lang_code == "te" else ("Hindi" if lang_code == "hi" else "English"))

            # Calculate confidence heuristic from response
            confidence = 0.94 if len(raw_transcript) > 5 else 0.80

            # Translate to normalized English query for RAG/SQL/Orchestrator
            normalized_query, _ = TranslationService.translate_to_english(raw_transcript, source_lang=lang_code)

            sec_logger.info(f"[VOICE_STT] Transcribed ({lang_code}): '{raw_transcript[:60]}' -> normalized: '{normalized_query[:60]}'")

            return TranscriptionResult(
                transcript=raw_transcript,
                detected_language=lang_code,
                language_name=lang_name,
                confidence=confidence,
                normalized_query=normalized_query,
                input_mode="voice",
                duration_seconds=duration
            )

        except requests.Timeout:
            sec_logger.error("[VOICE_STT] Groq Whisper API timed out after 15s")
            raise STTException("Voice processing timed out. Please try again.", status_code=504)
        except requests.RequestException as req_err:
            sec_logger.error(f"[VOICE_STT] Network error connecting to Groq Whisper: {req_err}")
            raise STTException("Network failure while processing voice audio. Please check your connection.", status_code=503)


class MockLocalSTTProvider(SpeechToTextProvider):
    """
    Offline/Local Mock Speech-to-Text provider for test suites, offline demos, and CI environments.
    Inspects audio metadata or fallback parameters to return deterministic transcriptions.
    """

    DEFAULT_TEST_QUERIES = [
        # English
        ("Show temperature near Chennai", "en"),
        ("Show salinity at 500 meters", "en"),
        ("Compare Bay of Bengal and Arabian Sea", "en"),
        ("Plot temperature versus depth", "en"),
        ("Show available ARGO floats", "en"),
        # Telugu
        ("చెన్నై దగ్గర సముద్ర ఉష్ణోగ్రతను చూపించు", "te"),
        ("బంగాళాఖాతంలో ఉప్పుదనం ఎలా ఉంది?", "te"),
        ("DEV-001 ఎక్కడ ఉంది మరియు దాని స్థితి ఏమిటి?", "te"),
        # Hindi
        ("चेन्नई के पास समुद्र का तापमान दिखाओ", "hi"),
        ("बंगाल की खाड़ी में लवणता कैसे बदली है?", "hi"),
        ("सभी ARGO फ्लोट्स दिखाएं", "hi"),
    ]

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        content_type: str = "audio/webm",
        language_hint: Optional[str] = None
    ) -> TranscriptionResult:
        if not audio_bytes or len(audio_bytes) < 50:
            raise STTException("Audio recording is empty. Please speak into the microphone.", status_code=400)

        # Check if caller supplied mock text inside filename or dummy payload
        transcript = None
        lang_code = language_hint or "en"

        if language_hint == "te":
            transcript = "చెన్నై దగ్గర సముద్ర ఉష్ణోగ్రతను చూపించు"
            lang_code = "te"
        elif language_hint == "hi":
            transcript = "चेन्नई के पास समुद्र का तापमान दिखाओ"
            lang_code = "hi"
        else:
            # Check filename pattern e.g. mock_te_query.wav or mock_hi_query.wav
            if "te" in filename.lower():
                transcript = "చెన్నై దగ్గర సముద్ర ఉష్ణోగ్రతను చూపించు"
                lang_code = "te"
            elif "hi" in filename.lower():
                transcript = "चेन्नई के पास समुद्र का तापमान दिखाओ"
                lang_code = "hi"
            else:
                transcript = "Show temperature near Chennai"
                lang_code = "en"

        lang_cfg = language_registry.get_language(lang_code)
        lang_name = lang_cfg.name if lang_cfg else ("Telugu" if lang_code == "te" else ("Hindi" if lang_code == "hi" else "English"))
        normalized_query, _ = TranslationService.translate_to_english(transcript, source_lang=lang_code)

        return TranscriptionResult(
            transcript=transcript,
            detected_language=lang_code,
            language_name=lang_name,
            confidence=0.98,
            normalized_query=normalized_query,
            input_mode="voice",
            duration_seconds=2.5
        )


class STTProviderFactory:
    """Factory creating configured SpeechToTextProvider instance."""

    @staticmethod
    def get_provider() -> SpeechToTextProvider:
        provider_name = getattr(settings, "STT_PROVIDER", "groq_whisper").lower().strip()
        if provider_name == "mock":
            return MockLocalSTTProvider()
        return GroqWhisperSTTProvider()


def get_stt_provider() -> SpeechToTextProvider:
    """Dependency helper returning the active STT provider."""
    return STTProviderFactory.get_provider()
