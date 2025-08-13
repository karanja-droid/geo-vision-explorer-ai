"""Active Learning API Endpoints

FastAPI endpoints for active learning workflows including labeling,
model retraining, and uncertainty zone identification.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user
from app.services.active_learning import ActiveLearningService
from app.tasks.active_learning import retrain_model_with_labels, identify_uncertainty_zones
from app.core.config import settings

router = APIRouter()


class LabelRequest(BaseModel):
    """Request model for adding training labels"""
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)
    label_value: float = Field(..., ge=0.0, le=1.0, description="Label value between 0 and 1")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence in label")
    source: str = Field(default="user", description="Label source")
    inference_id: Optional[str] = Field(None, description="Associated inference ID")
    project_id: Optional[UUID] = Field(None, description="Project ID")


class LabelResponse(BaseModel):
    """Response model for training label"""
    id: str
    longitude: float
    latitude: float
    label_value: float
    confidence: float
    source: str
    created_at: str
    uncertainty_value: Optional[float]
    prediction_value: Optional[float]


class RetrainingRequest(BaseModel):
    """Request model for model retraining"""
    base_model_version: str = Field(default="latest", description="Base model to fine-tune")
    project_id: Optional[UUID] = Field(None, description="Project ID")
    training_config: Optional[Dict[str, Any]] = Field(None, description="Training configuration")


class RetrainingResponse(BaseModel):
    """Response model for retraining task"""
    task_id: str
    status: str
    message: str
    estimated_completion_minutes: int


class SuggestionRequest(BaseModel):
    """Request model for labeling suggestions"""
    inference_id: str
    limit: int = Field(default=20, ge=1, le=100)
    exclude_labeled: bool = Field(default=True)


class LabelingSuggestion(BaseModel):
    """Labeling suggestion model"""
    id: str
    longitude: float
    latitude: float
    uncertainty_value: float
    prediction_value: float
    priority_score: float
    is_labeled: bool


class EligibilityResponse(BaseModel):
    """Response model for retraining eligibility"""
    eligible: bool
    total_labels: int
    recent_labels: int
    positive_labels: int
    negative_labels: int
    min_required: int
    recommendation: str


@router.post("/labels", response_model=LabelResponse)
async def add_training_label(
    request: LabelRequest,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Add a new training label for active learning
    
    Allows domain experts to provide ground truth labels at specific
    coordinates to improve model performance through retraining.
    """
    try:
        if not settings.ENABLE_ACTIVE_LEARNING:
            raise HTTPException(status_code=503, detail="Active learning service is disabled")
        
        service = ActiveLearningService(db)
        
        # Get user context
        user_id = UUID(current_user['user_id'])
        org_id = UUID(current_user['org_id']) if current_user.get('org_id') else None
        
        # Add training label
        label = await service.add_training_label(
            longitude=request.longitude,
            latitude=request.latitude,
            label_value=request.label_value,
            confidence=request.confidence,
            source=request.source,
            user_id=user_id,
            org_id=org_id,
            project_id=request.project_id,
            inference_id=request.inference_id
        )
        
        # Extract coordinates for response
        lon = db.scalar(func.ST_X(label.geom))
        lat = db.scalar(func.ST_Y(label.geom))
        
        return LabelResponse(
            id=str(label.id),
            longitude=lon,
            latitude=lat,
            label_value=label.label_value,
            confidence=label.confidence,
            source=label.source,
            created_at=label.created_at.isoformat(),
            uncertainty_value=label.uncertainty_value,
            prediction_value=label.prediction_value
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add training label: {str(e)}")


@router.get("/labels", response_model=List[LabelResponse])
async def get_training_labels(
    inference_id: Optional[str] = None,
    project_id: Optional[UUID] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get training labels with optional filtering"""
    try:
        service = ActiveLearningService(db)
        
        # Get user context
        org_id = UUID(current_user['org_id']) if current_user.get('org_id') else None
        
        # Get labels
        labels = await service.get_training_labels(
            org_id=org_id,
            project_id=project_id,
            inference_id=inference_id,
            limit=limit
        )
        
        # Convert to response format
        response_labels = []
        for label in labels:
            lon = db.scalar(func.ST_X(label.geom))
            lat = db.scalar(func.ST_Y(label.geom))
            
            response_labels.append(LabelResponse(
                id=str(label.id),
                longitude=lon,
                latitude=lat,
                label_value=label.label_value,
                confidence=label.confidence,
                source=label.source,
                created_at=label.created_at.isoformat(),
                uncertainty_value=label.uncertainty_value,
                prediction_value=label.prediction_value
            ))
        
        return response_labels
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get training labels: {str(e)}")


@router.post("/suggestions", response_model=List[LabelingSuggestion])
async def get_labeling_suggestions(
    request: SuggestionRequest,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get suggestions for active learning labeling
    
    Returns high-uncertainty locations where additional labels
    would most improve model performance.
    """
    try:
        service = ActiveLearningService(db)
        
        # Get suggestions
        suggestions = await service.get_labeling_suggestions(
            inference_id=request.inference_id,
            limit=request.limit,
            exclude_labeled=request.exclude_labeled
        )
        
        # Convert to response format
        return [
            LabelingSuggestion(
                id=suggestion['id'],
                longitude=suggestion['longitude'],
                latitude=suggestion['latitude'],
                uncertainty_value=suggestion['uncertainty_value'],
                prediction_value=suggestion['prediction_value'],
                priority_score=suggestion['priority_score'],
                is_labeled=suggestion['is_labeled']
            )
            for suggestion in suggestions
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get labeling suggestions: {str(e)}")


@router.get("/retraining/eligibility", response_model=EligibilityResponse)
async def check_retraining_eligibility(
    project_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Check if enough labels are available for model retraining"""
    try:
        service = ActiveLearningService(db)
        
        # Get user context
        org_id = UUID(current_user['org_id']) if current_user.get('org_id') else None
        
        # Check eligibility
        eligibility = await service.check_retraining_eligibility(
            org_id=org_id,
            project_id=project_id
        )
        
        return EligibilityResponse(**eligibility)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check retraining eligibility: {str(e)}")


@router.post("/retraining/start", response_model=RetrainingResponse)
async def start_model_retraining(
    request: RetrainingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Start model retraining with collected labels
    
    Initiates a background task to retrain the prospectivity model
    using the collected training labels. Requires minimum 20 labels.
    """
    try:
        if not settings.ENABLE_ACTIVE_LEARNING:
            raise HTTPException(status_code=503, detail="Active learning service is disabled")
        
        service = ActiveLearningService(db)
        
        # Get user context
        user_id = current_user['user_id']
        org_id = current_user.get('org_id')
        
        # Check eligibility first
        eligibility = await service.check_retraining_eligibility(
            org_id=UUID(org_id) if org_id else None,
            project_id=request.project_id
        )
        
        if not eligibility['eligible']:
            raise HTTPException(
                status_code=400,
                detail=f"Not eligible for retraining: {eligibility['recommendation']}"
            )
        
        # Start retraining task
        task = retrain_model_with_labels.delay(
            base_model_version=request.base_model_version,
            org_id=str(org_id) if org_id else None,
            project_id=str(request.project_id) if request.project_id else None,
            user_id=str(user_id),
            training_config=request.training_config
        )
        
        # Estimate completion time based on number of labels
        estimated_minutes = max(5, eligibility['total_labels'] // 10)
        
        return RetrainingResponse(
            task_id=task.id,
            status="started",
            message=f"Model retraining started with {eligibility['total_labels']} labels",
            estimated_completion_minutes=estimated_minutes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start retraining: {str(e)}")


@router.get("/retraining/status/{task_id}")
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


@router.get("/retraining/result/{task_id}")
async def get_retraining_result(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get completed model retraining result with metrics"""
    try:
        from app.core.celery_app import celery_app
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state != 'SUCCESS':
            raise HTTPException(
                status_code=400,
                detail=f"Retraining task not completed. Current status: {task.state}"
            )
        
        result = task.result
        
        return {
            'task_id': result['task_id'],
            'new_model_version': result['new_model_version'],
            'base_model_version': result['base_model_version'],
            'training_samples': result['training_samples'],
            'validation_samples': result['validation_samples'],
            'metrics_before': result['metrics_before'],
            'metrics_after': result['metrics_after'],
            'improvement': result['improvement'],
            'model_path': result['model_path'],
            'status': result['status']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get retraining result: {str(e)}")


@router.post("/uncertainty-zones/identify")
async def identify_uncertainty_zones_endpoint(
    inference_id: str,
    uncertainty_cog_path: str,
    prospectivity_cog_path: str,
    project_id: Optional[UUID] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: Dict = Depends(get_current_user)
):
    """Identify high uncertainty zones for active learning suggestions"""
    try:
        # Get user context
        org_id = current_user.get('org_id')
        
        # Start uncertainty zone identification task
        task = identify_uncertainty_zones.delay(
            inference_id=inference_id,
            uncertainty_cog_path=uncertainty_cog_path,
            prospectivity_cog_path=prospectivity_cog_path,
            org_id=str(org_id) if org_id else None,
            project_id=str(project_id) if project_id else None
        )
        
        return {
            'task_id': task.id,
            'status': 'started',
            'message': f'Identifying uncertainty zones for inference {inference_id}'
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to identify uncertainty zones: {str(e)}")


@router.get("/models/versions")
async def get_model_versions(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get available model versions with metrics"""
    try:
        service = ActiveLearningService(db)
        
        # Get user context
        org_id = UUID(current_user['org_id']) if current_user.get('org_id') else None
        
        # Get model versions
        versions = await service.get_model_versions(org_id=org_id, limit=limit)
        
        # Format response
        response_versions = []
        for version in versions:
            # Get metrics
            metrics = {}
            for metric in version.metrics:
                if metric.metric_type == 'validation':
                    metrics[metric.metric_name] = metric.metric_value
            
            response_versions.append({
                'id': str(version.id),
                'version': version.version,
                'base_version': version.base_version,
                'created_at': version.created_at.isoformat(),
                'training_samples': version.training_samples,
                'status': version.status,
                'metrics': metrics,
                'model_path': version.model_path
            })
        
        return {
            'versions': response_versions,
            'total_count': len(response_versions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model versions: {str(e)}")


# Health check endpoint
@router.get("/health")
async def active_learning_health():
    """Health check for active learning service"""
    if not settings.ENABLE_ACTIVE_LEARNING:
        raise HTTPException(status_code=503, detail="Active learning service is disabled")
    
    return {
        "status": "healthy",
        "service": "active_learning",
        "version": "1.0.0",
        "features": {
            "labeling": True,
            "retraining": True,
            "uncertainty_analysis": True,
            "model_versioning": True
        }
    }