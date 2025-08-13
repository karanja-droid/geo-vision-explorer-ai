"""AI Inference API Endpoints

FastAPI endpoints for prospectivity modeling with uncertainty quantification.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user
from app.tasks.ai_inference import run_prospectivity_inference, retrain_prospectivity_model
from app.core.config import settings

router = APIRouter()


class InferenceRequest(BaseModel):
    """Request model for AI inference"""
    aoi: Dict[str, Any] = Field(..., description="GeoJSON polygon defining area of interest")
    model_version: str = Field(default="latest", description="Model version to use")
    project_id: Optional[UUID] = Field(None, description="Project ID for organization")


class InferenceResponse(BaseModel):
    """Response model for AI inference task"""
    task_id: str
    status: str
    message: str
    estimated_completion_minutes: int


class InferenceResult(BaseModel):
    """Response model for completed inference"""
    inference_id: str
    status: str
    prospectivity_cog: str
    uncertainty_cog: str
    metadata: Dict[str, Any]
    statistics: Dict[str, Any]


class TrainingLabel(BaseModel):
    """Training label for active learning"""
    longitude: float
    latitude: float
    label: float = Field(..., ge=0, le=1, description="Label value between 0 and 1")
    confidence: float = Field(default=1.0, ge=0, le=1, description="Label confidence")
    source: str = Field(default="user", description="Label source")


class RetrainingRequest(BaseModel):
    """Request model for model retraining"""
    labels: List[TrainingLabel] = Field(..., min_items=20, description="Training labels (minimum 20)")
    base_model_version: str = Field(default="latest", description="Base model to fine-tune")
    project_id: Optional[UUID] = Field(None, description="Project ID for organization")


class RetrainingResponse(BaseModel):
    """Response model for model retraining task"""
    task_id: str
    status: str
    message: str
    training_samples: int


class ModelMetrics(BaseModel):
    """Model performance metrics"""
    auc: float
    precision: float
    recall: float
    f1: float


class RetrainingResult(BaseModel):
    """Response model for completed retraining"""
    task_id: str
    new_model_version: str
    base_model_version: str
    training_samples: int
    metrics_before: ModelMetrics
    metrics_after: ModelMetrics
    improvement: ModelMetrics
    status: str


@router.post("/inference/run", response_model=InferenceResponse)
async def run_inference(
    request: InferenceRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Run prospectivity inference with uncertainty quantification
    
    Starts a background task to run AI inference on the specified AOI.
    Returns both prospectivity and uncertainty as Cloud-Optimized GeoTIFFs.
    """
    try:
        # Validate AOI GeoJSON
        if not request.aoi.get('geometry'):
            raise ValueError("AOI must contain geometry")
        
        if request.aoi['geometry']['type'] not in ['Polygon', 'MultiPolygon']:
            raise ValueError("AOI geometry must be Polygon or MultiPolygon")
        
        # Check if AI inference is enabled
        if not settings.ENABLE_PROSPECTIVITY:
            raise HTTPException(status_code=503, detail="AI inference service is disabled")
        
        # Get user context
        org_id = current_user.get('org_id')
        
        # Start inference task
        task = run_prospectivity_inference.delay(
            aoi_geojson=request.aoi,
            model_version=request.model_version,
            org_id=str(org_id) if org_id else None,
            project_id=str(request.project_id) if request.project_id else None
        )
        
        # Estimate completion time based on AOI size
        aoi_bounds = request.aoi.get('bbox', [-180, -90, 180, 90])
        area_deg2 = (aoi_bounds[2] - aoi_bounds[0]) * (aoi_bounds[3] - aoi_bounds[1])
        estimated_minutes = max(2, int(area_deg2 * 10))  # Rough estimate
        
        return InferenceResponse(
            task_id=task.id,
            status="started",
            message=f"AI inference started with model {request.model_version}",
            estimated_completion_minutes=estimated_minutes
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start inference: {str(e)}")


@router.get("/inference/status/{task_id}")
async def get_inference_status(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get status of an AI inference task"""
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


@router.get("/inference/result/{task_id}", response_model=InferenceResult)
async def get_inference_result(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get completed inference result"""
    try:
        from app.core.celery_app import celery_app
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state != 'SUCCESS':
            raise HTTPException(
                status_code=400, 
                detail=f"Task not completed. Current status: {task.state}"
            )
        
        result = task.result
        
        return InferenceResult(
            inference_id=result['inference_id'],
            status=result['status'],
            prospectivity_cog=result['prospectivity_cog'],
            uncertainty_cog=result['uncertainty_cog'],
            metadata=result['metadata'],
            statistics=result['statistics']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get inference result: {str(e)}")


@router.post("/models/retrain", response_model=RetrainingResponse)
async def retrain_model(
    request: RetrainingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Retrain prospectivity model with new labels (Active Learning)
    
    Requires minimum 20 training labels. Creates a new model version
    with improved performance based on user feedback.
    """
    try:
        # Check if active learning is enabled
        if not settings.ENABLE_ACTIVE_LEARNING:
            raise HTTPException(status_code=503, detail="Active learning service is disabled")
        
        # Validate minimum labels
        if len(request.labels) < 20:
            raise ValueError("Minimum 20 training labels required for retraining")
        
        # Get user context
        org_id = current_user.get('org_id')
        
        # Convert labels to dict format
        training_labels = [
            {
                'longitude': label.longitude,
                'latitude': label.latitude,
                'label': label.label,
                'confidence': label.confidence,
                'source': label.source
            }
            for label in request.labels
        ]
        
        # Start retraining task
        task = retrain_prospectivity_model.delay(
            training_labels=training_labels,
            base_model_version=request.base_model_version,
            org_id=str(org_id) if org_id else None,
            project_id=str(request.project_id) if request.project_id else None
        )
        
        return RetrainingResponse(
            task_id=task.id,
            status="started",
            message=f"Model retraining started with {len(request.labels)} labels",
            training_samples=len(request.labels)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start retraining: {str(e)}")


@router.get("/models/retrain/status/{task_id}")
async def get_retraining_status(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get status of a model retraining task"""
    try:
        from app.core.celery_app import celery_app
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state == 'PENDING':
            response = {
                'task_id': task_id,
                'status': 'pending',
                'message': 'Retraining task is waiting to be processed'
            }
        elif task.state == 'PROGRESS':
            response = {
                'task_id': task_id,
                'status': 'running',
                'message': 'Model retraining is in progress',
                'progress': task.info
            }
        elif task.state == 'SUCCESS':
            response = {
                'task_id': task_id,
                'status': 'completed',
                'message': 'Model retraining completed successfully',
                'result': task.result
            }
        else:  # FAILURE
            response = {
                'task_id': task_id,
                'status': 'failed',
                'message': 'Model retraining failed',
                'error': str(task.info)
            }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get retraining status: {str(e)}")


@router.get("/models/retrain/result/{task_id}", response_model=RetrainingResult)
async def get_retraining_result(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get completed model retraining result"""
    try:
        from app.core.celery_app import celery_app
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state != 'SUCCESS':
            raise HTTPException(
                status_code=400, 
                detail=f"Retraining task not completed. Current status: {task.state}"
            )
        
        result = task.result
        
        return RetrainingResult(
            task_id=result['task_id'],
            new_model_version=result['new_model_version'],
            base_model_version=result['base_model_version'],
            training_samples=result['training_samples'],
            metrics_before=ModelMetrics(**result['metrics']['before']),
            metrics_after=ModelMetrics(**result['metrics']['after']),
            improvement=ModelMetrics(**result['improvement']),
            status=result['status']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get retraining result: {str(e)}")


@router.get("/models/available")
async def get_available_models(
    current_user: Dict = Depends(get_current_user)
):
    """Get list of available model versions"""
    try:
        # Mock implementation - in production would query model registry
        models = [
            {
                'version': 'latest',
                'created_at': '2024-01-15T10:00:00Z',
                'description': 'Latest production model',
                'metrics': {
                    'auc': 0.85,
                    'precision': 0.78,
                    'recall': 0.82,
                    'f1': 0.80
                },
                'training_samples': 10000,
                'status': 'active'
            },
            {
                'version': 'v1.2.0',
                'created_at': '2024-01-10T15:30:00Z',
                'description': 'Previous stable version',
                'metrics': {
                    'auc': 0.82,
                    'precision': 0.75,
                    'recall': 0.79,
                    'f1': 0.77
                },
                'training_samples': 8500,
                'status': 'archived'
            }
        ]
        
        return {
            'models': models,
            'default_version': 'latest',
            'total_count': len(models)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available models: {str(e)}")


@router.post("/models/rollback")
async def rollback_model(
    target_version: str,
    current_user: Dict = Depends(get_current_user)
):
    """Rollback to a previous model version"""
    try:
        # Check user permissions (admin only)
        user_role = current_user.get('role', 'viewer')
        if user_role not in ['admin', 'analyst']:
            raise HTTPException(status_code=403, detail="Insufficient permissions for model rollback")
        
        # Mock implementation - in production would update model registry
        result = {
            'status': 'success',
            'message': f'Model rolled back to version {target_version}',
            'previous_version': 'latest',
            'new_active_version': target_version,
            'rollback_timestamp': '2024-01-15T12:00:00Z'
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rollback model: {str(e)}")


# Health check endpoint
@router.get("/inference/health")
async def ai_inference_health():
    """Health check for AI inference service"""
    if not settings.ENABLE_PROSPECTIVITY:
        raise HTTPException(status_code=503, detail="AI inference service is disabled")
    
    return {
        "status": "healthy",
        "service": "ai_inference",
        "version": "1.0.0",
        "features": {
            "prospectivity_modeling": True,
            "uncertainty_quantification": True,
            "active_learning": settings.ENABLE_ACTIVE_LEARNING,
            "model_versioning": True,
            "cog_output": True
        }
    }