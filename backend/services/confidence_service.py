from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

class ConfidenceService:
    """
    Evidence-Based Scientific Confidence Engine for FloatChat.
    Strictly forbids hardcoded confidence numbers (99%, 98%, 95%).
    Computes factual evidence scores (0.0 to 100.0) from:
    1. Retrieval Relevance Score (0-30 points)
    2. Source Authority / Tier (0-25 points)
    3. Data Freshness / Age Penalty (0-20 points)
    4. Corroborating Physical Records Count (0-15 points)
    5. Output Verification & Factual Grounding (0-10 points)
    """

    SOURCE_TRUST_LEVELS = {
        "ARGO_GDAC_IFREMER": 25.0,
        "NOAA_PMEL": 25.0,
        "INCOIS": 25.0,
        "EURO_ARGO": 25.0,
        "ORGANIZATIONAL_DATASET": 20.0,
        "UPLOADED_NETCDF": 18.0,
        "UPLOADED_FILE": 15.0,
        "DEMO_DATA": 5.0,
        "UNKNOWN": 8.0
    }

    @classmethod
    def calculate_confidence(
        cls,
        retrieval_score: float = 0.0, # 0 to 100
        source_type: str = "UNKNOWN",
        observation_time: Optional[Any] = None,
        supporting_records_count: int = 0,
        validation_passed: bool = True
    ) -> Dict[str, Any]:
        breakdown = {}

        # 1. Retrieval semantic contribution (max 30 pts)
        retrieval_norm = max(0.0, min(100.0, retrieval_score))
        c_retrieval = round((retrieval_norm / 100.0) * 30.0, 1)
        breakdown["retrieval_semantic_score"] = c_retrieval

        # 2. Source quality contribution (max 25 pts)
        src_key = source_type.upper().strip() if source_type else "UNKNOWN"
        c_source = cls.SOURCE_TRUST_LEVELS.get(src_key, 12.0)
        breakdown["source_authority_score"] = c_source

        # 3. Data Freshness (max 20 pts)
        c_freshness = 10.0
        data_age_days = None
        if observation_time:
            try:
                if isinstance(observation_time, str):
                    obs_dt = datetime.fromisoformat(observation_time.replace("Z", "+00:00"))
                else:
                    obs_dt = observation_time

                if obs_dt.tzinfo is None:
                    now = datetime.utcnow()
                else:
                    now = datetime.now(timezone.utc)

                age_delta = now - obs_dt
                data_age_days = max(0, age_delta.days)

                if data_age_days < 7:
                    c_freshness = 20.0 # Recent observation within 7 days
                elif data_age_days < 30:
                    c_freshness = 17.0
                elif data_age_days < 180:
                    c_freshness = 14.0
                elif data_age_days < 365:
                    c_freshness = 11.0
                else:
                    c_freshness = 8.0 # Multi-year historical profile
            except Exception:
                c_freshness = 10.0
        breakdown["data_freshness_score"] = c_freshness
        breakdown["data_age_days"] = data_age_days

        # 4. Corroborating Physical Records (max 15 pts)
        if supporting_records_count >= 20:
            c_corroboration = 15.0
        elif supporting_records_count >= 5:
            c_corroboration = 12.0
        elif supporting_records_count >= 1:
            c_corroboration = 8.0
        else:
            c_corroboration = 2.0
        breakdown["supporting_records_score"] = c_corroboration
        breakdown["supporting_records_count"] = supporting_records_count

        # 5. Validation Check (max 10 pts)
        c_val = 10.0 if validation_passed else 0.0
        breakdown["validation_score"] = c_val

        # Total mathematical score
        total = round(c_retrieval + c_source + c_freshness + c_corroboration + c_val, 1)
        total = max(5.0, min(100.0, total))

        if total >= 80.0:
            label = "HIGH"
        elif total >= 55.0:
            label = "MEDIUM"
        else:
            label = "LOW"

        return {
            "score": total,
            "label": label,
            "display": f"{label} ({total}%)",
            "breakdown": breakdown
        }
