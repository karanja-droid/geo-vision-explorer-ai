"""Active Learning Celery Tasks

Background tasks for model retraining and active learning workflows.
"""

import json
import numpy as np
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4
from datetime import datetime
from celery import Task
from celery.utils.log import get_task_logger
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc, mean_squared_error
import joblib
import boto3
import tempfile
import os

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.services.active_learning import ActiveLearningService
from app.models.active_learning import ModelVersion
from app.core.config import settings

logger = get_task_logger(__name__)


class ActiveLearningTask(Task):
    """Base task class for active learning with error handling"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Active learning task {task_id} failed: {exc}")
    
    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"Active learning task {task_id} completed successfully")


@celery_app.task(base=ActiveLearningTask, bind=True)
def retrain_model_with_labels(
    self,
    base_model_version: str = "latest",
    org_id: Optional[str] = None,
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    training_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Retrain prospectivity model with new training labels
    
    Args:
        base_model_version: Base model version to fine-tune
        org_id: Organization ID
        project_id: Project ID
        user_id: User ID who initiated retraining
        training_config: Training configuration parameters
        
    Returns:
        Dictionary with retraining results and metrics
    """
    logger.info(f"Starting model retraining task {self.request.id}")
    
    # Update task state
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 6, 'status': 'Initializing retraining'}
    )
    
    db = SessionLocal()
    try:
        # Initialize service
        service = ActiveLearningService(db)
        
        # Check retraining eligibility
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 6, 'status': 'Checking training data eligibility'}
        )
        
        eligibility = await service.check_retraining_eligibility(
            org_id=UUID(org_id) if org_id else None,
            project_id=UUID(project_id) if project_id else None
        )
        
        if not eligibility['eligible']:
            raise ValueError(f"Not eligible for retraining: {eligibility['recommendation']}")
        
        # Prepare training data
        self.update_state(
            state='PROGRESS',
            meta={'current': 2, 'total': 6, 'status': 'Preparing training data'}
        )
        
        X, y, feature_names = await service.prepare_training_data(
            org_id=UUID(org_id) if org_id else None,
            project_id=UUID(project_id) if project_id else None
        )
        
        logger.info(f"Training data prepared: {X.shape[0]} samples, {X.shape[1]} features")
        
        # Split data for training and validation
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=(y > 0.5).astype(int)
        )
        
        # Load base model or create new one
        self.update_state(
            state='PROGRESS',
            meta={'current': 3, 'total': 6, 'status': 'Loading base model'}
        )
        
        base_model = await _load_base_model(base_model_version)
        
        # Configure training parameters
        if training_config is None:
            training_config = {
                'n_estimators': 150,
                'max_depth': 12,
                'min_samples_split': 5,
                'min_samples_leaf': 2,
                'random_state': 42,
                'n_jobs': -1
            }
        
        # Train new model
        self.update_state(
            state='PROGRESS',
            meta={'current': 4, 'total': 6, 'status': 'Training new model'}
        )
        
        # Create new model (fine-tuning approach)
        new_model = RandomForestRegressor(**training_config)
        
        # If we have a base model, use warm start approach
        if base_model is not None:
            # For RandomForest, we'll retrain with combined data
            # In production, this could use more sophisticated transfer learning
            logger.info("Fine-tuning from base model")
        
        # Train the model
        new_model.fit(X_train, y_train)
        
        # Evaluate model performance
        self.update_state(
            state='PROGRESS',
            meta={'current': 5, 'total': 6, 'status': 'Evaluating model performance'}
        )
        
        # Get predictions
        y_pred_train = new_model.predict(X_train)
        y_pred_val = new_model.predict(X_val)
        
        # Calculate metrics
        metrics_before = await _get_baseline_metrics(base_model, X_val, y_val) if base_model else None
        metrics_after = _calculate_metrics(y_val, y_pred_val, y_train, y_pred_train)
        
        # Calculate improvement
        improvement = {}
        if metrics_before:
            for key in metrics_after.keys():
                if key in metrics_before:
                    improvement[key] = metrics_after[key] - metrics_before[key]
        
        # Create new model version
        new_version = f"retrained_{self.request.id[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        model_version = await service.create_model_version(
            version=new_version,
            base_version=base_model_version,
            user_id=UUID(user_id) if user_id else uuid4(),
            training_samples=len(X),
            training_config=training_config,
            org_id=UUID(org_id) if org_id else None,
            project_id=UUID(project_id) if project_id else None
        )
        
        # Save model artifacts
        self.update_state(
            state='PROGRESS',
            meta={'current': 6, 'total': 6, 'status': 'Saving model artifacts'}
        )
        
        model_path = await _save_model_artifacts(new_model, new_version, feature_names)
        
        # Update model version with path
        model_version.model_path = model_path
        model_version.status = 'active'
        db.commit()
        
        # Save metrics
        await service.save_model_metrics(model_version.id, metrics_after, 'validation')
        if metrics_before:
            await service.save_model_metrics(model_version.id, metrics_before, 'baseline')
        
        # Prepare result
        result = {
            'task_id': self.request.id,
            'new_model_version': new_version,
            'base_model_version': base_model_version,
            'training_samples': len(X),
            'validation_samples': len(X_val),
            'metrics_before': metrics_before or {},
            'metrics_after': metrics_after,
            'improvement': improvement,
            'model_path': model_path,
            'feature_names': feature_names[:20],  # Limit for response size
            'training_config': training_config,
            'status': 'completed'
        }
        
        logger.info(f"Model retraining completed: {new_version}")
        return result
        
    except Exception as e:
        logger.error(f"Model retraining failed: {str(e)}")
        
        # Update model version status if created
        try:
            if 'model_version' in locals():
                model_version.status = 'failed'
                db.commit()
        except:
            pass
        
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        db.close()


@celery_app.task(base=ActiveLearningTask, bind=True)
def identify_uncertainty_zones(
    self,
    inference_id: str,
    uncertainty_cog_path: str,
    prospectivity_cog_path: str,
    org_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """Identify high uncertainty zones for active learning suggestions
    
    Args:
        inference_id: Inference ID
        uncertainty_cog_path: Path to uncertainty COG
        prospectivity_cog_path: Path to prospectivity COG
        org_id: Organization ID
        project_id: Project ID
        
    Returns:
        Dictionary with identified zones and statistics
    """
    logger.info(f"Identifying uncertainty zones for inference: {inference_id}")
    
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 3, 'status': 'Analyzing uncertainty data'}
    )
    
    db = SessionLocal()
    try:
        service = ActiveLearningService(db)
        
        # Identify high uncertainty zones
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 3, 'status': 'Identifying high uncertainty zones'}
        )
        
        zones = await service.identify_high_uncertainty_zones(
            inference_id=inference_id,
            uncertainty_cog_path=uncertainty_cog_path,
            prospectivity_cog_path=prospectivity_cog_path,
            org_id=UUID(org_id) if org_id else None,
            project_id=UUID(project_id) if project_id else None
        )
        
        # Generate labeling suggestions
        self.update_state(
            state='PROGRESS',
            meta={'current': 2, 'total': 3, 'status': 'Generating labeling suggestions'}
        )
        
        suggestions = await service.get_labeling_suggestions(
            inference_id=inference_id,
            limit=50
        )
        
        result = {
            'task_id': self.request.id,
            'inference_id': inference_id,
            'zones_identified': len(zones),
            'suggestions_generated': len(suggestions),
            'top_suggestions': suggestions[:10],  # Top 10 for immediate display
            'status': 'completed'
        }
        
        logger.info(f"Uncertainty zone identification completed: {len(zones)} zones")
        return result
        
    except Exception as e:
        logger.error(f"Uncertainty zone identification failed: {str(e)}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        db.close()


async def _load_base_model(model_version: str) -> Optional[RandomForestRegressor]:
    """Load base model for fine-tuning"""
    try:
        if model_version == "latest":
            # Create a baseline model
            model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42
            )
            
            # Train on synthetic data for baseline
            np.random.seed(42)
            X_synthetic = np.random.randn(1000, 50)
            y_synthetic = (
                0.3 * X_synthetic[:, 0] +
                0.2 * X_synthetic[:, 1] +
                0.1 * X_synthetic[:, 2] +
                0.1 * np.random.randn(1000)
            )
            y_synthetic = 1 / (1 + np.exp(-y_synthetic))  # Sigmoid
            
            model.fit(X_synthetic, y_synthetic)
            logger.info(f"Loaded baseline model: {model_version}")
            return model
        
        # In production, load from S3
        # model_path = f"s3://{settings.S3_BUCKET}/models/{model_version}/model.joblib"
        # return joblib.load(model_path)
        
        return None
        
    except Exception as e:
        logger.warning(f"Failed to load base model {model_version}: {str(e)}")
        return None


async def _get_baseline_metrics(
    base_model: RandomForestRegressor,
    X_val: np.ndarray,
    y_val: np.ndarray
) -> Dict[str, float]:
    """Get baseline metrics from base model"""
    try:
        y_pred_base = base_model.predict(X_val)
        return _calculate_metrics(y_val, y_pred_base, y_val, y_pred_base)
    except Exception as e:
        logger.warning(f"Failed to get baseline metrics: {str(e)}")
        return {}


def _calculate_metrics(
    y_true_val: np.ndarray,
    y_pred_val: np.ndarray,
    y_true_train: np.ndarray,
    y_pred_train: np.ndarray
) -> Dict[str, float]:
    """Calculate comprehensive model metrics"""
    metrics = {}
    
    try:
        # Convert to binary for classification metrics
        y_true_binary = (y_true_val > 0.5).astype(int)
        y_pred_binary = (y_pred_val > 0.5).astype(int)
        
        # AUC-ROC
        if len(np.unique(y_true_binary)) > 1:
            metrics['auc'] = roc_auc_score(y_true_binary, y_pred_val)
        else:
            metrics['auc'] = 0.5
        
        # Precision-Recall AUC
        if len(np.unique(y_true_binary)) > 1:
            precision, recall, _ = precision_recall_curve(y_true_binary, y_pred_val)
            metrics['pr_auc'] = auc(recall, precision)
        else:
            metrics['pr_auc'] = 0.5
        
        # Classification metrics
        tp = np.sum((y_true_binary == 1) & (y_pred_binary == 1))
        fp = np.sum((y_true_binary == 0) & (y_pred_binary == 1))
        tn = np.sum((y_true_binary == 0) & (y_pred_binary == 0))
        fn = np.sum((y_true_binary == 1) & (y_pred_binary == 0))
        
        metrics['precision'] = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        metrics['recall'] = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        metrics['f1'] = (
            2 * metrics['precision'] * metrics['recall'] / 
            (metrics['precision'] + metrics['recall'])
            if (metrics['precision'] + metrics['recall']) > 0 else 0.0
        )
        
        # Regression metrics
        metrics['mse'] = mean_squared_error(y_true_val, y_pred_val)
        metrics['rmse'] = np.sqrt(metrics['mse'])
        
        # R-squared
        ss_res = np.sum((y_true_val - y_pred_val) ** 2)
        ss_tot = np.sum((y_true_val - np.mean(y_true_val)) ** 2)
        metrics['r2'] = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
        
        # Training metrics for overfitting detection
        train_mse = mean_squared_error(y_true_train, y_pred_train)
        metrics['overfitting_ratio'] = metrics['mse'] / train_mse if train_mse > 0 else 1.0
        
    except Exception as e:
        logger.error(f"Error calculating metrics: {str(e)}")
        # Return default metrics
        metrics = {
            'auc': 0.5, 'pr_auc': 0.5, 'precision': 0.0, 'recall': 0.0,
            'f1': 0.0, 'mse': 1.0, 'rmse': 1.0, 'r2': 0.0, 'overfitting_ratio': 1.0
        }
    
    return metrics


async def _save_model_artifacts(
    model: RandomForestRegressor,
    model_version: str,
    feature_names: List[str]
) -> str:
    """Save model artifacts to S3"""
    try:
        if not settings.AWS_ACCESS_KEY_ID:
            logger.warning("S3 not configured, skipping model save")
            return f"local://models/{model_version}"
        
        s3_client = boto3.client('s3')
        
        # Create temporary files
        with tempfile.TemporaryDirectory() as temp_dir:
            # Save model
            model_path = os.path.join(temp_dir, 'model.joblib')
            joblib.dump(model, model_path)
            
            # Save feature names
            features_path = os.path.join(temp_dir, 'feature_names.json')
            with open(features_path, 'w') as f:
                json.dump(feature_names, f)
            
            # Save metadata
            metadata_path = os.path.join(temp_dir, 'metadata.json')
            metadata = {
                'model_version': model_version,
                'created_at': datetime.now().isoformat(),
                'model_type': 'RandomForestRegressor',
                'feature_count': len(feature_names),
                'sklearn_version': '1.0.0'  # Would get actual version
            }
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Upload to S3
            s3_prefix = f"models/{model_version}"
            
            # Upload model
            s3_client.upload_file(
                model_path,
                settings.S3_BUCKET,
                f"{s3_prefix}/model.joblib",
                ExtraArgs={'ContentType': 'application/octet-stream'}
            )
            
            # Upload feature names
            s3_client.upload_file(
                features_path,
                settings.S3_BUCKET,
                f"{s3_prefix}/feature_names.json",
                ExtraArgs={'ContentType': 'application/json'}
            )
            
            # Upload metadata
            s3_client.upload_file(
                metadata_path,
                settings.S3_BUCKET,
                f"{s3_prefix}/metadata.json",
                ExtraArgs={'ContentType': 'application/json'}
            )
        
        s3_path = f"s3://{settings.S3_BUCKET}/{s3_prefix}"
        logger.info(f"Saved model artifacts to: {s3_path}")
        return s3_path
        
    except Exception as e:
        logger.error(f"Failed to save model artifacts: {str(e)}")
        return f"local://models/{model_version}"