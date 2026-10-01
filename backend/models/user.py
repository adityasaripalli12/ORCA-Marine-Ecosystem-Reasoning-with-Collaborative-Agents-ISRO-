import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from backend.database.connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="Researcher", nullable=False) # Admin, Researcher, Student, Government
    phone_number = Column(String, default="+918125768347")
    mfa_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(String, default="Never")
