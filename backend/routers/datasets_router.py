
import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database.connection import get_db
from backend.models.dataset import Dataset
from backend.models.duplicate_review import DuplicateReview
from backend.models.audit import AuditLog
from backend.models.security import SecurityEvent
from backend.schemas.dataset import (
    DatasetResponse,
    DatasetCompareRequest,
    DatasetReviewActionRequest
)
from backend.auth.dependencies import require_researcher, require_admin, get_current_user, require_permission
from backend.auth.permissions import Permission
from backend.services.duplicate_detector import DuplicateDetectorService
from backend.services.netcdf_service import NetCDFService
from backend.services.ocean_ingestion_service import OceanIngestionService
from backend.models.user import User
from backend.utils.logger import sec_logger
from backend.middleware.rate_limiter import rate_limiter


router = APIRouter(prefix="", tags=["Datasets Pipeline"])

UPLOAD_DIR = "./uploaded_datasets"
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB Limit

@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    request: Request,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_permission(Permission.DATASET_UPLOAD))
):
    """
    Unified Dataset Upload & Duplicate Detection Pipeline:
    1. File Format & Size Validation
    2. Prompt Injection & Payload Security Scan
    3. SHA-256 Calculation
    4. Exact Duplicate Check (Stops upload IMMEDIATELY before registration if matched)
    5. Content Fingerprint Generation & Schema Near-Duplicate Check
    6. AI Structural & Oceanographic Validation
    7. Registration & Audit Logging
    """
    rate_limiter.check_and_enforce(request, category="upload", limit=15, window_seconds=60)
    client_ip = request.client.host if request.client else "127.0.0.1"
    filename = file.filename or "ocean_dataset.nc"
    ext = os.path.splitext(filename)[1].lower()
    
    # 1. Format validation
    if ext not in [".nc", ".csv", ".json"]:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Allowed formats: .nc (NetCDF-3), .csv, .json"
        )

    file_bytes = await file.read()

    # Size & emptiness validation
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400, 
            detail=f"File exceeds maximum allowed size of 100 MB (Got {len(file_bytes) / (1024*1024):.1f} MB)."
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 2. Calculate true SHA-256 checksum
    sha256_hash = DuplicateDetectorService.compute_sha256(file_bytes)

    # 3. CRITICAL: Exact Duplicate Check DURING upload (BEFORE registration)
    existing_exact = DuplicateDetectorService.check_exact_duplicate(db, sha256_hash)
    if existing_exact:
        # Halt upload immediately. Do NOT create record, do NOT index.
        sec_logger.warning(
            f"DUPLICATE DETECTED: Uploaded file '{filename}' matches existing dataset '{existing_exact.dataset_name}' (SHA-256: {sha256_hash})"
        )
        audit = AuditLog(
            username=current_user.name,
            role=current_user.role,
            action="DUPLICATE_DATASET",
            ip_address=client_ip,
            status="Denied",
            description=f"Duplicate dataset upload halted: '{filename}' matches '{existing_exact.dataset_name}' (SHA-256: {sha256_hash[:16]}...)"
        )
        db.add(audit)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "status": "DUPLICATE",
                "error": "DUPLICATE_DATASET_DETECTED",
                "message": "This dataset already exists in FloatChat.",
                "filename": filename,
                "existing_dataset_id": existing_exact.id,
                "existing_dataset_name": existing_exact.dataset_name,
                "sha256": sha256_hash,
                "uploaded_date": existing_exact.upload_date.strftime("%d %b %Y") if existing_exact.upload_date else "Recent",
                "uploaded_by": existing_exact.uploaded_by
            }
        )

    # 4. Parse metadata & perform embedded security scan
    try:
        extracted_meta = NetCDFService.parse_and_extract_metadata(filename, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process dataset: {str(e)}")

    if extracted_meta.get("security_status") == "BLOCKED":
        sec_evt = SecurityEvent(
            event_type="DOCUMENT_PROMPT_INJECTION (Suspicious Dataset Instruction)",
            severity="High",
            risk_score=90,
            risk_level="CRITICAL",
            action_taken="BLOCK",
            source=f"DocumentScan:{filename}",
            status="BLOCKED",
            user_role=current_user.role,
            username=current_user.name,
            ip=client_ip,
            details=f"Dataset '{filename}' blocked: {extracted_meta.get('error')}"
        )
        audit = AuditLog(
            username=current_user.name,
            role=current_user.role,
            action="DATASET_BLOCKED",
            ip_address=client_ip,
            status="Denied",
            description=f"Security Gateway blocked dataset '{filename}' for malicious prompt injection instructions."
        )
        db.add(sec_evt)
        db.add(audit)
        db.commit()
        raise HTTPException(
            status_code=403, 
            detail="Dataset upload blocked: File contains unauthorized prompt-injection or destructive command payload."
        )


    # 5. Content Fingerprint & Near-Duplicate Analysis
    content_fingerprint = DuplicateDetectorService.generate_content_fingerprint(extracted_meta)
    near_dup = DuplicateDetectorService.check_near_duplicates(db, extracted_meta)

    # 6. AI Document/Dataset Validation
    ai_val = NetCDFService.validate_dataset_ai(filename, extracted_meta)

    duplicate_status = "Unique"
    similarity_score = 0.0
    duplicate_of_id = None

    if near_dup:
        similarity_score = near_dup.get("similarity_score", 0.0)
        duplicate_of_id = near_dup.get("existing_dataset_id")
        duplicate_status = "Possible Duplicate"

    # Save to upload directory
    file_path = os.path.join(UPLOAD_DIR, f"{sha256_hash[:12]}_{filename}")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    file_size_str = f"{len(file_bytes) / (1024 * 1024):.2f} MB" if len(file_bytes) >= 1024*1024 else f"{len(file_bytes) / 1024:.1f} KB"

    # 7. Register dataset
    new_ds = Dataset(
        dataset_name=filename,
        dataset_type=ext,
        file_path=file_path,
        file_size=file_size_str,
        sha256_hash=sha256_hash,
        uploaded_by=current_user.name,
        verification_status=ai_val.get("status", "Verified"),
        duplicate_status=duplicate_status,
        content_fingerprint=content_fingerprint,
        similarity_score=similarity_score,
        duplicate_of_id=duplicate_of_id,
        meta_data=extracted_meta,
        ai_analysis=ai_val,
        validation_details={
            "sha256": sha256_hash,
            "content_fingerprint": content_fingerprint,
            "ai_confidence": ai_val.get("confidence", 95.0),
            "reasons": ai_val.get("reasons", []),
            "flags": ai_val.get("flags", []),
            "detected_variables": ai_val.get("detected_variables", [])
        },
        status="Active"
    )
    db.add(new_ds)
    db.commit()
    db.refresh(new_ds)

    # Ingest discrete physical measurements into real ocean_observations table
    sample_recs = extracted_meta.get("sample_records", [])
    if sample_recs:
        detected_wmo = extracted_meta.get("wmo_id", filename.split(".")[0])
        obs_payloads = []
        for r in sample_recs:
            if "temperature" in r and "depth" in r:
                obs_payloads.append({
                    "source": "UPLOADED_NETCDF" if ext == ".nc" else "UPLOADED_FILE",
                    "dataset": filename,
                    "wmo_id": str(r.get("wmo_id", detected_wmo)),
                    "platform_id": str(detected_wmo),
                    "observation_timestamp": r.get("time") or datetime.utcnow().isoformat(),
                    "latitude": r.get("latitude", 0.0),
                    "longitude": r.get("longitude", 0.0),
                    "depth": r.get("depth", 0.0),
                    "pressure": r.get("pressure", r.get("depth", 0.0)),
                    "temperature": r.get("temperature", 0.0),
                    "salinity": r.get("salinity"),
                    "quality_flag": "1",
                    "source_reference": file_path
                })
        if obs_payloads:
            OceanIngestionService.ingest_observations_batch(obs_payloads, db, actor_name=current_user.name)

    # If near-duplicate, record DuplicateReview entry
    if near_dup and duplicate_of_id:
        rev = DuplicateReview(
            dataset_a_id=duplicate_of_id,
            dataset_b_id=new_ds.id,
            dataset_a_name=near_dup.get("existing_dataset_name", ""),
            dataset_b_name=new_ds.dataset_name,
            sha256_a=near_dup.get("existing_sha256", ""),
            sha256_b=new_ds.sha256_hash,
            similarity_score=similarity_score,
            matching_elements=near_dup.get("matching_elements", []),
            differences=near_dup.get("differences", []),
            status="UNDER_REVIEW"
        )
        db.add(rev)
        
        audit = AuditLog(
            username=current_user.name,
            role=current_user.role,
            action="NEAR_DUPLICATE_FLAGGED",
            ip_address=client_ip,
            status="Pending",
            description=f"Possible duplicate dataset flagged: '{filename}' is {similarity_score}% similar to '{near_dup.get('existing_dataset_name')}'"
        )
        db.add(audit)
        db.commit()
    else:
        audit = AuditLog(
            username=current_user.name,
            role=current_user.role,
            action="UPLOAD_DATASET",
            ip_address=client_ip,
            status="Success",
            description=f"Uploaded {filename} ({file_size_str}) - SHA-256 Verified Unique with {extracted_meta.get('record_count', 0)} records"
        )
        db.add(audit)
        db.commit()

    return new_ds

# ---------------------------------------------------------------------------
# Dataset Queries & Admin Integrity Operations
# ---------------------------------------------------------------------------

@router.get("/datasets", response_model=List[DatasetResponse])
def list_datasets(db: Session = Depends(get_db), current_user: User = Depends(require_permission(Permission.DATASET_READ))):
    return db.query(Dataset).order_by(Dataset.upload_date.desc()).all()

@router.get("/datasets/integrity-stats")
def get_dataset_integrity_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns live database metrics for the Administrator Document/Dataset Integrity Dashboard.
    """
    total_datasets = db.query(Dataset).filter(Dataset.status != "Deleted").count()
    unique_count = db.query(Dataset).filter(Dataset.duplicate_status == "Unique", Dataset.status == "Active").count()
    possible_duplicates = db.query(Dataset).filter(Dataset.duplicate_status.in_(["Possible Duplicate", "UNDER_REVIEW"])).count()
    
    # Blocked duplicate attempts logged in audit
    duplicates_blocked = db.query(AuditLog).filter(AuditLog.action == "DUPLICATE_DATASET").count()
    
    invalid_count = db.query(Dataset).filter(Dataset.verification_status.in_(["Invalid", "Failed", "INVALID"])).count()
    under_review_count = db.query(Dataset).filter(Dataset.duplicate_status.in_(["Under Review", "UNDER_REVIEW", "Possible Duplicate"])).count()
    quarantined_count = db.query(Dataset).filter(Dataset.status == "Quarantined").count()

    return {
        "total_datasets": total_datasets,
        "unique": unique_count,
        "duplicates": duplicates_blocked,
        "possible_duplicates": possible_duplicates,
        "invalid": invalid_count,
        "under_review": under_review_count,
        "quarantined": quarantined_count
    }

@router.post("/datasets/compare")
def compare_datasets(
    payload: DatasetCompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Side-by-side comparison of two datasets (e.g. possible duplicates).
    """
    ds_a = db.query(Dataset).filter(Dataset.id == payload.dataset_a_id).first()
    ds_b = db.query(Dataset).filter(Dataset.id == payload.dataset_b_id).first()

    if not ds_a or not ds_b:
        raise HTTPException(status_code=404, detail="One or both datasets could not be found.")

    meta_a = ds_a.meta_data or {}
    meta_b = ds_b.meta_data or {}

    similarity, matching_elements, differences = DuplicateDetectorService.calculate_similarity(meta_a, meta_b)

    return {
        "dataset_a": {
            "id": ds_a.id,
            "filename": ds_a.dataset_name,
            "sha256": ds_a.sha256_hash,
            "format": ds_a.dataset_type,
            "size": ds_a.file_size,
            "uploaded_by": ds_a.uploaded_by,
            "upload_date": ds_a.upload_date.strftime("%d %b %Y") if ds_a.upload_date else "",
            "variables": meta_a.get("columns") or meta_a.get("variables") or [],
            "record_count": meta_a.get("record_count", 0),
            "coordinates": {
                "latitude": [meta_a.get("latitude_min"), meta_a.get("latitude_max")],
                "longitude": [meta_a.get("longitude_min"), meta_a.get("longitude_max")]
            },
            "telemetry": {
                "temperature_avg": meta_a.get("temperature_avg"),
                "salinity_avg": meta_a.get("salinity_avg"),
                "pressure_avg": meta_a.get("pressure_avg")
            }
        },
        "dataset_b": {
            "id": ds_b.id,
            "filename": ds_b.dataset_name,
            "sha256": ds_b.sha256_hash,
            "format": ds_b.dataset_type,
            "size": ds_b.file_size,
            "uploaded_by": ds_b.uploaded_by,
            "upload_date": ds_b.upload_date.strftime("%d %b %Y") if ds_b.upload_date else "",
            "variables": meta_b.get("columns") or meta_b.get("variables") or [],
            "record_count": meta_b.get("record_count", 0),
            "coordinates": {
                "latitude": [meta_b.get("latitude_min"), meta_b.get("latitude_max")],
                "longitude": [meta_b.get("longitude_min"), meta_b.get("longitude_max")]
            },
            "telemetry": {
                "temperature_avg": meta_b.get("temperature_avg"),
                "salinity_avg": meta_b.get("salinity_avg"),
                "pressure_avg": meta_b.get("pressure_avg")
            }
        },
        "similarity_score": similarity,
        "matching_elements": matching_elements,
        "differences": differences
    }

@router.post("/datasets/{dataset_id}/review-action")
def perform_review_action(
    dataset_id: str,
    payload: DatasetReviewActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Administrator decision on flagged or possible duplicate dataset:
    - approve: marks dataset as Unique & Verified
    - reject: removes dataset and marks rejected
    - mark_duplicate: marks duplicate status as Duplicate
    - keep_both: approves both datasets as distinct valid versions
    - quarantine: moves dataset into isolated quarantine
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    action = payload.action.lower()
    if action == "approve" or action == "keep_both":
        ds.duplicate_status = "Unique"
        ds.verification_status = "Verified"
        ds.status = "Active"
    elif action == "mark_duplicate":
        ds.duplicate_status = "Duplicate"
    elif action == "quarantine":
        ds.duplicate_status = "Quarantined"
        ds.status = "Quarantined"
    elif action == "reject":
        ds.duplicate_status = "Rejected"
        ds.status = "Deleted"
        if ds.file_path and os.path.exists(ds.file_path):
            try: os.remove(ds.file_path)
            except OSError: pass

    # Update any matching duplicate review
    rev = db.query(DuplicateReview).filter(
        (DuplicateReview.dataset_b_id == dataset_id) | (DuplicateReview.dataset_a_id == dataset_id)
    ).first()
    if rev:
        rev.status = action.upper()
        rev.admin_decision = action
        rev.admin_user = current_user.name
        rev.reviewed_at = datetime.utcnow()

    audit = AuditLog(
        username=current_user.name,
        role=current_user.role,
        action="ADMIN_DUPLICATE_DECISION",
        ip_address=client_ip,
        status="Success",
        description=f"Admin decision '{action}' applied to dataset '{ds.dataset_name}' (ID: {ds.id})"
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "message": f"Dataset review action '{action}' successfully recorded.",
        "dataset_id": ds.id,
        "duplicate_status": ds.duplicate_status
    }

@router.get("/dataset/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds

@router.get("/dataset/{dataset_id}/preview")
def preview_dataset(dataset_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    meta = ds.meta_data or {}
    sample_records = meta.get("sample_records", [])[:50]
    
    return {
        "id": ds.id,
        "filename": ds.dataset_name,
        "format": ds.dataset_type,
        "file_size": ds.file_size,
        "sha256": ds.sha256_hash,
        "content_fingerprint": ds.content_fingerprint,
        "duplicate_status": ds.duplicate_status,
        "similarity_score": ds.similarity_score,
        "record_count": meta.get("record_count", 0),
        "columns": meta.get("columns") or meta.get("variables") or [],
        "dimensions": meta.get("dimensions", {}),
        "ai_analysis": ds.ai_analysis,
        "validation_details": ds.validation_details,
        "statistics": {
            "temperature": {"min": meta.get("temperature_min"), "max": meta.get("temperature_max"), "avg": meta.get("temperature_avg")},
            "salinity": {"min": meta.get("salinity_min"), "max": meta.get("salinity_max"), "avg": meta.get("salinity_avg")},
            "pressure": {"min": meta.get("pressure_min"), "max": meta.get("pressure_max"), "avg": meta.get("pressure_avg")},
            "depth": {"min": meta.get("depth_min"), "max": meta.get("depth_max"), "avg": meta.get("depth_avg")},
            "latitude": {"min": meta.get("latitude_min"), "max": meta.get("latitude_max")},
            "longitude": {"min": meta.get("longitude_min"), "max": meta.get("longitude_max")}
        },
        "sample_records": sample_records
    }

@router.delete("/dataset/{dataset_id}")
@router.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_permission(Permission.DATASET_DELETE))):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if ds.file_path and os.path.exists(ds.file_path):
        try: os.remove(ds.file_path)
        except OSError: pass

    db.delete(ds)
    audit = AuditLog(
        username=current_user.name,
        role=current_user.role,
        action="DELETE_DATASET",
        ip_address="127.0.0.1",
        status="Success",
        description=f"Deleted dataset {ds.dataset_name}"
    )
    db.add(audit)
    db.commit()
    return {"message": "Dataset deleted successfully"}
