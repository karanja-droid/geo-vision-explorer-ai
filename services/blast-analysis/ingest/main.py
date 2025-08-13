#!/usr/bin/env python3
"""
Drill & Blast AI - Ingest Service
Handles data intake, validation, and job submission
"""

import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
import redis.asyncio as redis
import asyncpg
import boto3
from botocore.exceptions import ClientError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/geovision_blast")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "blast-data")
JWT_SECRET = os.getenv("JWT_SECRET", "your-jwt-secret-here")

# Initialize FastAPI app
app = FastAPI(
    title="Drill & Blast AI - Ingest Service",
    description="Data intake, validation, and job submission for blast analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Global connections
redis_client = None
db_pool = None
s3_client = None

# Pydantic models
class BlastDesign(BaseModel):
    final_wall_dxf: Optional[str] = None
    floor_elev_m: float
    bench_height_m: Optional[float] = 15.0

class BlastScan(BaseModel):
    type: str  # "pointcloud" or "mesh"
    uri: str
    captured_at: str
    format: Optional[str] = "laz"  # laz, las, ply, obj

class BlastOptions(BaseModel):
    do_fragmentation: bool = True
    resolution_cm: int = 10
    overbreak_threshold_cm: float = 10.0
    underbreak_threshold_cm: float = -10.0
    collar_dev_threshold_m: float = 0.3
    toe_dev_threshold_m: float = 1.0

class BlastMetadata(BaseModel):
    blast_id: str
    site: str
    crs: str
    design: BlastDesign
    preblast: BlastScan
    postblast: BlastScan
    pattern_csv: Optional[str] = None
    loading_csv: Optional[str] = None
    mwd_csv: Optional[str] = None
    boretrack_csv: Optional[str] = None
    options: BlastOptions = BlastOptions()
    
    @validator('blast_id')
    def validate_blast_id(cls, v):
        if not v or len(v) < 3:
            raise ValueError('blast_id must be at least 3 characters long')
        return v
    
    @validator('crs')
    def validate_crs(cls, v):
        if not v.startswith('EPSG:'):
            raise ValueError('crs must be in EPSG format (e.g., EPSG:32735)')
        return v

class JobResponse(BaseModel):
    job_id: str
    blast_id: str
    status: str
    message: Optional[str] = None

class JobStatus(BaseModel):
    job_id: str
    blast_id: str
    status: str
    progress: float
    message: Optional[str] = None
    started_at: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    global redis_client, db_pool, s3_client
    
    # Initialize Redis connection
    redis_client = redis.from_url(REDIS_URL)
    await redis_client.ping()
    logger.info("Connected to Redis")
    
    # Initialize database connection pool
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
    logger.info("Connected to PostgreSQL")
    
    # Initialize S3 client
    s3_client = boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY
    )
    
    # Ensure bucket exists
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET)
    except ClientError:
        s3_client.create_bucket(Bucket=S3_BUCKET)
    
    logger.info(f"Connected to S3 bucket: {S3_BUCKET}")

@app.on_event("shutdown")
async def shutdown_event():
    global redis_client, db_pool
    
    if redis_client:
        await redis_client.close()
    
    if db_pool:
        await db_pool.close()

# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate JWT token and return user info"""
    # TODO: Implement proper JWT validation
    # For now, return mock user
    return {
        "user_id": "user_123",
        "username": "test_user",
        "role": "geologist"
    }

# Utility functions
async def validate_file_exists(uri: str) -> bool:
    """Check if file exists in S3"""
    try:
        if uri.startswith('s3://'):
            # Parse S3 URI
            parts = uri.replace('s3://', '').split('/', 1)
            bucket = parts[0]
            key = parts[1] if len(parts) > 1 else ''
            
            s3_client.head_object(Bucket=bucket, Key=key)
            return True
        else:
            # Check local file
            return Path(uri).exists()
    except Exception as e:
        logger.warning(f"File validation failed for {uri}: {e}")
        return False

async def validate_blast_data(metadata: BlastMetadata) -> List[str]:
    """Validate blast data and return list of errors"""
    errors = []
    
    # Check required files exist
    files_to_check = [
        metadata.preblast.uri,
        metadata.postblast.uri
    ]
    
    # Add optional files if provided
    if metadata.pattern_csv:
        files_to_check.append(metadata.pattern_csv)
    if metadata.loading_csv:
        files_to_check.append(metadata.loading_csv)
    if metadata.mwd_csv:
        files_to_check.append(metadata.mwd_csv)
    if metadata.boretrack_csv:
        files_to_check.append(metadata.boretrack_csv)
    if metadata.design.final_wall_dxf:
        files_to_check.append(metadata.design.final_wall_dxf)
    
    # Validate file existence
    for file_uri in files_to_check:
        if not await validate_file_exists(file_uri):
            errors.append(f"File not found: {file_uri}")
    
    # Validate scan timing
    try:
        pre_time = datetime.fromisoformat(metadata.preblast.captured_at.replace('Z', '+00:00'))
        post_time = datetime.fromisoformat(metadata.postblast.captured_at.replace('Z', '+00:00'))
        
        if post_time <= pre_time:
            errors.append("Post-blast scan must be captured after pre-blast scan")
    except ValueError as e:
        errors.append(f"Invalid timestamp format: {e}")
    
    # Validate CRS format
    try:
        epsg_code = int(metadata.crs.replace('EPSG:', ''))
        if epsg_code < 1000 or epsg_code > 99999:
            errors.append("Invalid EPSG code")
    except ValueError:
        errors.append("Invalid CRS format")
    
    return errors

async def store_blast_metadata(metadata: BlastMetadata, job_id: str, user_id: str):
    """Store blast metadata in database"""
    async with db_pool.acquire() as conn:
        # Insert blast project
        blast_project_id = await conn.fetchval("""
            INSERT INTO blast_projects (name, site_name, crs, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        """, metadata.blast_id, metadata.site, metadata.crs, user_id)
        
        # Insert analysis job
        await conn.execute("""
            INSERT INTO blast_analysis_jobs (
                job_id, blast_project_id, blast_id, status, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
        """, job_id, blast_project_id, metadata.blast_id, 'queued', 
            json.dumps(metadata.dict()), datetime.utcnow())
        
        return blast_project_id

async def enqueue_blast_job(job_id: str, metadata: BlastMetadata):
    """Add job to Redis processing queue"""
    job_data = {
        "job_id": job_id,
        "metadata": metadata.dict(),
        "created_at": datetime.utcnow().isoformat(),
        "priority": 1  # Normal priority
    }
    
    # Add to processing queue
    await redis_client.lpush("blast_analysis_queue", json.dumps(job_data))
    
    # Set job status
    await redis_client.hset(f"job:{job_id}", mapping={
        "status": "queued",
        "progress": "0.0",
        "created_at": datetime.utcnow().isoformat()
    })
    
    # Set expiration (24 hours)
    await redis_client.expire(f"job:{job_id}", 86400)

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Redis
        await redis_client.ping()
        
        # Check database
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        
        # Check S3
        s3_client.head_bucket(Bucket=S3_BUCKET)
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "redis": "ok",
                "database": "ok",
                "s3": "ok"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {e}")

@app.post("/api/v1/blast-analysis/run", response_model=JobResponse)
async def submit_blast_analysis(
    metadata: BlastMetadata,
    current_user: dict = Depends(get_current_user)
):
    """Submit blast analysis job"""
    try:
        # Validate input data
        validation_errors = await validate_blast_data(metadata)
        if validation_errors:
            raise HTTPException(
                status_code=400, 
                detail=f"Validation errors: {'; '.join(validation_errors)}"
            )
        
        # Generate job ID
        job_id = f"JOB_{uuid.uuid4().hex[:8].upper()}"
        
        # Store metadata in database
        blast_project_id = await store_blast_metadata(
            metadata, job_id, current_user["user_id"]
        )
        
        # Enqueue processing job
        await enqueue_blast_job(job_id, metadata)
        
        logger.info(f"Submitted blast analysis job {job_id} for blast {metadata.blast_id}")
        
        return JobResponse(
            job_id=job_id,
            blast_id=metadata.blast_id,
            status="queued",
            message="Job submitted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit blast analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@app.get("/api/v1/blast-analysis/status/{job_id}", response_model=JobStatus)
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get job status"""
    try:
        # Get status from Redis
        job_data = await redis_client.hgetall(f"job:{job_id}")
        
        if not job_data:
            # Check database for completed jobs
            async with db_pool.acquire() as conn:
                db_job = await conn.fetchrow("""
                    SELECT job_id, blast_id, status, progress, started_at, completed_at
                    FROM blast_analysis_jobs
                    WHERE job_id = $1
                """, job_id)
                
                if not db_job:
                    raise HTTPException(status_code=404, detail="Job not found")
                
                return JobStatus(
                    job_id=db_job['job_id'],
                    blast_id=db_job['blast_id'],
                    status=db_job['status'],
                    progress=float(db_job['progress'] or 0),
                    started_at=db_job['started_at']
                )
        
        # Calculate estimated completion
        estimated_completion = None
        if job_data.get('status') == 'processing':
            progress = float(job_data.get('progress', 0))
            if progress > 0.1:  # At least 10% complete
                started_at = datetime.fromisoformat(job_data['started_at'])
                elapsed = datetime.utcnow() - started_at
                estimated_total = elapsed / progress
                estimated_completion = started_at + estimated_total
        
        return JobStatus(
            job_id=job_id,
            blast_id=job_data.get('blast_id', ''),
            status=job_data.get('status', 'unknown'),
            progress=float(job_data.get('progress', 0)),
            message=job_data.get('message'),
            started_at=datetime.fromisoformat(job_data['started_at']) if job_data.get('started_at') else None,
            estimated_completion=estimated_completion
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@app.post("/api/v1/blast-analysis/upload")
async def upload_file(
    file: UploadFile = File(...),
    blast_id: str = Form(...),
    file_type: str = Form(...),  # preblast, postblast, pattern, loading, etc.
    current_user: dict = Depends(get_current_user)
):
    """Upload file to S3 and return signed URL"""
    try:
        # Validate file type and size
        max_size = 5 * 1024 * 1024 * 1024  # 5GB
        if file.size > max_size:
            raise HTTPException(status_code=413, detail="File too large")
        
        # Generate S3 key
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        s3_key = f"blasts/{blast_id}/{file_type}/{timestamp}_{file.filename}"
        
        # Upload to S3
        s3_client.upload_fileobj(
            file.file,
            S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': file.content_type}
        )
        
        # Generate S3 URI
        s3_uri = f"s3://{S3_BUCKET}/{s3_key}"
        
        logger.info(f"Uploaded file {file.filename} to {s3_uri}")
        
        return {
            "filename": file.filename,
            "s3_uri": s3_uri,
            "size": file.size,
            "content_type": file.content_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

@app.get("/api/v1/blast-analysis/jobs")
async def list_jobs(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List blast analysis jobs"""
    try:
        async with db_pool.acquire() as conn:
            where_clause = "WHERE created_by = $1"
            params = [current_user["user_id"]]
            
            if status:
                where_clause += " AND status = $2"
                params.append(status)
            
            jobs = await conn.fetch(f"""
                SELECT 
                    baj.job_id,
                    baj.blast_id,
                    baj.status,
                    baj.progress,
                    baj.created_at,
                    baj.started_at,
                    baj.completed_at,
                    bp.site_name
                FROM blast_analysis_jobs baj
                JOIN blast_projects bp ON baj.blast_project_id = bp.id
                {where_clause}
                ORDER BY baj.created_at DESC
                LIMIT $3 OFFSET $4
            """, *params, limit, offset)
            
            return {
                "jobs": [dict(job) for job in jobs],
                "total": len(jobs),
                "limit": limit,
                "offset": offset
            }
            
    except Exception as e:
        logger.error(f"Failed to list jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

# Run the application
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )