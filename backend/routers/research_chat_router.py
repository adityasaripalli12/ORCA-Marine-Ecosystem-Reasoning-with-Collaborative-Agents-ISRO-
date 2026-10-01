import os
import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from backend.database.connection import get_db
from backend.models.user import User
from backend.models.dataset import Dataset
from backend.models.research_chat import (
    ResearchConversation,
    ResearchConversationMember,
    ResearchMessage,
    ResearchAttachment,
    ResearchDatasetRef,
    ResearchPinnedFinding,
    ResearchNotification,
)
from backend.schemas.research_chat import (
    ConversationResponse,
    ConversationDetailResponse,
    ConversationCreateRequest,
    ConversationUpdateRequest,
    AddMemberRequest,
    MessageResponse,
    MessageSendRequest,
    MessageEditRequest,
    DatasetShareRequest,
    PinFindingRequest,
    ReactionRequest,
    AIAskRequest,
    AICommandRequest,
    AIResearchResponse,
    ResearcherProfileResponse,
    NotificationResponse,
    SearchResultResponse,
    ConversationMemberResponse,
    AttachmentResponse,
    DatasetRefResponse,
    PinnedFindingResponse,
)
from backend.auth.dependencies import get_current_user
from backend.services.research_chat_service import ResearchChatService, chat_ws_manager
from backend.middleware.rate_limiter import rate_limiter

router = APIRouter(prefix="", tags=["Research Collaboration & Chat"])

# ---------------------------------------------------------------------------
# Helper Serializers
# ---------------------------------------------------------------------------
def _serialize_member(m: ResearchConversationMember) -> ConversationMemberResponse:
    u = m.user
    return ConversationMemberResponse(
        id=m.id,
        user_id=m.user_id,
        name=u.name if u else "Researcher",
        email=u.email if u else "",
        role=m.role,
        user_role=u.role if u else "Researcher",
        joined_at=m.joined_at.strftime("%Y-%m-%d %H:%M") if m.joined_at else "",
        last_read_at=m.last_read_at.strftime("%Y-%m-%d %H:%M") if m.last_read_at else None
    )

def _serialize_attachment(a: ResearchAttachment) -> AttachmentResponse:
    u = a.message.sender if a.message else None
    return AttachmentResponse(
        id=a.id,
        filename=a.filename,
        file_path=a.file_path,
        file_size=a.file_size,
        file_type=a.file_type,
        sha256_hash=a.sha256_hash,
        duplicate_status=a.duplicate_status,
        uploaded_by=a.uploaded_by,
        uploaded_by_name=u.name if u else "Researcher",
        created_at=a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else ""
    )

def _serialize_dataset_ref(d: ResearchDatasetRef) -> DatasetRefResponse:
    ds = d.dataset
    u = d.message.sender if d.message else None
    return DatasetRefResponse(
        id=d.id,
        dataset_id=d.dataset_id,
        dataset_name=d.dataset_name,
        dataset_type=ds.dataset_type if ds else ".nc",
        file_size=ds.file_size if ds else "Unknown",
        verification_status=ds.verification_status if ds else "Verified",
        duplicate_status=ds.duplicate_status if ds else "Unique",
        shared_by=d.shared_by,
        shared_by_name=u.name if u else "Researcher",
        meta_data=ds.meta_data if ds else {},
        created_at=d.created_at.strftime("%Y-%m-%d %H:%M") if d.created_at else ""
    )

def _serialize_finding(f: ResearchPinnedFinding) -> PinnedFindingResponse:
    return PinnedFindingResponse(
        id=f.id,
        conversation_id=f.conversation_id,
        message_id=f.message_id,
        author_id=f.author_id,
        author_name=f.author.name if f.author else "Researcher",
        finding_text=f.finding_text,
        related_dataset_id=f.related_dataset_id,
        related_dataset_name=f.dataset.dataset_name if f.dataset else None,
        pinned_by_id=f.pinned_by_id,
        pinned_by_name=f.pinned_by.name if f.pinned_by else "Admin",
        created_at=f.created_at.strftime("%Y-%m-%d %H:%M") if f.created_at else ""
    )

def _serialize_message(m: ResearchMessage) -> MessageResponse:
    sender = m.sender
    parent_prev = None
    if m.parent_message_id:
        p = m.conversation.messages if m.conversation else []
        for pm in p:
            if pm.id == m.parent_message_id:
                parent_prev = f"{pm.sender.name if pm.sender else 'User'}: {pm.content[:60]}"
                break

    return MessageResponse(
        id=m.id,
        conversation_id=m.conversation_id,
        sender_id=m.sender_id,
        sender_name=sender.name if sender else "Researcher",
        sender_role=sender.role if sender else "Researcher",
        content=m.content,
        message_type=m.message_type or "text",
        parent_message_id=m.parent_message_id,
        parent_message_preview=parent_prev,
        is_edited=bool(m.is_edited),
        is_pinned=bool(m.is_pinned),
        reactions=m.reactions or {},
        attachments=[_serialize_attachment(a) for a in (m.attachments or [])],
        dataset_refs=[_serialize_dataset_ref(d) for d in (m.dataset_refs or [])],
        created_at=m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else "",
        updated_at=m.updated_at.strftime("%Y-%m-%d %H:%M") if m.updated_at else ""
    )

def _serialize_conversation(conv: ResearchConversation, current_user_id: str) -> ConversationResponse:
    # Find last message
    last_msg = None
    if conv.messages:
        sorted_msgs = sorted(conv.messages, key=lambda x: x.created_at, reverse=True)
        if sorted_msgs:
            last_msg = _serialize_message(sorted_msgs[0])

    members = [_serialize_member(m) for m in conv.members]
    
    # Target user for direct chat
    direct_target = None
    display_title = conv.title or "Research Chat"
    if conv.type == "direct":
        for m in conv.members:
            if m.user_id != current_user_id and m.user:
                u = m.user
                direct_target = ResearcherProfileResponse(
                    id=u.id,
                    name=u.name,
                    email=u.email,
                    role=u.role,
                    organization="Ocean Research Institute",
                    is_active=u.is_active,
                    last_login=u.last_login
                )
                display_title = u.name
                break

    # Count unread messages
    user_member = next((m for m in conv.members if m.user_id == current_user_id), None)
    unread_count = 0
    if user_member and user_member.last_read_at and conv.messages:
        unread_count = sum(1 for msg in conv.messages if msg.created_at > user_member.last_read_at and msg.sender_id != current_user_id)

    return ConversationResponse(
        id=conv.id,
        type=conv.type,
        title=display_title,
        description=conv.description,
        created_by=conv.created_by,
        created_at=conv.created_at.strftime("%Y-%m-%d %H:%M") if conv.created_at else "",
        updated_at=conv.updated_at.strftime("%Y-%m-%d %H:%M") if conv.updated_at else "",
        unread_count=unread_count,
        last_message=last_msg,
        members=members,
        direct_target_user=direct_target
    )


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@router.get("/research-chat/conversations", response_model=List[ConversationResponse])
def list_user_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all direct chats and research groups where current user is a member.
    """
    memberships = db.query(ResearchConversationMember).filter(
        ResearchConversationMember.user_id == current_user.id
    ).all()
    conv_ids = [m.conversation_id for m in memberships]

    if not conv_ids:
        # If user has no conversations yet, auto-create a default general collaboration group if none exists
        gen_group = db.query(ResearchConversation).filter(ResearchConversation.title == "Ocean Climate Research Hub").first()
        if not gen_group:
            gen_group = ResearchChatService.create_research_group(
                db=db,
                current_user=current_user,
                title="Ocean Climate Research Hub",
                description="Global collaborative workspace for Argo float analysis, NetCDF anomalies, and ocean dynamics."
            )
            conv_ids = [gen_group.id]
        else:
            # Add user to general group
            new_m = ResearchConversationMember(conversation_id=gen_group.id, user_id=current_user.id, role="member")
            db.add(new_m)
            db.commit()
            conv_ids = [gen_group.id]

    conversations = db.query(ResearchConversation).filter(
        ResearchConversation.id.in_(conv_ids)
    ).order_by(desc(ResearchConversation.updated_at)).all()

    return [_serialize_conversation(c, current_user.id) for c in conversations]


@router.post("/research-chat/conversations/direct", response_model=ConversationResponse)
def start_direct_conversation(
    payload: ConversationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not payload.target_user_id:
        raise HTTPException(status_code=400, detail="target_user_id is required for direct chat.")
    conv = ResearchChatService.get_or_create_direct_conversation(db, current_user, payload.target_user_id)
    return _serialize_conversation(conv, current_user.id)


@router.post("/research-chat/conversations/group", response_model=ConversationResponse)
def create_group_conversation(
    payload: ConversationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = ResearchChatService.create_research_group(
        db=db,
        current_user=current_user,
        title=payload.title or "New Research Group",
        description=payload.description,
        initial_member_ids=payload.initial_member_ids
    )
    return _serialize_conversation(conv, current_user.id)


@router.get("/research-chat/conversations/{conversation_id}/details", response_model=ConversationDetailResponse)
def get_conversation_details(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ResearchChatService.verify_conversation_membership(db, conversation_id, current_user.id, current_user.role)

    conv = db.query(ResearchConversation).filter(ResearchConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    # Mark as read
    user_m = db.query(ResearchConversationMember).filter(
        ResearchConversationMember.conversation_id == conversation_id,
        ResearchConversationMember.user_id == current_user.id
    ).first()
    if user_m:
        user_m.last_read_at = datetime.utcnow()
        db.commit()

    members = [_serialize_member(m) for m in conv.members]
    findings = [_serialize_finding(f) for f in conv.findings]

    # Shared files & datasets across conversation messages
    attachments = db.query(ResearchAttachment).filter(ResearchAttachment.conversation_id == conversation_id).all()
    datasets = db.query(ResearchDatasetRef).filter(ResearchDatasetRef.conversation_id == conversation_id).all()

    total_msgs = db.query(ResearchMessage).filter(ResearchMessage.conversation_id == conversation_id).count()

    return ConversationDetailResponse(
        conversation=_serialize_conversation(conv, current_user.id),
        members=members,
        pinned_findings=findings,
        shared_files=[_serialize_attachment(a) for a in attachments],
        shared_datasets=[_serialize_dataset_ref(d) for d in datasets],
        total_messages=total_msgs
    )


@router.patch("/research-chat/conversations/{conversation_id}", response_model=ConversationResponse)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    member = ResearchChatService.verify_conversation_membership(db, conversation_id, current_user.id, current_user.role)
    if member.role not in ["owner", "admin"] and current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only group owner or admins can update group settings.")

    conv = db.query(ResearchConversation).filter(ResearchConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if payload.title is not None:
        conv.title = payload.title.strip()
    if payload.description is not None:
        conv.description = payload.description.strip()
    conv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(conv)
    return _serialize_conversation(conv, current_user.id)


@router.post("/research-chat/conversations/{conversation_id}/members", response_model=ConversationMemberResponse)
def add_member(
    conversation_id: str,
    payload: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    m = ResearchChatService.add_group_member(db, conversation_id, current_user, payload.user_id, payload.role)
    return _serialize_member(m)


@router.delete("/research-chat/conversations/{conversation_id}/members/{user_id}")
def remove_member(
    conversation_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ResearchChatService.remove_group_member(db, conversation_id, current_user, user_id)
    return {"status": "success", "message": "Member removed successfully."}


@router.get("/research-chat/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ResearchChatService.verify_conversation_membership(db, conversation_id, current_user.id, current_user.role)

    messages = db.query(ResearchMessage).filter(
        ResearchMessage.conversation_id == conversation_id
    ).order_by(desc(ResearchMessage.created_at)).offset(offset).limit(limit).all()

    messages.reverse()
    return [_serialize_message(m) for m in messages]


@router.post("/research-chat/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    payload: MessageSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg = ResearchChatService.send_message(
        db=db,
        conversation_id=conversation_id,
        sender=current_user,
        content=payload.content,
        parent_message_id=payload.parent_message_id,
        message_type=payload.message_type
    )

    serialized = _serialize_message(msg).model_dump()
    # Broadcast via WebSocket to active conversation peers
    await chat_ws_manager.broadcast_to_conversation(
        conversation_id,
        {"type": "NEW_MESSAGE", "message": serialized}
    )
    return _serialize_message(msg)


@router.patch("/research-chat/messages/{message_id}", response_model=MessageResponse)
def edit_message(
    message_id: str,
    payload: MessageEditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg = db.query(ResearchMessage).filter(ResearchMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    if msg.sender_id != current_user.id and current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="You can only edit your own messages.")

    msg.content = payload.content.strip()
    msg.is_edited = True
    msg.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return _serialize_message(msg)


@router.delete("/research-chat/messages/{message_id}")
def delete_message(
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg = db.query(ResearchMessage).filter(ResearchMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    if msg.sender_id != current_user.id and current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    db.delete(msg)
    db.commit()
    return {"status": "success", "message": "Message deleted."}


@router.post("/research-chat/messages/{message_id}/reactions", response_model=MessageResponse)
def toggle_reaction(
    message_id: str,
    payload: ReactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg = db.query(ResearchMessage).filter(ResearchMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    ResearchChatService.verify_conversation_membership(db, msg.conversation_id, current_user.id, current_user.role)

    reactions = dict(msg.reactions or {})
    emoji = payload.emoji
    user_list = reactions.get(emoji, [])
    if current_user.id in user_list:
        user_list.remove(current_user.id)
        if not user_list:
            reactions.pop(emoji, None)
        else:
            reactions[emoji] = user_list
    else:
        user_list.append(current_user.id)
        reactions[emoji] = user_list

    msg.reactions = reactions
    db.commit()
    db.refresh(msg)
    return _serialize_message(msg)


@router.post("/research-chat/conversations/{conversation_id}/files", response_model=MessageResponse)
async def share_file(
    conversation_id: str,
    file: UploadFile = File(...),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_bytes = await file.read()
    filename = file.filename or "shared_file.nc"
    msg = ResearchChatService.share_file(
        db=db,
        conversation_id=conversation_id,
        sender=current_user,
        filename=filename,
        file_bytes=file_bytes,
        note=note
    )
    serialized = _serialize_message(msg).model_dump()
    await chat_ws_manager.broadcast_to_conversation(
        conversation_id,
        {"type": "NEW_MESSAGE", "message": serialized}
    )
    return _serialize_message(msg)


@router.post("/research-chat/conversations/{conversation_id}/datasets", response_model=MessageResponse)
async def share_dataset(
    conversation_id: str,
    payload: DatasetShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg = ResearchChatService.share_dataset_reference(
        db=db,
        conversation_id=conversation_id,
        sender=current_user,
        dataset_id=payload.dataset_id,
        note=payload.note
    )
    serialized = _serialize_message(msg).model_dump()
    await chat_ws_manager.broadcast_to_conversation(
        conversation_id,
        {"type": "NEW_MESSAGE", "message": serialized}
    )
    return _serialize_message(msg)


@router.post("/research-chat/conversations/{conversation_id}/findings", response_model=PinnedFindingResponse)
def pin_finding(
    conversation_id: str,
    payload: PinFindingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    finding = ResearchChatService.pin_finding(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        finding_text=payload.finding_text,
        message_id=payload.message_id,
        related_dataset_id=payload.related_dataset_id
    )
    return _serialize_finding(finding)


@router.delete("/research-chat/findings/{finding_id}")
def unpin_finding(
    finding_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ResearchChatService.unpin_finding(db, finding_id, current_user)
    return {"status": "success", "message": "Finding unpinned."}


@router.post("/research-chat/conversations/{conversation_id}/ai-ask", response_model=AIResearchResponse)
async def ask_flowchat_ai(
    conversation_id: str,
    payload: AIAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ResearchChatService.execute_ai_research_assistant(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        question=payload.question,
        dataset_ids=payload.dataset_ids,
        include_context=payload.include_context
    )
    if result.get("blocked"):
        raise HTTPException(
            status_code=403,
            detail={
                "status": "blocked",
                "blocked": True,
                "reason": result.get("reason", "prompt_injection"),
                "message": "Request blocked by FlowChat security controls.",
            }
        )
    await chat_ws_manager.broadcast_to_conversation(
        conversation_id,
        {"type": "AI_UPDATED"}
    )
    return result


@router.post("/research-chat/conversations/{conversation_id}/ai-command", response_model=AIResearchResponse)
async def run_ai_command(
    conversation_id: str,
    payload: AICommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ResearchChatService.execute_ai_command(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        command=payload.command,
        dataset_ids=payload.dataset_ids
    )
    if result.get("blocked"):
        raise HTTPException(
            status_code=403,
            detail={
                "status": "blocked",
                "blocked": True,
                "reason": result.get("reason", "prompt_injection"),
                "message": "Request blocked by FlowChat security controls.",
            }
        )
    await chat_ws_manager.broadcast_to_conversation(
        conversation_id,
        {"type": "AI_UPDATED"}
    )
    return result


@router.get("/research-chat/researchers", response_model=List[ResearcherProfileResponse])
def search_researchers(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search authenticated researchers and colleagues without exposing sensitive columns.
    """
    query = db.query(User).filter(User.is_active == True)
    if q:
        search_term = f"%{q.strip()}%"
        query = query.filter(or_(User.name.ilike(search_term), User.email.ilike(search_term)))

    users = query.limit(30).all()
    results = []
    for u in users:
        results.append(ResearcherProfileResponse(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            organization="Ocean Research Institute" if u.role in ["Researcher", "Admin"] else ("Government Climate Agency" if u.role == "Government" else "Academic Institution"),
            is_active=u.is_active,
            last_login=u.last_login or "Recently",
            online_status="online" if u.id == current_user.id else "away"
        ))
    return results


@router.get("/research-chat/notifications", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifs = db.query(ResearchNotification).filter(
        ResearchNotification.user_id == current_user.id
    ).order_by(desc(ResearchNotification.created_at)).limit(40).all()

    return [
        NotificationResponse(
            id=n.id,
            type=n.type,
            title=n.title,
            content=n.content,
            conversation_id=n.conversation_id,
            message_id=n.message_id,
            is_read=n.is_read,
            created_at=n.created_at.strftime("%Y-%m-%d %H:%M") if n.created_at else ""
        )
        for n in notifs
    ]


@router.patch("/research-chat/notifications/read")
def mark_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(ResearchNotification).filter(
        ResearchNotification.user_id == current_user.id,
        ResearchNotification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "success"}


@router.get("/research-chat/search", response_model=SearchResultResponse)
def search_research_chat(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search across messages, researchers, groups, files, datasets, and pinned findings in user's scope.
    """
    clean_q = q.strip()
    term = f"%{clean_q}%"

    # User's authorized conversations
    memberships = db.query(ResearchConversationMember).filter(
        ResearchConversationMember.user_id == current_user.id
    ).all()
    conv_ids = [m.conversation_id for m in memberships]

    matched_msgs = db.query(ResearchMessage).filter(
        ResearchMessage.conversation_id.in_(conv_ids),
        ResearchMessage.content.ilike(term)
    ).limit(20).all()

    matched_groups = db.query(ResearchConversation).filter(
        ResearchConversation.id.in_(conv_ids),
        ResearchConversation.type == "group",
        or_(ResearchConversation.title.ilike(term), ResearchConversation.description.ilike(term))
    ).limit(10).all()

    matched_researchers = db.query(User).filter(
        User.is_active == True,
        or_(User.name.ilike(term), User.email.ilike(term))
    ).limit(10).all()

    matched_files = db.query(ResearchAttachment).filter(
        ResearchAttachment.conversation_id.in_(conv_ids),
        ResearchAttachment.filename.ilike(term)
    ).limit(15).all()

    matched_datasets = db.query(ResearchDatasetRef).filter(
        ResearchDatasetRef.conversation_id.in_(conv_ids),
        ResearchDatasetRef.dataset_name.ilike(term)
    ).limit(15).all()

    matched_findings = db.query(ResearchPinnedFinding).filter(
        ResearchPinnedFinding.conversation_id.in_(conv_ids),
        ResearchPinnedFinding.finding_text.ilike(term)
    ).limit(15).all()

    return SearchResultResponse(
        messages=[_serialize_message(m) for m in matched_msgs],
        researchers=[
            ResearcherProfileResponse(
                id=u.id, name=u.name, email=u.email, role=u.role,
                organization="Ocean Research Institute", is_active=u.is_active, last_login=u.last_login
            ) for u in matched_researchers
        ],
        groups=[_serialize_conversation(g, current_user.id) for g in matched_groups],
        files=[_serialize_attachment(f) for f in matched_files],
        datasets=[_serialize_dataset_ref(d) for d in matched_datasets],
        findings=[_serialize_finding(f) for f in matched_findings]
    )


# ---------------------------------------------------------------------------
# WebSocket Endpoint for Live Research Chat
# ---------------------------------------------------------------------------
@router.websocket("/ws/research-chat/{conversation_id}")
async def websocket_research_chat_endpoint(
    websocket: WebSocket,
    conversation_id: str
):
    await chat_ws_manager.connect(conversation_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Heartbeat / ping response
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        chat_ws_manager.disconnect(conversation_id, websocket)
    except Exception:
        chat_ws_manager.disconnect(conversation_id, websocket)
