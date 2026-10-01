import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.models.hazard import HazardEvent, OceanAlert
from backend.services.risk_engine import RiskEngine
from backend.services.hazard_detection_service import HazardSeverity

class AlertService:
    """
    Ocean Hazard Alert Engine.
    Handles alert triggering, fingerprint deduplication, escalation/de-escalation,
    and automatic expiration lifecycle.
    """

    DEFAULT_TTL_HOURS = 12.0

    @classmethod
    def generate_fingerprint(cls, hazard_type: str, region: Optional[str], lat: Optional[float], lon: Optional[float]) -> str:
        """
        Creates stable deduplication fingerprint:
        Combines hazard_type, generalized spatial cell (approx 100km grid or region),
        and 6-hour temporal epoch.
        """
        now = datetime.now(timezone.utc)
        epoch_6h = int(now.timestamp() // (6 * 3600))
        
        # Grid quantization (~0.5 degree approx 55 km)
        grid_lat = round(lat * 2) / 2 if lat is not None else 0.0
        grid_lon = round(lon * 2) / 2 if lon is not None else 0.0
        loc_token = region if region else f"{grid_lat}:{grid_lon}"

        seed = f"{hazard_type}|{loc_token}|{epoch_6h}"
        return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:24]

    @classmethod
    def determine_alert_level(cls, severity: str, confidence_score: float, confidence_label: str) -> str:
        """
        Calculates official Alert Level:
        🔴 CRITICAL: CRITICAL severity + HIGH confidence (score >= 80)
        🟠 WARNING: HIGH severity + (MEDIUM or HIGH confidence)
        🟡 ADVISORY: MODERATE severity OR (HIGH/CRITICAL severity with LOW confidence)
        🟢 NORMAL: LOW severity or no confirmed hazard
        """
        if severity == HazardSeverity.CRITICAL.value and confidence_score >= 80.0:
            return "CRITICAL"
        elif severity in [HazardSeverity.CRITICAL.value, HazardSeverity.HIGH.value] and confidence_score >= 60.0:
            return "WARNING"
        elif severity == HazardSeverity.MODERATE.value or (severity in [HazardSeverity.CRITICAL.value, HazardSeverity.HIGH.value] and confidence_score < 60.0):
            return "ADVISORY"
        return "NORMAL"

    @classmethod
    def process_ocean_data_and_alert(
        cls,
        db: Session,
        ocean_data: Dict[str, Any],
        custom_confidence_weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Full pipeline:
        1. Evaluates hazards and evidence-based risk
        2. Records HazardEvent in DB
        3. Applies alert rules & deduplication
        4. Escalates, de-escalates, or creates new OceanAlert
        """
        # 1. Clean up any expired alerts first
        cls.expire_stale_alerts(db)

        # 2. Risk evaluation
        risk_result = RiskEngine.evaluate_risk(ocean_data, custom_confidence_weights)
        
        has_hazard = risk_result["has_hazard"]
        hazard_type = risk_result.get("primary_hazard")
        severity = risk_result.get("severity", HazardSeverity.LOW.value)
        conf_score = risk_result.get("confidence_score", 0.0)
        conf_label = risk_result.get("confidence_label", "LOW")
        lat = ocean_data.get("latitude")
        lon = ocean_data.get("longitude")
        region = ocean_data.get("region") or risk_result.get("region", "Global Ocean Sector")

        # 3. Record HazardEvent in database
        event_record = HazardEvent(
            hazard_type=hazard_type or "NOMINAL_MONITORING",
            severity=severity,
            confidence_score=conf_score,
            confidence_label=conf_label,
            observed_value=ocean_data.get("observed_value"),
            threshold_value=ocean_data.get("threshold_value"),
            unit=ocean_data.get("unit"),
            latitude=lat,
            longitude=lon,
            region=region,
            source=ocean_data.get("source", "FloatChat Telemetry Network"),
            evidence_json=json.dumps(risk_result.get("evidence", [])),
            status="ACTIVE" if has_hazard else "RESOLVED"
        )
        db.add(event_record)
        db.commit()
        db.refresh(event_record)

        # 4. If no hazard, return NORMAL status without opening an alert
        if not has_hazard:
            return {
                "alert_level": "NORMAL",
                "hazard_detected": False,
                "event_id": event_record.id,
                "risk_profile": risk_result,
                "message": "No verified high-risk ocean hazard is currently detected in the available data."
            }

        # 5. Determine Alert Level
        alert_level = cls.determine_alert_level(severity, conf_score, conf_label)
        
        # Filter: avoid creating high alerts on purely low-confidence anomalies
        if alert_level == "NORMAL":
            return {
                "alert_level": "NORMAL",
                "hazard_detected": True,
                "event_id": event_record.id,
                "risk_profile": risk_result,
                "message": "Minor anomaly detected, but confidence is low. Continues under background monitoring."
            }

        # 6. Alert Fingerprinting & Deduplication
        fingerprint = cls.generate_fingerprint(hazard_type, region, lat, lon)
        
        # Check for existing active alert with matching fingerprint
        existing_alert = db.query(OceanAlert).filter(
            OceanAlert.fingerprint == fingerprint,
            OceanAlert.status.in_(["ACTIVE", "UPDATED"])
        ).first()

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=cls.DEFAULT_TTL_HOURS)

        severity_rank = {"NORMAL": 0, "ADVISORY": 1, "WARNING": 2, "CRITICAL": 3}

        if existing_alert:
            # Event persists: update existing alert instead of creating duplicates!
            old_level = existing_alert.alert_level
            old_rank = severity_rank.get(old_level, 1)
            new_rank = severity_rank.get(alert_level, 1)

            existing_alert.hazard_event_id = event_record.id
            existing_alert.confidence_score = conf_score
            existing_alert.confidence_label = conf_label
            existing_alert.updated_at = now
            existing_alert.expires_at = expires_at
            existing_alert.status = "UPDATED"

            if new_rank > old_rank:
                # Escalation: ADVISORY -> WARNING -> CRITICAL
                existing_alert.alert_level = alert_level
                existing_alert.escalation_count = (existing_alert.escalation_count or 0) + 1
                existing_alert.title = f"{alert_level} ESCALATION: {hazard_type.replace('_', ' ')}"
                existing_alert.message = f"Hazard escalated to {alert_level}. Confidence: {conf_score}% ({conf_label}). {risk_result['recommended_action']}"
            elif new_rank < old_rank:
                # De-escalation when conditions or confidence decrease
                existing_alert.alert_level = alert_level
                existing_alert.title = f"{alert_level} DE-ESCALATION: {hazard_type.replace('_', ' ')}"
                existing_alert.message = f"Hazard de-escalated to {alert_level}. Confidence: {conf_score}% ({conf_label})."
            else:
                # Persistent event update (no level change)
                existing_alert.message = f"Hazard ongoing. Confidence: {conf_score}% ({conf_label}). {risk_result['recommended_action']}"

            db.commit()
            db.refresh(existing_alert)
            alert_obj = existing_alert
            action_type = "UPDATED_EXISTING"
        else:
            # Create fresh new alert
            alert_obj = OceanAlert(
                hazard_event_id=event_record.id,
                alert_level=alert_level,
                hazard_type=hazard_type,
                title=f"{alert_level} ALERT: {hazard_type.replace('_', ' ')}",
                message=f"{severity} hazard detected in {region}. Confidence: {conf_score}% ({conf_label}). {risk_result['recommended_action']}",
                action_guidance=risk_result.get("recommended_action"),
                confidence_score=conf_score,
                confidence_label=conf_label,
                latitude=lat,
                longitude=lon,
                region=region,
                sources=ocean_data.get("source", "Multi-Source Sensor Telemetry"),
                fingerprint=fingerprint,
                expires_at=expires_at,
                status="ACTIVE"
            )
            db.add(alert_obj)
            db.commit()
            db.refresh(alert_obj)
            action_type = "CREATED_NEW"

        return {
            "alert_id": alert_obj.id,
            "action_type": action_type,
            "alert_level": alert_obj.alert_level,
            "hazard_type": alert_obj.hazard_type,
            "title": alert_obj.title,
            "message": alert_obj.message,
            "action_guidance": alert_obj.action_guidance,
            "confidence_score": alert_obj.confidence_score,
            "confidence_label": alert_obj.confidence_label,
            "region": alert_obj.region,
            "latitude": alert_obj.latitude,
            "longitude": alert_obj.longitude,
            "fingerprint": alert_obj.fingerprint,
            "created_at": alert_obj.created_at.isoformat(),
            "expires_at": alert_obj.expires_at.isoformat(),
            "status": alert_obj.status,
            "hazard_event_id": event_record.id,
            "risk_profile": risk_result
        }

    @classmethod
    def expire_stale_alerts(cls, db: Session) -> int:
        """
        Finds active alerts whose expires_at timestamp has passed,
        and marks them EXPIRED so alerts do not remain active indefinitely.
        """
        now = datetime.now(timezone.utc)
        expired_count = db.query(OceanAlert).filter(
            OceanAlert.status.in_(["ACTIVE", "UPDATED"]),
            OceanAlert.expires_at <= now
        ).update({"status": "EXPIRED"}, synchronize_session=False)
        if expired_count > 0:
            db.commit()
        return expired_count

    @classmethod
    def resolve_alert(cls, db: Session, alert_id: str, reason: str = "Conditions resolved") -> Optional[OceanAlert]:
        """Manually or programmatically resolve an active alert."""
        alert = db.query(OceanAlert).filter(OceanAlert.id == alert_id).first()
        if alert:
            alert.status = "RESOLVED"
            alert.updated_at = datetime.now(timezone.utc)
            alert.message = f"{alert.message} [RESOLVED: {reason}]"
            db.commit()
            db.refresh(alert)
        return alert

    @classmethod
    def get_active_alerts(cls, db: Session, region: Optional[str] = None) -> List[OceanAlert]:
        """Returns all currently active / updated alerts."""
        cls.expire_stale_alerts(db)
        q = db.query(OceanAlert).filter(OceanAlert.status.in_(["ACTIVE", "UPDATED"]))
        if region:
            q = q.filter(OceanAlert.region == region)
        return q.order_by(OceanAlert.created_at.desc()).all()
