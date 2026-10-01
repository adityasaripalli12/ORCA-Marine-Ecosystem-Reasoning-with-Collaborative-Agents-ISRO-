from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.auth.dependencies import get_current_user
from backend.auth.permissions import Permission, ROLE_PERMISSIONS
from backend.models.user import User
from backend.models.audit import AuditLog
from backend.services.voice.stt_provider import get_stt_provider, TranscriptionResult, STTException
from backend.services.voice.tts_provider import TextToSpeechProvider, clean_text_for_speech
from backend.services.language_registry import language_registry
from backend.middleware.rate_limiter import rate_limiter
from backend.utils.logger import sec_logger

router = APIRouter(prefix="", tags=["Multilingual Voice Assistant"])

MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB max audio upload
ALLOWED_MIME_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mp3",
    "audio/mpeg",
    "audio/ogg",
    "audio/m4a",
    "audio/mp4",
    "audio/x-m4a",
    "application/octet-stream"  # Browser blobs sometimes send octet-stream
}


def _verify_voice_permission(user: User):
    """Verifies that the current user's role has VOICE_USE permission."""
    role_perms = ROLE_PERMISSIONS.get(user.role, set())
    if Permission.VOICE_USE not in role_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Role '{user.role}' is not authorized to use voice input."
        )


@router.post("/api/voice/transcribe", response_model=TranscriptionResult)
@router.post("/voice/transcribe", response_model=TranscriptionResult)
async def transcribe_voice(
    request: Request,
    file: UploadFile = File(...),
    client_language: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Transcribe recorded audio, detect spoken language (English, Telugu, Hindi),
    and generate normalized English query for FloatChat AI/RAG/SQL pipeline.
    Audio is processed directly in-memory and NOT saved permanently to disk.
    """
    # 1. Enforce RBAC permission check
    _verify_voice_permission(current_user)

    # 2. Enforce sliding window rate limiting for audio uploads
    rate_limiter.check_and_enforce(request, category="voice_transcribe", limit=30, window_seconds=60)

    # 3. Validate content type and file extension
    content_type = (file.content_type or "audio/webm").lower()
    filename = file.filename or "audio.webm"

    # 4. Read audio bytes with size limit check
    audio_bytes = await file.read()
    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio recording is empty or too short. Please speak clearly into the microphone."
        )

    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio file exceeds the maximum allowed size of 15MB."
        )

    # 5. Execute STT provider
    stt_provider = get_stt_provider()
    try:
        result = stt_provider.transcribe(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=content_type,
            language_hint=client_language
        )

        # 6. Audit voice transcription event (privacy safe: logs metadata, never raw audio)
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit = AuditLog(
            username=current_user.name,
            role=current_user.role,
            action="VOICE_TRANSCRIPTION",
            ip_address=client_ip,
            status="Success",
            description=f"Voice input ({result.detected_language}): '{result.transcript[:40]}...' ({len(audio_bytes)} bytes)"
        )
        db.add(audit)
        db.commit()

        return result

    except STTException as e:
        sec_logger.warning(f"[VOICE_ROUTER] STT error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        sec_logger.error(f"[VOICE_ROUTER] Unexpected error during transcription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sorry, I couldn't understand the voice input. Please try again or type your query."
        )


@router.post("/api/voice/synthesize")
@router.post("/voice/synthesize")
def prepare_speech_synthesis(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Cleans response text into natural speakable audio text and provides
    localized TTS voice configurations for English, Telugu, and Hindi.
    """
    raw_text = payload.get("text", "")
    language = payload.get("language", "en")

    if not raw_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text payload is required for synthesis.")

    speech_payload = TextToSpeechProvider.prepare_response_speech(raw_text, language=language)
    return speech_payload


@router.get("/api/voice/languages")
@router.get("/voice/languages")
def get_supported_voice_languages():
    """
    Returns registered languages supported for voice commands and speech synthesis.
    """
    langs = language_registry.list_languages(only_enabled=True)
    return [
        {
            "code": l.code,
            "name": l.name,
            "native_name": l.native_name,
            "locale": l.locale,
            "sample_queries": l.sample_queries[:3]
        }
        for l in langs
    ]
