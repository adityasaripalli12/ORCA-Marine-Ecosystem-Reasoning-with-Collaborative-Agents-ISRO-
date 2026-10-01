from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.models.chat import ChatHistory
from backend.models.security import SecurityEvent
from backend.models.audit import AuditLog
from backend.schemas.chat import ChatRequest, ChatResponse
from backend.auth.dependencies import get_current_user
from backend.models.user import User
from backend.services.ai_security_gateway import AISecurityGateway
from backend.middleware.rate_limiter import rate_limiter

router = APIRouter(prefix="", tags=["AI Security Gateway & Chat Engine"])

@router.post("/chat", response_model=ChatResponse)
def execute_chat(
    payload: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    # Enforce server-side sliding window rate limiting
    rate_limiter.check_and_enforce(request, category="chat", limit=40, window_seconds=60)

    # Process through FlowChat AI Security Gateway
    result = AISecurityGateway.process_request(
        user_question=payload.question,
        current_user=current_user,
        client_ip=client_ip,
        db=db,
        device_id=payload.device_id,
        dataset_id=payload.dataset_id,
        messages=payload.messages,
        confirmed_action=payload.confirmed_action,
        language=payload.language
    )

    if result.get("blocked"):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail={
                "status": "blocked",
                "blocked": True,
                "reason": result.get("reason", "prompt_injection"),
                "message": result.get("block_message", "Request blocked by FlowChat security controls."),
            }
        )

    # Store legitimate conversation in ChatHistory
    chat = ChatHistory(
        user_id=current_user.id,
        question=payload.question,
        generated_sql=result.get("generated_sql"),
        ai_response=result["ai_response"],
        confidence_score=result["confidence_score"]
    )
    db.add(chat)

    audit = AuditLog(
        username=current_user.name,
        role=current_user.role,
        action="EXECUTE_AI_QUERY",
        ip_address=client_ip,
        status="Success",
        description=f"AI query processed: '{payload.question[:40]}...'"
    )
    db.add(audit)
    db.commit()
    db.refresh(chat)

    return {
        "id": chat.id,
        "question": chat.question,
        "intent": result.get("intent", "GENERAL_AI"),
        "map_action": result.get("map_action", "NONE"),
        "device_id": result.get("device_id"),
        "location": result.get("location"),
        "generated_sql": None,
        "ai_response": chat.ai_response,
        "confidence_score": chat.confidence_score,
        "confidence_label": result.get("confidence_label", "HIGH"),
        "provenance": result.get("provenance"),
        "observation_data": result.get("observation_data"),
        "retrieved_docs": result.get("retrieved_docs", []),
        "execution_time_ms": result.get("execution_time_ms", 50),
        "has_geo_data": result.get("has_geo_data", False),
        "requires_map": result.get("requires_map", False),
        "requires_confirmation": result.get("requires_confirmation", False),
        "confirmation_action": result.get("confirmation_action"),
        "risk_score": result.get("risk_score", 10),
        "risk_level": result.get("risk_level", "LOW"),
        "locations": result.get("locations", []),
        "sources": result.get("sources", []),
        "dataset_used": result.get("dataset_used"),
        "records_retrieved": result.get("records_retrieved"),
        "suggestions": result.get("suggestions", []),
        "detected_language": result.get("detected_language", "en"),
        "translated_query": result.get("translated_query")
    }

