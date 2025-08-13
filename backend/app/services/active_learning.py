"""Active Learning Service

Service for managing active learning workflows including label collection,
uncertainty analysis, and model retraining.
"""

import json
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from geoalchemy2.functions import ST_DWithin, ST_Distance
import joblib
import boto3
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc

from app.core.config import settings
from app.core.logging import logger
from app.models.active_learning import TrainingLabel, ModelVersion, ModelMetric, HighUncertaintyZone
from app.services.feature_store import FeatureStoreService


class ActiveLearningService:
    """Service for active learning and model retraining"""
    
    def __init__(self, db: Session):
        self.db = db
        self.s3_client = boto3.client('s3') if settings.AWS_ACCESS_KEY_ID else None
        self.feature_service = FeatureStoreService(db)
        
        # Active learning configuration
        self.min_labels_for_retraining = 20
        self.uncertainty_threshold = 0.7  # High uncertainty threshold
        self.max_suggestions_per_inference = 100
        
    async def add_training_label(
        self,
        longitude: float,
        latitude: float,
        label_value: float,
        confidence: float = 1.0,
        source: str = "user",
        user_id: UUID,
        org_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        inference_id: Optional[str] = None
    ) -> TrainingLabel:
        """Add a new training label from user input
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            label_value: Label value (0.0 to 1.0)
            confidence: User confidence in label (0.0 to 1.0)
            source: Label source (user, expert, synthetic)
            user_id: ID of user providing label
            org_id: Organization ID
            project_id: Project ID
            inference_id: Associated inference ID if available
            
        Returns:
            Created TrainingLabel instance
        """
        logger.info(f"Adding training label at ({longitude}, {latitude}) with value {label_value}")
        
        try:
            # Get context information if inference_id provided
            uncertainty_value = None
            prediction_value = None
            
            if inference_id:
                # Get uncertainty and prediction values at this location
                uncertainty_value, prediction_value = await self._get_inference_values_at_point(
                    inference_id, longitude, latitude
                )
            
            # Create training label
            label = TrainingLabel(
                geom=f"POINT({longitude} {latitude})",
                label_value=label_value,
                confidence=confidence,
                source=source,
                weight=confidence,  # Use confidence as weight
                created_by=user_id,
                inference_id=inference_id,
                uncertainty_value=uncertainty_value,
                prediction_value=prediction_value,
                org_id=org_id,
                project_id=project_id
            )
            
            self.db.add(label)
            self.db.commit()
            self.db.refresh(label)
            
            # Mark uncertainty zone as labeled if it exists
            if inference_id:
                await self._mark_uncertainty_zone_labeled(inference_id, longitude, latitude)
            
            logger.info(f"Created training label: {label.id}")
            return label
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to add training label: {str(e)}")
            raise
    
    async def get_training_labels(
        self,
        org_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        inference_id: Optional[str] = None,
        limit: int = 1000
    ) -> List[TrainingLabel]:
        """Get training labels with optional filtering"""
        query = self.db.query(TrainingLabel)
        
        if org_id:
            query = query.filter(TrainingLabel.org_id == org_id)
        if project_id:
            query = query.filter(TrainingLabel.project_id == project_id)
        if inference_id:
            query = query.filter(TrainingLabel.inference_id == inference_id)
        
        labels = query.order_by(desc(TrainingLabel.created_at)).limit(limit).all()
        
        logger.info(f"Retrieved {len(labels)} training labels")
        return labels
    
    async def identify_high_uncertainty_zones(
        self,
        inference_id: str,
        uncertainty_cog_path: str,
        prospectivity_cog_path: str,
        org_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> List[HighUncertaintyZone]:
        """Identify high uncertainty zones for active learning suggestions
        
        Args:
            inference_id: Inference ID
            uncertainty_cog_path: Path to uncertainty COG
            prospectivity_cog_path: Path to prospectivity COG
            org_id: Organization ID
            project_id: Project ID
            
        Returns:
            List of high uncertainty zones
        """
        logger.info(f"Identifying high uncertainty zones for inference: {inference_id}")
        
        try:
            # For now, create mock high uncertainty zones
            # In production, this would analyze the actual COG files
            zones = []
            
            # Generate sample high uncertainty points
            np.random.seed(42)
            n_zones = min(self.max_suggestions_per_inference, 50)
            
            for i in range(n_zones):
                # Mock coordinates within a reasonable range
                longitude = np.random.uniform(28.0, 28.1)
                latitude = np.random.uniform(-26.0, -25.9)
                
                # Mock uncertainty and prediction values
                uncertainty_value = np.random.uniform(self.uncertainty_threshold, 1.0)
                prediction_value = np.random.uniform(0.0, 1.0)
                
                # Calculate priority score (higher uncertainty = higher priority)
                priority_score = uncertainty_value * (1.0 + abs(prediction_value - 0.5))
                
                zone = HighUncertaintyZone(
                    inference_id=inference_id,
                    geom=f"POINT({longitude} {latitude})",
                    uncertainty_value=uncertainty_value,
                    prediction_value=prediction_value,
                    priority_score=priority_score,
                    org_id=org_id,
                    project_id=project_id
                )
                
                self.db.add(zone)
                zones.append(zone)
            
            self.db.commit()
            
            logger.info(f"Identified {len(zones)} high uncertainty zones")
            return zones
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to identify uncertainty zones: {str(e)}")
            raise
    
    async def get_labeling_suggestions(
        self,
        inference_id: str,
        limit: int = 20,
        exclude_labeled: bool = True
    ) -> List[Dict[str, Any]]:
        """Get suggestions for active learning labeling
        
        Args:
            inference_id: Inference ID to get suggestions for
            limit: Maximum number of suggestions
            exclude_labeled: Whether to exclude already labeled zones
            
        Returns:
            List of labeling suggestions with coordinates and metadata
        """
        query = self.db.query(HighUncertaintyZone).filter(
            HighUncertaintyZone.inference_id == inference_id
        )
        
        if exclude_labeled:
            query = query.filter(HighUncertaintyZone.is_labeled == False)
        
        zones = query.order_by(desc(HighUncertaintyZone.priority_score)).limit(limit).all()
        
        suggestions = []
        for zone in zones:
            # Extract coordinates from geometry
            lon = self.db.scalar(func.ST_X(zone.geom))
            lat = self.db.scalar(func.ST_Y(zone.geom))
            
            suggestions.append({
                'id': str(zone.id),
                'longitude': lon,
                'latitude': lat,
                'uncertainty_value': zone.uncertainty_value,
                'prediction_value': zone.prediction_value,
                'priority_score': zone.priority_score,
                'is_labeled': zone.is_labeled
            })
        
        logger.info(f"Generated {len(suggestions)} labeling suggestions")
        return suggestions
    
    async def check_retraining_eligibility(
        self,
        org_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Check if enough labels are available for retraining
        
        Returns:
            Dictionary with eligibility status and statistics
        """
        query = self.db.query(TrainingLabel)
        
        if org_id:
            query = query.filter(TrainingLabel.org_id == org_id)
        if project_id:
            query = query.filter(TrainingLabel.project_id == project_id)
        
        total_labels = query.count()
        recent_labels = query.filter(
            TrainingLabel.created_at >= func.now() - func.interval('30 days')
        ).count()
        
        # Check label distribution
        positive_labels = query.filter(TrainingLabel.label_value >= 0.5).count()
        negative_labels = query.filter(TrainingLabel.label_value < 0.5).count()
        
        eligible = (
            total_labels >= self.min_labels_for_retraining and
            positive_labels > 0 and
            negative_labels > 0
        )
        
        return {
            'eligible': eligible,
            'total_labels': total_labels,
            'recent_labels': recent_labels,
            'positive_labels': positive_labels,
            'negative_labels': negative_labels,
            'min_required': self.min_labels_for_retraining,
            'recommendation': self._get_retraining_recommendation(
                total_labels, positive_labels, negative_labels
            )
        }
    
    async def prepare_training_data(
        self,
        org_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepare training data from labels and features
        
        Returns:
            Tuple of (X, y, feature_names)
        """
        logger.info("Preparing training data for model retraining")
        
        # Get training labels
        labels = await self.get_training_labels(org_id=org_id, project_id=project_id)
        
        if len(labels) < self.min_labels_for_retraining:
            raise ValueError(f"Insufficient labels: {len(labels)} < {self.min_labels_for_retraining}")
        
        # Extract coordinates and labels
        coordinates = []
        y_values = []
        weights = []
        
        for label in labels:
            lon = self.db.scalar(func.ST_X(label.geom))
            lat = self.db.scalar(func.ST_Y(label.geom))
            coordinates.append([lon, lat])
            y_values.append(label.label_value)
            weights.append(label.weight)
        
        # Get features for these coordinates
        # Create bounding box around all points
        lons = [coord[0] for coord in coordinates]
        lats = [coord[1] for coord in coordinates]
        bbox = [min(lons) - 0.01, min(lats) - 0.01, max(lons) + 0.01, max(lats) + 0.01]
        
        # Get features from feature store
        features_result = await self.feature_service.get_features(
            bbox=bbox,
            keys=None,  # Get all features
            scales=[1, 3, 5],
            format="json",
            org_id=org_id
        )
        
        features_data = features_result.get('features', [])
        
        # Match features to label coordinates
        X_list = []
        y_matched = []
        weights_matched = []
        feature_names = None
        
        for i, (lon, lat) in enumerate(coordinates):
            # Find closest feature point
            closest_feature = self._find_closest_feature(lon, lat, features_data)
            
            if closest_feature:
                # Extract feature vector
                exclude_cols = {'cell_id', 'longitude', 'latitude', 'country', 'province', 'scale'}
                feature_vector = []
                
                if feature_names is None:
                    feature_names = [k for k in closest_feature.keys() if k not in exclude_cols]
                
                for key in feature_names:
                    value = closest_feature.get(key, 0.0)
                    feature_vector.append(float(value) if value is not None else 0.0)
                
                X_list.append(feature_vector)
                y_matched.append(y_values[i])
                weights_matched.append(weights[i])
        
        if not X_list:
            raise ValueError("No features found for training labels")
        
        X = np.array(X_list)
        y = np.array(y_matched)
        
        logger.info(f"Prepared training data: {X.shape[0]} samples, {X.shape[1]} features")
        return X, y, feature_names
    
    async def create_model_version(
        self,
        version: str,
        base_version: Optional[str],
        user_id: UUID,
        training_samples: int,
        training_config: Dict[str, Any],
        org_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
    ) -> ModelVersion:
        """Create a new model version record"""
        model_version = ModelVersion(
            version=version,
            base_version=base_version,
            created_by=user_id,
            training_samples=training_samples,
            training_config=training_config,
            org_id=org_id,
            project_id=project_id
        )
        
        self.db.add(model_version)
        self.db.commit()
        self.db.refresh(model_version)
        
        logger.info(f"Created model version: {version}")
        return model_version
    
    async def save_model_metrics(
        self,
        model_version_id: UUID,
        metrics: Dict[str, float],
        metric_type: str = "validation"
    ):
        """Save model performance metrics"""
        for metric_name, metric_value in metrics.items():
            metric = ModelMetric(
                model_version_id=model_version_id,
                metric_name=metric_name,
                metric_value=metric_value,
                metric_type=metric_type
            )
            self.db.add(metric)
        
        self.db.commit()
        logger.info(f"Saved {len(metrics)} metrics for model version {model_version_id}")
    
    async def get_model_versions(
        self,
        org_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[ModelVersion]:
        """Get model versions with metrics"""
        query = self.db.query(ModelVersion)
        
        if org_id:
            query = query.filter(ModelVersion.org_id == org_id)
        
        versions = query.order_by(desc(ModelVersion.created_at)).limit(limit).all()
        
        logger.info(f"Retrieved {len(versions)} model versions")
        return versions
    
    def _find_closest_feature(
        self, 
        lon: float, 
        lat: float, 
        features_data: List[Dict[str, Any]],
        max_distance: float = 0.01
    ) -> Optional[Dict[str, Any]]:
        """Find closest feature point to given coordinates"""
        closest_feature = None
        min_distance = float('inf')
        
        for feature in features_data:
            f_lon = feature.get('longitude')
            f_lat = feature.get('latitude')
            
            if f_lon is not None and f_lat is not None:
                distance = ((lon - f_lon) ** 2 + (lat - f_lat) ** 2) ** 0.5
                
                if distance < min_distance and distance <= max_distance:
                    min_distance = distance
                    closest_feature = feature
        
        return closest_feature
    
    async def _get_inference_values_at_point(
        self,
        inference_id: str,
        longitude: float,
        latitude: float
    ) -> Tuple[Optional[float], Optional[float]]:
        """Get uncertainty and prediction values at a specific point"""
        # In production, this would query the COG files
        # For now, return mock values
        uncertainty = np.random.uniform(0.0, 1.0)
        prediction = np.random.uniform(0.0, 1.0)
        
        return uncertainty, prediction
    
    async def _mark_uncertainty_zone_labeled(
        self,
        inference_id: str,
        longitude: float,
        latitude: float,
        radius: float = 0.001  # ~100m
    ):
        """Mark nearby uncertainty zones as labeled"""
        # Find uncertainty zones within radius
        zones = self.db.query(HighUncertaintyZone).filter(
            and_(
                HighUncertaintyZone.inference_id == inference_id,
                func.ST_DWithin(
                    HighUncertaintyZone.geom,
                    func.ST_GeomFromText(f"POINT({longitude} {latitude})", 4326),
                    radius
                )
            )
        ).all()
        
        # Mark as labeled
        for zone in zones:
            zone.is_labeled = True
        
        if zones:
            self.db.commit()
            logger.info(f"Marked {len(zones)} uncertainty zones as labeled")
    
    def _get_retraining_recommendation(
        self,
        total_labels: int,
        positive_labels: int,
        negative_labels: int
    ) -> str:
        """Get recommendation for retraining based on label statistics"""
        if total_labels < self.min_labels_for_retraining:
            return f"Need {self.min_labels_for_retraining - total_labels} more labels"
        
        if positive_labels == 0:
            return "Need positive examples (label_value >= 0.5)"
        
        if negative_labels == 0:
            return "Need negative examples (label_value < 0.5)"
        
        # Check balance
        ratio = positive_labels / (positive_labels + negative_labels)
        if ratio < 0.1:
            return "Need more positive examples for better balance"
        elif ratio > 0.9:
            return "Need more negative examples for better balance"
        
        return "Ready for retraining"