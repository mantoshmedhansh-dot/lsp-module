from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class PaginatedResponse(BaseModel):
    data: List[Any]
    total: int
    page: int
    pageSize: int
    totalPages: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
