"""
FastAPI Dependencies
Centralized authentication, authorization, and database session management
"""
from typing import Generator, Callable, Any, Optional, List
from uuid import UUID

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select

from .database import get_session
from .security import verify_token

# Security scheme for Bearer token authentication
security = HTTPBearer(auto_error=False)


# Forward reference for User model (resolved at runtime)
def _get_user_model():
    """Lazy import to avoid circular dependencies"""
    from app.models.user import User
    return User


def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency.
    Usage: db: Session = Depends(get_db)
    """
    yield from get_session()


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Any]:
    """
    Get current user if authenticated, None otherwise.
    Use this for endpoints that work with or without authentication.
    Supports both Bearer token and X-User-Id header (for frontend proxy).
    """
    User = _get_user_model()
    user_id = None

    # First try Bearer token
    if credentials:
        token = credentials.credentials
        payload = verify_token(token)
        if payload:
            user_id = payload.get("user_id")

    # Then try X-User-Id header (frontend proxy auth)
    if not user_id:
        user_id = request.headers.get("X-User-Id")

    if not user_id:
        return None

    try:
        user = db.exec(select(User).where(User.id == UUID(user_id))).first()
    except (ValueError, TypeError):
        return None

    return user


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get current authenticated user.
    Raises 401 if not authenticated.
    Supports both Bearer token and X-User-Id header (for frontend proxy).

    Usage: current_user: User = Depends(get_current_user)
    """
    User = _get_user_model()
    user_id = None

    # First try Bearer token
    if credentials:
        token = credentials.credentials
        payload = verify_token(token)
        if payload:
            user_id = payload.get("user_id")

    # Then try X-User-Id header (frontend proxy auth)
    if not user_id:
        user_id = request.headers.get("X-User-Id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = db.exec(select(User).where(User.id == UUID(user_id))).first()
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.isActive:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    current_user: Any = Depends(get_current_user)
) -> Any:
    """
    Get current active user.
    Alias for get_current_user with explicit active check.
    """
    return current_user


def require_roles(allowed_roles: List[str]) -> Callable:
    """
    Role-based access control dependency factory.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            _: None = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
            current_user: User = Depends(get_current_user)
        ):
            ...
    """
    async def role_checker(current_user: Any = Depends(get_current_user)) -> None:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized for this action"
            )
    return role_checker


def require_any_role(*roles: str) -> Callable:
    """
    Convenience wrapper for require_roles.

    Usage:
        @router.get("/managers")
        async def managers_endpoint(
            _: None = Depends(require_any_role("SUPER_ADMIN", "ADMIN", "MANAGER"))
        ):
            ...
    """
    return require_roles(list(roles))


def require_super_admin() -> Callable:
    """Require SUPER_ADMIN role"""
    return require_roles(["SUPER_ADMIN"])


def require_admin() -> Callable:
    """Require ADMIN or SUPER_ADMIN role"""
    return require_roles(["SUPER_ADMIN", "ADMIN"])


def require_manager() -> Callable:
    """Require MANAGER, ADMIN, or SUPER_ADMIN role"""
    return require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


def require_client() -> Callable:
    """Require CLIENT, MANAGER, ADMIN, or SUPER_ADMIN role (any authenticated user with company)"""
    return require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER", "CLIENT"])


class CompanyFilter:
    """
    Multi-tenant company filter dependency.

    Automatically filters queries by company based on user role:
    - SUPER_ADMIN: Can see all companies (no filter)
    - LSP users: See own company + all client brand companies
    - Brand users: Filtered to their company only

    Usage:
        @router.get("/items")
        async def list_items(
            company_filter: CompanyFilter = Depends(),
            db: Session = Depends(get_db)
        ):
            query = select(Item)
            query = company_filter.apply_filter(query, Item.companyId)
            ...
    """

    def __init__(self, current_user: Any = Depends(get_current_user), db: Session = Depends(get_db)):
        self.user = current_user
        self.db = db
        self.is_super_admin = current_user.role == "SUPER_ADMIN"
        self.company_id: Optional[UUID] = None if self.is_super_admin else current_user.companyId
        self._company_ids: Optional[List[UUID]] = None  # Cached list for LSP hierarchy

    @property
    def company_ids(self) -> Optional[List[UUID]]:
        """Get all company IDs this user can access (for LSP hierarchy)."""
        if self.is_super_admin:
            return None  # No filter
        if self._company_ids is not None:
            return self._company_ids

        # Check if user's company is an LSP
        from app.models.company import Company
        company = self.db.exec(
            select(Company).where(Company.id == self.company_id)
        ).first()

        if company and company.companyType == "LSP":
            # LSP sees own data + all child brand data
            children = self.db.exec(
                select(Company.id).where(Company.parentId == self.company_id)
            ).all()
            self._company_ids = [self.company_id] + list(children)
        else:
            self._company_ids = [self.company_id] if self.company_id else None

        return self._company_ids

    def apply_filter(self, query: Any, company_field: Any) -> Any:
        """Apply company filter to a query (supports LSP hierarchy)."""
        if self.is_super_admin:
            return query
        ids = self.company_ids
        if ids and len(ids) > 1:
            # LSP: filter to own + children
            return query.where(company_field.in_(ids))
        elif self.company_id:
            return query.where(company_field == self.company_id)
        return query
