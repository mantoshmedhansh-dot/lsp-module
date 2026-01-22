"""
CJDQuick B2B Logistics Backend
FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="CJDQuick B2B Logistics API",
    description="B2B Freight Transport Services - FTL/PTL",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "CJDQuick B2B Logistics API",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "b2b-logistics"}


# API Routes will be registered here
# from app.api.v1 import router as api_v1_router
# app.include_router(api_v1_router, prefix="/api/v1")
