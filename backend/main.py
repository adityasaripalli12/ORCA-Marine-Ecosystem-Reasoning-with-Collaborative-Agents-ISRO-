import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config.settings import settings
from backend.middleware.security_headers import SecurityHeadersMiddleware

# Import database connection and models to ensure all tables are created
from backend.database.connection import Base, engine, SessionLocal
from backend.models.user import User
from backend.models.audit import AuditLog
from backend.models.chat import ChatHistory
from backend.models.dataset import Dataset
from backend.models.duplicate_review import DuplicateReview
from backend.models.embedding import Embedding
from backend.models.security import SecurityEvent
from backend.models.research_chat import (
    ResearchConversation,
    ResearchConversationMember,
    ResearchMessage,
    ResearchAttachment,
    ResearchDatasetRef,
    ResearchPinnedFinding,
    ResearchNotification,
)
from backend.models.hazard import HazardEvent, OceanAlert
from backend.auth.password import hash_password

# Import routers
from backend.routers.auth_router import router as auth_router
from backend.routers.users_router import router as users_router
from backend.routers.datasets_router import router as datasets_router
from backend.routers.visualization_router import router as visualization_router
from backend.routers.chat_router import router as chat_router
from backend.routers.security_router import router as security_router
from backend.routers.audit_router import router as audit_router
from backend.routers.geo_router import router as geo_router
from backend.routers.devices_router import router as devices_router
from backend.routers.research_chat_router import router as research_chat_router
from backend.routers.hazard_router import router as hazard_router
from backend.routers.ocean_intelligence_router import router as ocean_intel_router
from backend.routers.voice_router import router as voice_router

# Create database tables if they do not exist
Base.metadata.create_all(bind=engine)
from backend.database.migration import run_migrations
run_migrations()

# Seed default database users if they don't exist
db = SessionLocal()
try:
    seed_accounts = [
        {"name": "System Administrator", "email": "admin@argo.edu", "password": "admin123", "role": "Admin"},
        {"name": "System Administrator", "email": "admin@gmail.com", "password": "Admin@123", "role": "Admin"},
        {"name": "Dr. Sarah Jenkins", "email": "sarah.jenkins@argo.edu", "password": "researcher123", "role": "Researcher"},
        {"name": "Dr. Sarah Jenkins", "email": "research@gmail.com", "password": "Research@123", "role": "Researcher"},
        {"name": "Oceanography Student", "email": "student@gmail.com", "password": "Student@123", "role": "Student"},
        {"name": "NOAA Climate Agency", "email": "govp@gmail.com", "password": "Gov@123", "role": "Government"},
        {"name": "Pacific Maritime Lines", "email": "shipping@gmail.com", "password": "Shipping@123", "role": "Shipping"},
        {"name": "National Coastal Guard Command", "email": "coastguard@gmail.com", "password": "CoastGuard@123", "role": "Coastal Guard"},
    ]

    for acc in seed_accounts:
        existing = db.query(User).filter(User.email == acc["email"]).first()
        if not existing:
            new_u = User(
                name=acc["name"],
                email=acc["email"],
                password_hash=hash_password(acc["password"]),
                role=acc["role"],
                is_active=True,
                last_login="Never"
            )
            db.add(new_u)

    db.commit()
except Exception as e:
    db.rollback()
    print(f"Error seeding database: {e}")
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware with explicit allowed origins list (no wildcard with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:(300[0-9]|5173|8000))?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)

# Security Headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Include routers under /api/v1 prefix
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(datasets_router, prefix=settings.API_V1_STR)
app.include_router(visualization_router, prefix=settings.API_V1_STR)
app.include_router(chat_router, prefix=settings.API_V1_STR)
app.include_router(security_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(geo_router, prefix=settings.API_V1_STR)
app.include_router(devices_router, prefix=settings.API_V1_STR)
app.include_router(research_chat_router, prefix=settings.API_V1_STR)
app.include_router(hazard_router, prefix=settings.API_V1_STR)
app.include_router(ocean_intel_router, prefix=settings.API_V1_STR)
app.include_router(voice_router, prefix=settings.API_V1_STR)

# Also include routers at root for frontend compatibility
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(datasets_router)
app.include_router(visualization_router)
app.include_router(chat_router)
app.include_router(security_router)
app.include_router(audit_router)
app.include_router(geo_router)
app.include_router(devices_router)
app.include_router(research_chat_router)
app.include_router(hazard_router)
app.include_router(ocean_intel_router)
app.include_router(voice_router)

@app.get("/")
def read_root():
    return {
        "message": "FloatChat Enterprise API is running",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

@app.get("/health")
def health_check():
    """Health check endpoint for Render and monitoring services."""
    return {"status": "ok", "version": settings.VERSION, "message": "FlowChat backend is running"}

@app.get("/api/health")
def api_health_check():
    """Health check alias for frontend connectivity test (GET /api/health)."""
    return {"status": "ok", "version": settings.VERSION, "message": "FlowChat backend is running"}

