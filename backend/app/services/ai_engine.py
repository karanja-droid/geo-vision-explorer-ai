"""AI engine for prospectivity analysis and model training"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import cross_val_score, train_test_split, GridSearchCV
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.feature_selection import SelectKBest, f_classif, RFE
from sklearn.utils.class_weight import compute_class_weight
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Tuple, Optional
from uuid import UUID
import joblib
import os
import logging
from datetime import datetime
import asyncio

from app.models.prospectivity import (
    AIModel, TrainingData, ProspectivityRun, ProspectivityTarget,
    ModelPerformance, FeatureImportance, ModelPrediction
)
from app.services.spatial_processor import extract_features_at_points
from app.services.raster_processor import create_prospectivity_raster
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIModelEngine:
    """AI model engine for prospectivity analysis"""
    
    def __init__(self):
        self.model_classes = {
            'random_forest': RandomForestClassifier,
            'gradient_boosting': GradientBoostingClassifier,
            'neural_network': MLPClassifier,
            'svm': SVC,
            'logistic_regression': LogisticRegression
        }
        
        self.default_parameters = {
            'random_forest': {
                'n_estimators': 100,
                'max_depth': 10,
                'min_samples_split': 5,
                'min_samples_leaf': 2,
                'random_state': 42
            },
            'gradient_boosting': {
                'n_estimators': 100,
                'learning_rate': 0.1,
                'max_depth': 6,
                'random_state': 42
            },
            'neural_network': {
                'hidden_layer_sizes': (100, 50),
                'max_iter': 1000,
                'random_state': 42
            },
            'svm': {
                'kernel': 'rbf',
                'C': 1.0,
                'probability': True,
                'random_state': 42
            },
            'logistic_regression': {
                'random_state': 42,
                'max_iter': 1000
            }
        }

    async def train_model(
        self,
        db: Session,
        model_id: UUID,
        training_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Train an AI model"""
        
        try:
            # Get model record
            model = db.query(AIModel).filter(AIModel.id == model_id).first()
            if not model:
                raise ValueError(f"Model {model_id} not found")
            
            logger.info(f"Starting training for model {model.name}")
            
            # Load training data
            training_data = await self._load_training_data(db, model_id, training_config)
            if len(training_data) < 10:
                raise ValueError("Insufficient training data (minimum 10 samples required)")
            
            # Prepare features and labels
            X, y, feature_names = await self._prepare_training_data(training_data)
            
            # Split data
            validation_split = training_config.get('validation_split', 0.2)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=validation_split, random_state=42, stratify=y
            )
            
            # Feature selection
            if training_config.get('feature_selection', True):
                X_train, X_test, selected_features = await self._select_features(
                    X_train, X_test, y_train, feature_names
                )
                feature_names = selected_features
            
            # Handle class imbalance
            if training_config.get('class_balancing', True):
                class_weights = compute_class_weight(
                    'balanced', classes=np.unique(y_train), y=y_train
                )
                class_weight_dict = {i: w for i, w in enumerate(class_weights)}
            else:
                class_weight_dict = None
            
            # Get model parameters
            model_params = model.parameters or {}
            default_params = self.default_parameters.get(model.model_type, {})
            final_params = {**default_params, **model_params}
            
            if class_weight_dict and model.model_type in ['random_forest', 'gradient_boosting', 'logistic_regression']:
                final_params['class_weight'] = class_weight_dict
            
            # Create and train model
            model_class = self.model_classes[model.model_type]
            ml_model = model_class(**final_params)
            
            # Hyperparameter tuning
            if training_config.get('hyperparameter_tuning', True):
                ml_model = await self._tune_hyperparameters(
                    ml_model, X_train, y_train, model.model_type
                )
            
            # Train model
            ml_model.fit(X_train, y_train)
            
            # Evaluate model
            y_pred = ml_model.predict(X_test)
            y_pred_proba = ml_model.predict_proba(X_test)[:, 1] if hasattr(ml_model, 'predict_proba') else y_pred
            
            # Calculate metrics
            metrics = {
                'accuracy': accuracy_score(y_test, y_pred),
                'precision': precision_score(y_test, y_pred),
                'recall': recall_score(y_test, y_pred),
                'f1': f1_score(y_test, y_pred),
                'auc': roc_auc_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.5
            }
            
            # Cross-validation
            cv_folds = training_config.get('cross_validation_folds', 5)
            cv_scores = cross_val_score(ml_model, X, y, cv=cv_folds, scoring='accuracy')
            metrics['cv_accuracy_mean'] = cv_scores.mean()
            metrics['cv_accuracy_std'] = cv_scores.std()
            
            # Save model
            model_path = await self._save_model(ml_model, model_id, feature_names)
            
            # Update model record
            model.status = 'ready'
            model.validation_accuracy = metrics['accuracy']
            model.training_samples = len(training_data)
            model.feature_count = len(feature_names)
            model.model_file_path = model_path
            model.trained_at = datetime.utcnow()
            
            # Save performance metrics
            await self._save_performance_metrics(db, model_id, metrics, y_test, y_pred)
            
            # Save feature importance
            if hasattr(ml_model, 'feature_importances_'):
                await self._save_feature_importance(db, model_id, ml_model.feature_importances_, feature_names)
            
            db.commit()
            
            logger.info(f"Model training completed successfully. Accuracy: {metrics['accuracy']:.3f}")
            
            return {
                'status': 'success',
                'metrics': metrics,
                'feature_count': len(feature_names),
                'training_samples': len(training_data)
            }
            
        except Exception as e:
            logger.error(f"Model training failed: {str(e)}")
            
            # Update model status
            model = db.query(AIModel).filter(AIModel.id == model_id).first()
            if model:
                model.status = 'failed'
                db.commit()
            
            raise e

    async def run_prospectivity_analysis(
        self,
        db: Session,
        run_id: UUID,
        analysis_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Run prospectivity analysis"""
        
        try:
            # Get run record
            run = db.query(ProspectivityRun).filter(ProspectivityRun.id == run_id).first()
            if not run:
                raise ValueError(f"Run {run_id} not found")
            
            # Get model
            model = db.query(AIModel).filter(AIModel.id == run.model_id).first()
            if not model or model.status != 'ready':
                raise ValueError("Model is not ready for analysis")
            
            logger.info(f"Starting prospectivity analysis for run {run.name}")
            
            # Load trained model
            ml_model, feature_names = await self._load_model(model.model_file_path)
            
            # Generate analysis grid
            analysis_grid = await self._generate_analysis_grid(
                run.analysis_area, run.grid_resolution
            )
            
            # Update progress
            run.progress_percent = 10.0
            db.commit()
            
            # Extract features for grid points
            grid_features = await self._extract_grid_features(
                analysis_grid, feature_names, run.project_id
            )
            
            # Update progress
            run.progress_percent = 50.0
            db.commit()
            
            # Make predictions
            predictions = ml_model.predict_proba(grid_features)[:, 1]
            prediction_classes = ml_model.predict(grid_features)
            
            # Update progress
            run.progress_percent = 80.0
            db.commit()
            
            # Generate targets
            confidence_threshold = analysis_config.get('confidence_threshold', 0.5)
            targets = await self._generate_targets(
                db, run_id, analysis_grid, predictions, prediction_classes, confidence_threshold
            )
            
            # Create output raster if requested
            if 'raster' in analysis_config.get('output_formats', []):
                raster_path = await self._create_output_raster(
                    analysis_grid, predictions, run_id
                )
                run.output_raster_path = raster_path
            
            # Update run record
            run.status = 'completed'
            run.progress_percent = 100.0
            run.target_count = len(targets)
            run.completed_at = datetime.utcnow()
            
            db.commit()
            
            logger.info(f"Prospectivity analysis completed. Generated {len(targets)} targets")
            
            return {
                'status': 'success',
                'target_count': len(targets),
                'high_confidence_targets': len([t for t in targets if t.confidence_level in ['high', 'very_high']])
            }
            
        except Exception as e:
            logger.error(f"Prospectivity analysis failed: {str(e)}")
            
            # Update run status
            run = db.query(ProspectivityRun).filter(ProspectivityRun.id == run_id).first()
            if run:
                run.status = 'failed'
                run.error_message = str(e)
                db.commit()
            
            raise e

    async def _load_training_data(
        self,
        db: Session,
        model_id: UUID,
        training_config: Dict[str, Any]
    ) -> List[TrainingData]:
        """Load training data for model"""
        
        query = db.query(TrainingData).filter(TrainingData.model_id == model_id)
        
        # Apply filters
        filters = training_config.get('training_data_filters', {})
        if 'project_id' in filters:
            query = query.filter(TrainingData.project_id == filters['project_id'])
        
        if 'min_confidence' in filters:
            query = query.filter(TrainingData.confidence >= filters['min_confidence'])
        
        # Exclude validation set if specified
        if not training_config.get('include_validation_set', True):
            query = query.filter(TrainingData.validation_set == False)
        
        return query.all()

    async def _prepare_training_data(
        self,
        training_data: List[TrainingData]
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepare training data for ML"""
        
        # Extract features and labels
        features_list = []
        labels = []
        feature_names = None
        
        for sample in training_data:
            if sample.features:
                if feature_names is None:
                    feature_names = list(sample.features.keys())
                
                # Ensure consistent feature order
                feature_vector = [sample.features.get(name, 0.0) for name in feature_names]
                features_list.append(feature_vector)
                labels.append(int(sample.is_positive))
        
        if not features_list:
            raise ValueError("No feature data found in training samples")
        
        X = np.array(features_list)
        y = np.array(labels)
        
        # Handle missing values
        X = np.nan_to_num(X, nan=0.0)
        
        # Scale features
        scaler = StandardScaler()
        X = scaler.fit_transform(X)
        
        return X, y, feature_names

    async def _select_features(
        self,
        X_train: np.ndarray,
        X_test: np.ndarray,
        y_train: np.ndarray,
        feature_names: List[str]
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Select most important features"""
        
        # Use SelectKBest for initial feature selection
        k = min(20, X_train.shape[1])  # Select top 20 features or all if less
        selector = SelectKBest(score_func=f_classif, k=k)
        
        X_train_selected = selector.fit_transform(X_train, y_train)
        X_test_selected = selector.transform(X_test)
        
        # Get selected feature names
        selected_indices = selector.get_support(indices=True)
        selected_features = [feature_names[i] for i in selected_indices]
        
        return X_train_selected, X_test_selected, selected_features

    async def _tune_hyperparameters(
        self,
        model,
        X_train: np.ndarray,
        y_train: np.ndarray,
        model_type: str
    ):
        """Tune hyperparameters using grid search"""
        
        param_grids = {
            'random_forest': {
                'n_estimators': [50, 100, 200],
                'max_depth': [5, 10, 15],
                'min_samples_split': [2, 5, 10]
            },
            'gradient_boosting': {
                'n_estimators': [50, 100, 200],
                'learning_rate': [0.05, 0.1, 0.2],
                'max_depth': [3, 6, 9]
            },
            'neural_network': {
                'hidden_layer_sizes': [(50,), (100,), (100, 50)],
                'learning_rate_init': [0.001, 0.01, 0.1]
            }
        }
        
        if model_type in param_grids:
            grid_search = GridSearchCV(
                model, param_grids[model_type], cv=3, scoring='accuracy', n_jobs=-1
            )
            grid_search.fit(X_train, y_train)
            return grid_search.best_estimator_
        
        return model

    async def _save_model(
        self,
        model,
        model_id: UUID,
        feature_names: List[str]
    ) -> str:
        """Save trained model to disk"""
        
        model_dir = os.path.join(settings.MODEL_STORAGE_PATH, str(model_id))
        os.makedirs(model_dir, exist_ok=True)
        
        model_path = os.path.join(model_dir, 'model.joblib')
        features_path = os.path.join(model_dir, 'features.joblib')
        
        # Save model and feature names
        joblib.dump(model, model_path)
        joblib.dump(feature_names, features_path)
        
        return model_path

    async def _load_model(self, model_path: str) -> Tuple[Any, List[str]]:
        """Load trained model from disk"""
        
        model_dir = os.path.dirname(model_path)
        features_path = os.path.join(model_dir, 'features.joblib')
        
        model = joblib.load(model_path)
        feature_names = joblib.load(features_path)
        
        return model, feature_names

    async def _save_performance_metrics(
        self,
        db: Session,
        model_id: UUID,
        metrics: Dict[str, float],
        y_test: np.ndarray,
        y_pred: np.ndarray
    ):
        """Save model performance metrics"""
        
        # Save individual metrics
        for metric_name, metric_value in metrics.items():
            performance = ModelPerformance(
                model_id=model_id,
                validation_type='holdout',
                metric_name=metric_name,
                metric_value=metric_value
            )
            db.add(performance)
        
        # Save confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        confusion_performance = ModelPerformance(
            model_id=model_id,
            validation_type='holdout',
            metric_name='confusion_matrix',
            metric_value=0.0,  # Not applicable for matrix
            metadata={'matrix': cm.tolist()}
        )
        db.add(confusion_performance)

    async def _save_feature_importance(
        self,
        db: Session,
        model_id: UUID,
        importances: np.ndarray,
        feature_names: List[str]
    ):
        """Save feature importance scores"""
        
        # Sort features by importance
        importance_indices = np.argsort(importances)[::-1]
        
        for rank, idx in enumerate(importance_indices):
            feature_importance = FeatureImportance(
                model_id=model_id,
                feature_name=feature_names[idx],
                importance_score=float(importances[idx]),
                importance_rank=rank + 1,
                feature_type='unknown'  # Could be enhanced with feature type detection
            )
            db.add(feature_importance)

    async def _generate_analysis_grid(
        self,
        analysis_area: Optional[Dict[str, Any]],
        grid_resolution: float
    ) -> List[Tuple[float, float]]:
        """Generate analysis grid points"""
        
        # This is a simplified implementation
        # In practice, you would generate a proper grid based on the analysis area
        
        if analysis_area:
            # Extract bounds from GeoJSON
            coordinates = analysis_area.get('coordinates', [[]])[0]
            if coordinates:
                lons = [coord[0] for coord in coordinates]
                lats = [coord[1] for coord in coordinates]
                min_lon, max_lon = min(lons), max(lons)
                min_lat, max_lat = min(lats), max(lats)
            else:
                # Default bounds
                min_lon, max_lon = -180, 180
                min_lat, max_lat = -90, 90
        else:
            # Default bounds
            min_lon, max_lon = -180, 180
            min_lat, max_lat = -90, 90
        
        # Generate grid
        grid_points = []
        lon_step = grid_resolution / 111320  # Approximate degrees per meter
        lat_step = grid_resolution / 111320
        
        lon = min_lon
        while lon <= max_lon:
            lat = min_lat
            while lat <= max_lat:
                grid_points.append((lon, lat))
                lat += lat_step
            lon += lon_step
        
        return grid_points

    async def _extract_grid_features(
        self,
        grid_points: List[Tuple[float, float]],
        feature_names: List[str],
        project_id: UUID
    ) -> np.ndarray:
        """Extract features for grid points"""
        
        # This would integrate with spatial processing services
        # For now, return dummy features
        
        n_points = len(grid_points)
        n_features = len(feature_names)
        
        # Generate dummy features (in practice, extract from spatial layers)
        features = np.random.rand(n_points, n_features)
        
        return features

    async def _generate_targets(
        self,
        db: Session,
        run_id: UUID,
        grid_points: List[Tuple[float, float]],
        predictions: np.ndarray,
        prediction_classes: np.ndarray,
        confidence_threshold: float
    ) -> List[ProspectivityTarget]:
        """Generate prospectivity targets"""
        
        targets = []
        
        for i, (lon, lat) in enumerate(grid_points):
            score = float(predictions[i])
            
            # Only create targets above threshold
            if score >= confidence_threshold:
                # Determine confidence level
                if score >= 0.9:
                    confidence_level = 'very_high'
                elif score >= 0.75:
                    confidence_level = 'high'
                elif score >= 0.6:
                    confidence_level = 'medium'
                else:
                    confidence_level = 'low'
                
                target = ProspectivityTarget(
                    run_id=run_id,
                    easting=lon,
                    northing=lat,
                    prospectivity_score=score,
                    confidence_level=confidence_level,
                    uncertainty=1.0 - score  # Simple uncertainty measure
                )
                
                db.add(target)
                targets.append(target)
        
        return targets

    async def _create_output_raster(
        self,
        grid_points: List[Tuple[float, float]],
        predictions: np.ndarray,
        run_id: UUID
    ) -> str:
        """Create output raster file"""
        
        # This would use raster processing services
        # For now, return a placeholder path
        
        raster_dir = os.path.join(settings.RASTER_OUTPUT_PATH, str(run_id))
        os.makedirs(raster_dir, exist_ok=True)
        
        raster_path = os.path.join(raster_dir, 'prospectivity.tif')
        
        # In practice, create actual raster using GDAL/rasterio
        # For now, just create empty file
        with open(raster_path, 'w') as f:
            f.write("placeholder raster")
        
        return raster_path

# Convenience functions for API
async def train_prospectivity_model(
    db: Session,
    model_id: UUID,
    training_config: Dict[str, Any]
):
    """Train prospectivity model (async wrapper)"""
    engine = AIModelEngine()
    return await engine.train_model(db, model_id, training_config)

async def run_prospectivity_analysis(
    db: Session,
    run_id: UUID,
    analysis_config: Dict[str, Any]
):
    """Run prospectivity analysis (async wrapper)"""
    engine = AIModelEngine()
    return await engine.run_prospectivity_analysis(db, run_id, analysis_config)

def validate_training_data(training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate training data quality"""
    
    if not training_data:
        return {'valid': False, 'errors': ['No training data provided']}
    
    errors = []
    warnings = []
    
    # Check minimum sample count
    if len(training_data) < 10:
        errors.append('Insufficient training data (minimum 10 samples required)')
    
    # Check class balance
    positive_count = sum(1 for sample in training_data if sample.get('is_positive', False))
    negative_count = len(training_data) - positive_count
    
    if positive_count == 0:
        errors.append('No positive samples found')
    elif negative_count == 0:
        errors.append('No negative samples found')
    elif min(positive_count, negative_count) / max(positive_count, negative_count) < 0.1:
        warnings.append('Severe class imbalance detected')
    
    # Check feature completeness
    feature_counts = {}
    for sample in training_data:
        features = sample.get('features', {})
        for feature_name in features.keys():
            feature_counts[feature_name] = feature_counts.get(feature_name, 0) + 1
    
    if not feature_counts:
        errors.append('No features found in training data')
    else:
        # Check for missing features
        total_samples = len(training_data)
        for feature_name, count in feature_counts.items():
            if count < total_samples * 0.8:  # Less than 80% coverage
                warnings.append(f'Feature "{feature_name}" has low coverage ({count}/{total_samples})')
    
    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings,
        'sample_count': len(training_data),
        'positive_samples': positive_count,
        'negative_samples': negative_count,
        'feature_count': len(feature_counts)
    }

def extract_features_from_datasets(
    datasets: List[str],
    locations: List[Tuple[float, float]]
) -> Dict[str, List[float]]:
    """Extract features from various datasets at specified locations"""
    
    # This would integrate with various data sources
    # For now, return dummy features
    
    features = {}
    
    for dataset in datasets:
        if dataset == 'geology':
            features['rock_type'] = [1.0] * len(locations)
            features['age'] = [2.5] * len(locations)
        elif dataset == 'geochemistry':
            features['au_ppm'] = [0.1] * len(locations)
            features['cu_ppm'] = [100.0] * len(locations)
        elif dataset == 'geophysics':
            features['magnetic_intensity'] = [50000.0] * len(locations)
            features['gravity'] = [-50.0] * len(locations)
        elif dataset == 'remote_sensing':
            features['ndvi'] = [0.3] * len(locations)
            features['clay_index'] = [0.2] * len(locations)
    
    return features

def calculate_model_performance(
    y_true: List[bool],
    y_pred: List[bool],
    y_pred_proba: Optional[List[float]] = None
) -> Dict[str, float]:
    """Calculate comprehensive model performance metrics"""
    
    y_true_np = np.array(y_true)
    y_pred_np = np.array(y_pred)
    
    metrics = {
        'accuracy': accuracy_score(y_true_np, y_pred_np),
        'precision': precision_score(y_true_np, y_pred_np),
        'recall': recall_score(y_true_np, y_pred_np),
        'f1': f1_score(y_true_np, y_pred_np)
    }
    
    if y_pred_proba:
        y_pred_proba_np = np.array(y_pred_proba)
        metrics['auc'] = roc_auc_score(y_true_np, y_pred_proba_np)
    
    return metrics