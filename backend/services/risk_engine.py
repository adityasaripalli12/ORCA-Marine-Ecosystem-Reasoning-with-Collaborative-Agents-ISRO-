from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from backend.services.hazard_detection_service import (
    HazardType,
    HazardSeverity,
    HazardDetectionService
)
from backend.services.confidence_service import ConfidenceService

class RiskEngine:
    """
    Oceanographic Risk Engine.
    Synthesizes hazard detection findings with evidence-based confidence scores
    to calculate actionable risk levels and domain-appropriate safety guidance.
    """

    # Domain-appropriate maritime safety guidance mappings
    ACTION_GUIDANCE_MAP = {
        HazardType.EXTREME_WAVE.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL DANGER: Phenomenal sea state. Cease all offshore/small-craft operations immediately. Follow official maritime safety guidance and port captain directives.",
            HazardSeverity.HIGH.value: "HIGH RISK: Severe wave heights. Large vessels exercise extreme caution. Small crafts seek sheltered harbor.",
            HazardSeverity.MODERATE.value: "ADVISORY: Moderate-to-rough seas. Monitor real-time wave buoy and altimetry updates before proceeding.",
            HazardSeverity.LOW.value: "NOMINAL: Sea state within regular operational limits."
        },
        HazardType.HIGH_WIND.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL DANGER: Storm-to-hurricane force winds. Severe structural and vessel hazard. Follow official maritime safety guidance.",
            HazardSeverity.HIGH.value: "HIGH RISK: Gale force winds detected. Secure deck equipment, reduce sail/speed, and monitor weather radar.",
            HazardSeverity.MODERATE.value: "ADVISORY: Strong breeze conditions. Exercise caution in exposed coastal and offshore passages.",
            HazardSeverity.LOW.value: "NOMINAL: Atmospheric wind conditions are within standard navigation limits."
        },
        HazardType.CYCLONE_RISK.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL DANGER: Severe cyclonic storm in progress. Evacuate low-lying coastal areas and follow national meteorological disaster protocols.",
            HazardSeverity.HIGH.value: "HIGH RISK: Cyclonic storm developing. Prepare emergency maritime moorings and follow official maritime safety guidance.",
            HazardSeverity.MODERATE.value: "ADVISORY: Deep tropical depression organizing. Maintain continuous watch on synoptic bulletins.",
            HazardSeverity.LOW.value: "NOMINAL: No cyclonic system detected."
        },
        HazardType.STORM_SURGE.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL DANGER: Major storm surge inundation expected. Immediate coastal flood evacuation according to local emergency authorities.",
            HazardSeverity.HIGH.value: "HIGH RISK: Significant surge elevation above high tide. Coastal infrastructure alert in effect.",
            HazardSeverity.MODERATE.value: "ADVISORY: Minor coastal surge possible. Monitor tide gauges.",
            HazardSeverity.LOW.value: "NOMINAL: Water levels tracking predicted astronomical tide."
        },
        HazardType.TSUNAMI_WARNING.value: {
            HazardSeverity.CRITICAL.value: "EMERGENCY TSUNAMI WARNING: Inundation threat imminent. Move immediately to high ground or designated vertical evacuation shelters. Follow national disaster authority broadcasts.",
            HazardSeverity.HIGH.value: "TSUNAMI WATCH: Strong marine currents and rapid coastal sea-level withdrawal possible. Clear beaches and harbors immediately.",
            HazardSeverity.MODERATE.value: "TSUNAMI ADVISORY: Dangerous marine currents in coastal bays and estuaries. Stay away from water's edge.",
            HazardSeverity.LOW.value: "NOMINAL: No tsunami warning bulletin issued."
        },
        HazardType.SST_ANOMALY.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL ANOMALY: Severe thermal marine heatwave / localized spike. Check sensor calibration and notify oceanographic monitoring network.",
            HazardSeverity.HIGH.value: "HIGH ANOMALY: Significant thermal departure from historical baseline. High risk of coral bleaching and altered fish migration.",
            HazardSeverity.MODERATE.value: "ADVISORY: Moderate sea temperature anomaly detected relative to 15-year climatology.",
            HazardSeverity.LOW.value: "NOMINAL: Sea surface temperatures tracking seasonal baseline."
        },
        HazardType.SALINITY_ANOMALY.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL ANOMALY: Extreme salinity excursion. Possible freshwater lens or hypersaline sensor anomaly.",
            HazardSeverity.HIGH.value: "HIGH ANOMALY: Substantial salinity deviation outside World Ocean Atlas normal bounds.",
            HazardSeverity.MODERATE.value: "ADVISORY: Minor regional salinity anomaly observed.",
            HazardSeverity.LOW.value: "NOMINAL: Salinity values conform to regional oceanographic baseline."
        },
        HazardType.CURRENT_ANOMALY.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL DANGER: Extreme ocean current shear. Strong drift hazard for ROVs, divers, and drifting array nodes.",
            HazardSeverity.HIGH.value: "HIGH RISK: Strong anomalous currents. Compensate drift trajectory for maritime navigation.",
            HazardSeverity.MODERATE.value: "ADVISORY: Elevated current speeds noted.",
            HazardSeverity.LOW.value: "NOMINAL: Surface circulation within normal bounds."
        },
        HazardType.RAPID_CHANGE.value: {
            HazardSeverity.CRITICAL.value: "CRITICAL ALERT: Explosive synoptic/oceanographic transition underway. Prepare for severe rapid weather deterioration.",
            HazardSeverity.HIGH.value: "HIGH RISK: Rapid barometric drop or thermal change. Conditions destabilizing quickly.",
            HazardSeverity.MODERATE.value: "ADVISORY: Notable rate-of-change detected in telemetry trends.",
            HazardSeverity.LOW.value: "NOMINAL: Stable atmospheric and oceanic rates of change."
        }
    }

    SEVERITY_ORDER = {
        HazardSeverity.LOW.value: 1,
        HazardSeverity.MODERATE.value: 2,
        HazardSeverity.HIGH.value: 3,
        HazardSeverity.CRITICAL.value: 4
    }

    @classmethod
    def evaluate_risk(
        cls,
        ocean_data: Dict[str, Any],
        custom_confidence_weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Executes hazard detection and computes synthesized risk profiles with confidence scores.
        """
        # 1. Run all deterministic hazard detectors
        detected_hazards = HazardDetectionService.scan_all_hazards(ocean_data)
        
        # Filter to confirmed detections
        active_detections = [h for h in detected_hazards if h.get("detected")]

        # 2. Extract confidence signals from metadata
        obs_count = int(ocean_data.get("observation_count", 1))
        agreeing_src = int(ocean_data.get("agreeing_sources", 1 if active_detections else 0))
        total_src = int(ocean_data.get("total_sources", 1))
        
        # Timestamp parsing
        obs_time = ocean_data.get("timestamp")
        if isinstance(obs_time, str):
            try:
                obs_time = datetime.fromisoformat(obs_time.replace("Z", "+00:00"))
            except Exception:
                obs_time = None

        quality_flags = {
            "has_valid_coordinates": ocean_data.get("latitude") is not None and ocean_data.get("longitude") is not None,
            "has_timestamp": obs_time is not None,
            "sensor_status": ocean_data.get("sensor_status", "operational"),
            "missing_fields_count": ocean_data.get("missing_fields_count", 0),
            "qc_passed": ocean_data.get("qc_passed", True),
            "spatial_consistency": ocean_data.get("spatial_consistency", 1.0)
        }

        # 3. Compute Evidence-Based Confidence Score
        confidence_result = ConfidenceService.evaluate_confidence(
            observation_count=obs_count,
            observation_timestamp=obs_time,
            quality_flags=quality_flags,
            agreeing_sources=agreeing_src,
            total_sources=total_src,
            forecast_aligned=ocean_data.get("forecast_aligned", True),
            forecast_confidence=float(ocean_data.get("forecast_confidence", 0.85)),
            custom_weights=custom_confidence_weights
        )

        conf_score = confidence_result["confidence_score"]
        conf_label = confidence_result["confidence_label"]

        if not active_detections:
            # No hazards detected -> NOMINAL
            return {
                "has_hazard": False,
                "primary_hazard": None,
                "risk_level": "LOW",
                "severity": HazardSeverity.LOW.value,
                "confidence_score": conf_score,
                "confidence_label": conf_label,
                "confidence_details": confidence_result,
                "detected_hazards": [],
                "evidence": ["All oceanographic and atmospheric sensor readings conform to verified baseline limits."],
                "recommended_action": "All maritime and scientific operations nominal. Continue standard telemetry monitoring.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "latitude": ocean_data.get("latitude"),
                "longitude": ocean_data.get("longitude"),
                "region": ocean_data.get("region", "Global Ocean Network")
            }

        # Select primary hazard by highest severity, then by priority
        primary = max(
            active_detections,
            key=lambda h: (cls.SEVERITY_ORDER.get(h.get("severity", "LOW"), 1), h.get("observed_value") or 0)
        )

        hazard_type = primary.get("hazard", "UNKNOWN")
        severity = primary.get("severity", HazardSeverity.LOW.value)

        # Determine risk level taking confidence into account:
        # High severity with low confidence is downgraded in operational urgency (caution / advisory)
        if severity == HazardSeverity.CRITICAL.value and conf_label == "HIGH":
            risk_level = "CRITICAL"
        elif severity in [HazardSeverity.CRITICAL.value, HazardSeverity.HIGH.value] and conf_label in ["HIGH", "MEDIUM"]:
            risk_level = "HIGH"
        elif severity == HazardSeverity.MODERATE.value or (severity == HazardSeverity.HIGH.value and conf_label == "LOW"):
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        # Action guidance
        guidance = cls.ACTION_GUIDANCE_MAP.get(hazard_type, {}).get(
            severity,
            "Follow official maritime safety guidance and monitor regional marine forecasts."
        )

        # Aggregate evidence across active detections
        all_evidence = []
        for d in active_detections:
            all_evidence.extend(d.get("evidence", []))

        return {
            "has_hazard": True,
            "primary_hazard": hazard_type,
            "risk_level": risk_level,
            "severity": severity,
            "confidence_score": conf_score,
            "confidence_label": conf_label,
            "confidence_details": confidence_result,
            "detected_hazards": active_detections,
            "evidence": all_evidence,
            "recommended_action": guidance,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": primary.get("source", "FloatChat Ocean Sensor Array"),
            "latitude": ocean_data.get("latitude"),
            "longitude": ocean_data.get("longitude"),
            "region": ocean_data.get("region", "Monitored Marine Sector")
        }
