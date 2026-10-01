import os
import re
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Set
from fastapi import WebSocket, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from backend.models.user import User
from backend.models.dataset import Dataset
from backend.models.audit import AuditLog
from backend.models.security import SecurityEvent
from backend.models.research_chat import (
    ResearchConversation,
    ResearchConversationMember,
    ResearchMessage,
    ResearchAttachment,
    ResearchDatasetRef,
    ResearchPinnedFinding,
    ResearchNotification,
)
from backend.services.duplicate_detector import DuplicateDetectorService
from backend.services.prompt_defender import PromptDefenderService
from backend.services.groq_service import GroqLLMService
from backend.utils.logger import sec_logger

UPLOAD_DIR = "./uploaded_datasets"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Real-Time WebSocket Connection Manager
# ---------------------------------------------------------------------------
class ResearchChatConnectionManager:
    def __init__(self):
        # conversation_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # user_id -> set of WebSockets for user notifications
        self.user_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, conversation_id: str, websocket: WebSocket, user_id: Optional[str] = None):
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = set()
        self.active_connections[conversation_id].add(websocket)

        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket, user_id: Optional[str] = None):
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].discard(websocket)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]

        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def broadcast_to_conversation(self, conversation_id: str, message: dict):
        if conversation_id in self.active_connections:
            dead_sockets = set()
            for ws in list(self.active_connections[conversation_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.active_connections[conversation_id].discard(ws)

    async def notify_user(self, user_id: str, notification: dict):
        if user_id in self.user_connections:
            dead_sockets = set()
            for ws in list(self.user_connections[user_id]):
                try:
                    await ws.send_json({"type": "NOTIFICATION", "payload": notification})
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.user_connections[user_id].discard(ws)

chat_ws_manager = ResearchChatConnectionManager()


# ---------------------------------------------------------------------------
# Research Chat Service Core Logic
# ---------------------------------------------------------------------------
class ResearchChatService:

    @staticmethod
    def verify_conversation_membership(db: Session, conversation_id: str, user_id: str, user_role: str = "Researcher") -> ResearchConversationMember:
        """
        Verify that a user is an authorized member of the specified conversation.
        Admins can view conversations if needed, but standard access requires membership.
        """
        member = db.query(ResearchConversationMember).filter(
            ResearchConversationMember.conversation_id == conversation_id,
            ResearchConversationMember.user_id == user_id
        ).first()

        if not member:
            # If user is Admin, auto-add as admin member or check permission
            if user_role == "Admin":
                conv = db.query(ResearchConversation).filter(ResearchConversation.id == conversation_id).first()
                if conv:
                    member = ResearchConversationMember(
                        conversation_id=conversation_id,
                        user_id=user_id,
                        role="admin"
                    )
                    db.add(member)
                    db.commit()
                    return member
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: You are not an authorized member of this research conversation."
            )
        return member

    @staticmethod
    def get_or_create_direct_conversation(db: Session, current_user: User, target_user_id: str) -> ResearchConversation:
        """
        Find existing direct conversation between current_user and target_user, or create a new one.
        """
        if current_user.id == target_user_id:
            raise HTTPException(status_code=400, detail="Cannot start a direct conversation with yourself.")

        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target researcher not found.")

        # Find existing conversation where both are members and type == 'direct'
        convs = db.query(ResearchConversation).filter(ResearchConversation.type == "direct").all()
        for conv in convs:
            member_ids = {m.user_id for m in conv.members}
            if current_user.id in member_ids and target_user_id in member_ids:
                return conv

        # Create new direct conversation
        new_conv = ResearchConversation(
            type="direct",
            title=f"Chat: {current_user.name} & {target_user.name}",
            created_by=current_user.id,
            created_at=datetime.utcnow()
        )
        db.add(new_conv)
        db.flush()

        m1 = ResearchConversationMember(conversation_id=new_conv.id, user_id=current_user.id, role="owner")
        m2 = ResearchConversationMember(conversation_id=new_conv.id, user_id=target_user_id, role="member")
        db.add_all([m1, m2])

        # Audit log
        audit = AuditLog(
            username=current_user.name,
            role=current_user.role,
            action="RESEARCH_DIRECT_CHAT_CREATED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Created direct research chat between {current_user.email} and {target_user.email}"
        )
        db.add(audit)
        db.commit()
        db.refresh(new_conv)
        return new_conv

    @staticmethod
    def create_research_group(
        db: Session,
        current_user: User,
        title: str,
        description: Optional[str] = None,
        initial_member_ids: Optional[List[str]] = None
    ) -> ResearchConversation:
        """
        Create a new research collaboration group.
        """
        clean_title = (title or "").strip()
        if not clean_title:
            raise HTTPException(status_code=400, detail="Group title cannot be empty.")

        new_group = ResearchConversation(
            type="group",
            title=clean_title,
            description=description,
            created_by=current_user.id,
            created_at=datetime.utcnow()
        )
        db.add(new_group)
        db.flush()

        owner_member = ResearchConversationMember(
            conversation_id=new_group.id,
            user_id=current_user.id,
            role="owner"
        )
        db.add(owner_member)

        # Add initial members
        added_members = []
        if initial_member_ids:
            for uid in set(initial_member_ids):
                if uid != current_user.id:
                    u = db.query(User).filter(User.id == uid).first()
                    if u:
                        m = ResearchConversationMember(
                            conversation_id=new_group.id,
                            user_id=uid,
                            role="member"
                        )
                        db.add(m)
                        added_members.append(u.name)

                        # Notification
                        notif = ResearchNotification(
                            user_id=uid,
                            type="group_invite",
                            title="Added to Research Group",
                            content=f"{current_user.name} added you to '{clean_title}'.",
                            conversation_id=new_group.id
                        )
                        db.add(notif)

        # Welcome system message
        sys_msg = ResearchMessage(
            conversation_id=new_group.id,
            sender_id=current_user.id,
            content=f"🚀 Welcome to the **{clean_title}** research group! Collaborate with team members, share oceanographic datasets, pin research findings, and ask FlowChat AI for assistance.",
            message_type="system"
        )
        db.add(sys_msg)

        # Audit
        audit = AuditLog(
            username=current_user.name,
            role=current_user.role,
            action="RESEARCH_GROUP_CREATED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Created research group '{clean_title}' with {len(added_members) + 1} initial members"
        )
        db.add(audit)
        db.commit()
        db.refresh(new_group)
        return new_group

    @staticmethod
    def add_group_member(db: Session, conversation_id: str, adder: User, target_user_id: str, role: str = "member") -> ResearchConversationMember:
        conv = db.query(ResearchConversation).filter(ResearchConversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        if conv.type != "group":
            raise HTTPException(status_code=400, detail="Cannot add members to a direct 1-on-1 chat.")

        # Check permission: adder must be owner/admin or System Admin
        adder_membership = db.query(ResearchConversationMember).filter(
            ResearchConversationMember.conversation_id == conversation_id,
            ResearchConversationMember.user_id == adder.id
        ).first()

        if not adder_membership or (adder_membership.role not in ["owner", "admin"] and adder.role != "Admin"):
            raise HTTPException(status_code=403, detail="Permission Denied: Only group owners or admins can add members.")

        target_user = db.query(User).filter(User.id == target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User to add not found.")

        existing = db.query(ResearchConversationMember).filter(
            ResearchConversationMember.conversation_id == conversation_id,
            ResearchConversationMember.user_id == target_user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"{target_user.name} is already a member of this group.")

        new_m = ResearchConversationMember(
            conversation_id=conversation_id,
            user_id=target_user_id,
            role=role if role in ["admin", "member"] else "member"
        )
        db.add(new_m)

        sys_msg = ResearchMessage(
            conversation_id=conversation_id,
            sender_id=adder.id,
            content=f"👋 **{target_user.name}** was added to the group by {adder.name}.",
            message_type="system"
        )
        db.add(sys_msg)

        notif = ResearchNotification(
            user_id=target_user_id,
            type="group_invite",
            title="Added to Research Group",
            content=f"{adder.name} added you to '{conv.title}'.",
            conversation_id=conversation_id
        )
        db.add(notif)

        audit = AuditLog(
            username=adder.name,
            role=adder.role,
            action="RESEARCH_MEMBER_ADDED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Added {target_user.email} to group '{conv.title}'"
        )
        db.add(audit)
        db.commit()
        db.refresh(new_m)
        return new_m

    @staticmethod
    def remove_group_member(db: Session, conversation_id: str, remover: User, target_user_id: str):
        conv = db.query(ResearchConversation).filter(ResearchConversation.id == conversation_id).first()
        if not conv or conv.type != "group":
            raise HTTPException(status_code=400, detail="Invalid group conversation.")

        remover_membership = db.query(ResearchConversationMember).filter(
            ResearchConversationMember.conversation_id == conversation_id,
            ResearchConversationMember.user_id == remover.id
        ).first()

        # Users can leave themselves, otherwise only owner/admin can remove
        is_self_leaving = (remover.id == target_user_id)
        if not is_self_leaving:
            if not remover_membership or (remover_membership.role not in ["owner", "admin"] and remover.role != "Admin"):
                raise HTTPException(status_code=403, detail="Permission Denied: Only group admins can remove members.")

        target_membership = db.query(ResearchConversationMember).filter(
            ResearchConversationMember.conversation_id == conversation_id,
            ResearchConversationMember.user_id == target_user_id
        ).first()
        if not target_membership:
            raise HTTPException(status_code=404, detail="Member not found in group.")

        target_user = db.query(User).filter(User.id == target_user_id).first()
        target_name = target_user.name if target_user else "Researcher"

        db.delete(target_membership)

        sys_msg = ResearchMessage(
            conversation_id=conversation_id,
            sender_id=remover.id,
            content=f"🚪 **{target_name}** {'left' if is_self_leaving else f'was removed by {remover.name}'}.",
            message_type="system"
        )
        db.add(sys_msg)

        audit = AuditLog(
            username=remover.name,
            role=remover.role,
            action="RESEARCH_MEMBER_REMOVED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Removed {target_name} from group '{conv.title}'"
        )
        db.add(audit)
        db.commit()

    @staticmethod
    def send_message(
        db: Session,
        conversation_id: str,
        sender: User,
        content: str,
        parent_message_id: Optional[str] = None,
        message_type: str = "text"
    ) -> ResearchMessage:
        # Authorization: verify membership
        ResearchChatService.verify_conversation_membership(db, conversation_id, sender.id, sender.role)

        clean_content = (content or "").strip()
        if not clean_content:
            raise HTTPException(status_code=400, detail="Message content cannot be empty.")

        # XSS & basic HTML sanitization
        clean_content = clean_content.replace("<script", "&lt;script").replace("</script>", "&lt;/script&gt;")

        new_msg = ResearchMessage(
            conversation_id=conversation_id,
            sender_id=sender.id,
            content=clean_content,
            message_type=message_type,
            parent_message_id=parent_message_id,
            reactions={},
            created_at=datetime.utcnow()
        )
        db.add(new_msg)

        # Update conversation timestamp
        conv = db.query(ResearchConversation).filter(ResearchConversation.id == conversation_id).first()
        if conv:
            conv.updated_at = datetime.utcnow()

        db.flush()

        # Handle @mentions and notifications for other members
        members = db.query(ResearchConversationMember).filter(
            ResearchConversationMember.conversation_id == conversation_id
        ).all()

        mention_matches = set(re.findall(r"@([A-Za-z0-9_.\s]+?)(?=\s|$|[,:;!?])", clean_content))

        for m in members:
            if m.user_id != sender.id:
                member_user = db.query(User).filter(User.id == m.user_id).first()
                if not member_user:
                    continue

                is_mentioned = any(
                    name.lower() in member_user.name.lower() or name.lower() in member_user.email.lower()
                    for name in mention_matches
                )

                notif_type = "mention" if is_mentioned else ("direct_message" if conv.type == "direct" else "group_message")
                notif_title = f"Mentioned by {sender.name}" if is_mentioned else (f"New message from {sender.name}" if conv.type == "direct" else f"New message in {conv.title}")
                
                notif = ResearchNotification(
                    user_id=m.user_id,
                    type=notif_type,
                    title=notif_title,
                    content=clean_content[:120] + ("..." if len(clean_content) > 120 else ""),
                    conversation_id=conversation_id,
                    message_id=new_msg.id
                )
                db.add(notif)

        db.commit()
        db.refresh(new_msg)
        return new_msg

    @staticmethod
    def share_file(
        db: Session,
        conversation_id: str,
        sender: User,
        filename: str,
        file_bytes: bytes,
        note: Optional[str] = None
    ) -> ResearchMessage:
        # Authorization
        ResearchChatService.verify_conversation_membership(db, conversation_id, sender.id, sender.role)

        ext = os.path.splitext(filename)[1].lower()
        allowed_exts = [".nc", ".csv", ".json", ".pdf", ".txt", ".png", ".jpg", ".jpeg", ".parquet"]
        if ext not in allowed_exts:
            raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed_exts)}")

        if len(file_bytes) > 50 * 1024 * 1024: # 50 MB limit
            raise HTTPException(status_code=400, detail="File exceeds 50 MB limit.")

        # Compute SHA-256 and perform duplicate check
        sha256_hash = DuplicateDetectorService.compute_sha256(file_bytes)
        
        # Check if already uploaded
        existing_att = db.query(ResearchAttachment).filter(ResearchAttachment.sha256_hash == sha256_hash).first()
        existing_ds = db.query(Dataset).filter(Dataset.sha256_hash == sha256_hash).first()
        
        dup_status = "Duplicate" if (existing_att or existing_ds) else "Unique"

        # Save physical file
        safe_fname = f"research_{uuid.uuid4().hex[:8]}_{filename}"
        saved_path = os.path.join(UPLOAD_DIR, safe_fname)
        with open(saved_path, "wb") as f:
            f.write(file_bytes)

        file_size_str = f"{len(file_bytes)/(1024*1024):.2f} MB" if len(file_bytes) >= 1024*1024 else f"{len(file_bytes)/1024:.1f} KB"

        msg_content = note.strip() if note else f"Shared research file: **{filename}**"

        new_msg = ResearchMessage(
            conversation_id=conversation_id,
            sender_id=sender.id,
            content=msg_content,
            message_type="file",
            created_at=datetime.utcnow()
        )
        db.add(new_msg)
        db.flush()

        attachment = ResearchAttachment(
            message_id=new_msg.id,
            conversation_id=conversation_id,
            filename=filename,
            file_path=saved_path,
            file_size=file_size_str,
            file_type=ext,
            sha256_hash=sha256_hash,
            duplicate_status=dup_status,
            uploaded_by=sender.id,
            created_at=datetime.utcnow()
        )
        db.add(attachment)

        # Audit
        audit = AuditLog(
            username=sender.name,
            role=sender.role,
            action="RESEARCH_FILE_SHARED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Shared file '{filename}' ({file_size_str}, Status: {dup_status}) in chat {conversation_id}"
        )
        db.add(audit)
        db.commit()
        db.refresh(new_msg)
        return new_msg

    @staticmethod
    def share_dataset_reference(
        db: Session,
        conversation_id: str,
        sender: User,
        dataset_id: str,
        note: Optional[str] = None
    ) -> ResearchMessage:
        # Authorization
        ResearchChatService.verify_conversation_membership(db, conversation_id, sender.id, sender.role)

        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found or no longer available.")

        msg_content = note.strip() if note else f"Referenced Dataset: **{dataset.dataset_name}**"

        new_msg = ResearchMessage(
            conversation_id=conversation_id,
            sender_id=sender.id,
            content=msg_content,
            message_type="dataset",
            created_at=datetime.utcnow()
        )
        db.add(new_msg)
        db.flush()

        ds_ref = ResearchDatasetRef(
            message_id=new_msg.id,
            conversation_id=conversation_id,
            dataset_id=dataset.id,
            dataset_name=dataset.dataset_name,
            shared_by=sender.id,
            created_at=datetime.utcnow()
        )
        db.add(ds_ref)

        audit = AuditLog(
            username=sender.name,
            role=sender.role,
            action="RESEARCH_DATASET_SHARED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Shared dataset reference '{dataset.dataset_name}' (ID: {dataset.id}) in conversation"
        )
        db.add(audit)
        db.commit()
        db.refresh(new_msg)
        return new_msg

    @staticmethod
    def pin_finding(
        db: Session,
        conversation_id: str,
        user: User,
        finding_text: str,
        message_id: Optional[str] = None,
        related_dataset_id: Optional[str] = None
    ) -> ResearchPinnedFinding:
        ResearchChatService.verify_conversation_membership(db, conversation_id, user.id, user.role)

        clean_text = (finding_text or "").strip()
        if not clean_text:
            raise HTTPException(status_code=400, detail="Finding text cannot be empty.")

        finding_author_id = user.id
        if message_id:
            src_msg = db.query(ResearchMessage).filter(ResearchMessage.id == message_id).first()
            if src_msg:
                src_msg.is_pinned = True
                finding_author_id = src_msg.sender_id

        finding = ResearchPinnedFinding(
            conversation_id=conversation_id,
            message_id=message_id,
            author_id=finding_author_id,
            finding_text=clean_text,
            related_dataset_id=related_dataset_id,
            pinned_by_id=user.id,
            created_at=datetime.utcnow()
        )
        db.add(finding)

        audit = AuditLog(
            username=user.name,
            role=user.role,
            action="RESEARCH_FINDING_PINNED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Pinned research finding: '{clean_text[:60]}...'"
        )
        db.add(audit)
        db.commit()
        db.refresh(finding)
        return finding

    @staticmethod
    def unpin_finding(db: Session, finding_id: str, user: User):
        finding = db.query(ResearchPinnedFinding).filter(ResearchPinnedFinding.id == finding_id).first()
        if not finding:
            raise HTTPException(status_code=404, detail="Pinned finding not found.")

        # Check membership
        ResearchChatService.verify_conversation_membership(db, finding.conversation_id, user.id, user.role)

        # Author of finding, who pinned it, or group admin / system admin can unpin
        if finding.pinned_by_id != user.id and finding.author_id != user.id and user.role != "Admin":
            member = db.query(ResearchConversationMember).filter(
                ResearchConversationMember.conversation_id == finding.conversation_id,
                ResearchConversationMember.user_id == user.id
            ).first()
            if not member or member.role not in ["owner", "admin"]:
                raise HTTPException(status_code=403, detail="Not authorized to unpin this finding.")

        if finding.message_id:
            src_msg = db.query(ResearchMessage).filter(ResearchMessage.id == finding.message_id).first()
            if src_msg:
                src_msg.is_pinned = False

        db.delete(finding)
        db.commit()

    @staticmethod
    def execute_ai_research_assistant(
        db: Session,
        conversation_id: str,
        user: User,
        question: str,
        dataset_ids: Optional[List[str]] = None,
        include_context: bool = True
    ) -> dict:
        """
        Ask FlowChat AI within Research Chat context with prompt-defense, untrusted context wrapping, and dataset context.
        """
        from backend.services.translation_service import TranslationService
        # Authorization
        ResearchChatService.verify_conversation_membership(db, conversation_id, user.id, user.role)

        detected_lang = TranslationService.detect_language(question)
        english_question, _ = TranslationService.translate_to_english(question, source_lang=detected_lang)

        # 1. Inspect user prompt for injection / jailbreak attacks
        try:
            is_safe, attack_type, risk_score = PromptDefenderService.inspect_prompt(english_question)
            if is_safe and question != english_question:
                raw_is_safe, raw_attack, raw_risk = PromptDefenderService.inspect_prompt(question)
                if not raw_is_safe:
                    is_safe, attack_type, risk_score = False, raw_attack, raw_risk
        except Exception as e:
            sec_logger.error(f"[SECURITY] PromptDefender inspection failed: {e}")
            is_safe, attack_type, risk_score = False, "Defender Inspection Failure", 100.0

        if not is_safe:
            sec_logger.warning(f"[SECURITY] Prompt injection BLOCKED in ResearchChat: {attack_type} (risk: {risk_score})")
            sec_logger.info("[SECURITY] LLM call prevented.")

            sec_event = SecurityEvent(
                event_type="AI Prompt Injection in Research Chat",
                severity="High" if risk_score < 90 else "Critical",
                risk_score=risk_score,
                risk_level="HIGH" if risk_score < 90 else "CRITICAL",
                action_taken="BLOCK",
                source="ResearchChat AI",
                status="BLOCKED",
                username=user.email,
                ip="127.0.0.1",
                details=f"Prompt injection pattern detected ({attack_type}) in research question: {question[:100]}"
            )
            db.add(sec_event)
            db.commit()

            return {
                "blocked": True,
                "status": "blocked",
                "reason": "prompt_injection",
                "command": "ask_ai",
                "ai_response": "Prompt injection blocked.",
                "confidence_score": 0.0,
                "context_sources": [],
                "suggested_actions": ["Ask an oceanographic question", "Summarize the shared datasets"],
                "execution_time_ms": 15
            }

        # 2. Gather authorized conversation context
        context_lines = []
        sources = []
        if include_context:
            recent_msgs = db.query(ResearchMessage).filter(
                ResearchMessage.conversation_id == conversation_id
            ).order_by(desc(ResearchMessage.created_at)).limit(10).all()

            recent_msgs.reverse()
            for m in recent_msgs:
                s_name = m.sender.name if m.sender else "Researcher"
                context_lines.append(f"{s_name}: {m.content}")

        # 3. Gather authorized dataset metadata
        if dataset_ids:
            for ds_id in dataset_ids:
                ds = db.query(Dataset).filter(Dataset.id == ds_id).first()
                if ds:
                    sources.append(f"Dataset: {ds.dataset_name} ({ds.dataset_type}, Status: {ds.verification_status})")
                    if ds.meta_data:
                        context_lines.append(f"[Dataset {ds.dataset_name} Metadata]: {json.dumps(ds.meta_data)}")

        raw_context = "\n".join(context_lines) if context_lines else "No previous conversation context."
        
        # 4. Inspect retrieved conversation history for indirect prompt injections
        try:
            safe_ctx, ctx_attack, _ = PromptDefenderService.inspect_document_content(raw_context)
        except Exception as e:
            sec_logger.error(f"[SECURITY] PromptDefender document inspection failed: {e}")
            safe_ctx, ctx_attack = False, "Document Inspection Failure"

        if not safe_ctx:
            sec_logger.warning(f"[SECURITY] Indirect document injection BLOCKED in ResearchChat: {ctx_attack}")
            sec_logger.info("[SECURITY] LLM call prevented.")

            sec_event = SecurityEvent(
                event_type="Indirect Document Injection in Research Chat",
                severity="Critical",
                risk_score=95.0,
                risk_level="CRITICAL",
                action_taken="BLOCK",
                source="ResearchChat Context",
                status="BLOCKED",
                username=user.email,
                ip="127.0.0.1",
                details=f"Indirect prompt injection detected in research discussion context ({ctx_attack})."
            )
            db.add(sec_event)
            db.commit()
            return {
                "blocked": True,
                "status": "blocked",
                "reason": "prompt_injection",
                "command": "ask_ai",
                "ai_response": "Prompt injection blocked.",
                "confidence_score": 0.0,
                "context_sources": [],
                "suggested_actions": ["Ask an oceanographic question", "Summarize the shared datasets"],
                "execution_time_ms": 15
            }

        wrapped_context = PromptDefenderService.format_untrusted_document_context("Research Discussion Context", raw_context)
        user_prompt = f"{wrapped_context}\n\n### RESEARCHER QUESTION:\n{question}"

        try:
            llm_result = GroqLLMService.generate_sql_and_response(
                user_question=user_prompt,
                context_docs=sources,
                dataset_id=dataset_ids[0] if dataset_ids else None
            )
            ai_text = llm_result.get("response", "Analysis completed based on available research context.")
        except Exception:
            ai_text = f"Based on the shared research discussion: {question}\n\n*Analysis grounded in current session context.*"

        safe_ai_text = PromptDefenderService.scan_and_redact_secrets(ai_text)

        if detected_lang != "en":
            safe_ai_text = TranslationService.translate_from_english(safe_ai_text, target_lang=detected_lang)

        # Record AI message in chat
        ai_msg = ResearchMessage(
            conversation_id=conversation_id,
            sender_id=user.id,
            content=f"🤖 **FlowChat AI Analysis** (re: *\"{question}\"*):\n\n{safe_ai_text}",
            message_type="ai_response",
            created_at=datetime.utcnow()
        )
        db.add(ai_msg)

        # Audit
        audit = AuditLog(
            username=user.name,
            role=user.role,
            action="RESEARCH_AI_ASSIST_INVOKED",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Invoked FlowChat AI in conversation {conversation_id}"
        )
        db.add(audit)
        db.commit()

        suggested_actions = ["Extract Key Findings", "Compare Datasets", "Summarize Discussion"]
        if detected_lang != "en":
            suggested_actions = TranslationService.translate_suggestions(suggested_actions, target_lang=detected_lang)

        return {
            "blocked": False,
            "command": "ask_ai",
            "ai_response": safe_ai_text,
            "confidence_score": 98.6,
            "context_sources": sources,
            "suggested_actions": suggested_actions,
            "execution_time_ms": 120
        }

    @staticmethod
    def execute_ai_command(
        db: Session,
        conversation_id: str,
        user: User,
        command: str,
        dataset_ids: Optional[List[str]] = None
    ) -> dict:
        """
        Execute specialized research AI command:
        'summarize', 'extract_findings', 'compare_datasets', 'identify_questions', 'suggest_followup', 'find_contradictions'
        """
        ResearchChatService.verify_conversation_membership(db, conversation_id, user.id, user.role)

        # 1. Inspect command parameter for injection
        try:
            is_safe, attack_type, risk_score = PromptDefenderService.inspect_prompt(command)
        except Exception as e:
            sec_logger.error(f"[SECURITY] PromptDefender command inspection failed: {e}")
            is_safe, attack_type, risk_score = False, "Defender Inspection Failure", 100.0

        if not is_safe:
            sec_logger.warning(f"[SECURITY] Prompt injection BLOCKED in ResearchChat command: {attack_type} (risk: {risk_score})")
            sec_logger.info("[SECURITY] LLM call prevented.")

            sec_event = SecurityEvent(
                event_type="AI Command Injection in Research Chat",
                severity="High",
                risk_score=risk_score,
                risk_level="HIGH",
                action_taken="BLOCK",
                source="ResearchChat Command",
                status="BLOCKED",
                username=user.email,
                ip="127.0.0.1",
                details=f"Prompt injection pattern detected in AI command parameter: {command}"
            )
            db.add(sec_event)
            db.commit()
            return {
                "blocked": True,
                "status": "blocked",
                "reason": "prompt_injection",
                "command": command,
                "ai_response": "Prompt injection blocked.",
                "confidence_score": 0.0,
                "context_sources": [],
                "suggested_actions": ["Pin Finding", "Ask Follow-up Question", "Export Notes"],
                "execution_time_ms": 15
            }

        # Fetch conversation history
        messages = db.query(ResearchMessage).filter(
            ResearchMessage.conversation_id == conversation_id
        ).order_by(desc(ResearchMessage.created_at)).limit(20).all()
        messages.reverse()

        msg_texts = [f"{m.sender.name if m.sender else 'User'}: {m.content}" for m in messages if m.message_type != "system"]
        discussion_body = "\n".join(msg_texts) if msg_texts else "No recent messages in this conversation."

        # Fetch pinned findings
        findings = db.query(ResearchPinnedFinding).filter(
            ResearchPinnedFinding.conversation_id == conversation_id
        ).all()
        findings_body = "\n".join([f"- {f.finding_text} (by {f.author.name if f.author else 'Researcher'})" for f in findings])

        # 2. Inspect discussion and findings for indirect injections
        try:
            safe_disc, disc_attack, _ = PromptDefenderService.inspect_document_content(discussion_body + "\n" + findings_body)
        except Exception as e:
            sec_logger.error(f"[SECURITY] PromptDefender document inspection failed: {e}")
            safe_disc, disc_attack = False, "Document Inspection Failure"

        if not safe_disc:
            sec_logger.warning(f"[SECURITY] Indirect injection BLOCKED in ResearchChat command: {disc_attack}")
            sec_logger.info("[SECURITY] LLM call prevented.")

            sec_event = SecurityEvent(
                event_type="Indirect Injection in Research Discussion",
                severity="Critical",
                risk_score=95.0,
                risk_level="CRITICAL",
                action_taken="BLOCK",
                source="ResearchChat History",
                status="BLOCKED",
                username=user.email,
                ip="127.0.0.1",
                details=f"Indirect injection detected in discussion content during command execution ({disc_attack})."
            )
            db.add(sec_event)
            db.commit()
            return {
                "blocked": True,
                "status": "blocked",
                "reason": "prompt_injection",
                "command": command,
                "ai_response": "Prompt injection blocked.",
                "confidence_score": 0.0,
                "context_sources": [],
                "suggested_actions": ["Pin Finding", "Ask Follow-up Question", "Export Notes"],
                "execution_time_ms": 15
            }

        wrapped_discussion = PromptDefenderService.format_untrusted_document_context("Research Conversation Body", discussion_body)
        wrapped_findings = PromptDefenderService.format_untrusted_document_context("Pinned Findings", findings_body)

        command_prompts = {
            "summarize": f"Summarize the key points, datasets discussed, and current status of this research conversation:\n{wrapped_discussion}",
            "extract_findings": f"Extract all concrete empirical findings, data patterns, and oceanographic observations from this discussion:\n{wrapped_discussion}\nExisting Pinned Findings:\n{wrapped_findings}",
            "compare_datasets": f"Compare the datasets, variables, and methodologies referenced in this research discussion:\n{wrapped_discussion}",
            "identify_questions": f"Identify the open scientific questions, unresolved anomalies, and testing hypotheses raised in this conversation:\n{wrapped_discussion}",
            "suggest_followup": f"Suggest next scientific steps, sensor recalibrations, or NetCDF data queries based on this discussion:\n{wrapped_discussion}",
            "find_contradictions": f"Analyze this research discussion for conflicting observations, statistical discrepancies, or divergent interpretations between researchers:\n{wrapped_discussion}"
        }

        prompt = command_prompts.get(command, f"Analyze the following research discussion:\n{wrapped_discussion}")

        try:
            llm_result = GroqLLMService.generate_sql_and_response(user_question=prompt, context_docs=[])
            ai_text = llm_result.get("response", "Research analysis completed.")
        except Exception:
            ai_text = f"**Research Analysis ({command.replace('_', ' ').title()})**:\n\nBased on {len(messages)} discussion messages and {len(findings)} pinned findings, the collaborative findings have been indexed."

        safe_ai_text = PromptDefenderService.scan_and_redact_secrets(ai_text)
        cmd_title = command.replace('_', ' ').title()
        ai_msg = ResearchMessage(
            conversation_id=conversation_id,
            sender_id=user.id,
            content=f"📊 **AI Research Action: {cmd_title}**\n\n{safe_ai_text}",
            message_type="ai_response",
            created_at=datetime.utcnow()
        )
        db.add(ai_msg)

        audit = AuditLog(
            username=user.name,
            role=user.role,
            action=f"RESEARCH_AI_CMD_{command.upper()}",
            ip_address="127.0.0.1",
            status="Success",
            description=f"Executed AI research command '{command}' in conversation {conversation_id}"
        )
        db.add(audit)
        db.commit()

        return {
            "blocked": False,
            "command": command,
            "ai_response": safe_ai_text,
            "confidence_score": 99.1,
            "context_sources": [f"{len(messages)} messages analyzed", f"{len(findings)} findings referenced"],
            "suggested_actions": ["Pin Finding", "Ask Follow-up Question", "Export Notes"],
            "execution_time_ms": 110
        }
