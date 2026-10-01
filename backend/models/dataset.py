import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, JSON, DateTime
from backend.database.connection import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_name = Column(String, nullable=False)
    dataset_type = Column(String, nullable=False) # .nc, .csv, .json
    file_path = Column(String, nullable=False)
    file_size = Column(String, nullable=False)
    sha256_hash = Column(String, unique=True, index=True, nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    uploaded_by = Column(String, nullable=False)
    verification_status = Column(String, default="Verified") # Verified, Pending, Failed, Invalid, Quarantined
    duplicate_status = Column(String, default="Unique") # Unique, Duplicate, Possible Duplicate, Under Review, Invalid, Quarantined
    content_fingerprint = Column(String, index=True, nullable=True)
    similarity_score = Column(Float, nullable=True, default=0.0)
    duplicate_of_id = Column(String, nullable=True)
    meta_data = Column(JSON, nullable=True) # Lat, Long, Temp, Salinity, Depth
    ai_analysis = Column(JSON, nullable=True) # AI Confidence, validation flags, prompt injection checks
    validation_details = Column(JSON, nullable=True) # Detailed integrity & structural verification report
    status = Column(String, default="Active")
