"""Application Configuration

Pydantic settings for the GeoVision AI Miner backend including
feature flags, database connections, and service configurations.
"""

import os
from typing import Optional, List
from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Basic app settings
    PROJECT_NAME: str = "GeoVision AI Miner"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/geovision")
    
    # Redis
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Celery
    CELERY_BROKER_URL: Optional[str] = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: Optional[str] = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    
    # AWS/S3
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_DEFAULT_REGION: str = os.getenv("AWS_DEFAULT_REGION", "us-west-2")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "geovision-ai-miner-data")
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Base URL for API self-links and OpenAPI
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    
    # CORS Origins
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:8080,http://localhost:3000")
    BACKEND_CORS_ORIGINS: List[str] = []
    
    @validator("BACKEND_CORS_ORIGINS", pre=True, always=True)
    def assemble_cors_origins(cls, v, values):
        # Use ALLOWED_ORIGINS if BACKEND_CORS_ORIGINS is not set
        if not v and "ALLOWED_ORIGINS" in values:
            allowed_origins = values["ALLOWED_ORIGINS"]
            if isinstance(allowed_origins, str):
                return [origin.strip() for origin in allowed_origins.split(",") if origin.strip()]
        
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        return []
    
    # Feature Flags
    ENABLE_FEATURE_STORE: bool = os.getenv("ENABLE_FEATURE_STORE", "true").lower() == "true"
    ENABLE_AI_INFERENCE: bool = os.getenv("ENABLE_AI_INFERENCE", "true").lower() == "true"
    ENABLE_ACTIVE_LEARNING: bool = os.getenv("ENABLE_ACTIVE_LEARNING", "true").lower() == "true"
    ENABLE_DRILL_DATA: bool = os.getenv("ENABLE_DRILL_DATA", "true").lower() == "true"
    ENABLE_LIMS_QC: bool = os.getenv("ENABLE_LIMS_QC", "true").lower() == "true"
    ENABLE_ADVANCED_SECURITY: bool = os.getenv("ENABLE_ADVANCED_SECURITY", "true").lower() == "true"
    ENABLE_DATA_RESIDENCY: bool = os.getenv("ENABLE_DATA_RESIDENCY", "false").lower() == "true"
    ENABLE_AUDIT_LOGS: bool = os.getenv("ENABLE_AUDIT_LOGS", "true").lower() == "true"
    ENABLE_MAPLIBRE_FALLBACK: bool = os.getenv("ENABLE_MAPLIBRE_FALLBACK", "true").lower() == "true"
    ENABLE_USAGE_TRACKING: bool = os.getenv("ENABLE_USAGE_TRACKING", "true").lower() == "true"
    
    # Feature Store Configuration
    FEATURE_STORE_CACHE_TTL: int = int(os.getenv("FEATURE_STORE_CACHE_TTL", "3600"))  # 1 hour
    FEATURE_STORE_MAX_CELLS: int = int(os.getenv("FEATURE_STORE_MAX_CELLS", "100000"))
    FEATURE_STORE_DEFAULT_SCALES: List[int] = [1, 3, 5]
    
    # Drill Data QA Configuration
    ENABLE_DRILL_QA: bool = os.getenv("ENABLE_DRILL_QA", "true").lower() == "true"
    DRILL_QA_MAX_FILE_SIZE: int = int(os.getenv("DRILL_QA_MAX_FILE_SIZE", "104857600"))  # 100MB
    DRILL_QA_SUPPORTED_FORMATS: List[str] = ["csv", "xlsx"]
    DRILL_QA_REPORT_RETENTION_DAYS: int = int(os.getenv("DRILL_QA_REPORT_RETENTION_DAYS", "90"))
    DRILL_QA_NIGHTLY_REPORTS: bool = os.getenv("DRILL_QA_NIGHTLY_REPORTS", "true").lower() == "true"
    
    # AI Inference Configuration
    AI_MODEL_PATH: str = os.getenv("AI_MODEL_PATH", "/models/prospectivity")
    AI_INFERENCE_TIMEOUT: int = int(os.getenv("AI_INFERENCE_TIMEOUT", "300"))  # 5 minutes
    AI_MAX_CONCURRENT_JOBS: int = int(os.getenv("AI_MAX_CONCURRENT_JOBS", "5"))
    
    # Data Residency Configuration
    DEFAULT_DATA_REGION: str = os.getenv("DEFAULT_DATA_REGION", "us-west-2")
    SUPPORTED_REGIONS: List[str] = [
        "us-west-2", "us-east-1", "eu-west-1", "ap-southeast-2", "af-south-1"
    ]
    
    # Usage Tracking Configuration
    USAGE_TRACKING_INTERVAL: int = int(os.getenv("USAGE_TRACKING_INTERVAL", "3600"))  # 1 hour
    TRIAL_DURATION_DAYS: int = int(os.getenv("TRIAL_DURATION_DAYS", "30"))
    
    # Audit Configuration
    AUDIT_LOG_RETENTION_DAYS: int = int(os.getenv("AUDIT_LOG_RETENTION_DAYS", "2555"))  # 7 years
    AUDIT_EXPORT_INTERVAL_HOURS: int = int(os.getenv("AUDIT_EXPORT_INTERVAL_HOURS", "24"))
    
    # Performance Configuration
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", "4"))
    REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "30"))
    MAX_REQUEST_SIZE: int = int(os.getenv("MAX_REQUEST_SIZE", "100"))  # MB
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "json")
    
    class Config:
        case_sensitive = True
        env_file = ".env"


# Global settings instance
settings = Settings()