from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ResearcherProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization: Optional[str] = "Ocean Research Institute"
    phone_number: Optional[str] = None
    is_active: bool = True
    last_login: Optional[str] = None
    research_interests: Optional[List[str]] = ["Oceanography", "Argo Floats", "Climate Modeling"]
    online_status: Optional[str] = "online" # 'online', 'away', 'offline'

class ConversationMemberResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: str
    role: str # 'owner' | 'admin' | 'member'
    user_role: str # FlowChat role: 'Admin' | 'Researcher' | etc.
    joined_at: str
    last_read_at: Optional[str] = None

class AttachmentResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    file_size: str
    file_type: str
    sha256_hash: str
    duplicate_status: str
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    created_at: str

class DatasetRefResponse(BaseModel):
    id: str
    dataset_id: str
    dataset_name: str
    dataset_type: Optional[str] = ".nc"
    file_size: Optional[str] = None
    verification_status: Optional[str] = "Verified"
    duplicate_status: Optional[str] = "Unique"
    shared_by: str
    shared_by_name: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    created_at: str

class PinnedFindingResponse(BaseModel):
    id: str
    conversation_id: str
    message_id: Optional[str] = None
    author_id: str
    author_name: str
    finding_text: str
    related_dataset_id: Optional[str] = None
    related_dataset_name: Optional[str] = None
    pinned_by_id: str
    pinned_by_name: str
    created_at: str

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    content: str
    message_type: str # 'text' | 'file' | 'dataset' | 'ai_response' | 'system'
    parent_message_id: Optional[str] = None
    parent_message_preview: Optional[str] = None
    is_edited: bool = False
    is_pinned: bool = False
    reactions: Dict[str, List[str]] = {}
    attachments: List[AttachmentResponse] = []
    dataset_refs: List[DatasetRefResponse] = []
    created_at: str
    updated_at: str

class ConversationResponse(BaseModel):
    id: str
    type: str # 'direct' | 'group'
    title: str
    description: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str
    unread_count: int = 0
    last_message: Optional[MessageResponse] = None
    members: List[ConversationMemberResponse] = []
    direct_target_user: Optional[ResearcherProfileResponse] = None

class ConversationDetailResponse(BaseModel):
    conversation: ConversationResponse
    members: List[ConversationMemberResponse]
    pinned_findings: List[PinnedFindingResponse]
    shared_files: List[AttachmentResponse]
    shared_datasets: List[DatasetRefResponse]
    total_messages: int

class ConversationCreateRequest(BaseModel):
    type: str = "direct" # 'direct' | 'group'
    target_user_id: Optional[str] = None # For direct
    title: Optional[str] = None # For group
    description: Optional[str] = None
    initial_member_ids: Optional[List[str]] = []

class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "member" # 'admin' | 'member'

class MessageSendRequest(BaseModel):
    content: str
    parent_message_id: Optional[str] = None
    message_type: str = "text"

class MessageEditRequest(BaseModel):
    content: str

class DatasetShareRequest(BaseModel):
    dataset_id: str
    note: Optional[str] = None

class PinFindingRequest(BaseModel):
    message_id: Optional[str] = None
    finding_text: str
    related_dataset_id: Optional[str] = None

class ReactionRequest(BaseModel):
    emoji: str # e.g. "👍", "❤️", "🔬", "💡", "⚠️"

class AIAskRequest(BaseModel):
    question: str
    dataset_ids: Optional[List[str]] = None
    include_context: bool = True

class AICommandRequest(BaseModel):
    command: str # 'summarize' | 'extract_findings' | 'compare_datasets' | 'identify_questions' | 'suggest_followup' | 'find_contradictions'
    dataset_ids: Optional[List[str]] = None

class AIResearchResponse(BaseModel):
    blocked: bool = False
    status: Optional[str] = None
    reason: Optional[str] = None
    command: Optional[str] = None
    ai_response: str
    confidence_score: float = 98.4
    context_sources: List[str] = []
    suggested_actions: List[str] = []
    execution_time_ms: int = 45

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    content: str
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None
    is_read: bool
    created_at: str

class SearchResultResponse(BaseModel):
    messages: List[MessageResponse] = []
    researchers: List[ResearcherProfileResponse] = []
    groups: List[ConversationResponse] = []
    files: List[AttachmentResponse] = []
    datasets: List[DatasetRefResponse] = []
    findings: List[PinnedFindingResponse] = []
