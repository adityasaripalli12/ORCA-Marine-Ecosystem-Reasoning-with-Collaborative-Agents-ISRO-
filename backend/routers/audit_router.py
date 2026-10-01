from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.models.audit import AuditLog
from backend.schemas.audit import AuditLogResponse
from backend.auth.dependencies import require_admin, require_audit_read
from backend.models.user import User

router = APIRouter(prefix="", tags=["Audit Ledger (Admin Only)"])

@router.get("/audit-logs", response_model=List[AuditLogResponse])
@router.get("/admin/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(db: Session = Depends(get_db), current_user: User = Depends(require_audit_read)):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()


