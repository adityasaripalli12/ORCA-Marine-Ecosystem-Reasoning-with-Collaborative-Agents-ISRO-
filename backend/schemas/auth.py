from pydantic import BaseModel, EmailStr
from typing import Optional, List, Union, Any

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = None

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "Researcher"
    phone_number: Optional[str] = None
    organization: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = "success"
    message: Optional[str] = "Authenticated successfully"


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone_number: Optional[str] = None
    is_active: bool
    last_login: str
