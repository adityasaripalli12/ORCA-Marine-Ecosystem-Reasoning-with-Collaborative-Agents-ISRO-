import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from backend.database.connection import Base

class ResearchConversation(Base):
    __tablename__ = "research_conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String, nullable=False, default="direct") # 'direct' | 'group'
    title = Column(String, nullable=True) # Name for group, or custom topic
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("ResearchConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("ResearchMessage", back_populates="conversation", cascade="all, delete-orphan")
    findings = relationship("ResearchPinnedFinding", back_populates="conversation", cascade="all, delete-orphan")


class ResearchConversationMember(Base):
    __tablename__ = "research_conversation_members"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("research_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, default="member") # 'owner' | 'admin' | 'member'
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("ResearchConversation", back_populates="members")
    user = relationship("User")

    __table_args__ = (
        Index("ix_conv_user", "conversation_id", "user_id", unique=True),
    )


class ResearchMessage(Base):
    __tablename__ = "research_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("research_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text") # 'text', 'file', 'dataset', 'ai_response', 'system'
    parent_message_id = Column(String, ForeignKey("research_messages.id"), nullable=True)
    is_edited = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    reactions = Column(JSON, default=dict) # {"👍": ["user_id1"], ...}
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    conversation = relationship("ResearchConversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    attachments = relationship("ResearchAttachment", back_populates="message", cascade="all, delete-orphan")
    dataset_refs = relationship("ResearchDatasetRef", back_populates="message", cascade="all, delete-orphan")


class ResearchAttachment(Base):
    __tablename__ = "research_attachments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("research_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("research_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    sha256_hash = Column(String, index=True, nullable=False)
    duplicate_status = Column(String, default="Unique")
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("ResearchMessage", back_populates="attachments")


class ResearchDatasetRef(Base):
    __tablename__ = "research_dataset_refs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("research_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("research_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False, index=True)
    dataset_name = Column(String, nullable=False)
    shared_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("ResearchMessage", back_populates="dataset_refs")
    dataset = relationship("Dataset")


class ResearchPinnedFinding(Base):
    __tablename__ = "research_pinned_findings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("research_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id = Column(String, ForeignKey("research_messages.id", ondelete="CASCADE"), nullable=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    finding_text = Column(Text, nullable=False)
    related_dataset_id = Column(String, ForeignKey("datasets.id"), nullable=True)
    pinned_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("ResearchConversation", back_populates="findings")
    author = relationship("User", foreign_keys=[author_id])
    pinned_by = relationship("User", foreign_keys=[pinned_by_id])
    dataset = relationship("Dataset", foreign_keys=[related_dataset_id])


class ResearchNotification(Base):
    __tablename__ = "research_notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False) # 'direct_message', 'group_message', 'group_invite', 'file_shared', 'dataset_shared', 'mention', 'reply'
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    conversation_id = Column(String, nullable=True)
    message_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
