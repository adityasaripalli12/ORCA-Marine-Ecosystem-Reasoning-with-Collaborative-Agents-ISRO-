import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, JSON, DateTime
from backend.database.connection import Base

class DuplicateReview(Base):
    __tablename__ = "duplicate_reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_a_id = Column(String, nullable=False) # Existing dataset
    dataset_b_id = Column(String, nullable=False) # New / Uploaded dataset
    dataset_a_name = Column(String, nullable=False)
    dataset_b_name = Column(String, nullable=False)
    sha256_a = Column(String, nullable=False)
    sha256_b = Column(String, nullable=False)
    similarity_score = Column(Float, nullable=False)
    matching_elements = Column(JSON, nullable=True) # Matching variables, bounding box, record count, time range
    differences = Column(JSON, nullable=True) # Altered metadata, precision diffs, formatting changes
    status = Column(String, default="UNDER_REVIEW") # UNDER_REVIEW, APPROVED, REJECTED, MARKED_DUPLICATE, KEPT_BOTH
    admin_decision = Column(String, nullable=True)
    admin_user = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
