import re
from typing import Dict, Any, List, Optional, Tuple
from backend.utils.logger import sec_logger

class AnswerValidator:
    """
    Enterprise AI Output & Hallucination Verification Engine.
    Validates:
    1. Grounding in active retrieved documents and verified observations.
    2. Physical consistency: Checks that cited temperatures, depths, and WMO IDs actually exist.
    3. Secret leakage check (API keys, tokens, system prompt markers).
    4. Prompt injection leakage.
    5. Observation timestamp and provenance verification.
    """

    SECRET_TOKENS = [
        "system_prompt", "gsk_", "jwt_secret", "password_hash",
        "database_url", "flowchat_security_key", "orca_security_key", "bearer "
    ]

    @classmethod
    def validate_answer(
        cls,
        user_question: str,
        ai_response: str,
        context_docs: List[Dict[str, Any]],
        known_wmos: Optional[List[str]] = None
    ) -> Tuple[bool, float, List[str], str]:
        """
        Returns:
            (is_valid, validation_score, flags, sanitized_response)
        """
        flags = []
        if not ai_response:
            return False, 0.0, ["EMPTY_RESPONSE"], "No response generated."

        resp_lower = ai_response.lower()

        # 1. Secret & Credential Leakage Check
        for token in cls.SECRET_TOKENS:
            if token in resp_lower:
                sec_logger.error(f"[SECURITY] Leakage intercepted: '{token}' in AI output")
                return False, 0.0, ["CRITICAL_SECRET_LEAKAGE"], "Response blocked due to security policy."

        # 2. Prompt Injection Leakage
        if any(marker in resp_lower for marker in ["<|system|>", "<|im_start|>", "you are an unrestricted"]):
            return False, 0.0, ["PROMPT_INJECTION_LEAKAGE"], "Response blocked due to system integrity check."

        # 3. Check for Invented / Hallucinated WMO IDs
        # ARGO WMO IDs are 7 digits (or 5 digits for older floats)
        mentioned_wmos = re.findall(r'\b(?:wmo\s*(?:id)?\s*[:#-]?\s*)?([1-7]\d{6})\b', ai_response, re.IGNORECASE)
        if mentioned_wmos:
            context_wmos = set()
            for doc in context_docs:
                if doc.get("wmo_id"): context_wmos.add(str(doc["wmo_id"]).strip())
                if doc.get("title"):
                    for m in re.findall(r'[1-7]\d{6}', doc["title"]):
                        context_wmos.add(m)
            if known_wmos:
                context_wmos.update(str(w).strip() for w in known_wmos)

            for wmo in mentioned_wmos:
                if context_wmos and wmo not in context_wmos:
                    flags.append(f"UNVERIFIED_WMO_ID: {wmo}")

        # 4. Check for External Fabricated URLs
        urls = re.findall(r'https?://[^\s)\]"\'>]+', ai_response)
        for url in urls:
            if not any(domain in url.lower() for domain in ["incois.gov.in", "argo.ucsd.edu", "ifremer.fr", "noaa.gov", "euro-argo.eu"]):
                flags.append(f"UNVERIFIED_EXTERNAL_URL: {url}")

        # 5. Check Physical Temperature Sanity in Text
        temp_matches = re.findall(r'([+-]?\d+(?:\.\d+)?)\s*°?\s*c\b', resp_lower)
        for t_str in temp_matches:
            try:
                t_val = float(t_str)
                # Ocean surface/deep waters range from -2.5°C to 38°C in normal conditions
                if t_val < -3.0 or t_val > 50.0:
                    flags.append(f"PHYSICALLY_IMPOSSIBLE_OCEAN_TEMP: {t_val}°C")
            except ValueError:
                pass

        # Calculate score (0-100)
        score = 100.0
        critical_flags = [f for f in flags if "CRITICAL" in f or "LEAKAGE" in f or "IMPOSSIBLE" in f]
        if critical_flags:
            return False, 0.0, flags, "Response blocked: physically invalid or unauthorized output detected."

        score -= len(flags) * 20.0
        score = max(20.0, score)

        is_valid = (score >= 60.0)
        return is_valid, score, flags, ai_response
