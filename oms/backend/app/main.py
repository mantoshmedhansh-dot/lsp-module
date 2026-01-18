import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.routes import api_router
from .services.scheduler import start_scheduler, shutdown_scheduler, get_last_scan_result

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events for the FastAPI app."""
    # Startup
    logger.info("Starting CJDQuick OMS API...")
    start_scheduler()
    logger.info("Scheduler started - Detection Engine will run every 15 minutes")
    yield
    # Shutdown
    logger.info("Shutting down CJDQuick OMS API...")
    shutdown_scheduler()
    logger.info("Scheduler stopped")


app = FastAPI(
    title=settings.APP_NAME,
    description="CJDQuick Order Management System API",
    version="1.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "https://cjdquick-oms.vercel.app",
        "https://oms-sable.vercel.app",
        "https://*.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "message": "CJDQuick OMS API",
        "version": "1.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "deploy": "auto", "version": "1.2.0"}


@app.get("/scheduler/status")
async def scheduler_status():
    """Get scheduler status and last scan result."""
    return {
        "scheduler": "running",
        "detection_engine": {
            "interval": "15 minutes",
            "last_scan": get_last_scan_result()
        }
    }


@app.get("/debug/db")
async def debug_db():
    """Debug endpoint to test database connection"""
    from .core.database import SessionLocal
    from .core.config import settings
    import traceback

    result = {
        "database_url_set": bool(settings.DATABASE_URL),
        "database_url_preview": settings.DATABASE_URL[:50] + "..." if settings.DATABASE_URL else None,
    }

    try:
        db = SessionLocal()
        # Try a simple query
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        result["connection"] = "success"

        # Try to count users
        from .models.user import User
        user_count = db.query(User).count()
        result["user_count"] = user_count

        # Get first user email (if any)
        first_user = db.query(User).first()
        if first_user:
            result["first_user_email"] = first_user.email
            result["first_user_role"] = first_user.role
            result["password_hash_prefix"] = first_user.password[:20] + "..." if first_user.password else None
            result["password_hash_length"] = len(first_user.password) if first_user.password else 0

        db.close()
    except Exception as e:
        result["connection"] = "failed"
        result["error"] = str(e)
        result["traceback"] = traceback.format_exc()

    return result


# Seed endpoint removed - data already seeded


@app.get("/debug/verify/{email}")
async def debug_verify(email: str, password: str = "admin123"):
    """Debug endpoint to test password verification"""
    from .core.database import SessionLocal
    from .models.user import User
    from .core.security import verify_password
    import traceback

    result = {"email": email, "password_to_verify": password}

    try:
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()

        if not user:
            result["error"] = "User not found"
            return result

        result["user_found"] = True
        result["password_hash"] = user.password[:30] + "..." if user.password else None
        result["password_hash_length"] = len(user.password) if user.password else 0
        result["hash_starts_with_$2"] = user.password.startswith("$2") if user.password else False

        try:
            is_valid = verify_password(password, user.password)
            result["password_valid"] = is_valid
        except Exception as e:
            result["verify_error"] = str(e)
            result["verify_traceback"] = traceback.format_exc()

        db.close()
    except Exception as e:
        result["error"] = str(e)
        result["traceback"] = traceback.format_exc()

    return result
