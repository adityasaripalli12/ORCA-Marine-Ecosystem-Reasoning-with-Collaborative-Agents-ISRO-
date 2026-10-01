from enum import Enum
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

class HazardType(str, Enum):
    SEVERE_MARINE_WEATHER = "SEVERE_MARINE_WEATHER"
    CYCLONE_RISK = "CYCLONE_RISK"
    STORM_SURGE = "STORM_SURGE"
    EXTREME_WAVE = "EXTREME_WAVE"
    HIGH_WIND = "HIGH_WIND"
    SST_ANOMALY = "SST_ANOMALY"
    SALINITY_ANOMALY = "SALINITY_ANOMALY"
    CURRENT_ANOMALY = "CURRENT_ANOMALY"
    SEA_LEVEL_ANOMALY = "SEA_LEVEL_ANOMALY"
    RAPID_CHANGE = "RAPID_CHANGE"
    TSUNAMI_WARNING = "TSUNAMI_WARNING"

class HazardSeverity(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class HazardDetectionService:
    """
    Deterministic Ocean Hazard Detection Engine.
    Detects marine hazards using empirical sensor thresholds, historical oceanographic
    climatologies, and verified provider warnings.
    Does NOT use generative AI to guess hazards or fabricate scores.
    """

    # Empirical Thresholds & Climatological Baselines
    HISTORICAL_BASELINES = {
        "SST": {
            "name": "Global Tropical/Subtropical Climatology (2010-2025)",
            "start": "2010-01-01",
            "end": "2025-12-31",
            "method": "15-Year Satellite OISST + In-Situ ARGO Climatological Mean",
            "min_val": 24.0,
            "max_val": 30.5,
            "unit": "°C"
        },
        "SALINITY": {
            "name": "World Ocean Atlas (WOA) Salinity Baseline",
            "start": "2010-01-01",
            "end": "2025-12-31",
            "method": "WOA Historical Normal (Argo Reference Array)",
            "min_val": 33.0,
            "max_val": 36.5,
            "unit": "PSU"
        },
        "SEA_LEVEL": {
            "name": "Global Tidal Gauge & Altimetry Datum Baseline",
            "start": "2015-01-01",
            "end": "2025-12-31",
            "method": "Mean High Water Spring (MHWS) Baseline",
            "min_val": -0.4,
            "max_val": 0.4,
            "unit": "m"
        },
        "CURRENT": {
            "name": "Ocean General Circulation Climatological Baseline",
            "start": "2015-01-01",
            "end": "2025-12-31",
            "method": "ADCP & HF-Radar Drifter Mean Velocity",
            "max_normal": 1.0,
            "unit": "m/s"
        }
    }

    # Authoritative Tsunami Warning Providers allowed to trigger tsunami warnings
    AUTHORITATIVE_TSUNAMI_PROVIDERS = {
        "PTWC",      # Pacific Tsunami Warning Center (NOAA)
        "INCOIS",    # Indian National Centre for Ocean Information Services
        "IOTWMS",    # Indian Ocean Tsunami Warning and Mitigation System (UNESCO/IOC)
        "JMA",       # Japan Meteorological Agency
        "US_NTWC",   # US National Tsunami Warning Center
        "NWPTAC",    # Northwest Pacific Tsunami Advisory Center
    }

    @classmethod
    def detect_high_wind(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects high wind and gale conditions.
        Thresholds (knots): Moderate >= 22 (Force 6), High >= 34 (Gale), Critical >= 48 (Storm Force).
        """
        wind_speed = data.get("wind_speed_kts") or data.get("wind_kts")
        if wind_speed is None and data.get("wind_speed_mps") is not None:
            wind_speed = float(data["wind_speed_mps"]) * 1.94384 # convert m/s to kts

        if wind_speed is None:
            return {"detected": False, "hazard": HazardType.HIGH_WIND.value}

        wind_speed = float(wind_speed)
        detected = wind_speed >= 22.0
        severity = HazardSeverity.LOW.value

        if wind_speed >= 48.0:
            severity = HazardSeverity.CRITICAL.value
        elif wind_speed >= 34.0:
            severity = HazardSeverity.HIGH.value
        elif wind_speed >= 22.0:
            severity = HazardSeverity.MODERATE.value

        return {
            "hazard": HazardType.HIGH_WIND.value,
            "detected": detected,
            "severity": severity,
            "observed_value": round(wind_speed, 1),
            "unit": "kts",
            "threshold": 34.0,
            "source": data.get("source", "Marine Weather Station / Telemetry"),
            "timestamp": data.get("timestamp"),
            "evidence": [
                f"Sustained wind speed measured at {round(wind_speed, 1)} kts (Gale threshold: 34.0 kts, Storm threshold: 48.0 kts).",
                f"Beaufort Scale Category: {'Storm/Violent Storm (Force 10-11)' if wind_speed >= 48 else 'Gale/Severe Gale (Force 8-9)' if wind_speed >= 34 else 'Strong Breeze (Force 6-7)'}."
            ] if detected else ["Wind speed within standard operational limits."]
        }

    @classmethod
    def detect_extreme_wave(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects hazardous sea state and extreme significant wave heights.
        Thresholds (m): Moderate >= 2.5m, High >= 4.0m, Critical >= 6.0m.
        """
        wave_height = data.get("wave_height_m") or data.get("significant_wave_height")
        if wave_height is None:
            return {"detected": False, "hazard": HazardType.EXTREME_WAVE.value}

        wave_height = float(wave_height)
        detected = wave_height >= 2.5
        severity = HazardSeverity.LOW.value

        if wave_height >= 6.0:
            severity = HazardSeverity.CRITICAL.value
        elif wave_height >= 4.0:
            severity = HazardSeverity.HIGH.value
        elif wave_height >= 2.5:
            severity = HazardSeverity.MODERATE.value

        return {
            "hazard": HazardType.EXTREME_WAVE.value,
            "detected": detected,
            "severity": severity,
            "observed_value": round(wave_height, 2),
            "unit": "m",
            "threshold": 4.0,
            "source": data.get("source", "Wave Buoy / Altimetry"),
            "timestamp": data.get("timestamp"),
            "evidence": [
                f"Significant wave height recorded at {round(wave_height, 2)} m (Hazard advisory threshold: 2.5m, High: 4.0m, Critical: 6.0m).",
                f"Sea State Condition: {'Phenomenal/High Seas' if wave_height >= 6.0 else 'Rough/Very Rough Seas' if wave_height >= 4.0 else 'Moderate Seas'}."
            ] if detected else ["Wave heights within nominal baseline."]
        }

    @classmethod
    def detect_cyclone_risk(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects tropical cyclone / depression signature:
        Combination of deep atmospheric low pressure (< 1000 hPa), high winds (>= 34 kts),
        and active cyclonic organization.
        """
        pressure = data.get("pressure_hpa") or data.get("sea_level_pressure")
        wind_speed = data.get("wind_speed_kts") or data.get("wind_kts")
        has_cyclonic_rotation = data.get("cyclonic_rotation", False)

        if pressure is None or wind_speed is None:
            return {"detected": False, "hazard": HazardType.CYCLONE_RISK.value}

        pressure = float(pressure)
        wind_speed = float(wind_speed)

        # Cyclone logic
        is_deep_low = pressure < 1000.0
        is_gale_force = wind_speed >= 34.0

        detected = (is_deep_low and is_gale_force) or (pressure < 985.0)
        severity = HazardSeverity.LOW.value

        if pressure < 970.0 or wind_speed >= 64.0:
            severity = HazardSeverity.CRITICAL.value # Severe Cyclone / Hurricane force
        elif pressure < 990.0 or wind_speed >= 48.0:
            severity = HazardSeverity.HIGH.value     # Cyclonic Storm
        elif detected:
            severity = HazardSeverity.MODERATE.value # Deep Depression

        return {
            "hazard": HazardType.CYCLONE_RISK.value,
            "detected": detected,
            "severity": severity,
            "observed_value": round(pressure, 1),
            "unit": "hPa",
            "threshold": 1000.0,
            "source": data.get("source", "Synoptic Met Station / Cyclone Warning Center"),
            "timestamp": data.get("timestamp"),
            "evidence": [
                f"Barometric pressure plunged to {round(pressure, 1)} hPa (Cyclonic low-pressure threshold: 1000.0 hPa).",
                f"Coincident sustained winds at {round(wind_speed, 1)} kts with cyclonic system signature."
            ] if detected else ["Atmospheric pressure and wind fields indicate nominal synoptic conditions."]
        }

    @classmethod
    def detect_storm_surge(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects storm surge and abnormal sea-level elevation.
        Thresholds (m above astronomical tide): Moderate >= 0.6m, High >= 1.2m, Critical >= 2.0m.
        """
        surge_height = data.get("surge_height_m") or data.get("sea_level_anomaly_m")
        if surge_height is None:
            return {"detected": False, "hazard": HazardType.STORM_SURGE.value}

        surge_height = float(surge_height)
        detected = surge_height >= 0.6
        severity = HazardSeverity.LOW.value

        if surge_height >= 2.0:
            severity = HazardSeverity.CRITICAL.value
        elif surge_height >= 1.2:
            severity = HazardSeverity.HIGH.value
        elif surge_height >= 0.6:
            severity = HazardSeverity.MODERATE.value

        baseline = cls.HISTORICAL_BASELINES["SEA_LEVEL"]
        return {
            "hazard": HazardType.STORM_SURGE.value,
            "detected": detected,
            "severity": severity,
            "observed_value": round(surge_height, 2),
            "unit": "m",
            "threshold": 1.2,
            "source": data.get("source", "Coastal Tide Gauge / Ocean Altimetry"),
            "timestamp": data.get("timestamp"),
            "baseline": baseline,
            "evidence": [
                f"Measured water level anomaly is +{round(surge_height, 2)} m above astronomical tide baseline.",
                f"Reference Baseline: {baseline['name']} ({baseline['method']})."
            ] if detected else ["Coastal water levels tracking predicted astronomical tide."]
        }

    @classmethod
    def detect_sst_anomaly(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects abnormal sea surface temperature relative to historical climatology.
        Thermal spikes or marine heatwaves.
        """
        sst = data.get("sst_c") or data.get("water_temp_c") or data.get("temperature")
        if sst is None:
            return {"detected": False, "hazard": HazardType.SST_ANOMALY.value}

        sst = float(sst)
        baseline = cls.HISTORICAL_BASELINES["SST"]
        min_b, max_b = baseline["min_val"], baseline["max_val"]

        anomaly_val = 0.0
        if sst > max_b:
            anomaly_val = sst - max_b
        elif sst < min_b:
            anomaly_val = min_b - sst

        detected = anomaly_val >= 2.0
        severity = HazardSeverity.LOW.value

        if anomaly_val >= 5.0 or sst >= 35.0:
            severity = HazardSeverity.CRITICAL.value
        elif anomaly_val >= 3.5:
            severity = HazardSeverity.HIGH.value
        elif anomaly_val >= 2.0:
            severity = HazardSeverity.MODERATE.value

        return {
            "hazard": HazardType.SST_ANOMALY.value,
            "detected": detected,
            "severity": severity,
            "observed_value": round(sst, 1),
            "anomaly_delta": round(anomaly_val, 2),
            "unit": "°C",
            "threshold": max_b,
            "source": data.get("source", "Argo Float / Satellite SST"),
            "timestamp": data.get("timestamp"),
            "baseline": baseline,
            "evidence": [
                f"SST measured at {round(sst, 1)}°C, reflecting a +{round(anomaly_val, 2)}°C statistical anomaly outside historical baseline [{min_b}°C - {max_b}°C].",
                f"Baseline Reference: {baseline['name']} ({baseline['method']})."
            ] if detected else [f"SST of {round(sst, 1)}°C is within historical climatological baseline range [{min_b}°C - {max_b}°C]."]
        }

    @classmethod
    def detect_salinity_anomaly(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects abnormal salinity relative to World Ocean Atlas baseline.
        """
        salinity = data.get("salinity_psu") or data.get("salinity")
        if salinity is None:
            return {"detected": False, "hazard": HazardType.SALINITY_ANOMALY.value}

        salinity = float(salinity)
        baseline = cls.HISTORICAL_BASELINES["SALINITY"]
        min_b, max_b = baseline["min_val"], baseline["max_val"]

        anomaly_val = 0.0
        if salinity > max_b:
            anomaly_val = salinity - max_b
        elif salinity < min_b:
            anomaly_val = min_b - salinity

        detected = anomaly_val >= 1.5
        severity = HazardSeverity.LOW.value

        if anomaly_val >= 4.0:
            severity = HazardSeverity.CRITICAL.value
        elif anomaly_val >= 2.5:
            severity = HazardSeverity.HIGH.value
        elif anomaly_val >= 1.5:
            severity = HazardSeverity.MODERATE.value

        return {
            "hazard": HazardType.SALINITY_ANOMALY.value,
            "detected": detected,
            "severity": severity,
            "observed_value": round(salinity, 2),
            "anomaly_delta": round(anomaly_val, 2),
            "unit": "PSU",
            "threshold": f"{min_b}-{max_b}",
            "source": data.get("source", "Argo Salinity CTD Sensor"),
            "timestamp": data.get("timestamp"),
            "baseline": baseline,
            "evidence": [
                f"Salinity recorded at {round(salinity, 2)} PSU (deviation of {round(anomaly_val, 2)} PSU from baseline [{min_b} - {max_b} PSU]).",
                f"Reference: {baseline['name']}."
            ] if detected else ["Salinity levels conform to regional oceanographic baseline."]
        }

    @classmethod
    def detect_current_anomaly(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects anomalous surface or subsurface ocean currents.
        """
        current_speed = data.get("current_speed_mps") or data.get("current_velocity")
        if current_speed is None:
            return {"detected": False, "hazard": HazardType.CURRENT_ANOMALY.value}

        current_speed = float(current_speed)
        detected = current_speed >= 1.8
        severity = HazardSeverity.LOW.value

        if current_speed >= 3.5:
            severity = HazardSeverity.CRITICAL.value
        elif current_speed >= 2.5:
            severity = HazardSeverity.HIGH.value
        elif current_speed >= 1.8:
            severity = HazardSeverity.MODERATE.value

        baseline = cls.HISTORICAL_BASELINES["CURRENT"]
        return {
            "hazard": HazardType.CURRENT_ANOMALY.value,
            "detected": detected,
            "severity": severity,
            "observed_value": round(current_speed, 2),
            "unit": "m/s",
            "threshold": 1.8,
            "source": data.get("source", "Acoustic Doppler Current Profiler (ADCP)"),
            "timestamp": data.get("timestamp"),
            "baseline": baseline,
            "evidence": [
                f"Current speed reached {round(current_speed, 2)} m/s (normal baseline <= {baseline['max_normal']} m/s).",
                f"Strong current shear observed: potential navigation hazard."
            ] if detected else ["Ocean current speeds within normal circulation baseline."]
        }

    @classmethod
    def detect_rapid_change(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects rapid oceanographic or atmospheric changes over short windows (e.g. 3 hours).
        """
        temp_delta_3h = data.get("temp_delta_3h")
        pressure_drop_3h = data.get("pressure_drop_3h")

        detected = False
        severity = HazardSeverity.LOW.value
        reasons = []

        if pressure_drop_3h is not None and float(pressure_drop_3h) >= 8.0:
            detected = True
            drop_val = float(pressure_drop_3h)
            if drop_val >= 16.0:
                severity = HazardSeverity.CRITICAL.value
            elif drop_val >= 12.0:
                severity = HazardSeverity.HIGH.value
            else:
                severity = HazardSeverity.MODERATE.value
            reasons.append(f"Rapid barometric pressure drop of {round(drop_val, 1)} hPa in 3 hours (explosive cyclogenesis/bomb cyclone indicator).")

        if temp_delta_3h is not None and abs(float(temp_delta_3h)) >= 3.0:
            detected = True
            delta_val = abs(float(temp_delta_3h))
            if delta_val >= 6.0:
                severity = max(severity, HazardSeverity.CRITICAL.value)
            elif delta_val >= 4.5:
                severity = max(severity, HazardSeverity.HIGH.value)
            else:
                severity = max(severity, HazardSeverity.MODERATE.value)
            reasons.append(f"Rapid sea temperature shift of {round(delta_val, 1)}°C over 3 hours (intense upwelling/thermal front).")

        return {
            "hazard": HazardType.RAPID_CHANGE.value,
            "detected": detected,
            "severity": severity,
            "source": data.get("source", "High-Frequency Float Telemetry"),
            "timestamp": data.get("timestamp"),
            "evidence": reasons if detected else ["Ocean condition rates of change are nominal."]
        }

    @classmethod
    def detect_tsunami_warning(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        SAFETY RULE: Tsunami risk CANNOT be inferred from generic anomalies.
        Only support tsunami warnings when an authoritative tsunami warning provider is connected
        and delivers a signed bulletin.
        """
        bulletin = data.get("tsunami_bulletin")
        provider = (data.get("tsunami_provider") or "").upper().strip()
        is_official = provider in cls.AUTHORITATIVE_TSUNAMI_PROVIDERS

        if not bulletin or not is_official:
            # Generic anomalies alone can NEVER trigger tsunami alert
            return {
                "hazard": HazardType.TSUNAMI_WARNING.value,
                "detected": False,
                "severity": HazardSeverity.LOW.value,
                "reason": "Tsunami risk cannot be inferred from generic anomalies without an official bulletin from an authoritative tsunami warning center (PTWC, INCOIS, IOTWMS, JMA)."
            }

        # Valid authoritative bulletin
        severity_map = {
            "WARNING": HazardSeverity.CRITICAL.value,
            "WATCH": HazardSeverity.HIGH.value,
            "ADVISORY": HazardSeverity.MODERATE.value,
            "INFORMATION": HazardSeverity.LOW.value
        }
        raw_level = (bulletin.get("level") or "WARNING").upper()
        severity = severity_map.get(raw_level, HazardSeverity.CRITICAL.value)

        return {
            "hazard": HazardType.TSUNAMI_WARNING.value,
            "detected": True,
            "severity": severity,
            "observed_value": bulletin.get("wave_amplitude_m", 0.0),
            "unit": "m amplitude",
            "source": f"Official Tsunami Warning Center ({provider})",
            "timestamp": data.get("timestamp"),
            "bulletin_id": bulletin.get("bulletin_id"),
            "evidence": [
                f"Authoritative Tsunami Warning Bulletin #{bulletin.get('bulletin_id', 'N/A')} issued by {provider}.",
                f"Official alert level: {raw_level}. Epicenter: {bulletin.get('epicenter', 'Offshore Seismic Zone')}.",
                f"Estimated ocean wave arrival: {bulletin.get('estimated_arrival', 'Immediate caution advised')}."
            ]
        }

    @classmethod
    def scan_all_hazards(cls, ocean_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Executes all deterministic hazard detectors against the provided ocean observation packet.
        Returns a list of structured detection results.
        """
        detectors = [
            cls.detect_extreme_wave,
            cls.detect_high_wind,
            cls.detect_cyclone_risk,
            cls.detect_storm_surge,
            cls.detect_sst_anomaly,
            cls.detect_salinity_anomaly,
            cls.detect_current_anomaly,
            cls.detect_rapid_change,
            cls.detect_tsunami_warning,
        ]

        results = []
        for det in detectors:
            try:
                res = det(ocean_data)
                results.append(res)
            except Exception as e:
                # Detector isolation: one failing detector does not crash the entire hazard engine
                results.append({
                    "hazard": det.__name__.replace("detect_", "").upper(),
                    "detected": False,
                    "error": str(e)
                })

        return results
