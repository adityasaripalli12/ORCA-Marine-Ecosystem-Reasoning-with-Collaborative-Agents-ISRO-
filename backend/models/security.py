import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Float
from backend.database.connection import Base

class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String, nullable=False) # PROMPT_INJECTION, SQL_INJECTION, etc.
    severity = Column(String, default="High") # Low, Medium, High, Critical
    risk_score = Column(Integer, default=50) # 0 to 100
    risk_level = Column(String, default="HIGH") # LOW, MEDIUM, HIGH, CRITICAL
    action_taken = Column(String, default="BLOCK") # ALLOW, BLOCK, WARN, REQUIRE_CONFIRMATION, etc.
    source = Column(String, default="FlowChat AI") # FlowChat AI, REST API, DEV-004, etc.
    status = Column(String, default="BLOCKED") # BLOCKED, DENIED, ALLOWED, FLAGGED, PENDING_REVIEW
    device_id = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    user_role = Column(String, nullable=True)
    username = Column(String, nullable=False)
    ip = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    details = Column(String, nullable=False)

