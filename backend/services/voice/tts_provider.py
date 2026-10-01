import re
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel


def clean_text_for_speech(text: str) -> str:
    """
    Cleans rich AI response markdown into natural, speakable text for Text-to-Speech engines.
    - Strips markdown tables, SQL blocks, code fences, and URLs.
    - Preserves numerical measurements, float IDs, locations, and oceanographic units.
    - Normalizes excessive whitespace and punctuation.
    """
    if not text:
        return ""

    cleaned = text

    # 1. Remove markdown code blocks (```...```)
    cleaned = re.sub(r'```[\s\S]*?```', '', cleaned)

    # 2. Remove markdown tables (| ... |)
    lines = cleaned.split('\n')
    non_table_lines = [line for line in lines if not (line.strip().startswith('|') and line.strip().endswith('|'))]
    cleaned = '\n'.join(non_table_lines)

    # 3. Convert markdown links [Label](URL) -> Label
    cleaned = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', cleaned)

    # 4. Remove bold/italics markers (**text** -> text, *text* -> text)
    cleaned = re.sub(r'\*\*([^\*]+)\*\*', r'\1', cleaned)
    cleaned = re.sub(r'\*([^\*]+)\*', r'\1', cleaned)
    cleaned = re.sub(r'`([^`]+)`', r'\1', cleaned)

    # 5. Remove bullet points and headers (# Header -> Header)
    cleaned = re.sub(r'^\s*[#\*\-]+\s+', '', cleaned, flags=re.MULTILINE)

    # 6. Clean common emojis that might sound strange when read aloud
    cleaned = re.sub(r'[🤖🌊📡📊🗺️📍🔬⚠️🛡️🔍⚡🔊🎤✓🔒]', '', cleaned)

    # 7. Collapse multiple blank lines or spaces
    cleaned = re.sub(r'\n+', '. ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # Ensure ending period
    if cleaned and not cleaned.endswith(('.', '!', '?')):
        cleaned += '.'

    return cleaned


class BrowserSpeechConfig(BaseModel):
    """Configuration for client-side Web Speech Synthesis."""
    language: str
    locale: str
    rate: float = 1.0
    pitch: float = 1.0
    preferred_voice_name: Optional[str] = None


class TextToSpeechProvider(ABC):
    """
    Modular Text-to-Speech provider abstraction.
    Prepares, sanitizes, and maps speech metadata for natural voice playback in English, Telugu, and Hindi.
    """

    SPEECH_CONFIGS: Dict[str, BrowserSpeechConfig] = {
        "en": BrowserSpeechConfig(language="en", locale="en-US", rate=1.0, pitch=1.0),
        "te": BrowserSpeechConfig(language="te", locale="te-IN", rate=0.95, pitch=1.0),
        "hi": BrowserSpeechConfig(language="hi", locale="hi-IN", rate=0.95, pitch=1.0),
    }

    @classmethod
    def get_speech_config(cls, language: str) -> BrowserSpeechConfig:
        lang_clean = (language or "en").lower().strip()
        return cls.SPEECH_CONFIGS.get(lang_clean, cls.SPEECH_CONFIGS["en"])

    @classmethod
    def prepare_response_speech(cls, text: str, language: str = "en") -> Dict[str, Any]:
        """
        Processes AI markdown text and generates clean speakable payload and configuration.
        """
        clean_speech = clean_text_for_speech(text)
        config = cls.get_speech_config(language)
        return {
            "clean_text": clean_speech,
            "language": config.language,
            "locale": config.locale,
            "rate": config.rate,
            "pitch": config.pitch,
            "word_count": len(clean_speech.split())
        }
