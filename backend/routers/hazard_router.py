from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.database.connection import get_db
from backend.models.user import User
from backend.models.hazard import HazardEvent, OceanAlert
from backend.auth.dependencies import get_current_user
from backend.services.alert_service import AlertService
from backend.services.hazard_detection_service import HazardDetectionService

router = APIRouter(tags=["Ocean Hazards & Alerts"])

# Request / Response Schemas
class OceanDataPayload(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    region: Optional[str] = "Monitored Marine Sector"
    timestamp: Optional[str] = None
    source: Optional[str] = "FloatChat In-Situ Array"
    observation_count: int = 1
    agreeing_sources: int = 1
    total_sources: int = 1
    forecast_aligned: bool = True
    forecast_confidence: float = 0.85
    # Sensor values
    wind_speed_kts: Optional[float] = None
    wind_speed_mps: Optional[float] = None
    wave_height_m: Optional[float] = None
    pressure_hpa: Optional[float] = None
    surge_height_m: Optional[float] = None
    sst_c: Optional[float] = None
    salinity_psu: Optional[float] = None
    current_speed_mps: Optional[float] = None
    pressure_drop_3h: Optional[float] = None
    temp_delta_3h: Optional[float] = None
    cyclonic_rotation: Optional[bool] = False
    tsunami_provider: Optional[str] = None
    tsunami_bulletin: Optional[Dict[str, Any]] = None
    # Quality flags
    sensor_status: Optional[str] = "operational"
    missing_fields_count: Optional[int] = 0
    qc_passed: Optional[bool] = True
    spatial_consistency: Optional[float] = 1.0


@router.get("/hazards/alerts")
def get_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    region: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve ocean hazard alerts. Authenticated endpoint.
    Filters by status (ACTIVE, UPDATED, RESOLVED, EXPIRED) and region.
    """
    AlertService.expire_stale_alerts(db)

    query = db.query(OceanAlert)
    if status_filter:
        query = query.filter(OceanAlert.status == status_filter.upper())
    else:
        query = query.filter(OceanAlert.status.in_(["ACTIVE", "UPDATED"]))

    if region:
        query = query.filter(OceanAlert.region == region)

    alerts = query.order_by(OceanAlert.updated_at.desc()).limit(limit).all()
    return alerts


@router.get("/hazards/summary")
def get_hazard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get high-level summary of active ocean hazards, alert counts, and monitored baselines.
    """
    AlertService.expire_stale_alerts(db)

    active_alerts = db.query(OceanAlert).filter(OceanAlert.status.in_(["ACTIVE", "UPDATED"])).all()
    
    critical_count = sum(1 for a in active_alerts if a.alert_level == "CRITICAL")
    warning_count = sum(1 for a in active_alerts if a.alert_level == "WARNING")
    advisory_count = sum(1 for a in active_alerts if a.alert_level == "ADVISORY")

    overall_status = "NORMAL"
    if critical_count > 0:
        overall_status = "CRITICAL"
    elif warning_count > 0:
        overall_status = "WARNING"
    elif advisory_count > 0:
        overall_status = "ADVISORY"

    return {
        "overall_status": overall_status,
        "active_alerts_total": len(active_alerts),
        "critical_alerts": critical_count,
        "warning_alerts": warning_count,
        "advisory_alerts": advisory_count,
        "recent_alerts": active_alerts[:5],
        "baselines_tracked": HazardDetectionService.HISTORICAL_BASELINES
    }


@router.post("/hazards/evaluate")
def evaluate_ocean_data(
    payload: OceanDataPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ingest marine observation / forecast package, run full deterministic hazard + confidence pipeline,
    and return structured findings and triggered alert.
    """
    result = AlertService.process_ocean_data_and_alert(
        db=db,
        ocean_data=payload.model_dump()
    )
    return result


@router.post("/hazards/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: str,
    reason: str = Body("Conditions returned to verified baseline", embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually resolve an active ocean alert (Authorized Researchers and Admins).
    """
    resolved = AlertService.resolve_alert(db, alert_id, reason)
    if not resolved:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "success", "alert": resolved}
