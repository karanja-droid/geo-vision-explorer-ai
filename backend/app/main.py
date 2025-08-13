"""GeoVision AI Miner - Main Application

FastAPI application with enterprise features including:
- Feature Store Service
- AI Inference with Uncertainty
- Active Learning
- Drill Data QA
- LIMS Integration
- Security & Compliance
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
import time
import logging

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging import setup_logging, logger

# Setup logging
setup_logging()

# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise geological data platform with AI-powered prospectivity modeling",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc"
)

# Add CORS middleware
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info(f"CORS enabled for origins: {origins}")
else:
    logger.warning("No CORS origins configured")

# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure appropriately for production
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time header to responses"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Exception handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors"""
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": "The requested resource was not found",
            "path": str(request.url.path)
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An internal server error occurred"
        }
    )


# Health check endpoints
@app.get("/health")
@app.get("/healthz")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": "geovision-ai-miner",
        "version": "1.0.0",
        "timestamp": time.time(),
        "baseUrl": settings.BASE_URL
    }


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with service status"""
    health_status = {
        "status": "healthy",
        "service": "geovision-ai-miner",
        "version": "1.0.0",
        "timestamp": time.time(),
        "services": {
            "database": "healthy",  # Would check actual DB connection
            "redis": "healthy" if settings.REDIS_URL else "not_configured",
            "s3": "healthy" if settings.AWS_ACCESS_KEY_ID else "not_configured",
            "celery": "healthy" if settings.CELERY_BROKER_URL else "not_configured"
        },
        "features": {
            "feature_store": settings.ENABLE_FEATURE_STORE,
            "ai_inference": settings.ENABLE_PROSPECTIVITY,
            "active_learning": settings.ENABLE_ACTIVE_LEARNING,
            "drill_qa": settings.ENABLE_DRILL_QA,
            "lims_qc": settings.ENABLE_LIMS_QC,
            "audit_exports": settings.ENABLE_AUDIT_EXPORTS,
            "data_residency": settings.ENABLE_DATA_RESIDENCY,
            "trial_enforcement": settings.ENABLE_TRIAL_ENFORCEMENT
        }
    }
    
    # Check if any critical services are down
    critical_services = ["database"]
    if any(health_status["services"][service] != "healthy" for service in critical_services):
        health_status["status"] = "degraded"
    
    return health_status


# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


# Custom OpenAPI with server URL
def custom_openapi():
    """Custom OpenAPI schema with correct server URL"""
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        description="Enterprise geological data platform with AI-powered prospectivity modeling",
        routes=app.routes,
    )
    
    # Set server URL for OpenAPI
    openapi_schema["servers"] = [{"url": settings.BASE_URL}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# Startup event
@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    logger.info("Starting GeoVision AI Miner application")
    logger.info(f"Feature flags: Feature Store={settings.ENABLE_FEATURE_STORE}, "
               f"AI Inference={settings.ENABLE_PROSPECTIVITY}, "
               f"Active Learning={settings.ENABLE_ACTIVE_LEARNING}")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown tasks"""
    logger.info("Shutting down GeoVision AI Miner application")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )