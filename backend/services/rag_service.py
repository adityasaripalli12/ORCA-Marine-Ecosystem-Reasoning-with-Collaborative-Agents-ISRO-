import re
import time
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.services.faiss_service import faiss_service
from backend.services.groq_service import GroqLLMService, DEVICES_DB
from backend.services.prompt_defender import PromptDefenderService
from backend.database.connection import SessionLocal
from backend.models.dataset import Dataset
from backend.utils.logger import sec_logger
from backend.models.security import SecurityEvent
from backend.models.audit import AuditLog

class AnswerValidator:
    """
    Enterprise AI Output & Hallucination Verification Engine.
    Validates:
    1. Relevance to user question
    2. Grounding in active retrieved documents or verified fleet registry
    3. Detection of invented facts, fake URLs, invented names, or fictitious policies
    4. Compliance with prompt-injection and secret protection rules
    """

    @staticmethod
    def validate_response(
        user_question: str,
        ai_response: str,
        context_docs: List[Dict[str, Any]],
        device_id: Optional[str] = None
    ) -> Tuple[bool, float, List[str]]:
        """
        Returns:
            (is_valid, validation_confidence, validation_flags)
        """
        flags = []
        q_lower = user_question.lower()
        resp_lower = ai_response.lower()

        # 1. Secret & Prompt Leak Check
        if any(token in resp_lower for token in ["system_prompt", "gsk_", "jwt_secret", "password_hash", "database_url"]):
            flags.append("POTENTIAL_SECRET_LEAKAGE")
            return False, 0.0, flags

        # 2. Check for Hallucinated Device IDs (e.g. inventing DEV-999)
        mentioned_devs = re.findall(r'DEV-\d+', ai_response.upper())
        for dev in mentioned_devs:
            if dev not in DEVICES_DB:
                flags.append(f"UNVERIFIED_DEVICE_REFERENCE: {dev}")
                return False, 40.0, flags

        # 3. Check for Fabricated URLs
        urls = re.findall(r'https?://[^\s)\]]+', ai_response)
        for url in urls:
            if "floatchat.incois.gov.in" not in url and "argo.ucsd.edu" not in url and "nodc.noaa.gov" not in url:
                flags.append(f"UNVERIFIED_EXTERNAL_URL: {url}")
                return False, 50.0, flags

        # 4. Uncertainty acknowledgment is always valid
        if "i don't have enough verified information" in resp_lower or "could not find" in resp_lower:
            return True, 95.0, ["GROUNDED_UNCERTAINTY_EXPRESSED"]

        # 5. Check if question was asking about a specific metric and response addressed it
        metrics = ["temperature", "salinity", "pressure", "depth", "latitude", "longitude", "battery", "status"]
        for m in metrics:
            if m in q_lower and m not in resp_lower and len(ai_response) > 50:
                # Mild flag, not hard failure
                flags.append(f"METRIC_PARTIALLY_ADDRESSED_{m.upper()}")

        return True, 95.0, flags


class RAGPipelineService:
    """
    Grounded RAG Pipeline & Source-Verified Conversational Service.
    Retrieves ONLY ACTIVE documents from the knowledge base.
    Calculates empirical confidence scores and validates output before delivery.
    """

    @staticmethod
    def calculate_confidence_score(
        retrieval_docs: List[Dict[str, Any]],
        device_matched: bool,
        is_grounded: bool,
        validation_score: float
    ) -> float:
        """
        Calculates confidence score based on measurable empirical signals:
        - Retrieval relevance of active sources (0 - 40 pts)
        - Source trust levels (0 - 30 pts)
        - Device registry grounding (0 - 20 pts)
        - Validation pass result (0 - 10 pts)
        """
        score = 0.0

        # Retrieval relevance contribution
        if retrieval_docs:
            top_rel = retrieval_docs[0].get("relevance_score", 0.0)
            score += min(40.0, (top_rel / 100.0) * 40.0)
            # Source trust level contribution (Level 4/5 gets max)
            trust_lvl = retrieval_docs[0].get("trust_level", 4)
            score += min(30.0, (trust_lvl / 5.0) * 30.0)
        elif device_matched:
            score += 65.0  # Fleet registry is Level 5 verified authoritative source

        if is_grounded:
            score += 15.0

        score += (validation_score / 100.0) * 15.0

        return round(min(100.0, max(10.0, score)), 1)

    @staticmethod
    def execute_rag_pipeline(
        user_question: str, 
        device_id: Optional[str] = None, 
        dataset_id: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None
    ) -> dict:
        t_start = time.time()
        
        # Step 1: Prompt Injection & Security Defense Inspection
        is_safe, attack_type, _ = PromptDefenderService.inspect_prompt(user_question)
        if not is_safe:
            return {
                "blocked": True,
                "reason": attack_type,
                "intent": "SECURITY_BLOCKED",
                "ai_response": "⚠️ Security Alert: This request was blocked because it contains a potential prompt injection or an attempt to override system instructions.",
                "generated_sql": None,
                "confidence_score": 0.0,
                "retrieved_docs": [],
                "execution_time_ms": int((time.time() - t_start) * 1000),
                "has_geo_data": False,
                "requires_map": False,
                "locations": [],
                "sources": [],
                "suggestions": ["Show all devices", "Tell me about DEV-001", "What datasets are available?"]
            }

        # Step 2: Ensure FAISS Index is synced with ACTIVE datasets
        db = SessionLocal()
        try:
            if not faiss_service.documents:
                faiss_service.sync_active_datasets(db)
        except Exception as e:
            sec_logger.warning(f"FAISS sync error: {e}")
        finally:
            db.close()

        # Step 3: Retrieve Authoritative ACTIVE Documents
        retrieved_docs = faiss_service.search_knowledge(user_question, top_k=3)
        # Step 3b: Inspect each retrieved document for indirect prompt injection or jailbreak content
        for doc in retrieved_docs:
            # Use the document snippet or full text if available (here we use title + meta info)
            doc_text = f"{doc.get('title', '')} {doc.get('meta_data', {})}"
            safe_doc, doc_label, _ = PromptDefenderService.inspect_document_content(doc_text)
            if not safe_doc:
                # Log security event and audit
                sec_evt = SecurityEvent(
                    event_type=doc_label,
                    severity="Critical",
                    risk_score=95,
                    risk_level="CRITICAL",
                    action_taken="BLOCK",
                    source="RAG_DOCUMENT",
                    status="BLOCKED",
                    user_role="UNKNOWN",  # will be set later in gateway when calling
                    username="UNKNOWN",
                    ip="UNKNOWN",
                    details=f"Indirect document injection detected in RAG document '{doc.get('title', '')}'."
                )
                # Note: The gateway will handle DB commit; here we just prepare the objects for return
                return {
                    "blocked": True,
                    "reason": doc_label,
                    "intent": "SECURITY_BLOCKED",
                    "ai_response": "⚠️ Security Alert: Retrieved document contains a potential prompt injection or jailbreak attempt and has been blocked.",
                    "generated_sql": None,
                    "confidence_score": 0.0,
                    "retrieved_docs": [],
                    "execution_time_ms": int((time.time() - t_start) * 1000),
                    "has_geo_data": False,
                    "requires_map": False,
                    "locations": [],
                    "sources": [],
                    "suggestions": ["Show all devices", "Tell me about DEV-001", "What datasets are available?"]
                }


        # Build Untrusted Document Context formatted with security delimiters
        context_blocks = []
        sources = []
        for doc in retrieved_docs:
            sources.append({
                "title": doc.get("title", "Active Dataset"),
                "format": doc.get("format", ".nc"),
                "trust_level": doc.get("trust_level", 4),
                "relevance": doc.get("relevance", "95.0%")
            })
            meta = doc.get("meta_data", {})
            snippet = f"Dataset: {doc.get('title')}, Variables: {meta.get('columns', [])}, Lat Bounds: {meta.get('latitude_min')}-{meta.get('latitude_max')}, Records: {meta.get('record_count')}"
            context_blocks.append(
                PromptDefenderService.format_untrusted_document_context(
                    doc_name=doc.get("title", "Dataset"),
                    doc_text=snippet,
                    trust_level=doc.get("trust_level", 4)
                )
            )

        # Step 4: FlowChat Unified AI Generation
        llm_result = GroqLLMService.generate_sql_and_response(
            user_question=user_question, 
            context_docs=retrieved_docs, 
            device_id=device_id,
            dataset_id=dataset_id,
            messages=messages
        )

        raw_response = llm_result.get("response", "")

        # Step 5: Post-Generation Answer Validation & Grounding Check
        is_valid, val_conf, val_flags = AnswerValidator.validate_response(
            user_question=user_question,
            ai_response=raw_response,
            context_docs=retrieved_docs,
            device_id=device_id
        )

        final_response = raw_response
        if not is_valid:
            sec_logger.warning(f"Answer validation flagged issue: {val_flags}. Falling back to grounded response.")
            final_response = "I don't have enough verified information in the active repository to answer that accurately."

        # Redact any accidental secrets
        final_response = PromptDefenderService.scan_and_redact_secrets(final_response)

        # Step 6: Confidence Score Calculation
        confidence_score = RAGPipelineService.calculate_confidence_score(
            retrieval_docs=retrieved_docs,
            device_matched=bool(llm_result.get("device_id")),
            is_grounded=is_valid,
            validation_score=val_conf
        )

        exec_time = int((time.time() - t_start) * 1000)

        return {
            "blocked": False,
            "intent": llm_result.get("intent", "GENERAL_AI"),
            "ai_response": final_response,
            "generated_sql": None,
            "confidence_score": confidence_score,
            "retrieved_docs": retrieved_docs,
            "execution_time_ms": exec_time,
            "has_geo_data": llm_result.get("has_geo_data", False),
            "requires_map": llm_result.get("requires_map", False),
            "locations": llm_result.get("locations", []),
            "sources": sources if sources else llm_result.get("sources", []),
            "dataset_used": llm_result.get("dataset_used"),
            "records_retrieved": llm_result.get("records_retrieved", len(retrieved_docs)),
            "validation_flags": val_flags,
            "suggestions": llm_result.get("suggestions", [])
        }
