from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class DatasetResponse(BaseModel):
    id: str
    dataset_name: str
    dataset_type: str
    file_path: str
    file_size: str
    sha256_hash: str
    upload_date: datetime
    uploaded_by: str
    verification_status: str
    duplicate_status: Optional[str] = "Unique"
    content_fingerprint: Optional[str] = None
    similarity_score: Optional[float] = 0.0
    duplicate_of_id: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    ai_analysis: Optional[Dict[str, Any]] = None
    validation_details: Optional[Dict[str, Any]] = None
    status: str

    class Config:
        from_attributes = True

class FileVerifyRequest(BaseModel):
    sha256_hash: str

class DatasetCompareRequest(BaseModel):
    dataset_a_id: str
    dataset_b_id: str

class DatasetReviewActionRequest(BaseModel):
    action: str # "approve", "reject", "mark_duplicate", "keep_both", "quarantine"
    notes: Optional[str] = None
