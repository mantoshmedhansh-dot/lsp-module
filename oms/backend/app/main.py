from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api.routes import api_router

app = FastAPI(
    title=settings.APP_NAME,
    description="CJDQuick Order Management System API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


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

        db.close()
    except Exception as e:
        result["connection"] = "failed"
        result["error"] = str(e)
        result["traceback"] = traceback.format_exc()

    return result
