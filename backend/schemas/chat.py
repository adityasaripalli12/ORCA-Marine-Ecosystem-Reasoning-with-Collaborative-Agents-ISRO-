from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatMessageItem(BaseModel):
    role: str # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    question: str
    dataset_id: Optional[str] = None
    device_id: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None # Conversation history for context memory
    confirmed_action: Optional[str] = None # For explicit confirmation of high-risk actions
    language: Optional[str] = None # User language preference (e.g. 'en', 'te', 'hi')

class SqlGenerateRequest(BaseModel):
    question: str

class RagSearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5

class LocationItem(BaseModel):
    name: str
    latitude: float
    longitude: float
    depth: Optional[float] = None
    temp: Optional[float] = None
    salinity: Optional[float] = None
    details: Optional[str] = None
    type: Optional[str] = "point"

class ScientificProvenance(BaseModel):
    source: str = "ARGO Global Assembly Center"
    dataset: Optional[str] = None
    wmo_id: Optional[str] = None
    observation_time: Optional[str] = None
    data_age: Optional[str] = None
    quality_flag: Optional[str] = "QC 1 (Good)"
    confidence_label: str = "HIGH"
    evidence_score: float = 90.0

class ChatResponse(BaseModel):
    id: str
    question: str
    intent: str = "GENERAL_AI"
    map_action: Optional[str] = "NONE"
    device_id: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    generated_sql: Optional[str] = None
    ai_response: str
    confidence_score: float = 85.0
    confidence_label: Optional[str] = "HIGH"
    provenance: Optional[ScientificProvenance] = None
    observation_data: Optional[Dict[str, Any]] = None
    retrieved_docs: Optional[List[Dict[str, Any]]] = None
    execution_time_ms: int = 142
    has_geo_data: bool = False
    requires_map: bool = False
    requires_confirmation: Optional[bool] = False
    confirmation_action: Optional[str] = None
    risk_score: Optional[int] = 10
    risk_level: Optional[str] = "LOW"
    locations: Optional[List[Dict[str, Any]]] = None
    sources: Optional[List[str]] = None
    dataset_used: Optional[str] = None
    records_retrieved: Optional[int] = None
    suggestions: Optional[List[str]] = None
    detected_language: Optional[str] = "en"
    translated_query: Optional[str] = None


