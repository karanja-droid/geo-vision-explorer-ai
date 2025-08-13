"""Feature Store API Endpoints

FastAPI endpoints for the feature store service including feature retrieval,
computation triggering, and export functionality.
"""

from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import io

from app.api.deps import get_db, get_current_user
from app.services.feature_store import FeatureStoreService
from app.tasks.feature_computation import compute_features_for_aoi
from app.core.config import settings

router = APIRouter()


class AOIRequest(BaseModel):
    """Request model for Area of Interest feature computation"""
    aoi: Dict[str, Any] = Field(..., description="GeoJSON polygon defining the area of interest")
    scales: List[int] = Field(default=[1, 3, 5], description="Scales in kilometers")
    project_id: Optional[UUID] = Field(None, description="Project ID for organization")


class FeatureResponse(BaseModel):
    """Response model for feature data"""
    features: List[Dict[str, Any]]
    summary: Dict[str, Any]


class ComputationResponse(BaseModel):
    """Response model for feature computation task"""
    task_id: str
    status: str
    message: str


class ExportResponse(BaseModel):
    """Response model for feature export"""
    export_id: str
    s3_path: str
    status: str


@router.get("/features", response_model=Union[FeatureResponse, bytes])
async def get_features(
    bbox: str = Query(..., description="Bounding box as 'min_lon,min_lat,max_lon,max_lat'"),
    keys: Optional[str] = Query(None, description="Comma-separated feature keys to filter"),
    scales: Optional[str] = Query(None, description="Comma-separated scales to filter (1,3,5)"),
    format: str = Query("json", description="Output format: json, parquet, csv"),
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get features for a bounding box with optional filtering
    
    Returns features in the specified format with summary statistics.
    Supports caching for improved performance.
    """
    try:
        # Parse bbox
        bbox_coords = [float(x.strip()) for x in bbox.split(',')]
        if len(bbox_coords) != 4:
            raise ValueError("Bounding box must have 4 coordinates")
        
        # Parse optional parameters
        feature_keys = [k.strip() for k in keys.split(',')] if keys else None
        scale_list = [int(s.strip()) for s in scales.split(',')] if scales else None
        
        # Validate scales
        if scale_list:
            valid_scales = [1, 3, 5]
            invalid_scales = [s for s in scale_list if s not in valid_scales]
            if invalid_scales:
                raise ValueError(f"Invalid scales: {invalid_scales}. Must be one of {valid_scales}")
        
        # Get user's organization ID
        org_id = current_user.get('org_id')
        
        # Initialize service and get features
        service = FeatureStoreService(db)
        result = await service.get_features(
            bbox=bbox_coords,
            keys=feature_keys,
            scales=scale_list,
            format=format,
            org_id=UUID(org_id) if org_id else None
        )
        
        # Return appropriate response based on format
        if format == "parquet":
            return StreamingResponse(
                io.BytesIO(result),
                media_type="application/octet-stream",
                headers={"Content-Disposition": "attachment; filename=features.parquet"}
            )
        elif format == "csv":
            return StreamingResponse(
                io.BytesIO(result),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=features.csv"}
            )
        else:
            return result
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve features: {str(e)}")


@router.post("/features/compute", response_model=ComputationResponse)
async def compute_features(
    request: AOIRequest,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Trigger feature computation for an Area of Interest
    
    Starts a background Celery task to compute multi-scale features
    for the specified AOI. Returns task ID for status tracking.
    """
    try:
        # Validate AOI GeoJSON
        if not request.aoi.get('geometry'):
            raise ValueError("AOI must contain geometry")
        
        if request.aoi['geometry']['type'] not in ['Polygon', 'MultiPolygon']:
            raise ValueError("AOI geometry must be Polygon or MultiPolygon")
        
        # Validate scales
        valid_scales = [1, 3, 5]
        invalid_scales = [s for s in request.scales if s not in valid_scales]
        if invalid_scales:
            raise ValueError(f"Invalid scales: {invalid_scales}. Must be one of {valid_scales}")
        
        # Get user context
        org_id = current_user.get('org_id')
        
        # Start computation task
        task = compute_features_for_aoi.delay(
            aoi_geojson=request.aoi,
            scales=request.scales,
            org_id=str(org_id) if org_id else None,
            project_id=str(request.project_id) if request.project_id else None
        )
        
        return ComputationResponse(
            task_id=task.id,
            status="started",
            message=f"Feature computation started for {len(request.scales)} scales"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start computation: {str(e)}")


@router.get("/features/compute/{task_id}")
async def get_computation_status(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get status of a feature computation task"""
    try:
        from app.core.celery_app import celery_app
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state == 'PENDING':
            response = {
                'task_id': task_id,
                'status': 'pending',
                'message': 'Task is waiting to be processed'
            }
        elif task.state == 'PROGRESS':
            response = {
                'task_id': task_id,
                'status': 'running',
                'message': 'Task is currently running',
                'progress': task.info
            }
        elif task.state == 'SUCCESS':
            response = {
                'task_id': task_id,
                'status': 'completed',
                'message': 'Task completed successfully',
                'result': task.result
            }
        else:  # FAILURE
            response = {
                'task_id': task_id,
                'status': 'failed',
                'message': 'Task failed',
                'error': str(task.info)
            }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")


@router.post("/features/export", response_model=ExportResponse)
async def export_features(
    bbox: str = Query(..., description="Bounding box as 'min_lon,min_lat,max_lon,max_lat'"),
    keys: Optional[str] = Query(None, description="Comma-separated feature keys to filter"),
    scales: Optional[str] = Query(None, description="Comma-separated scales to filter (1,3,5)"),
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Export features to S3 as parquet file
    
    Creates a parquet export of features for the specified parameters
    and stores it in S3 with proper organization and metadata.
    """
    try:
        # Parse parameters (same as get_features)
        bbox_coords = [float(x.strip()) for x in bbox.split(',')]
        if len(bbox_coords) != 4:
            raise ValueError("Bounding box must have 4 coordinates")
        
        feature_keys = [k.strip() for k in keys.split(',')] if keys else None
        scale_list = [int(s.strip()) for s in scales.split(',')] if scales else None
        
        # Get user's organization ID
        org_id = current_user.get('org_id')
        
        # Initialize service and export
        service = FeatureStoreService(db)
        s3_path = await service.export_to_s3(
            bbox=bbox_coords,
            keys=feature_keys,
            scales=scale_list,
            org_id=UUID(org_id) if org_id else None
        )
        
        # Extract export ID from S3 path
        export_id = s3_path.split('/')[-2]
        
        return ExportResponse(
            export_id=export_id,
            s3_path=s3_path,
            status="completed"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export features: {str(e)}")


@router.get("/features/available")
async def get_available_features(
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get list of available feature keys and metadata
    
    Returns all available feature keys organized by category
    with usage statistics and descriptions.
    """
    try:
        org_id = current_user.get('org_id')
        
        service = FeatureStoreService(db)
        result = service.get_available_features(
            org_id=UUID(org_id) if org_id else None
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available features: {str(e)}")


# Feature flag check
@router.get("/features/health")
async def feature_store_health():
    """Health check for feature store service"""
    if not settings.ENABLE_FEATURE_STORE:
        raise HTTPException(status_code=503, detail="Feature store service is disabled")
    
    return {
        "status": "healthy",
        "service": "feature_store",
        "version": "1.0.0",
        "features": {
            "computation": settings.CELERY_BROKER_URL is not None,
            "caching": settings.REDIS_URL is not None,
            "export": settings.AWS_ACCESS_KEY_ID is not None
        }
    }