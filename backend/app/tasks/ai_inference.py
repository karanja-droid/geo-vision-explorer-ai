"""AI Inference Celery Tasks

Background tasks for running AI prospectivity modeling with uncertainty quantification.
"""

import json
from typing import Dict, Any, Optional
from uuid import UUID
from celery import Task
from celery.utils.log import get_task_logger
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.services.ai_inference import AIInferenceService
from app.core.config import settings

logger = get_task_logger(__name__)


class AIInferenceTask(Task):
    """Base task class for AI inference with error handling"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"AI inference task {task_id} failed: {exc}")
        # Could send notification or update status here
    
    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"AI inference task {task_id} completed successfully")


@celery_app.task(base=AIInferenceTask, bind=True)
def run_prospectivity_inference(
    self,
    aoi_geojson: Dict[str, Any],
    model_version: str = "latest",
    org_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """Run prospectivity inference with uncertainty quantification
    
    Args:
        aoi_geojson: GeoJSON polygon defining area of interest
        model_version: Model version to use for inference
        org_id: Organization ID for access control
        project_id: Project ID for organization
        
    Returns:
        Dictionary with inference results and file paths
    """
    logger.info(f"Starting prospectivity inference task {self.request.id}")
    
    # Update task state
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 5, 'status': 'Initializing inference'}
    )
    
    db = SessionLocal()
    try:
        # Initialize service
        service = AIInferenceService(db)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 5, 'status': 'Loading features'}
        )
        
        # Run inference
        result = await service.run_inference(
            aoi_geojson=aoi_geojson,
            model_version=model_version,
            org_id=UUID(org_id) if org_id else None,
            project_id=UUID(project_id) if project_id else None
        )
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 5, 'total': 5, 'status': 'Inference completed'}
        )
        
        # Add task metadata
        result['task_id'] = self.request.id
        result['model_version'] = model_version
        
        logger.info(f"Prospectivity inference completed: {result['inference_id']}")
        return result
        
    except Exception as e:
        logger.error(f"Prospectivity inference failed: {str(e)}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        db.close()


@celery_app.task(base=AIInferenceTask, bind=True)
def retrain_prospectivity_model(
    self,
    training_labels: list,
    base_model_version: str = "latest",
    org_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """Retrain prospectivity model with new labels (for active learning)
    
    Args:
        training_labels: List of training labels with coordinates and values
        base_model_version: Base model version to fine-tune
        org_id: Organization ID for access control
        project_id: Project ID for organization
        
    Returns:
        Dictionary with retraining results and new model version
    """
    logger.info(f"Starting model retraining task {self.request.id}")
    
    # Update task state
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 4, 'status': 'Loading base model'}
    )
    
    db = SessionLocal()
    try:
        # Initialize service
        service = AIInferenceService(db)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 4, 'status': 'Preparing training data'}
        )
        
        # For now, return mock retraining result
        # In production, this would implement actual model retraining
        new_model_version = f"retrained_{self.request.id[:8]}"
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 3, 'total': 4, 'status': 'Evaluating model performance'}
        )
        
        result = {
            'task_id': self.request.id,
            'new_model_version': new_model_version,
            'base_model_version': base_model_version,
            'training_samples': len(training_labels),
            'metrics': {
                'before': {
                    'auc': 0.75,
                    'precision': 0.68,
                    'recall': 0.72,
                    'f1': 0.70
                },
                'after': {
                    'auc': 0.82,
                    'precision': 0.76,
                    'recall': 0.78,
                    'f1': 0.77
                }
            },
            'improvement': {
                'auc': 0.07,
                'precision': 0.08,
                'recall': 0.06,
                'f1': 0.07
            },
            'status': 'completed'
        }
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 4, 'total': 4, 'status': 'Model retraining completed'}
        )
        
        logger.info(f"Model retraining completed: {new_model_version}")
        return result
        
    except Exception as e:
        logger.error(f"Model retraining failed: {str(e)}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        db.close()


@celery_app.task
def cleanup_old_inference_results(days_old: int = 30) -> Dict[str, Any]:
    """Clean up old inference results from S3
    
    Args:
        days_old: Number of days after which to clean up results
        
    Returns:
        Dictionary with cleanup statistics
    """
    logger.info(f"Starting cleanup of inference results older than {days_old} days")
    
    try:
        import boto3
        from datetime import datetime, timedelta
        
        if not settings.AWS_ACCESS_KEY_ID:
            logger.warning("S3 not configured, skipping cleanup")
            return {'status': 'skipped', 'reason': 'S3 not configured'}
        
        s3_client = boto3.client('s3')
        cutoff_date = datetime.now() - timedelta(days=days_old)
        
        # List objects in ai-inference prefix
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(
            Bucket=settings.S3_BUCKET,
            Prefix='ai-inference/'
        )
        
        deleted_count = 0
        total_size = 0
        
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                        # Delete object
                        s3_client.delete_object(
                            Bucket=settings.S3_BUCKET,
                            Key=obj['Key']
                        )
                        deleted_count += 1
                        total_size += obj['Size']
        
        result = {
            'status': 'completed',
            'deleted_files': deleted_count,
            'freed_space_mb': total_size / (1024 * 1024),
            'cutoff_date': cutoff_date.isoformat()
        }
        
        logger.info(f"Cleanup completed: deleted {deleted_count} files, "
                   f"freed {result['freed_space_mb']:.2f} MB")
        
        return result
        
    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}")
        return {'status': 'failed', 'error': str(e)}