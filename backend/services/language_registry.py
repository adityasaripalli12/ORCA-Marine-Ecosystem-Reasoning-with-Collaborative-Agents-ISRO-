import re
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

# Unicode Script Ranges
TELUGU_SCRIPT_REGEX = re.compile(r'[\u0C00-\u0C7F]')
DEVANAGARI_SCRIPT_REGEX = re.compile(r'[\u0900-\u097F]')


class LanguageConfig(BaseModel):
    code: str
    name: str
    native_name: str
    locale: str
    whisper_code: str
    script_regex: Optional[str] = None
    tts_voice: str
    direction: str = "ltr"
    enabled: bool = True
    sample_queries: List[str] = Field(default_factory=list)
    domain_terms: List[str] = Field(default_factory=list)


class LanguageRegistryService:
    """
    Extensible Language Registry for FloatChat Multilingual Voice Assistant.
    Enables adding new languages (e.g. Tamil, Malayalam, Bengali, Spanish)
    by registering configuration without modifying RAG, FAISS, or SQL pipelines.
    """

    def __init__(self):
        self._registry: Dict[str, LanguageConfig] = {}
        self._compiled_regexes: Dict[str, re.Pattern] = {}
        self._register_default_languages()

    def _register_default_languages(self):
        # English (Default Reference Language)
        self.register_language(LanguageConfig(
            code="en",
            name="English",
            native_name="English",
            locale="en-US",
            whisper_code="en",
            script_regex=None,
            tts_voice="en-US-Standard-C",
            sample_queries=[
                "Show salinity trends in Bay of Bengal",
                "Where is DEV-001 and what is its status?",
                "What is the deepest measurement across all profiles?",
                "Why is DEV-004 showing a temperature anomaly?"
            ],
            domain_terms=[
                "salinity", "temperature", "thermocline", "ARGO float", "pressure",
                "depth profile", "anomaly", "INCOIS", "Bay of Bengal", "Arabian Sea"
            ]
        ))

        # Telugu (తెలుగు)
        self.register_language(LanguageConfig(
            code="te",
            name="Telugu",
            native_name="తెలుగు",
            locale="te-IN",
            whisper_code="te",
            script_regex=r'[\u0C00-\u0C7F]',
            tts_voice="te-IN-Standard-A",
            sample_queries=[
                "బంగాళాఖాతంలో ఉప్పుదనం ఎలా మారింది?",
                "ఆంధ్ర తీరంలో ఉష్ణోగ్రత మార్పులు చూపించు",
                "DEV-001 ఎక్కడ ఉంది మరియు దాని స్థితి ఏమిటి?",
                "అత్యంత లోతైన కొలత ఏమిటి?"
            ],
            domain_terms=[
                "ఉష్ణోగ్రత", "లవణీయత", "పీడనం", "లోతు", "ఫ్లోట్",
                "బంగాళాఖాతం", "అరేబియా సముద్రం", "హిందూ మహాసముద్రం"
            ]
        ))

        # Hindi (हिन्दी)
        self.register_language(LanguageConfig(
            code="hi",
            name="Hindi",
            native_name="हिन्दी",
            locale="hi-IN",
            whisper_code="hi",
            script_regex=r'[\u0900-\u097F]',
            tts_voice="hi-IN-Standard-A",
            sample_queries=[
                "बंगाल की खाड़ी में लवणता कैसे बदली है?",
                "आंध्र तट के पास तापमान में बदलाव दिखाएं",
                "DEV-001 कहाँ है और इसकी स्थिति क्या है?",
                "सबसे गहरा माप क्या है?"
            ],
            domain_terms=[
                "तापमान", "लवणता", "दबाव", "गहराई", "फ्लोट",
                "बंगाल की खाड़ी", "अरब सागर", "हिंद महासागर"
            ]
        ))

    def register_language(self, config: LanguageConfig):
        """Registers a new language into the system."""
        self._registry[config.code] = config
        if config.script_regex:
            self._compiled_regexes[config.code] = re.compile(config.script_regex)

    def get_language(self, code: str) -> Optional[LanguageConfig]:
        """Retrieves language configuration by ISO code."""
        return self._registry.get(code)

    def list_languages(self, only_enabled: bool = True) -> List[LanguageConfig]:
        """Lists all registered languages."""
        langs = list(self._registry.values())
        if only_enabled:
            langs = [l for l in langs if l.enabled]
        return langs

    def detect_language(self, text: str, client_preference: Optional[str] = None) -> str:
        """
        Detect language automatically from text using script analysis.
        Falls back to client preference if provided, or 'en'.
        """
        if not text:
            return client_preference or "en"

        # Count character matches across registered non-English regexes
        counts: Dict[str, int] = {}
        for code, regex in self._compiled_regexes.items():
            matches = len(regex.findall(text))
            if matches > 0:
                counts[code] = matches

        if counts:
            best_lang = max(counts, key=counts.get)
            return best_lang

        if client_preference and client_preference in self._registry:
            return client_preference

        return "en"


# Global singleton instance
language_registry = LanguageRegistryService()
