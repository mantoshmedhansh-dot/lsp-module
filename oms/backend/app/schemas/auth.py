from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    avatar: Optional[str] = None
    role: str
    isActive: bool
    companyId: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    user: UserResponse
    token: str
