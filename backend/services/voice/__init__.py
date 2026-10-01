"""
FloatChat Voice Services Package
Provides modular Speech-to-Text (STT) and Text-to-Speech (TTS) providers,
supporting multilingual ocean intelligence commands in English, Telugu, and Hindi.
"""

from backend.services.voice.stt_provider import (
    SpeechToTextProvider,
    GroqWhisperSTTProvider,
    MockLocalSTTProvider,
    STTProviderFactory,
    TranscriptionResult,
    get_stt_provider
)
from backend.services.voice.tts_provider import (
    TextToSpeechProvider,
    clean_text_for_speech,
    BrowserSpeechConfig
)

__all__ = [
    "SpeechToTextProvider",
    "GroqWhisperSTTProvider",
    "MockLocalSTTProvider",
    "STTProviderFactory",
    "TranscriptionResult",
    "get_stt_provider",
    "TextToSpeechProvider",
    "clean_text_for_speech",
    "BrowserSpeechConfig",
]
