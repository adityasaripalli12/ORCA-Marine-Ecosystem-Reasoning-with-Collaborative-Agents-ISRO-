import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, Boolean, Index, Integer
from backend.database.connection import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class HazardEvent(Base):
    """
    Empirical Ocean Hazard Event detected by deterministic detection engine.
    Stores raw metrics, detected hazard type, baseline comparisons, and evidence.
    """
    __tablename__ = "hazard_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    hazard_type = Column(String, nullable=False, index=True) # e.g. EXTREME_WAVE, HIGH_WIND, CYCLONE_RISK
    severity = Column(String, nullable=False, index=True)   # LOW, MODERATE, HIGH, CRITICAL
    confidence_score = Column(Float, nullable=False)        # 0.0 to 100.0
    confidence_label = Column(String, nullable=False)       # LOW, MEDIUM, HIGH
    observed_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    region = Column(String, nullable=True)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    source = Column(String, nullable=False)                 # Observation source or model
    evidence_json = Column(Text, nullable=True)             # Serialized list of structured evidence items
    baseline_info = Column(Text, nullable=True)             # Metadata on historical baseline used
    status = Column(String, default="ACTIVE", index=True)   # ACTIVE, RESOLVED, SUPERCEDED

    __table_args__ = (
        Index("ix_hazard_type_severity", "hazard_type", "severity"),
        Index("ix_hazard_status_detected", "status", "detected_at"),
        Index("ix_hazard_geo", "latitude", "longitude"),
    )


class OceanAlert(Base):
    """
    Official Ocean Hazard Alert with alert-level, deduplication fingerprint,
    and automatic expiration lifecycle.
    """
    __tablename__ = "ocean_alerts"

    id = Column(String, primary_key=True, default=generate_uuid)
    hazard_event_id = Column(String, nullable=True, index=True)
    alert_level = Column(String, nullable=False, index=True) # NORMAL, ADVISORY, WARNING, CRITICAL
    hazard_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    action_guidance = Column(Text, nullable=True)           # Domain-appropriate safety guidance
    confidence_score = Column(Float, nullable=False)
    confidence_label = Column(String, nullable=False)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    region = Column(String, nullable=True)
    sources = Column(Text, nullable=True)                   # Comma-separated or JSON list of sources
    fingerprint = Column(String, nullable=False, index=True)# Deduplication hash (hazard_type + region + window)
    escalation_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False, index=True)
    status = Column(String, default="ACTIVE", index=True)   # ACTIVE, UPDATED, RESOLVED, EXPIRED

    __table_args__ = (
        Index("ix_alert_fingerprint_status", "fingerprint", "status"),
        Index("ix_alert_level_status", "alert_level", "status"),
    )
