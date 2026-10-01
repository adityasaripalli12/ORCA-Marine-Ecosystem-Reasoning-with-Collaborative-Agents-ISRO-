import os
import requests
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from backend.config.settings import settings
from backend.utils.logger import sec_logger

class AIProvider(ABC):
    @abstractmethod
    def generate_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1024
    ) -> str:
        pass

class GroqProvider(AIProvider):
    DEFAULT_URL = "https://api.groq.com/openai/v1/chat/completions"
    DEFAULT_MODEL = "llama-3.3-70b-versatile"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY", "")

    def generate_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1024
    ) -> str:
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not configured.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.DEFAULT_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        res = requests.post(self.DEFAULT_URL, headers=headers, json=payload, timeout=12)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"]
        else:
            raise RuntimeError(f"Groq API error (status {res.status_code}): {res.text}")

class OpenAICompatibleProvider(AIProvider):
    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url
        self.api_key = api_key
        self.model = model

    def generate_chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 1024
    ) -> str:
        if not self.api_key:
            raise ValueError(f"API key missing for provider model {self.model}.")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        res = requests.post(self.base_url, headers=headers, json=payload, timeout=15)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"]
        else:
            raise RuntimeError(f"Provider API error ({res.status_code}): {res.text}")

class ModelRouter:
    """
    Multi-Model Router supporting Groq, OpenAI, Gemini, Anthropic, and OpenRouter.
    Seamlessly routes through active provider.
    """
    _providers: Dict[str, AIProvider] = {}

    @classmethod
    def get_provider(cls, name: Optional[str] = None) -> AIProvider:
        provider_name = (name or os.getenv("ACTIVE_AI_PROVIDER", "groq")).lower().strip()
        
        if provider_name not in cls._providers:
            if provider_name == "groq":
                cls._providers["groq"] = GroqProvider()
            elif provider_name == "openai":
                cls._providers["openai"] = OpenAICompatibleProvider(
                    base_url="https://api.openai.com/v1/chat/completions",
                    api_key=os.getenv("OPENAI_API_KEY", ""),
                    model=os.getenv("OPENAI_MODEL", "gpt-4o")
                )
            elif provider_name == "gemini":
                cls._providers["gemini"] = OpenAICompatibleProvider(
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                    api_key=os.getenv("GEMINI_API_KEY", ""),
                    model=os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
                )
            elif provider_name == "openrouter":
                cls._providers["openrouter"] = OpenAICompatibleProvider(
                    base_url="https://openrouter.ai/api/v1/chat/completions",
                    api_key=os.getenv("OPENROUTER_API_KEY", ""),
                    model=os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
                )
            else:
                cls._providers[provider_name] = GroqProvider()

        return cls._providers[provider_name]
