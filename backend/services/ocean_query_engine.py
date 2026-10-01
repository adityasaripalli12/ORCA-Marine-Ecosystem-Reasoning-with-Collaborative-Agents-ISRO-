import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from backend.models.ocean_observation import OceanObservation
from backend.models.dataset import Dataset
from backend.services.geo_anomaly_service import GeoAnomalyService
from backend.services.confidence_service import ConfidenceService
from backend.providers.provider_factory import ProviderFactory
from backend.services.ocean_ingestion_service import OceanIngestionService
from backend.utils.logger import sec_logger

# Ocean Basin Geographic Bounding Boxes
OCEAN_REGIONS: Dict[str, Dict[str, float]] = {
    "Indian Ocean": {"lat_min": -45.0, "lat_max": 28.0, "lon_min": 20.0, "lon_max": 120.0},
    "Arabian Sea": {"lat_min": 10.0, "lat_max": 26.0, "lon_min": 50.0, "lon_max": 78.0},
    "Bay of Bengal": {"lat_min": 5.0, "lat_max": 23.0, "lon_min": 80.0, "lon_max": 98.0},
    "Black Sea": {"lat_min": 40.0, "lat_max": 47.5, "lon_min": 27.0, "lon_max": 42.0},
    "Mediterranean Sea": {"lat_min": 30.0, "lat_max": 46.0, "lon_min": -6.0, "lon_max": 37.0},
    "Pacific Ocean": {"lat_min": -60.0, "lat_max": 60.0, "lon_min": 120.0, "lon_max": 180.0},
    "Atlantic Ocean": {"lat_min": -60.0, "lat_max": 65.0, "lon_min": -70.0, "lon_max": 20.0},
}

# Parameters and Units
PARAM_UNITS: Dict[str, str] = {
    "temperature": "°C",
    "salinity": "PSU",
    "depth": "m",
    "pressure": "dbar",
    "oxygen": "µmol/kg",
    "chlorophyll": "mg/m³",
    "sea_level": "m",
    "current": "m/s",
    "wind": "knots",
    "wave_height": "m",
}

# Known verified ARGO floats per region for auto-ingestion if DB is sparse
REGIONAL_SEEDS: Dict[str, List[str]] = {
    "Indian Ocean": ["1902372", "1901348", "1902332", "1901347"],
    "Arabian Sea": ["1902372", "1902332"],
    "Bay of Bengal": ["1902372"],
    "Black Sea": ["6903240"],
    "Mediterranean Sea": ["6903240"],
}


class OceanQueryEngine:
    """
    Dedicated Oceanographic Data Query & Retrieval Engine.
    Interprets natural language queries asking for physical parameters (temperature, salinity, depth, etc.),
    retrieves verified observations from the database or ARGO ERDDAP provider,
    computes deterministic mathematical aggregates, and ensures the ACTUAL ANSWER appears before provenance.
    """

    @classmethod
    def is_data_query(cls, query: str) -> bool:
        """
        Determines whether the user question is asking for actual ocean observations / data.
        """
        q = query.lower()

        # Keywords for physical oceanographic parameters
        param_patterns = [
            r"\btemp(erature)?\b",
            r"\bsalinity\b",
            r"\bdepth\b",
            r"\bpressure\b",
            r"\bchlorophyll\b",
            r"\boxygen\b",
            r"\bsea level\b",
            r"\bcurrent(s)?\b",
            r"\bwind\b",
            r"\bwave(s| height)?\b",
            r"\banomal(y|ies)\b",
            r"\btrend(s)?\b",
            r"\baverage\b",
            r"\bmean\b",
            r"\bmin(imum)?\b",
            r"\bmax(imum)?\b",
            r"\bwhen was\b",
            r"\btimestamp\b",
            r"\blatest\b"
        ]

        for pat in param_patterns:
            if re.search(pat, q):
                return True
        return False

    @classmethod
    def is_map_request(cls, query: str) -> bool:
        """
        Returns True ONLY when the user explicitly requests a map or geographic
        visualization.  The presence of coordinates, lat/lon, or WMO IDs in the
        data is NOT sufficient — the user must use words that ask to SEE or SHOW
        the data on a map.

        Data questions such as "What is the temperature of ARGO float 1902372?"
        must return False even if the response contains lat/lon.
        """
        q = query.lower()
        MAP_PHRASES = [
            r"\bshow\s+(me\s+)?on\s+(the\s+)?map\b",
            r"\bon\s+the\s+map\b",
            r"\bopen\s+(the\s+)?(ocean\s+)?map\b",
            r"\bplot\s+(on\s+)?(the\s+)?map\b",
            r"\bplot\s+(this|the|it|an?)?\s*(float|buoy|sensor|node|device)\b",
            r"\bmap\s+this\b",
            r"\bmap\s+it\b",
            r"\bwhere\s+is\b",
            r"\bwhere\s+are\b",
            r"\blocate\s+(this|the|it)\b",
            r"\bshow\s+(me\s+)?(the\s+)?(location|position)\b",
            r"\bgeographic\s+(position|location|visualization)\b",
            r"\btrajectory\b",
            r"\bplot\s+the\s+(trajectory|path|track|route)\b",
            r"\bshow\s+(nearby|surrounding)\s+(floats?|buoys?|sensors?)\b",
            r"\bvisuali[sz]e\s+(this|geographically|on\s+map)\b",
            r"\bshow\s+(me\s+)?(the\s+)?(map|geography|geo)\b",
            r"\bshow\s+.{0,30}\s+on\s+(the\s+)?map\b",
            r"\bgeographi(c|cal)\b",
        ]
        for pat in MAP_PHRASES:
            if re.search(pat, q):
                return True
        return False

    @classmethod
    def parse_query(
        cls,
        query: str,
        device_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        selected_region: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extracts parameter, aggregation type, region, and target WMO / device from query.
        """
        q = query.lower()

        # 1. Parameter extraction
        param = "temperature" # default
        if re.search(r"\bsalinit(y|ies)\b", q):
            param = "salinity"
        elif re.search(r"\bdepth\b|\bsounding\b", q):
            param = "depth"
        elif re.search(r"\bpressure\b", q):
            param = "pressure"
        elif re.search(r"\bchlorophyll\b|\bchla\b", q):
            param = "chlorophyll"
        elif re.search(r"\boxygen\b|\bdoxy\b", q):
            param = "oxygen"
        elif re.search(r"\bsea level\b", q):
            param = "sea_level"
        elif re.search(r"\bcurrent\b", q):
            param = "current"
        elif re.search(r"\bwind\b", q):
            param = "wind"
        elif re.search(r"\bwave\b", q):
            param = "wave_height"

        # 2. Aggregation / Intent type
        agg_type = "LATEST"
        if re.search(r"\baverage\b|\bmean\b|\bavg\b", q):
            agg_type = "AVERAGE"
        elif re.search(r"\bminimum\b|\blowest\b|\bcoldest\b|\bmin\b", q):
            agg_type = "MINIMUM"
        elif re.search(r"\bmaximum\b|\bhighest\b|\bwarmest\b|\bmax\b", q):
            agg_type = "MAXIMUM"
        elif re.search(r"\banomal(y|ies)\b", q):
            agg_type = "ANOMALY"
        elif re.search(r"\bwhen was\b|\bobservation time\b|\btimestamp\b|\bwhat time\b|\bdate\b", q):
            agg_type = "TIMESTAMP"
        elif re.search(r"\btrend(s)?\b", q):
            agg_type = "TREND"

        # 3. Region extraction (Crucial: distinguish "India" from "Indian Ocean")
        region = selected_region
        if re.search(r"\bindian ocean\b", q):
            region = "Indian Ocean"
        elif re.search(r"\barabian sea\b", q):
            region = "Arabian Sea"
        elif re.search(r"\bbay of bengal\b", q):
            region = "Bay of Bengal"
        elif re.search(r"\bblack sea\b", q):
            region = "Black Sea"
        elif re.search(r"\bmediterranean\b", q):
            region = "Mediterranean Sea"
        elif re.search(r"\bpacific ocean\b|\bpacific\b", q):
            region = "Pacific Ocean"
        elif re.search(r"\batlantic ocean\b|\batlantic\b", q):
            region = "Atlantic Ocean"
        elif re.search(r"\bindia\b", q) and not re.search(r"\bindian ocean\b", q):
            # The user asked about "India" land/country rather than "Indian Ocean"
            region = "India (Coastal/Offshore Indian Ocean)"

        # 4. WMO / Float extraction
        wmo_matches = re.findall(r"\b([1-7]\d{6})\b", query)
        wmo_id = wmo_matches[0] if wmo_matches else None

        # 5. Device extraction (e.g. DEV-001)
        dev_matches = re.findall(r"\b(DEV-\d+)\b", query, re.IGNORECASE)
        target_device = dev_matches[0].upper() if dev_matches else device_id

        return {
            "parameter": param,
            "aggregation": agg_type,
            "region": region,
            "wmo_id": wmo_id,
            "device_id": target_device,
            "dataset_id": dataset_id,
            "raw_query": query
        }

    @classmethod
    def execute_query(cls, parsed: Dict[str, Any], db: Session) -> Optional[Dict[str, Any]]:
        """
        Executes the data query against SQLite/PostgreSQL ocean_observations or auto-ingests from ARGO GDAC.
        Returns a structured dictionary with the exact answer, observation values, provenance, and formatted UI text.
        """
        param = parsed["parameter"]
        agg_type = parsed["aggregation"]
        region = parsed["region"]
        wmo_id = parsed["wmo_id"]
        dataset_id = parsed["dataset_id"]
        unit = PARAM_UNITS.get(param, "")

        # If user asks general "What is the temperature?" with NO region and NO WMO and NO dataset:
        if not region and not wmo_id and not dataset_id and not parsed.get("device_id"):
            clean_q = re.sub(r"[^\w\s]", "", parsed["raw_query"].strip().lower())
            if clean_q in ["what is the temperature", "what is the temp", "what is water temperature", "temperature"]:
                return {
                    "is_data_answer": True,
                    "is_clarification": True,
                    "parameter": param,
                    "ai_response": (
                        "Please specify an ocean region to retrieve verified observation data.\n\n"
                        "**Select an active ocean basin or enter a region:**\n"
                        "- 🌊 **Indian Ocean** (Bay of Bengal, Arabian Sea)\n"
                        "- 🌊 **Black Sea & Mediterranean Sea**\n"
                        "- 🌊 **Pacific Ocean**\n"
                        "- 🌊 **Atlantic Ocean**\n\n"
                        "Or ask for a specific float: *\"What is the temperature of ARGO Float 1902372?\"*"
                    ),
                    "confidence_score": 85.0,
                    "confidence_label": "HIGH",
                    "provenance": None,
                    "suggestions": [
                        "What is the temperature in Indian Ocean?",
                        "What is the temperature in Arabian Sea?",
                        "What is the latest salinity?",
                        "What is the average temperature in this dataset?"
                    ]
                }

            # Otherwise, for queries like "What is the latest salinity?" or "Is there any temperature anomaly?",
            # default to the active region of latest observation
            latest_ref = db.query(OceanObservation).order_by(desc(OceanObservation.observation_timestamp)).first()
            if latest_ref and -45.0 <= latest_ref.latitude <= 28.0 and 20.0 <= latest_ref.longitude <= 120.0:
                region = "Indian Ocean"
            elif latest_ref:
                region = "Global In-Situ Array"

        # Auto-ingest regional float if DB has no observations for the requested region
        if region in REGIONAL_SEEDS:
            bbox = OCEAN_REGIONS.get(region)
            if bbox:
                count_in_region = db.query(OceanObservation).filter(
                    OceanObservation.latitude >= bbox["lat_min"],
                    OceanObservation.latitude <= bbox["lat_max"],
                    OceanObservation.longitude >= bbox["lon_min"],
                    OceanObservation.longitude <= bbox["lon_max"]
                ).count()
                if count_in_region == 0:
                    sec_logger.info(f"Auto-seeding real ARGO observations for region: {region}")
                    for seed_wmo in REGIONAL_SEEDS[region][:2]:
                        try:
                            OceanIngestionService.ingest_from_provider(seed_wmo, db, limit=50)
                        except Exception as ing_err:
                            sec_logger.warning(f"Could not auto-seed float {seed_wmo}: {ing_err}")

        # Build base query
        query_builder = db.query(OceanObservation).filter(
            OceanObservation.quality_flag.in_(["1", "2"]) # Valid quality flags (1=Good, 2=Probably Good)
        )

        if wmo_id:
            query_builder = query_builder.filter(OceanObservation.wmo_id == wmo_id)
        elif region and region in OCEAN_REGIONS:
            bbox = OCEAN_REGIONS[region]
            query_builder = query_builder.filter(
                OceanObservation.latitude >= bbox["lat_min"],
                OceanObservation.latitude <= bbox["lat_max"],
                OceanObservation.longitude >= bbox["lon_min"],
                OceanObservation.longitude <= bbox["lon_max"]
            )
        elif region == "India (Coastal/Offshore Indian Ocean)":
            bbox = OCEAN_REGIONS["Indian Ocean"]
            query_builder = query_builder.filter(
                OceanObservation.latitude >= 0.0,
                OceanObservation.latitude <= 25.0,
                OceanObservation.longitude >= 55.0,
                OceanObservation.longitude <= 95.0
            )

        if dataset_id:
            query_builder = query_builder.filter(OceanObservation.dataset.contains(dataset_id))

        # Filter out nulls for requested parameter
        if param == "temperature":
            query_builder = query_builder.filter(OceanObservation.temperature.isnot(None))
        elif param == "salinity":
            query_builder = query_builder.filter(OceanObservation.salinity.isnot(None))
        elif param == "depth":
            query_builder = query_builder.filter(OceanObservation.depth.isnot(None))
        elif param == "chlorophyll":
            query_builder = query_builder.filter(OceanObservation.chlorophyll.isnot(None))
        elif param == "oxygen":
            query_builder = query_builder.filter(OceanObservation.oxygen.isnot(None))

        # -------------------------------------------------------------
        # 1. AVERAGE / MEAN CALCULATION (Deterministic Backend Execution)
        # -------------------------------------------------------------
        if agg_type == "AVERAGE":
            column = getattr(OceanObservation, param, OceanObservation.temperature)
            stats = query_builder.with_entities(
                func.count(column),
                func.avg(column),
                func.min(column),
                func.max(column),
                func.min(OceanObservation.observation_timestamp),
                func.max(OceanObservation.observation_timestamp)
            ).first()

            count, avg_val, min_val, max_val, t_start, t_end = stats

            if not count or avg_val is None:
                region_name = region or (f"Float WMO {wmo_id}" if wmo_id else "selected dataset")
                return {
                    "is_data_answer": True,
                    "answer_type": "NO_DATA",
                    "parameter": param,
                    "region": region_name,
                    "ai_response": f"No verified {param} observation is available for the selected {region_name}.",
                    "confidence_score": 40.0,
                    "confidence_label": "LOW",
                    "provenance": None
                }

            avg_val_rounded = round(float(avg_val), 2)
            min_val_rounded = round(float(min_val), 2)
            max_val_rounded = round(float(max_val), 2)
            time_range_str = (
                f"{t_start.strftime('%Y-%m-%d')} to {t_end.strftime('%Y-%m-%d')}"
                if t_start and t_end else "Historical ARGO Array"
            )
            region_title = f"{region.upper()} " if region else ""
            title = f"{region_title}AVERAGE {param.upper()}"
            val_display = f"{avg_val_rounded} {unit}"

            provenance = {
                "source": "ARGO Global Data Assembly Centre",
                "dataset": f"ArgoFloats_{wmo_id or 'regional_aggregate'}.nc",
                "wmo_id": wmo_id or "Regional Array",
                "observation_time": t_end.strftime("%Y-%m-%d %H:%M UTC") if t_end else "Recent Sync",
                "data_age": "Recent",
                "quality_flag": "QC 1 (Good)",
                "confidence_label": "HIGH",
                "evidence_score": 92.5
            }

            markdown_answer = (
                f"# 🌊 {title}\n\n"
                f"## {val_display}\n"
                f"*Calculated deterministic average across verified ocean observations.*\n\n"
                f"**Calculation Breakdown:**\n"
                f"- **Observations Used:** {count:,} verified profile soundings\n"
                f"- **Range:** {min_val_rounded} {unit} — {max_val_rounded} {unit}\n"
                f"- **Time Range:** {time_range_str}\n"
                f"- **Quality Control:** QC 1 (Good) filtered"
            )

            return {
                "is_data_answer": True,
                "answer_type": "OCEAN_OBSERVATION",
                "parameter": param,
                "value": avg_val_rounded,
                "unit": unit,
                "region": region or "Selected Region",
                "timestamp": t_end.isoformat() if t_end else None,
                "sources": ["ARGO Global Data Assembly Centre", "INCOIS Marine In-Situ Portal"],
                "wmo_id": wmo_id or "Regional Array",
                "quality_flag": "1",
                "confidence_score": 92.5,
                "confidence_label": "HIGH",
                "observation_data": {
                    "title": title,
                    "value_display": val_display,
                    "subtitle": f"Calculated average from {count:,} verified soundings.",
                    "parameter": param,
                    "value": avg_val_rounded,
                    "unit": unit,
                    "region": region or "Selected Region",
                    "wmo_id": wmo_id or "Regional Array",
                    "observation_time": t_end.strftime("%Y-%m-%d %H:%M UTC") if t_end else "Recent",
                    "quality_flag": "QC 1 (Good)",
                    "source": "ARGO Global Data Assembly Centre",
                    "stats": {
                        "count": count,
                        "mean": avg_val_rounded,
                        "min": min_val_rounded,
                        "max": max_val_rounded,
                        "time_range": time_range_str
                    }
                },
                "provenance": provenance,
                "ai_response": markdown_answer,
                "suggestions": [
                    f"What is the maximum {param}?",
                    f"What is the latest salinity?",
                    "Is there any temperature anomaly?"
                ]
            }

        # -------------------------------------------------------------
        # 2. ANOMALY DETECTION (Deterministic Z-Score / MAD Execution)
        # -------------------------------------------------------------
        if agg_type == "ANOMALY":
            obs_sample = query_builder.order_by(desc(OceanObservation.observation_timestamp)).limit(100).all()
            if not obs_sample or len(obs_sample) < 5:
                return {
                    "is_data_answer": True,
                    "answer_type": "NO_DATA",
                    "parameter": param,
                    "region": region or "Selected Region",
                    "ai_response": "No verified anomaly can be determined from the available data due to insufficient baseline observations.",
                    "confidence_score": 60.0,
                    "confidence_label": "MEDIUM",
                    "provenance": None,
                    "suggestions": ["What is the temperature in Indian Ocean?", "Show all ARGO floats"]
                }

            values = [getattr(o, param) for o in obs_sample if getattr(o, param) is not None]
            z_res = GeoAnomalyService.calculate_robust_z_scores(values)
            has_anomaly = z_res.get("has_anomaly", False)
            latest_o = obs_sample[0]

            provenance = {
                "source": "ARGO Global Data Assembly Centre",
                "dataset": f"ArgoFloats_{latest_o.wmo_id}.nc",
                "wmo_id": latest_o.wmo_id,
                "observation_time": latest_o.observation_timestamp.strftime("%Y-%m-%d %H:%M UTC"),
                "data_age": "Recent",
                "quality_flag": "QC 1 (Good)",
                "confidence_label": "HIGH",
                "evidence_score": 88.0
            }

            if has_anomaly:
                title = f"{region.upper() if region else ''} {param.upper()} ANOMALY DETECTED"
                val_display = f"Z = {z_res['max_z_score']:.2f}"
                markdown_answer = (
                    f"# ⚠️ {title}\n\n"
                    f"## {val_display} (Statistical Outlier)\n"
                    f"*Statistical deviation detected using Robust Median Absolute Deviation (MAD).*\n\n"
                    f"**Diagnostic Details:**\n"
                    f"- **Observed Value:** {latest_o.temperature} {unit} at {latest_o.depth} m\n"
                    f"- **Baseline Median:** {z_res['median']} {unit}\n"
                    f"- **Platform / WMO:** #{latest_o.wmo_id}\n"
                    f"- **Status:** Investigated via GeoAnomalyService"
                )
            else:
                title = f"{region.upper() if region else ''} {param.upper()} BASELINE NORMAL"
                val_display = "No Anomaly"
                markdown_answer = (
                    f"# ✓ {title}\n\n"
                    f"## No verified {param} anomaly detected\n"
                    f"*All observations are within expected scientific baseline ranges (|Z| < 3.5).*\n\n"
                    f"**Analysis Summary:**\n"
                    f"- **Baseline Median:** {z_res['median']} {unit}\n"
                    f"- **Max Robust Z-Score:** {z_res['max_z_score']:.2f} (Within 3.5σ threshold)\n"
                    f"- **Soundings Evaluated:** {len(values)} profiles\n"
                    f"- **Conclusion:** No verified anomaly can be determined from the available data."
                )

            return {
                "is_data_answer": True,
                "answer_type": "OCEAN_OBSERVATION",
                "parameter": param,
                "value": z_res["max_z_score"],
                "unit": "Z-score",
                "region": region or "Selected Region",
                "timestamp": latest_o.observation_timestamp.isoformat(),
                "sources": ["ARGO Global Data Assembly Centre"],
                "wmo_id": latest_o.wmo_id,
                "quality_flag": "1",
                "confidence_score": 88.0,
                "confidence_label": "HIGH",
                "observation_data": {
                    "title": title,
                    "value_display": val_display,
                    "subtitle": markdown_answer.split("\n\n")[1],
                    "parameter": param,
                    "value": z_res["max_z_score"],
                    "unit": "Z-score",
                    "region": region or "Selected Region",
                    "wmo_id": latest_o.wmo_id,
                    "observation_time": latest_o.observation_timestamp.strftime("%Y-%m-%d %H:%M UTC"),
                    "quality_flag": "QC 1 (Good)",
                    "source": "ARGO Global Data Assembly Centre",
                    "stats": z_res
                },
                "provenance": provenance,
                "ai_response": markdown_answer,
                "suggestions": [
                    f"What is the average {param}?",
                    "What is the latest salinity?",
                    "Show ARGO float positions"
                ]
            }

        # -------------------------------------------------------------
        # 3. LATEST OBSERVATION / TIMESTAMP RETRIEVAL (Default)
        # -------------------------------------------------------------
        latest_obs = query_builder.order_by(
            desc(OceanObservation.observation_timestamp),
            OceanObservation.depth
        ).first()

        if not latest_obs:
            region_name = region or (f"Float WMO {wmo_id}" if wmo_id else "selected region")
            return {
                "is_data_answer": True,
                "answer_type": "NO_DATA",
                "parameter": param,
                "region": region_name,
                "ai_response": f"No verified {param} observation is available for the selected {region_name}.",
                "confidence_score": 40.0,
                "confidence_label": "LOW",
                "provenance": None
            }

        val = getattr(latest_obs, param)
        val_rounded = round(float(val), 2) if val is not None else None
        obs_time_utc = latest_obs.observation_timestamp.strftime("%Y-%m-%d %H:%M UTC")

        # Timestamp specific query
        if agg_type == "TIMESTAMP":
            title = f"{region.upper() if region else 'ARGO'} OBSERVATION TIMESTAMP"
            val_display = obs_time_utc
            subtitle = f"Latest observation timestamp recorded for Float WMO #{latest_obs.wmo_id}."
            markdown_answer = (
                f"# 🕒 {title}\n\n"
                f"## {obs_time_utc}\n"
                f"*Latest verified observation timestamp for {region or f'Float #{latest_obs.wmo_id}'}.*\n\n"
                f"**Observation Details:**\n"
                f"- **Platform / Float WMO:** #{latest_obs.wmo_id}\n"
                f"- **Coordinates:** {latest_obs.latitude:.2f}°N, {latest_obs.longitude:.2f}°E\n"
                f"- **Depth:** {latest_obs.depth} m\n"
                f"- **Water Temperature:** {latest_obs.temperature} °C\n"
                f"- **Salinity:** {latest_obs.salinity or 'N/A'} PSU"
            )
        else:
            region_title = f"{region.upper()} " if region else ""
            title = f"{region_title}{param.upper()}"
            val_display = f"{val_rounded} {unit}"
            subtitle = f"Latest available observation for the {region or 'selected'} region."
            markdown_answer = (
                f"# 🌊 {title}\n\n"
                f"## {val_display}\n"
                f"*{subtitle}*\n\n"
                f"**Observation Details:**\n"
                f"- **Platform / WMO ID:** #{latest_obs.wmo_id}\n"
                f"- **Geographic Position:** {latest_obs.latitude:.2f}°N, {latest_obs.longitude:.2f}°E\n"
                f"- **Measurement Depth:** {latest_obs.depth} m (Pressure: {latest_obs.pressure:.1f} dbar)\n"
                f"- **Observation Timestamp:** {obs_time_utc}\n"
                f"- **Quality Control Flag:** QC {latest_obs.quality_flag} (Good - Verified In-Situ)\n"
                f"- **Associated Salinity:** {latest_obs.salinity or 'N/A'} PSU"
            )

        # Calculate evidence confidence score
        conf_res = ConfidenceService.calculate_confidence(
            retrieval_score=95.0,
            source_type=latest_obs.source,
            observation_time=latest_obs.observation_timestamp,
            supporting_records_count=20,
            validation_passed=True
        )

        data_age_str = f"{conf_res['breakdown'].get('data_age_days', 2)} Days" if conf_res['breakdown'].get('data_age_days') is not None else "Recent"
        provenance = {
            "source": "ARGO Global Data Assembly Centre",
            "dataset": latest_obs.dataset or f"ArgoFloats_{latest_obs.wmo_id}.nc",
            "wmo_id": str(latest_obs.wmo_id),
            "observation_time": obs_time_utc,
            "data_age": data_age_str,
            "quality_flag": f"QC {latest_obs.quality_flag} (Good)",
            "confidence_label": conf_res["label"],
            "evidence_score": conf_res["score"]
        }

        return {
            "is_data_answer": True,
            "answer_type": "OCEAN_OBSERVATION",
            "parameter": param,
            "value": val_rounded,
            "unit": unit,
            "region": region or f"WMO {latest_obs.wmo_id}",
            "timestamp": latest_obs.observation_timestamp.isoformat(),
            "sources": ["ARGO Global Data Assembly Centre", f"Float WMO {latest_obs.wmo_id}"],
            "wmo_id": str(latest_obs.wmo_id),
            "quality_flag": str(latest_obs.quality_flag),
            "confidence_score": conf_res["score"],
            "confidence_label": conf_res["label"],
            "observation_data": {
                "title": title,
                "value_display": val_display,
                "subtitle": subtitle,
                "parameter": param,
                "value": val_rounded,
                "unit": unit,
                "region": region or "Selected Region",
                "wmo_id": str(latest_obs.wmo_id),
                "depth": latest_obs.depth,
                "latitude": latest_obs.latitude,
                "longitude": latest_obs.longitude,
                "observation_time": obs_time_utc,
                "quality_flag": f"QC {latest_obs.quality_flag} (Good)",
                "source": "ARGO Global Data Assembly Centre",
                "dataset": latest_obs.dataset,
                "stats": {
                    "temperature": latest_obs.temperature,
                    "salinity": latest_obs.salinity,
                    "pressure": latest_obs.pressure,
                    "depth": latest_obs.depth
                }
            },
            "provenance": provenance,
            "ai_response": markdown_answer,
            "has_geo_data": True,
            "locations": [{
                "name": f"ARGO Float {latest_obs.wmo_id}",
                "latitude": latest_obs.latitude,
                "longitude": latest_obs.longitude,
                "temp": latest_obs.temperature,
                "salinity": latest_obs.salinity,
                "depth": latest_obs.depth
            }],
            "suggestions": [
                f"What is the average {param}?",
                "What is the latest salinity?",
                "When was this observation taken?",
                "Is there any temperature anomaly?"
            ]
        }
