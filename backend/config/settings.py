import os
import secrets
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Union, List

def _normalize_db_url(url: str) -> str:
    if url and url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url or "sqlite:///./floatchat.db"

class Settings(BaseSettings):
    PROJECT_NAME: str = "FloatChat Enterprise API"
    VERSION: str = "2.4.0"
    API_V1_STR: str = "/api/v1"

    # Server Port (Render supplies PORT via OS environment)
    PORT: int = 8000

    # Secret Key & JWT Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "floatchat_enterprise_secure_jwt_key_2026_prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database Settings (PostgreSQL with SQLite fallback)
    DATABASE_URL: str = _normalize_db_url(os.getenv("DATABASE_URL", "sqlite:///./floatchat.db"))

    # AI & Groq LLM API Key
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # Speech-to-Text (STT) Provider Settings (groq_whisper | mock)
    STT_PROVIDER: str = os.getenv("STT_PROVIDER", "groq_whisper")
    GROQ_WHISPER_MODEL: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3")

    # Allowed CORS Origins (comma-separated string or string)
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:5173,http://localhost:8000"

    # Admin Security Passkey (loaded from env)
    SECURITY_LOG_PASSKEY: str = os.getenv("SECURITY_LOG_PASSKEY", "$2b$12$YGnAJn.MnkY/hTgGg6mzNONfgcSPLUPMyBu3khgs8K9A6/jZi5On.")
    FLOWCHAT_SECURITY_KEY: str = os.getenv("FLOWCHAT_SECURITY_KEY", "$2b$12$YGnAJn.MnkY/hTgGg6mzNONfgcSPLUPMyBu3khgs8K9A6/jZi5On.")
    ORCA_SECURITY_KEY: str = os.getenv("ORCA_SECURITY_KEY", "$2b$12$YGnAJn.MnkY/hTgGg6mzNONfgcSPLUPMyBu3khgs8K9A6/jZi5On.")


    @property
    def cors_origins_list(self) -> List[str]:
        default_dev = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3002",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
        ]
        val = self.CORS_ORIGINS
        if isinstance(val, str):
            parsed = [o.strip() for o in val.split(",") if o.strip() and o.strip() != "*"]
            for d in default_dev:
                if d not in parsed:
                    parsed.append(d)
            return parsed
        elif isinstance(val, list):
            cleaned = [o for o in val if o != "*"]
            for d in default_dev:
                if d not in cleaned:
                    cleaned.append(d)
            return cleaned
        return default_dev

    class Config:
        case_sensitive = True
        extra = "ignore"
        env_file = ("backend/.env", ".env")
        env_file_encoding = "utf-8"


settings = Settings()

