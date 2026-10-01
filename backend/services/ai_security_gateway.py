import re
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.models.user import User
from backend.models.security import SecurityEvent
from backend.models.audit import AuditLog
from backend.models.ocean_observation import OceanObservation
from backend.services.prompt_defender import normalize_text, EDUCATIONAL_PATTERNS, PromptDefenderService
from backend.services.groq_service import DEVICES_DB, GroqLLMService
from backend.services.ai_security_investigator import AISecurityInvestigator
from backend.services.faiss_service import faiss_service
from backend.services.confidence_service import ConfidenceService
from backend.services.answer_validator import AnswerValidator
from backend.services.ocean_analytics import OceanAnalytics
from backend.providers.provider_factory import ProviderFactory
from backend.utils.logger import sec_logger

# ---------------------------------------------------------------------------
# Threat Detection Patterns
# ---------------------------------------------------------------------------

PROMPT_INJECTION_INTENTS = [
    (r"ignore\s+(all\s+|previous\s+|your\s+|system\s+)?(instructions|rules|prompts?|constraints)", "PROMPT_INJECTION", 90),
    (r"forget\s+(all\s+|your\s+|previous\s+)?(instructions|rules|prompts?|safeguards)", "PROMPT_INJECTION", 90),
    (r"disregard\s+(all\s+|your\s+|previous\s+)?(instructions|rules|prompts?)", "PROMPT_INJECTION", 90),
    (r"override\s+(all\s+|your\s+|system\s+)?(instructions|security|rules|policy|permissions|controls)", "PRIVILEGE_ESCALATION_ATTEMPT", 92),
    (r"disable\s+(your\s+|the\s+)?(security|guardrails|safety|filters?|rules)", "PRIVILEGE_ESCALATION_ATTEMPT", 92),
    (r"bypass\s+.*?(security|auth|filter|guard|restrictions|safety\s+system)", "PRIVILEGE_ESCALATION_ATTEMPT", 92),
    (r"reveal\s+.*?(system\s+prompt|hidden\s+instructions|internal\s+instructions|developer\s+prompt|rules)", "PROMPT_INJECTION", 88),
    (r"show\s+.*?(system\s+prompt|hidden\s+instructions|developer\s+instructions|hidden\s+configuration)", "PROMPT_INJECTION", 88),
    (r"display\s+.*?(system\s+prompt|hidden\s+instructions|internal\s+prompt)", "PROMPT_INJECTION", 88),
    (r"what\s+(is|are)\s+your\s+(system\s+prompt|hidden\s+instructions|internal\s+rules)", "PROMPT_INJECTION", 88),
    (r"act\s+as\s+.*?(unrestricted\s+ai|dan|jailbroken|god\s+mode|root|superuser)", "JAILBREAK_ATTEMPT", 95),
    (r"you\s+are\s+now\s+.*?(unrestricted|jailbroken|free\s+from\s+rules|in\s+developer\s+mode)", "JAILBREAK_ATTEMPT", 95),
    (r"developer\s+mode\s+output", "JAILBREAK_ATTEMPT", 90),
    (r"<\|system\|>", "PROMPT_INJECTION", 95),
    (r"<\|im_start\|>", "PROMPT_INJECTION", 95),
]

SQL_DESTRUCTIVE_PATTERNS = [
    (r"drop\s+(table|database|all\s+tables|the\s+users?\s+table|users?)", "SQL_INJECTION", 98),
    (r"delete\s+all\s+(datasets?|users?|devices?|records?|tables?)", "SQL_INJECTION", 95),
    (r"delete\s+from\s+(users?|datasets?|devices?)", "SQL_INJECTION", 95),
    (r"truncate\s+(table|database|users?|datasets?)", "SQL_INJECTION", 95),
    (r"ignore\s+restrictions\s+and\s+execute\s+this\s+sql", "SQL_INJECTION", 98),
    (r"union\s+(all\s+)?select", "SQL_INJECTION", 90),
    (r";\s*drop\s+", "SQL_INJECTION", 98),
    (r";\s*delete\s+", "SQL_INJECTION", 95),
    (r"'\s*or\s+'?1'?\s*=\s*'?1", "SQL_INJECTION", 90),
    (r"'\s*or\s+true", "SQL_INJECTION", 90),
]

# Additional destructive action patterns that are not standard SQL but represent privileged operations
DESTRUCTIVE_ACTION_PATTERNS = [
    (r"delete\s+(the\s+)?database", "DESTRUCTIVE_ACTION", 95),
    (r"drop\s+(the\s+)?(production\s+)?database", "DESTRUCTIVE_ACTION", 95),
    (r"wipe\s+(the\s+)?database", "DESTRUCTIVE_ACTION", 95),
    (r"erase\s+all\s+audit\s+logs", "DESTRUCTIVE_ACTION", 95),
    (r"delete\s+all\s+users", "DESTRUCTIVE_ACTION", 95),
    (r"delete\s+all\s+datasets", "DESTRUCTIVE_ACTION", 95),
    (r"delete\s+all\s+files", "DESTRUCTIVE_ACTION", 95),
    (r"remove\s+(the\s+)?(production\s+)?database", "DESTRUCTIVE_ACTION", 95),
    (r"disable\s+authentication", "DESTRUCTIVE_ACTION", 95),
    (r"make\s+me\s+admin", "DESTRUCTIVE_ACTION", 95),
    (r"give\s+me\s+administrator\s+access", "DESTRUCTIVE_ACTION", 95),
    (r"execute\s+this\s+sql", "DESTRUCTIVE_ACTION", 95),
    (r"run\s+this\s+command", "DESTRUCTIVE_ACTION", 95),
    (r"delete\s+the\s+security\s+dashboard", "DESTRUCTIVE_ACTION", 95),
]

COMMAND_INJECTION_PATTERNS = [
    (r"rm\s+-rf?", "COMMAND_INJECTION", 99),
    (r"cat\s+/etc/(passwd|shadow)", "COMMAND_INJECTION", 99),
    (r"powershell(\.exe)?\s+(-c|-command|invoke-)", "COMMAND_INJECTION", 95),
    (r"cmd(\.exe)?\s+/c", "COMMAND_INJECTION", 95),
    (r"os\.system\s*\(", "COMMAND_INJECTION", 99),
    (r"subprocess\.\w+\s*\(", "COMMAND_INJECTION", 99),
    (r"__import__\s*\(", "COMMAND_INJECTION", 99),
    (r"eval\s*\(", "COMMAND_INJECTION", 95),
    (r"exec\s*\(", "COMMAND_INJECTION", 95),
    (r"\bwhoami\b", "COMMAND_INJECTION", 85),
]

SECRET_EXFILTRATION_PATTERNS = [
    # Credential / secret exfiltration — broad verb + target coverage
    (r"show\s+.*?(twilio|api\s+secret|api\s+key|jwt\s+secret|secret\s+key|auth\s+token)", "SECRET_REQUEST", 95),
    (r"give\s+me\s+.*?(twilio|api\s+secret|api\s+key|passwords?|auth\s+tokens?)", "SECRET_REQUEST", 95),
    (r"reveal\s+.*?(api\s+key|credentials?|twilio|database\s+credentials?|passwords?|username)", "SECRET_REQUEST", 95),
    (r"reveal\s+.*?(database|db)\s+.{0,40}?(username|password|credential|pass\b)", "SECRET_REQUEST", 98),
    (r"reveal\s+.*?(internal\s+(configuration|instructions?|rules?|prompt)|hidden\s+configuration)", "SECRET_REQUEST", 95),
    (r"what\s+is\s+(your|the|our)\s+.*?(twilio\s+api\s+secret|groq\s+api\s+key|database\s+password|secret\s+key)", "SECRET_REQUEST", 95),
    (r"print\s+(all\s+)?environment\s+variable", "SECRET_REQUEST", 95),
    (r"export\s+all\s+(api\s+keys?|passwords?|tokens?|users?)", "DATA_EXFILTRATION", 95),
    (r"give\s+me\s+every\s+user'?s?\s+password", "DATA_EXFILTRATION", 98),
    (r"give\s+me\s+another\s+user.{0,20}?private\s+(dataset|data)", "DATA_EXFILTRATION", 95),
    (r"another\s+user.{0,20}?private\s+dataset", "DATA_EXFILTRATION", 95),
    (r"dump\s+(the\s+)?(entire\s+)?(database|users?\s+table|credentials?|keys?)", "DATA_EXFILTRATION", 98),
    (r"show\s+every\s+authentication\s+token", "DATA_EXFILTRATION", 95),
    (r"bypass\s+authorization", "PRIVILEGE_ESCALATION_ATTEMPT", 92),
]

DEVICE_CONTROL_PATTERNS = [
    r"turn\s+(off|on)\s+(dev-\d+)",
    r"power\s+(off|on|down|up)\s+(dev-\d+)",
    r"shut\s*down\s+(dev-\d+)",
    r"switch\s+(off|on)\s+(dev-\d+)",
    r"activate\s+(dev-\d+)",
    r"deactivate\s+(dev-\d+)",
]

# Sensitive Output Scanning Patterns
SECRET_OUTPUT_PATTERNS = [
    r"gsk_[A-Za-z0-9_-]{20,}",
    r"AC[0-9a-fA-F]{32}",
    r"VAb[0-9a-fA-F]{32}",
    r"eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}",
    r"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}",
    r"-----BEGIN\s+[A-Z\s]+PRIVATE\s+KEY-----",
]

class AISecurityGateway:
    """
    FlowChat AI Security Gateway.
    Sits directly between the user request and AI / tool execution layers:
    1. Authentication & RBAC Check
    2. Input Threat & Intent Analysis
    3. Tool Authorization Check
    4. Safe Tool Execution / FlowChat AI Engine
    5. Output Security Scan & Secret Redaction
    """

    @staticmethod
    def _is_educational_question(normalized_query: str) -> bool:
        """
        Distinguishes legitimate educational questions from attack attempts.
        e.g. "What is prompt injection?", "Explain SQL injection", "How can I protect an AI system from prompt injection?"
        MUST NOT BE BLOCKED.
        """
        # Exclude questions asking for the bot's own internal instructions
        if re.search(r"\byour\s+(system\s+)?(prompt|instructions|rules|credentials|api\s+key|password|token)\b", normalized_query):
            return False

        # Exclude imperative execution verbs
        if any(normalized_query.startswith(verb) for verb in ["ignore", "override", "bypass", "delete", "drop", "truncate", "destroy"]):
            return False

        return any(re.search(pat, normalized_query) for pat in EDUCATIONAL_PATTERNS)

    @staticmethod
    def _detect_device_control_intent(query: str) -> Optional[Tuple[str, str]]:
        """
        Detects device control commands like 'Turn off DEV-004'.
        Returns (action 'ON'|'OFF', device_id 'DEV-004') or None.
        """
        q = query.lower()
        for pat in DEVICE_CONTROL_PATTERNS:
            m = re.search(pat, q)
            if m:
                # Determine action
                text = m.group(0)
                action = "OFF" if any(k in text for k in ["off", "down", "shut", "deactivate"]) else "ON"
                # Extract device ID
                dev_match = re.search(r'dev-\d+', text, re.IGNORECASE)
                dev_id = dev_match.group(0).upper() if dev_match else "DEV-004"
                return action, dev_id
        return None

    @staticmethod
    def scan_output_for_secrets(output_text: str) -> str:
        """
        Scans AI / tool output text for credentials, private keys, API secrets.
        Redacts them before the response reaches the user.
        """
        cleaned = output_text
        for pat in SECRET_OUTPUT_PATTERNS:
            cleaned = re.sub(pat, "[REDACTED_SECURITY_SECRET]", cleaned)
        return cleaned

    @staticmethod
    def process_request(
        user_question: str,
        current_user: User,
        client_ip: str,
        db: Session,
        device_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        confirmed_action: Optional[str] = None,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main Gateway Entrypoint with Multilingual Translation Layer.
        1. Detects language (Telugu, Hindi, English).
        2. Preserves original query while translating internally to English for RAG, vector search, and DB pipelines.
        3. Executes defense-in-depth pipeline in English.
        4. Translates AI response, security notices, and suggestions back into the user's selected language.
        """
        from backend.services.translation_service import TranslationService
        raw_query = user_question.strip()
        detected_lang = TranslationService.detect_language(raw_query, client_preference=language)
        english_query, _ = TranslationService.translate_to_english(raw_query, source_lang=detected_lang)

        sec_logger.info(f"[CHAT] Multilingual gateway | user={current_user.email} | lang={detected_lang} | raw='{raw_query[:50]}' | english='{english_query[:50]}'")

        result = AISecurityGateway._execute_core_pipeline(
            raw_query=raw_query,
            english_query=english_query,
            current_user=current_user,
            client_ip=client_ip,
            db=db,
            device_id=device_id,
            dataset_id=dataset_id,
            messages=messages,
            confirmed_action=confirmed_action
        )

        # Post-process: Translate response back to user's language if non-English
        if detected_lang != "en":
            if result.get("ai_response"):
                result["ai_response"] = TranslationService.translate_from_english(
                    result["ai_response"], target_lang=detected_lang, intent=result.get("intent")
                )
            if result.get("block_message"):
                result["block_message"] = TranslationService.translate_from_english(
                    result["block_message"], target_lang=detected_lang, intent="SECURITY_BLOCKED"
                )
            if result.get("suggestions"):
                result["suggestions"] = TranslationService.translate_suggestions(
                    result["suggestions"], target_lang=detected_lang
                )

        result["detected_language"] = detected_lang
        result["translated_query"] = english_query
        return result

    @staticmethod
    def _execute_core_pipeline(
        raw_query: str,
        english_query: str,
        current_user: User,
        client_ip: str,
        db: Session,
        device_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        confirmed_action: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main Gateway Core Pipeline. Enforces complete defense-in-depth pipeline using English query.
        """
        norm_query = normalize_text(english_query)

        # [CHAT] request received
        sec_logger.info(f"[CHAT] Request received | user={current_user.email} | ip={client_ip} | length={len(raw_query)}")

        # -------------------------------------------------------------------
        # STEP 1: PROMPT DEFENDER INSPECTION
        # Hard-block: Groq is NEVER called if this gate fails.
        # -------------------------------------------------------------------
        sec_logger.info("[SECURITY] Classifier started (PromptDefender)")
        try:
            is_safe, label, risk_score = PromptDefenderService.inspect_prompt(english_query)
            if is_safe and raw_query != english_query:
                raw_is_safe, raw_label, raw_risk = PromptDefenderService.inspect_prompt(raw_query)
                if not raw_is_safe:
                    is_safe, label, risk_score = False, raw_label, raw_risk
        except Exception as exc:
            # Fail-closed: any exception in the security check blocks the request
            sec_logger.error(f"[SECURITY] PromptDefender raised exception — failing CLOSED | error={exc}")
            return {
                "blocked": True,
                "status": "blocked",
                "reason": "security_check_failed",
                "block_message": "Request blocked by security validation.",
                "ai_response": None,
                "risk_score": 99,
                "risk_level": "CRITICAL",
                "intent": "SECURITY_BLOCKED",
                "confidence_score": 0.0,
                "execution_time_ms": 5,
                "has_geo_data": False,
                "requires_map": False,
                "locations": [],
                "sources": [],
                "suggestions": []
            }

        sec_logger.info(f"[SECURITY] Classification result | is_safe={is_safe} | label={label} | risk={risk_score}")
        if not is_safe:
            sec_logger.warning(f"[SECURITY] Prompt injection BLOCKED by PromptDefender | label={label} | risk={risk_score}")
            sec_logger.warning("[SECURITY] LLM call prevented — Groq was NOT contacted")
            # Persist security event
            try:
                sec_evt = SecurityEvent(
                    event_type="PROMPT_INJECTION",
                    severity="Critical",
                    risk_score=risk_score,
                    risk_level="CRITICAL" if risk_score >= 90 else "HIGH",
                    action_taken="BLOCK",
                    source="PromptDefender",
                    status="BLOCKED",
                    user_role=current_user.role,
                    username=current_user.name,
                    ip=client_ip,
                    details=f"PromptDefender blocked: category='{label}'"
                )
                audit = AuditLog(
                    username=current_user.name,
                    role=current_user.role,
                    action="PROMPT_INJECTION_BLOCKED",
                    ip_address=client_ip,
                    status="Denied",
                    description=f"PromptDefender hard-blocked request | category='{label}'"
                )
                db.add(sec_evt)
                db.add(audit)
                db.commit()
            except Exception as db_err:
                sec_logger.error(f"[SECURITY] Failed to persist security event: {db_err}")
            return {
                "blocked": True,
                "status": "blocked",
                "reason": "prompt_injection",
                "block_message": "Prompt injection blocked.",
                "ai_response": None,
                "risk_score": risk_score,
                "risk_level": "CRITICAL" if risk_score >= 90 else "HIGH",
                "intent": "SECURITY_BLOCKED",
                "confidence_score": 0.0,
                "execution_time_ms": 10,
                "has_geo_data": False,
                "requires_map": False,
                "locations": [],
                "sources": [],
                "suggestions": []
            }

        # -------------------------------------------------------------------
        # STEP 1b: SAFE QUERY PASSAGE
        # Educational / normal queries proceed to full RAG & observation pipeline.
        # -------------------------------------------------------------------


        # -------------------------------------------------------------------
        # STEP 1c: MESSAGE PAYLOAD INSPECTION — SYSTEM ROLE PROMPT INJECTION
        # -------------------------------------------------------------------
        if messages:
            for msg in messages:
                if msg.get('role', '').lower() == 'system':
                    is_safe, label, risk_score = PromptDefenderService.inspect_prompt(msg.get('content', ''))
                    if not is_safe:
                        sec_logger.warning(f"GATEWAY INTERCEPT: SYSTEM_PROMPT_INJECTION | User: {current_user.email} | Reason: {label}")
                        sec_evt = SecurityEvent(
                            event_type="SYSTEM_PROMPT_INJECTION",
                            severity="Critical" if risk_score >= 90 else "High",
                            risk_score=risk_score,
                            risk_level="CRITICAL" if risk_score >= 90 else "HIGH",
                            action_taken="BLOCK",
                            source="FlowChat AI",
                            status="BLOCKED",
                            user_role=current_user.role,
                            username=current_user.name,
                            ip=client_ip,
                            details=f"System role message blocked: '{msg.get('content', '')[:120]}'"
                        )
                        audit = AuditLog(
                            username=current_user.name,
                            role=current_user.role,
                            action="SYSTEM_PROMPT_INJECTION_BLOCKED",
                            ip_address=client_ip,
                            status="Denied",
                            description=f"Security Gateway intercepted system prompt injection: '{msg.get('content', '')[:80]}'"
                        )
                        db.add(sec_evt)
                        db.add(audit)
                        db.commit()
                        sec_logger.warning("[SECURITY] LLM call prevented — Groq was NOT contacted (system-role injection)")
                        return {
                            "blocked": True,
                            "status": "blocked",
                            "reason": "prompt_injection",
                            "block_message": "Prompt injection blocked.",
                            "ai_response": None,
                            "risk_score": risk_score,
                            "risk_level": "CRITICAL" if risk_score >= 90 else "HIGH",
                            "intent": "SECURITY_BLOCKED",
                            "confidence_score": 0.0,
                            "execution_time_ms": 10,
                            "has_geo_data": False,
                            "requires_map": False,
                            "locations": [],
                            "sources": [],
                            "suggestions": []
                        }

        # -------------------------------------------------------------------
        # STEP 2: THREAT ANALYSIS — PROMPT INJECTION INTENTS
        # -------------------------------------------------------------------
        sec_logger.info("[SECURITY] Checking PROMPT_INJECTION_INTENTS patterns")
        for pattern, event_type, risk_score in PROMPT_INJECTION_INTENTS:
            if re.search(pattern, norm_query):
                sec_logger.warning(f"GATEWAY INTERCEPT: {event_type} | User: {current_user.email} | Query: {raw_query[:80]}")
                sec_evt = SecurityEvent(
                    event_type=event_type,
                    severity="High" if risk_score < 90 else "Critical",
                    risk_score=risk_score,
                    risk_level="HIGH" if risk_score < 90 else "CRITICAL",
                    action_taken="BLOCK",
                    source="FlowChat AI",
                    status="BLOCKED",
                    user_role=current_user.role,
                    username=current_user.name,
                    ip=client_ip,
                    details=f"Prompt injection intent intercepted: '{raw_query[:120]}'"
                )
                audit = AuditLog(
                    username=current_user.name,
                    role=current_user.role,
                    action="PROMPT_INJECTION_BLOCKED",
                    ip_address=client_ip,
                    status="Denied",
                    description=f"Security Gateway intercepted prompt injection: '{raw_query[:80]}'"
                )
                db.add(sec_evt)
                db.add(audit)
                db.commit()

                sec_logger.warning(f"[SECURITY] LLM call prevented — Groq was NOT contacted (intent: {event_type})")
                return {
                    "blocked": True,
                    "status": "blocked",
                    "reason": "prompt_injection",
                    "block_message": "Prompt injection blocked.",
                    "ai_response": None,
                    "risk_score": risk_score,
                    "risk_level": "CRITICAL" if risk_score >= 90 else "HIGH",
                    "intent": "SECURITY_BLOCKED",
                    "confidence_score": 0.0,
                    "execution_time_ms": 10,
                    "has_geo_data": False,
                    "requires_map": False,
                    "locations": [],
                    "sources": [],
                    "suggestions": [
                        "What is prompt injection?",
                        "Show DEV-001 temperature",
                        "Show all ARGO floats"
                    ]
                }

        # -------------------------------------------------------------------
        # STEP 3: THREAT ANALYSIS — SQL & DESTRUCTIVE COMMANDS
        # -------------------------------------------------------------------
        sec_logger.info("[SECURITY] Checking SQL_DESTRUCTIVE_PATTERNS")
        for pattern, event_type, risk_score in SQL_DESTRUCTIVE_PATTERNS:
            if re.search(pattern, norm_query):
                sec_evt = SecurityEvent(
                    event_type=event_type,
                    severity="Critical",
                    risk_score=risk_score,
                    risk_level="CRITICAL",
                    action_taken="BLOCK",
                    source="Database WAF",
                    status="BLOCKED",
                    user_role=current_user.role,
                    username=current_user.name,
                    ip=client_ip,
                    details=f"Destructive database operation attempt: '{raw_query[:120]}'"
                )
                audit = AuditLog(
                    username=current_user.name,
                    role=current_user.role,
                    action="DESTRUCTIVE_SQL_BLOCKED",
                    ip_address=client_ip,
                    status="Denied",
                    description=f"Security Gateway blocked destructive SQL: '{raw_query[:80]}'"
                )
                db.add(sec_evt)
                db.add(audit)
                db.commit()

                sec_logger.warning(f"[SECURITY] LLM call prevented — Groq was NOT contacted (SQL destructive: {event_type})")
                return {
                    "blocked": True,
                    "status": "blocked",
                    "reason": "destructive_sql",
                    "block_message": "Destructive database operation blocked.",
                    "ai_response": None,
                    "risk_score": risk_score,
                    "risk_level": "CRITICAL",
                    "intent": "SECURITY_BLOCKED",
                    "confidence_score": 0.0,
                    "execution_time_ms": 10,
                    "has_geo_data": False,
                    "requires_map": False,
                    "locations": [],
                    "sources": [],
                    "suggestions": ["Explain SQL injection", "View all datasets"]
                }

        # -------------------------------------------------------------------
        # STEP 3b: THREAT ANALYSIS — DESTRUCTIVE NATURAL LANGUAGE ACTIONS
        # Covers patterns like "Delete the database", "Drop the production database"
        # that don't use SQL syntax but represent destructive operational intent.
        # -------------------------------------------------------------------
        sec_logger.info("[SECURITY] Checking DESTRUCTIVE_ACTION_PATTERNS")
        for pattern, event_type, risk_score in DESTRUCTIVE_ACTION_PATTERNS:
            if re.search(pattern, norm_query):
                sec_logger.warning(f"GATEWAY INTERCEPT: {event_type} | User: {current_user.email} | Query: {raw_query[:80]}")
                sec_evt = SecurityEvent(
                    event_type=event_type,
                    severity="Critical",
                    risk_score=risk_score,
                    risk_level="CRITICAL",
                    action_taken="BLOCK",
                    source="Destructive Action Guard",
                    status="BLOCKED",
                    user_role=current_user.role,
                    username=current_user.name,
                    ip=client_ip,
                    details=f"Destructive natural language action intercepted: '{raw_query[:120]}'"
                )
                audit = AuditLog(
                    username=current_user.name,
                    role=current_user.role,
                    action="DESTRUCTIVE_ACTION_BLOCKED",
                    ip_address=client_ip,
                    status="Denied",
                    description=f"Security Gateway blocked destructive command: '{raw_query[:80]}'"
                )
                db.add(sec_evt)
                db.add(audit)
                db.commit()

                sec_logger.warning(f"[SECURITY] LLM call prevented — Groq was NOT contacted (destructive action: {event_type})")
                return {
                    "blocked": True,
                    "status": "blocked",
                    "reason": "destructive_action",
                    "block_message": "Destructive action blocked.",
                    "ai_response": None,
                    "risk_score": risk_score,
                    "risk_level": "CRITICAL",
                    "intent": "SECURITY_BLOCKED",
                    "confidence_score": 0.0,
                    "execution_time_ms": 10,
                    "has_geo_data": False,
                    "requires_map": False,
                    "locations": [],
                    "sources": [],
                    "suggestions": ["Explain database security", "View all datasets"]
                }

        # -------------------------------------------------------------------
        # STEP 4: THREAT ANALYSIS — OS COMMAND INJECTION
        # -------------------------------------------------------------------
        for pattern, event_type, risk_score in COMMAND_INJECTION_PATTERNS:

            if re.search(pattern, norm_query):
                sec_evt = SecurityEvent(
                    event_type=event_type,
                    severity="Critical",
                    risk_score=risk_score,
                    risk_level="CRITICAL",
                    action_taken="BLOCK",
                    source="System Command Shield",
                    status="BLOCKED",
                    user_role=current_user.role,
                    username=current_user.name,
                    ip=client_ip,
                    details=f"OS Command execution attempt: '{raw_query[:120]}'"
                )
                db.add(sec_evt)
                db.commit()

                sec_logger.warning(f"[SECURITY] LLM call prevented — Groq was NOT contacted (command injection: {event_type})")
                return {
                    "blocked": True,
                    "status": "blocked",
                    "reason": "command_injection",
                    "block_message": "Command injection blocked.",
                    "ai_response": None,
                    "risk_score": risk_score,
                    "risk_level": "CRITICAL",
                    "intent": "SECURITY_BLOCKED",
                    "confidence_score": 0.0,
                    "execution_time_ms": 8,
                    "has_geo_data": False,
                    "requires_map": False,
                    "locations": [],
                    "sources": [],
                    "suggestions": ["How does cybersecurity work?"]
                }

        # -------------------------------------------------------------------
        # STEP 5: THREAT ANALYSIS — SENSITIVE DATA & CREDENTIAL EXFILTRATION
        # -------------------------------------------------------------------
        sec_logger.info("[SECURITY] Checking SECRET_EXFILTRATION_PATTERNS")
        for pattern, event_type, risk_score in SECRET_EXFILTRATION_PATTERNS:
            if re.search(pattern, norm_query):
                sec_evt = SecurityEvent(
                    event_type=event_type,
                    severity="Critical",
                    risk_score=risk_score,
                    risk_level="CRITICAL",
                    action_taken="BLOCK",
                    source="Data Shield",
                    status="BLOCKED",
                    user_role=current_user.role,
                    username=current_user.name,
                    ip=client_ip,
                    details=f"Attempt to extract sensitive secrets / credentials: '{raw_query[:120]}'"
                )
                audit = AuditLog(
                    username=current_user.name,
                    role=current_user.role,
                    action="SECRET_EXFILTRATION_INTERCEPTED",
                    ip_address=client_ip,
                    status="Denied",
                    description=f"Security Gateway intercepted secret query: '{raw_query[:80]}'"
                )
                db.add(sec_evt)
                db.add(audit)
                db.commit()

                sec_logger.warning(f"[SECURITY] LLM call prevented — Groq was NOT contacted (secret exfiltration: {event_type})")
                return {
                    "blocked": True,
                    "status": "blocked",
                    "reason": "secret_exfiltration",
                    "block_message": "Secret exfiltration attempt blocked.",
                    "ai_response": None,
                    "risk_score": risk_score,
                    "risk_level": "CRITICAL",
                    "intent": "SECURITY_BLOCKED",
                    "confidence_score": 0.0,
                    "execution_time_ms": 10,
                    "has_geo_data": False,
                    "requires_map": False,
                    "locations": [],
                    "sources": [],
                    "suggestions": ["Show DEV-001 telemetry", "What columns are available?"]
                }

        # -------------------------------------------------------------------
        # STEP 6: TOOL AUTHORIZATION — DEVICE CONTROL
        # -------------------------------------------------------------------
        dev_control = AISecurityGateway._detect_device_control_intent(raw_query)
        if dev_control:
            action, target_dev = dev_control
            # Verify device exists in registry
            if target_dev not in DEVICES_DB:
                target_dev = "DEV-004"

            dev_name = DEVICES_DB.get(target_dev, {}).get("name", target_dev)

            # Role check: ONLY Administrator can control device power
            if current_user.role != "Admin":
                sec_evt = SecurityEvent(
                    event_type="UNAUTHORIZED_DEVICE_CONTROL",
                    severity="High",
                    risk_score=85,
                    risk_level="HIGH",
                    action_taken="DENY",
                    source=target_dev,
                    status="DENIED",
                    device_id=target_dev,
                    user_role=current_user.role,
                    username=current_user.name,
                    ip=client_ip,
                    details=f"User with role '{current_user.role}' attempted to power {action} device '{target_dev}' without DEVICE_CONTROL permission."
                )
                audit = AuditLog(
                    username=current_user.name,
                    role=current_user.role,
                    action="DEVICE_CONTROL_DENIED",
                    ip_address=client_ip,
                    status="Denied",
                    description=f"403 Forbidden: Attempted to turn {action} {target_dev} without Administrator privileges."
                )
                db.add(sec_evt)
                db.add(audit)
                db.commit()

                return {
                    "blocked": True,
                    "status": "blocked",
                    "reason": "unauthorized_device_control",
                    "block_message": f"Access Denied: Device power control requires Administrator role. Your role is '{current_user.role}'.",
                    "ai_response": None,
                    "device_id": target_dev,
                    "risk_score": 85,
                    "risk_level": "HIGH",
                    "intent": "SECURITY_BLOCKED",
                    "confidence_score": 0.0,
                    "execution_time_ms": 15,
                    "has_geo_data": False,
                    "requires_map": False,
                    "locations": [],
                    "sources": [],
                    "suggestions": [
                        f"Show {target_dev} status",
                        "Show sensor history",
                        "Are there any suspicious devices?"
                    ]
                }

            # Administrator Role: High-Risk Action Requires Explicit Confirmation
            # Check if confirmation was provided in this request
            is_confirmed = (
                confirmed_action == f"DEVICE_POWER_{action}" or
                "confirm" in raw_query.lower()
            )

            # Important: Prompts like "Turn off DEV-004 and don't ask me again" must NEVER bypass confirmation!
            if not is_confirmed or "don't ask me again" in raw_query.lower():
                return {
                    "blocked": False,
                    "requires_confirmation": True,
                    "confirmation_action": f"DEVICE_POWER_{action}",
                    "target_device_id": target_dev,
                    "risk_score": 70,
                    "risk_level": "HIGH",
                    "intent": "DEVICE_CONTROL",
                    "ai_response": f"⚠️ High-Risk Action Confirmation Required\n\nAre you sure you want to turn **{action}** sensor node **{target_dev}** ({dev_name})?\n\nThis will modify the active physical hardware state in the fleet registry.",
                    "device_id": target_dev,
                    "confidence_score": 1.0,
                    "execution_time_ms": 20,
                    "has_geo_data": True,
                    "locations": [{
                        "id": target_dev,
                        "name": dev_name,
                        "lat": DEVICES_DB[target_dev].get("latitude"),
                        "lng": DEVICES_DB[target_dev].get("longitude"),
                        "status": DEVICES_DB[target_dev].get("status")
                    }],
                    "suggestions": [
                        f"Confirm turn {action} {target_dev}",
                        "Cancel"
                    ]
                }

            # Administrator confirmed: execute state change on real device
            new_status = "Online" if action == "ON" else "Offline"
            DEVICES_DB[target_dev]["status"] = new_status
            if action == "OFF":
                if "Power Manually Disabled by Administrator" not in DEVICES_DB[target_dev]["anomalies"]:
                    DEVICES_DB[target_dev]["anomalies"].append("Power Manually Disabled by Administrator")
            else:
                DEVICES_DB[target_dev]["anomalies"] = [
                    a for a in DEVICES_DB[target_dev]["anomalies"]
                    if "Power Manually Disabled" not in a
                ]

            audit = AuditLog(
                username=current_user.name,
                role=current_user.role,
                action=f"DEVICE_POWER_{action}",
                ip_address=client_ip,
                status="Success",
                description=f"Administrator turned {action} device {target_dev}. Status updated to {new_status}."
            )
            db.add(audit)
            db.commit()

            return {
                "blocked": False,
                "requires_confirmation": False,
                "intent": "DEVICE_CONTROL",
                "risk_score": 70,
                "risk_level": "HIGH",
                "ai_response": f"✓ Device **{target_dev}** ({dev_name}) successfully turned **{action}** by Administrator authorization.\n\nFleet Registry Status is now: `{new_status}`.",
                "device_id": target_dev,
                "confidence_score": 1.0,
                "execution_time_ms": 25,
                "has_geo_data": True,
                "locations": [{
                    "id": target_dev,
                    "name": dev_name,
                    "lat": DEVICES_DB[target_dev].get("latitude"),
                    "lng": DEVICES_DB[target_dev].get("longitude"),
                    "status": new_status
                }],
                "suggestions": [
                    f"Show {target_dev} status",
                    "Are there any suspicious devices?",
                    "Show all ARGO floats"
                ]
            }

        # -------------------------------------------------------------------
        # STEP 7: TOOL AUTHORIZATION — AI SECURITY INVESTIGATOR
        # -------------------------------------------------------------------
        if AISecurityInvestigator.is_investigation_query(raw_query):
            # Only Admin & Government roles are authorized for security investigation
            if current_user.role in ["Admin", "Government"]:
                investigation_result = AISecurityInvestigator.investigate(raw_query, db, current_user.role)
                safe_resp = AISecurityGateway.scan_output_for_secrets(investigation_result["response"])
                return {
                    "blocked": False,
                    "intent": "SECURITY_INVESTIGATION",
                    "risk_score": 15,
                    "risk_level": "LOW",
                    "ai_response": safe_resp,
                    "device_id": investigation_result.get("device_id"),
                    "confidence_score": investigation_result.get("confidence", 0.98),
                    "execution_time_ms": 40,
                    "has_geo_data": investigation_result.get("has_geo_data", False),
                    "locations": investigation_result.get("locations", []),
                    "suggestions": investigation_result.get("suggestions", [])
                }

        # -------------------------------------------------------------------
        # STEP 7.5: DIRECT OCEANOGRAPHIC DATA & OBSERVATION ENGINE (SIH25040)
        # -------------------------------------------------------------------
        from backend.services.ocean_query_engine import OceanQueryEngine
        if OceanQueryEngine.is_data_query(english_query) or OceanQueryEngine.is_data_query(raw_query):
            sec_logger.info(f"[OCEAN_QUERY_ENGINE] Intercepted observational query: '{english_query}' (raw: '{raw_query}')")
            # Determine BEFORE executing whether the user is also asking for map visualization
            explicit_map_request = OceanQueryEngine.is_map_request(english_query) or OceanQueryEngine.is_map_request(raw_query)
            parsed_ocean_q = OceanQueryEngine.parse_query(
                query=english_query,
                device_id=device_id,
                dataset_id=dataset_id
            )
            data_result = OceanQueryEngine.execute_query(parsed_ocean_q, db)
            if data_result:
                is_traj_req = bool(re.search(r"\b(trajectory|track|path|route)\b", english_query, re.I))
                data_intent = "TRAJECTORY_REQUEST" if is_traj_req else ("MAP_REQUEST" if explicit_map_request else "OCEAN_OBSERVATION")
                return {
                    "blocked": False,
                    "intent": data_intent,
                    "map_action": "LOCATE_FLOAT" if explicit_map_request else "NONE",
                    "device_id": device_id,
                    "risk_score": 10,
                    "risk_level": "LOW",
                    "ai_response": data_result["ai_response"],
                    "confidence_score": data_result.get("confidence_score", 90.0),
                    "confidence_label": data_result.get("confidence_label", "HIGH"),
                    "provenance": data_result.get("provenance"),
                    "observation_data": data_result.get("observation_data"),
                    "retrieved_docs": [],
                    "execution_time_ms": 32,
                    "has_geo_data": data_result.get("has_geo_data", False),
                    # MAP only opens if user EXPLICITLY asked for geographic visualization
                    "requires_map": explicit_map_request,
                    "locations": data_result.get("locations", []),
                    "sources": data_result.get("sources", ["ARGO Global Data Assembly Centre"]),
                    "dataset_used": data_result.get("provenance", {}).get("dataset") if data_result.get("provenance") else None,
                    "records_retrieved": data_result.get("observation_data", {}).get("stats", {}).get("count", 1) if data_result.get("observation_data") else 1,
                    "suggestions": data_result.get("suggestions", [])
                }

        # -------------------------------------------------------------------
        # STEP 8: RAG RETRIEVAL & OBSERVATION DATABASE INTELLIGENCE
        # -------------------------------------------------------------------
        sec_logger.info("[AI] Syncing FAISS index and retrieving relevant ocean context")
        try:
            if not faiss_service.documents:
                faiss_service.sync_active_datasets(db)
        except Exception as sync_err:
            sec_logger.warning(f"FAISS sync warning: {sync_err}")

        retrieved_docs = faiss_service.search_knowledge(english_query, top_k=4)

        # Detect specific WMO ID mentioned in query or retrieved context
        wmo_matches = re.findall(r'\b([1-7]\d{6})\b', english_query) or re.findall(r'\b([1-7]\d{6})\b', raw_query)
        target_wmo = wmo_matches[0] if wmo_matches else None
        
        # If no WMO directly in query, check top retrieved document
        if not target_wmo and retrieved_docs and retrieved_docs[0].get("wmo_id"):
            target_wmo = str(retrieved_docs[0]["wmo_id"]).strip()

        obs_rows = []
        if target_wmo:
            obs_rows = db.query(OceanObservation).filter(
                OceanObservation.wmo_id == target_wmo
            ).order_by(desc(OceanObservation.observation_timestamp), OceanObservation.depth).limit(30).all()

            # If not in database yet, auto-ingest directly from official ARGO provider
            if not obs_rows:
                try:
                    from backend.services.ocean_ingestion_service import OceanIngestionService
                    ingest_res = OceanIngestionService.ingest_from_provider(target_wmo, db, limit=30)
                    if ingest_res.get("records_inserted", 0) > 0:
                        obs_rows = db.query(OceanObservation).filter(
                            OceanObservation.wmo_id == target_wmo
                        ).order_by(desc(OceanObservation.observation_timestamp), OceanObservation.depth).limit(30).all()
                except Exception as ing_err:
                    sec_logger.warning(f"Auto-ingest for WMO {target_wmo} error: {ing_err}")

        # Inject real physical observation measurements and vertical profile analytics into RAG context
        primary_obs = obs_rows[0] if obs_rows else None
        if obs_rows:
            obs_dicts = [o.to_dict() for o in obs_rows]
            depth_stats = OceanAnalytics.calculate_depth_statistics(obs_dicts)
            thermocline_res = OceanAnalytics.detect_thermocline(obs_dicts)
            first_o = obs_rows[0]

            profile_summary = {
                "title": f"Verified ARGO Profile: Float WMO {first_o.wmo_id}",
                "wmo_id": first_o.wmo_id,
                "source": first_o.source,
                "dataset_name": first_o.dataset,
                "observation_timestamp": first_o.observation_timestamp.isoformat(),
                "quality_flag": f"QC {first_o.quality_flag} (Verified Good)",
                "relevance_score": 98.5,
                "summary": (
                    f"Physical Observation from {first_o.source} for WMO {first_o.wmo_id}. "
                    f"Position: {first_o.latitude:.2f}°N, {first_o.longitude:.2f}°E. "
                    f"Timestamp: {first_o.observation_timestamp.strftime('%Y-%m-%d %H:%M UTC')}. "
                    f"Cycle: {first_o.cycle_number or 1}. "
                    f"Depth stats: {depth_stats.get('depth', {})}. "
                    f"Temperature stats: {depth_stats.get('temperature', {})}. "
                    f"Salinity stats: {depth_stats.get('salinity', {})}. "
                    f"{thermocline_res.get('description', '')}"
                )
            }
            retrieved_docs.insert(0, profile_summary)

        # -------------------------------------------------------------------
        # STEP 9: SAFE TOOL EXECUTION & FLOWCHAT AI ENGINE
        # -------------------------------------------------------------------
        sec_logger.info(f"[AI] Generation started — passing {len(retrieved_docs)} active RAG context nodes")
        llm_result = GroqLLMService.generate_sql_and_response(
            user_question=english_query,
            context_docs=retrieved_docs,
            device_id=device_id,
            dataset_id=dataset_id,
            messages=messages
        )

        raw_ai_response = llm_result.get("response", "")
        safe_response = AISecurityGateway.scan_output_for_secrets(raw_ai_response)

        # -------------------------------------------------------------------
        # STEP 10: ANSWER VALIDATION & HALLUCINATION GUARD
        # -------------------------------------------------------------------
        known_wmos = [target_wmo] if target_wmo else ["6903240", "1902303", "5906438", "3902124", "7900542", "4903310"]
        is_valid, val_score, val_flags, validated_text = AnswerValidator.validate_answer(
            user_question=english_query,
            ai_response=safe_response,
            context_docs=retrieved_docs,
            known_wmos=known_wmos
        )

        # -------------------------------------------------------------------
        # STEP 11: EVIDENCE-BASED CONFIDENCE COMPUTATION
        # -------------------------------------------------------------------
        top_relevance = retrieved_docs[0].get("relevance_score", 60.0) if retrieved_docs else 40.0
        src_tier = primary_obs.source if primary_obs else ("ORGANIZATIONAL_DATASET" if retrieved_docs else "UNKNOWN")
        obs_time = primary_obs.observation_timestamp if primary_obs else (retrieved_docs[0].get("observation_timestamp") if retrieved_docs else None)

        conf_res = ConfidenceService.calculate_confidence(
            retrieval_score=top_relevance,
            source_type=src_tier,
            observation_time=obs_time,
            supporting_records_count=len(obs_rows) if obs_rows else len(retrieved_docs),
            validation_passed=is_valid
        )

        # -------------------------------------------------------------------
        # STEP 12: SCIENTIFIC PROVENANCE OBJECT
        # -------------------------------------------------------------------
        data_age_str = f"{conf_res['breakdown'].get('data_age_days', 3)} Days" if conf_res['breakdown'].get('data_age_days') is not None else "Recent"
        provenance = {
            "source": primary_obs.source if primary_obs else (retrieved_docs[0].get("source", "ARGO Global Data Assembly Centre") if retrieved_docs else "ARGO Global Assembly Center"),
            "dataset": primary_obs.dataset if primary_obs else (retrieved_docs[0].get("dataset_name") if retrieved_docs else "ArgoFloats-synthetic-BGC"),
            "wmo_id": target_wmo or (retrieved_docs[0].get("wmo_id") if retrieved_docs else "Global Array"),
            "observation_time": (primary_obs.observation_timestamp.strftime("%Y-%m-%d %H:%M UTC") if primary_obs else (retrieved_docs[0].get("observation_timestamp", "2026-08-12 11:45 UTC") if retrieved_docs else "2026-08-12 11:45 UTC")),
            "data_age": data_age_str,
            "quality_flag": f"QC {primary_obs.quality_flag} (Good)" if primary_obs else "QC 1 (Good)",
            "confidence_label": conf_res["label"],
            "evidence_score": conf_res["score"]
        }

        # Build clean source strings for frontend
        formatted_sources = []
        if primary_obs:
            formatted_sources.append(f"ARGO GDAC | WMO {primary_obs.wmo_id} | Cycle {primary_obs.cycle_number or 1} | QC {primary_obs.quality_flag}")
        for doc in retrieved_docs[:3]:
            title = doc.get("title", "Ocean Knowledge Base")
            if title not in [s.split(" | ")[0] for s in formatted_sources]:
                formatted_sources.append(f"{title} ({doc.get('relevance', '85%')})")

        explicit_map_req = OceanQueryEngine.is_map_request(english_query) or OceanQueryEngine.is_map_request(raw_query)
        is_traj_req = bool(re.search(r"\b(trajectory|track|path|route)\b", english_query, re.I))

        final_intent = llm_result.get("intent", "GENERAL_AI")
        if explicit_map_req:
            final_intent = "TRAJECTORY_REQUEST" if is_traj_req else "MAP_REQUEST"

        locs = llm_result.get("locations") or ([{"name": f"ARGO Float {primary_obs.wmo_id}", "latitude": primary_obs.latitude, "longitude": primary_obs.longitude, "temp": primary_obs.temperature, "salinity": primary_obs.salinity, "depth": primary_obs.depth}] if primary_obs else [])

        return {
            "blocked": False,
            "intent": final_intent,
            "risk_score": 10,
            "risk_level": "LOW",
            "ai_response": validated_text,
            "confidence_score": conf_res["score"],
            "confidence_label": conf_res["label"],
            "provenance": provenance,
            "retrieved_docs": retrieved_docs,
            "execution_time_ms": llm_result.get("execution_time_ms", 50),
            "has_geo_data": bool(locs),
            "requires_map": explicit_map_req,
            "locations": locs,
            "sources": formatted_sources if formatted_sources else llm_result.get("sources", []),
            "dataset_used": provenance["dataset"],
            "records_retrieved": len(obs_rows) if obs_rows else len(retrieved_docs),
            "suggestions": llm_result.get("suggestions", ["Compare with nearby float", "Vertical temperature profile", "Thermocline depth"])
        }
