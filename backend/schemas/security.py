from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SecurityEventResponse(BaseModel):
    id: str
    event_type: str
    severity: str
    risk_score: Optional[int] = 50
    risk_level: Optional[str] = "HIGH"
    action_taken: Optional[str] = "BLOCK"
    source: Optional[str] = "FlowChat AI"
    status: Optional[str] = "BLOCKED"
    device_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    user_role: Optional[str] = None
    username: str
    ip: str
    created_at: datetime
    details: str

    class Config:
        from_attributes = True


class PromptCheckRequest(BaseModel):
    prompt: str

class PromptCheckResponse(BaseModel):
    is_safe: bool
    detected_attack: Optional[str] = None
    confidence: float
