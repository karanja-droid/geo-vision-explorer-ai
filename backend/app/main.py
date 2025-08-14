"""
GeoMiner Backend API Main Application

FastAPI application with comprehensive geological data management,
AI-powered prospectivity analysis, and enterprise features.
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import time
from typing import Dict, Any

# Core imports
from app.core.config import settings
from app.core.logging import setup_logging
from app.database import engine, Base
from app.core.security import get_current_user

# API routers
from app.api.v1.projects import router as projects_router
from app.api.v1.drilling import router as drilling_router
from app.api.v1.geochemistry import router as geochemistry_router
from app.api.v1.remote_sensing import router as remote_sensing_router
from app.api.v1.spatial_vector import router as spatial_router
from app.api.v1.prospectivity import router as prospectivity_router
from app.api.v1.exports import router as exports_router
from app.api.v1.executive import router as executive_router
from app.api.v1.geologist import router as geologist_router
from app.api.v1.driller import router as driller_router

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("🚀 Starting GeoMiner Backend API...")
    
    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create database tables: {e}")
        raise
    
    # Initialize services
    try:
        # Initialize Redis connection
        from app.integrations.redis.client import get_redis_client
        redis_client = get_redis_client()
        await redis_client.ping()
        logger.info("✅ Redis connection established")
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}")
    
    # Initialize S3 client
    try:
        import boto3
        s3_client = boto3.client('s3')
        logger.info("✅ S3 client initialized")
    except Exception as e:
        logger.warning(f"⚠️ S3 client initialization failed: {e}")
    
    logger.info("🎉 GeoMiner Backend API started successfully")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down GeoMiner Backend API...")
    logger.info("✅ Shutdown complete")

# Create FastAPI application
app = FastAPI(
    title="GeoMiner API",
    description="Advanced AI-powered geological exploration and mining intelligence platform",
    version="1.0.0",
    docs_url="/docs" if not settings.ENVIRONMENT == "production" else None,
    redoc_url="/redoc" if not settings.ENVIRONMENT == "production" else None,
    lifespan=lifespan
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
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

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests for monitoring"""
    start_time = time.time()
    
    # Log request
    logger.info(f"📥 {request.method} {request.url.path} - {request.client.host}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response
        logger.info(
            f"📤 {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s"
        )
        
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"❌ {request.method} {request.url.path} - "
            f"Error: {str(e)} - "
            f"Time: {process_time:.3f}s"
        )
        raise

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    logger.error(f"🚨 Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "request_id": getattr(request.state, "request_id", None)
        }
    )

# HTTP exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    logger.warning(f"⚠️ HTTP {exc.status_code}: {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "request_id": getattr(request.state, "request_id", None)
        }
    )

# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    }

@app.get("/healthz", tags=["Health"])
async def detailed_health_check():
    """Detailed health check with service status"""
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "services": {}
    }
    
    # Check database
    try:
        from app.database import SessionLocal
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        health_status["services"]["database"] = "healthy"
    except Exception as e:
        health_status["services"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        from app.integrations.redis.client import get_redis_client
        redis_client = get_redis_client()
        await redis_client.ping()
        health_status["services"]["redis"] = "healthy"
    except Exception as e:
        health_status["services"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check S3
    try:
        import boto3
        s3_client = boto3.client('s3')
        s3_client.list_buckets()
        health_status["services"]["s3"] = "healthy"
    except Exception as e:
        health_status["services"]["s3"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    return health_status

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "message": "GeoMiner API - AI-Powered Geological Intelligence",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "environment": settings.ENVIRONMENT
    }

# API version info
@app.get("/api/v1", tags=["API Info"])
async def api_v1_info():
    """API v1 information"""
    return {
        "version": "1.0.0",
        "description": "GeoMiner API v1 - Comprehensive geological data management",
        "endpoints": {
            "projects": "/api/v1/projects",
            "drilling": "/api/v1/drilling",
            "geochemistry": "/api/v1/geochemistry",
            "remote_sensing": "/api/v1/remote-sensing",
            "spatial": "/api/v1/spatial",
            "prospectivity": "/api/v1/prospectivity"
        },
        "documentation": "/docs"
    }

# Include API routers
app.include_router(
    projects_router,
    prefix="/api/v1/projects",
    tags=["Projects"],
    dependencies=[]
)

app.include_router(
    drilling_router,
    prefix="/api/v1/drilling",
    tags=["Drilling Data"],
    dependencies=[]
)

app.include_router(
    geochemistry_router,
    prefix="/api/v1/geochemistry",
    tags=["Geochemistry & LIMS"],
    dependencies=[]
)

app.include_router(
    remote_sensing_router,
    prefix="/api/v1/remote-sensing",
    tags=["Remote Sensing"],
    dependencies=[]
)

app.include_router(
    spatial_router,
    prefix="/api/v1/spatial",
    tags=["Spatial Data"],
    dependencies=[]
)

app.include_router(
    prospectivity_router,
    prefix="/api/v1/prospectivity",
    tags=["Prospectivity & AI"],
    dependencies=[]
)

app.include_router(
    exports_router,
    prefix="/api/v1",
    tags=["Exports & Reports"],
    dependencies=[]
)

app.include_router(
    executive_router,
    prefix="/api/v1",
    tags=["Executive"],
    dependencies=[]
)

app.include_router(
    geologist_router,
    prefix="/api/v1",
    tags=["Geologist"],
    dependencies=[]
)

app.include_router(
    driller_router,
    prefix="/api/v1",
    tags=["Driller"],
    dependencies=[]
)

# Static files (if needed)
if settings.SERVE_STATIC_FILES:
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Development endpoints (only in development)
if settings.ENVIRONMENT == "development":
    @app.get("/debug/config", tags=["Debug"])
    async def debug_config():
        """Debug endpoint to view configuration (development only)"""
        return {
            "environment": settings.ENVIRONMENT,
            "database_url": settings.DATABASE_URL[:20] + "..." if settings.DATABASE_URL else None,
            "allowed_origins": settings.ALLOWED_ORIGINS,
            "allowed_hosts": settings.ALLOWED_HOSTS,
            "serve_static_files": settings.SERVE_STATIC_FILES
        }
    
    @app.get("/debug/routes", tags=["Debug"])
    async def debug_routes():
        """Debug endpoint to list all routes (development only)"""
        routes = []
        for route in app.routes:
            if hasattr(route, 'methods') and hasattr(route, 'path'):
                routes.append({
                    "path": route.path,
                    "methods": list(route.methods),
                    "name": getattr(route, 'name', None)
                })
        return {"routes": routes}

# Application metadata
app.title = "GeoMiner API"
app.description = """
## GeoMiner - AI-Powered Geological Intelligence Platform

Advanced geological exploration and mining intelligence platform with:

### 🔧 **Core Features**
- **Project Management**: Comprehensive project and site management
- **Drilling Data**: Professional drilling data management with QA/QC
- **Geochemistry & LIMS**: Laboratory information management with statistical QC
- **Remote Sensing**: Multi-satellite imagery processing and analysis
- **Spatial Data**: Vector and raster data management with PostGIS
- **AI & Prospectivity**: Machine learning-powered mineral targeting

### 🚀 **Advanced Capabilities**
- **Real-time Collaboration**: Multi-user project collaboration
- **Quality Control**: Automated validation and QC reporting
- **Export & Reporting**: Professional reports and data export
- **Security**: Enterprise-grade security and access control
- **Scalability**: Cloud-native architecture for any scale

### 📊 **Data Modules**
1. **Drilling Data Management** - CRUD API with spatial validation
2. **Geochemistry & LIMS** - Professional QC engine with statistical analysis
3. **Remote Sensing** - Multi-satellite processing with spectral analysis
4. **Spatial Data Ingest** - Vector tile serving with format support
5. **Geology Mapping** - Field data collection and mapping tools
6. **Prospectivity & AI** - Machine learning for mineral targeting

### 🔗 **API Endpoints**
- **Projects**: `/api/v1/projects` - Project and site management
- **Drilling**: `/api/v1/drilling` - Drilling data and QA/QC
- **Geochemistry**: `/api/v1/geochemistry` - Laboratory data management
- **Remote Sensing**: `/api/v1/remote-sensing` - Satellite imagery processing
- **Spatial**: `/api/v1/spatial` - Vector and raster data management
- **Prospectivity**: `/api/v1/prospectivity` - AI-powered mineral targeting

### 📚 **Documentation**
- **Interactive Docs**: `/docs` - Swagger UI documentation
- **ReDoc**: `/redoc` - Alternative documentation interface
- **Health Check**: `/health` - Service health monitoring
"""

if __name__ == "__main__":
    import uvicorn
    
    logger.info("🚀 Starting GeoMiner API server...")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level="info" if settings.ENVIRONMENT == "production" else "debug",
        access_log=True
    )