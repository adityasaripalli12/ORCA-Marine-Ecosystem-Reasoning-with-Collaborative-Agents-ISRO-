from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.models.user import User
from backend.models.audit import AuditLog
from backend.schemas.user import UserCreate, UserUpdate, UserResponse
from backend.auth.password import hash_password
from backend.auth.dependencies import require_admin, require_users_manage

router = APIRouter(prefix="", tags=["Users Management (Admin Only)"])

@router.get("/users", response_model=List[UserResponse])
@router.get("/admin/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_users_manage)):
    return db.query(User).all()

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_users_manage)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User email already registered")

    new_user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role
    )
    db.add(new_user)
    
    audit = AuditLog(
        username=current_user.name,
        role=current_user.role,
        action="CREATE_USER",
        ip_address="127.0.0.1",
        status="Success",
        description=f"Admin created user {payload.email} with role {payload.role}"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_users_manage)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name: user.name = payload.name
    if payload.role: user.role = payload.role
    if payload.is_active is not None: user.is_active = payload.is_active

    audit = AuditLog(
        username=current_user.name,
        role=current_user.role,
        action="UPDATE_USER",
        ip_address="127.0.0.1",
        status="Success",
        description=f"Admin updated user {user.email}"
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_users_manage)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    audit = AuditLog(
        username=current_user.name,
        role=current_user.role,
        action="DELETE_USER",
        ip_address="127.0.0.1",
        status="Success",
        description=f"Admin deleted user {user.email}"
    )
    db.add(audit)
    db.commit()
    return {"message": "User deleted successfully"}
