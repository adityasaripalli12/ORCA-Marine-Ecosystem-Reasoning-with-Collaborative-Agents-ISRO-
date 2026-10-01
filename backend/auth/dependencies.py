from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.auth.jwt import decode_access_token
from backend.models.user import User
from backend.auth.permissions import Permission, ROLE_PERMISSIONS

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found",
        )
    return user

def require_permission(required_permission: Permission) -> Callable:
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role
        granted_permissions = ROLE_PERMISSIONS.get(user_role, set())
        if required_permission not in granted_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: 403 Forbidden. Permission '{required_permission.value}' required for role '{user_role}'.",
            )
        return current_user
    return dependency

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: 403 Forbidden. Administrator privilege required.",
        )
    return current_user

def require_researcher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["Admin", "Researcher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: 403 Forbidden. Researcher privilege required.",
        )
    return current_user

def require_admin_or_gov(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["Admin", "Government"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: 403 Forbidden. Restricted to Administrator and Government roles only.",
        )
    return current_user

# Convenience permission dependencies
require_users_manage = require_permission(Permission.USERS_MANAGE)
require_audit_read = require_permission(Permission.AUDIT_READ)
require_security_read = require_permission(Permission.SECURITY_READ)
require_dataset_delete = require_permission(Permission.DATASET_DELETE)

