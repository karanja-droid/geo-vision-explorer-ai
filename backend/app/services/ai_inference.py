"""AI Inference Service

Service for running prospectivity modeling with uncertainty quantification.
Generates dual COG outputs: prospectivity.tif and uncertainty.tif
"""

import json
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_bounds
from rasterio.profiles import default_gtiff_profile
from rasterio.warp import calculate_default_transform, reproject, Resampling
import boto3
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID, uuid4
from datetime import datetime
from pathlib import Path
import tempfile
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_squared_error, r2_score
import joblib
from scipy.stats import entropy
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.feature_store import FSCell, FSFeature
from app.services.feature_store import FeatureStoreService
from app.services.stac_integration import STACIntegrationService


class AIInferenceService:
    """Service for AI-powered prospectivity modeling with uncertainty"""
    
    def __init__(self, db: Session):
        self.db = db
        self.s3_client = boto3.client('s3') if settings.AWS_ACCESS_KEY_ID else None
        self.feature_service = FeatureStoreService(db)
        self.stac_service = STACIntegrationService()
        
        # Model configuration
        self.model_config = {
            'n_estimators': 100,
            'max_depth': 10,
            'min_samples_split': 5,
            'min_samples_leaf': 2,
            'random_state': 42
        }
        
        # COG creation parameters
        self.cog_profile = {
            'driver': 'GTiff',
            'interleave': 'pixel',
            'tiled': True,
            'blockxsize': 512,
            'blockysize': 512,
            'compress': 'lzw',
            'predictor': 2,
            'BIGTIFF': 'IF_SAFER'
        }
        
    async def run_inference(
        self,
        aoi_geojson: Dict[str, Any],
        model_version: str = "latest",
        org_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None
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
        logger.info(f"Starting AI inference for AOI with model {model_version}")
        
        try:
            # Generate unique inference ID
            inference_id = str(uuid4())
            
            # Extract AOI bounds
            aoi_bounds = self._extract_bounds(aoi_geojson)
            
            # Get features for AOI
            features_data = await self._get_features_for_inference(aoi_bounds, org_id)
            
            if not features_data:
                raise ValueError("No features found for the specified AOI")
            
            # Load or create model
            model = await self._load_model(model_version)
            
            # Prepare feature matrix
            X, coordinates, feature_names = self._prepare_feature_matrix(features_data)
            
            # Run inference with uncertainty
            prospectivity, uncertainty = self._predict_with_uncertainty(model, X)
            
            # Create raster grids
            prospectivity_grid, uncertainty_grid, transform, crs = self._create_raster_grids(
                coordinates, prospectivity, uncertainty, aoi_bounds
            )
            
            # Generate COG files
            cog_paths = await self._create_cog_files(
                prospectivity_grid, uncertainty_grid, transform, crs,
                inference_id, aoi_bounds, model_version
            )
            
            # Generate metadata
            metadata = self._generate_inference_metadata(
                inference_id, aoi_geojson, aoi_bounds, model_version,
                len(features_data), feature_names, cog_paths
            )
            
            # Store metadata
            await self._store_inference_metadata(metadata, org_id, project_id)
            
            # Create STAC item
            stac_item = await self.stac_service.create_stac_item(
                inference_id, metadata, cog_paths['prospectivity'], cog_paths['uncertainty']
            )
            
            result = {
                'inference_id': inference_id,
                'status': 'completed',
                'prospectivity_cog': cog_paths['prospectivity'],
                'uncertainty_cog': cog_paths['uncertainty'],
                'metadata': metadata,
                'stac_item': stac_item,
                'statistics': {
                    'prospectivity': {
                        'min': float(np.min(prospectivity)),
                        'max': float(np.max(prospectivity)),
                        'mean': float(np.mean(prospectivity)),
                        'std': float(np.std(prospectivity))
                    },
                    'uncertainty': {
                        'min': float(np.min(uncertainty)),
                        'max': float(np.max(uncertainty)),
                        'mean': float(np.mean(uncertainty)),
                        'std': float(np.std(uncertainty))
                    }
                }
            }
            
            logger.info(f"AI inference completed: {inference_id}")
            return result
            
        except Exception as e:
            logger.error(f"AI inference failed: {str(e)}")
            raise
    
    def _extract_bounds(self, aoi_geojson: Dict[str, Any]) -> List[float]:
        """Extract bounding box from GeoJSON"""
        if 'bbox' in aoi_geojson:
            return aoi_geojson['bbox']
        
        # Calculate bounds from geometry
        coords = aoi_geojson['geometry']['coordinates'][0]
        lons = [coord[0] for coord in coords]
        lats = [coord[1] for coord in coords]
        
        return [min(lons), min(lats), max(lons), max(lats)]
    
    async def _get_features_for_inference(
        self, 
        bbox: List[float], 
        org_id: Optional[UUID]
    ) -> List[Dict[str, Any]]:
        """Get features for inference from feature store"""
        result = await self.feature_service.get_features(
            bbox=bbox,
            keys=None,  # Get all features
            scales=[1, 3, 5],  # All scales
            format="json",
            org_id=org_id
        )
        
        return result.get('features', [])
    
    async def _load_model(self, model_version: str) -> RandomForestRegressor:
        """Load ML model for inference"""
        # For now, create a mock model
        # In production, this would load from S3 or model registry
        model = RandomForestRegressor(**self.model_config)
        
        # Generate synthetic training data for demonstration
        np.random.seed(42)
        n_samples = 1000
        n_features = 50
        
        X_train = np.random.randn(n_samples, n_features)
        # Create synthetic target with some geological logic
        y_train = (
            0.3 * X_train[:, 0] +  # Distance to faults
            0.2 * X_train[:, 1] +  # Magnetic anomaly
            0.1 * X_train[:, 2] +  # Elevation
            0.1 * np.random.randn(n_samples)  # Noise
        )
        
        model.fit(X_train, y_train)
        
        logger.info(f"Loaded model version: {model_version}")
        return model
    
    def _prepare_feature_matrix(
        self, 
        features_data: List[Dict[str, Any]]
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepare feature matrix for inference"""
        # Extract coordinates and features
        coordinates = []
        feature_rows = []
        
        # Get feature names (excluding metadata columns)
        exclude_cols = {'cell_id', 'longitude', 'latitude', 'country', 'province', 'scale'}
        feature_names = []
        
        for record in features_data:
            coordinates.append([record['longitude'], record['latitude']])
            
            feature_row = []
            for key, value in record.items():
                if key not in exclude_cols:
                    if not feature_names or len(feature_names) < len([k for k in record.keys() if k not in exclude_cols]):
                        if key not in feature_names:
                            feature_names.append(key)
                    feature_row.append(float(value) if value is not None else 0.0)
            
            feature_rows.append(feature_row)
        
        # Ensure all rows have the same number of features
        max_features = max(len(row) for row in feature_rows) if feature_rows else 0
        for row in feature_rows:
            while len(row) < max_features:
                row.append(0.0)
        
        X = np.array(feature_rows)
        coords = np.array(coordinates)
        
        # Handle case where we have fewer features than expected
        if X.shape[1] < 50:  # Expected number of features
            # Pad with zeros
            padding = np.zeros((X.shape[0], 50 - X.shape[1]))
            X = np.hstack([X, padding])
        elif X.shape[1] > 50:
            # Truncate
            X = X[:, :50]
        
        logger.info(f"Prepared feature matrix: {X.shape} with {len(feature_names)} features")
        return X, coords, feature_names
    
    def _predict_with_uncertainty(
        self, 
        model: RandomForestRegressor, 
        X: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Predict prospectivity with uncertainty quantification"""
        # Get predictions from all trees
        tree_predictions = np.array([tree.predict(X) for tree in model.estimators_])
        
        # Mean prediction (prospectivity)
        prospectivity = np.mean(tree_predictions, axis=0)
        
        # Standard deviation as uncertainty measure
        uncertainty = np.std(tree_predictions, axis=0)
        
        # Normalize prospectivity to 0-1 range
        prospectivity_min, prospectivity_max = np.min(prospectivity), np.max(prospectivity)
        if prospectivity_max > prospectivity_min:
            prospectivity = (prospectivity - prospectivity_min) / (prospectivity_max - prospectivity_min)
        
        # Normalize uncertainty to 0-1 range
        uncertainty_max = np.max(uncertainty)
        if uncertainty_max > 0:
            uncertainty = uncertainty / uncertainty_max
        
        logger.info(f"Generated predictions: prospectivity range [{np.min(prospectivity):.3f}, {np.max(prospectivity):.3f}], "
                   f"uncertainty range [{np.min(uncertainty):.3f}, {np.max(uncertainty):.3f}]")
        
        return prospectivity, uncertainty
    
    def _create_raster_grids(
        self,
        coordinates: np.ndarray,
        prospectivity: np.ndarray,
        uncertainty: np.ndarray,
        bounds: List[float]
    ) -> Tuple[np.ndarray, np.ndarray, rasterio.Affine, CRS]:
        """Create raster grids from point predictions"""
        # Define grid resolution (degrees)
        resolution = 0.001  # ~100m at equator
        
        # Calculate grid dimensions
        width = int((bounds[2] - bounds[0]) / resolution)
        height = int((bounds[3] - bounds[1]) / resolution)
        
        # Create transform
        transform = from_bounds(bounds[0], bounds[1], bounds[2], bounds[3], width, height)
        
        # Initialize grids
        prospectivity_grid = np.full((height, width), np.nan, dtype=np.float32)
        uncertainty_grid = np.full((height, width), np.nan, dtype=np.float32)
        
        # Fill grids with predictions
        for i, (lon, lat) in enumerate(coordinates):
            # Convert coordinates to grid indices
            col = int((lon - bounds[0]) / resolution)
            row = int((bounds[3] - lat) / resolution)  # Flip Y axis
            
            if 0 <= row < height and 0 <= col < width:
                prospectivity_grid[row, col] = prospectivity[i]
                uncertainty_grid[row, col] = uncertainty[i]
        
        # Simple interpolation to fill gaps
        prospectivity_grid = self._interpolate_grid(prospectivity_grid)
        uncertainty_grid = self._interpolate_grid(uncertainty_grid)
        
        crs = CRS.from_epsg(4326)
        
        logger.info(f"Created raster grids: {height}x{width} pixels")
        return prospectivity_grid, uncertainty_grid, transform, crs
    
    def _interpolate_grid(self, grid: np.ndarray) -> np.ndarray:
        """Simple interpolation to fill NaN values"""
        from scipy.ndimage import generic_filter
        
        def fill_nan(values):
            valid = values[~np.isnan(values)]
            return np.mean(valid) if len(valid) > 0 else np.nan
        
        # Fill NaN values with local mean
        filled = generic_filter(grid, fill_nan, size=3, mode='constant', cval=np.nan)
        
        # If still NaN, use global mean
        global_mean = np.nanmean(filled)
        filled = np.where(np.isnan(filled), global_mean, filled)
        
        return filled
    
    async def _create_cog_files(
        self,
        prospectivity_grid: np.ndarray,
        uncertainty_grid: np.ndarray,
        transform: rasterio.Affine,
        crs: CRS,
        inference_id: str,
        bounds: List[float],
        model_version: str
    ) -> Dict[str, str]:
        """Create Cloud-Optimized GeoTIFF files"""
        cog_paths = {}
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            
            # Create prospectivity COG
            prospectivity_path = temp_dir_path / "prospectivity.tif"
            await self._write_cog(
                prospectivity_grid, transform, crs, prospectivity_path,
                "Prospectivity", "Mineral prospectivity probability (0-1)"
            )
            
            # Create uncertainty COG
            uncertainty_path = temp_dir_path / "uncertainty.tif"
            await self._write_cog(
                uncertainty_grid, transform, crs, uncertainty_path,
                "Uncertainty", "Prediction uncertainty (0-1)"
            )
            
            # Upload to S3
            if self.s3_client:
                # Upload prospectivity COG
                s3_key_prosp = f"ai-inference/{inference_id}/prospectivity.tif"
                self.s3_client.upload_file(
                    str(prospectivity_path),
                    settings.S3_BUCKET,
                    s3_key_prosp,
                    ExtraArgs={
                        'ContentType': 'image/tiff',
                        'Metadata': {
                            'inference_id': inference_id,
                            'data_type': 'prospectivity',
                            'model_version': model_version,
                            'bounds': json.dumps(bounds)
                        }
                    }
                )
                cog_paths['prospectivity'] = f"s3://{settings.S3_BUCKET}/{s3_key_prosp}"
                
                # Upload uncertainty COG
                s3_key_unc = f"ai-inference/{inference_id}/uncertainty.tif"
                self.s3_client.upload_file(
                    str(uncertainty_path),
                    settings.S3_BUCKET,
                    s3_key_unc,
                    ExtraArgs={
                        'ContentType': 'image/tiff',
                        'Metadata': {
                            'inference_id': inference_id,
                            'data_type': 'uncertainty',
                            'model_version': model_version,
                            'bounds': json.dumps(bounds)
                        }
                    }
                )
                cog_paths['uncertainty'] = f"s3://{settings.S3_BUCKET}/{s3_key_unc}"
                
                logger.info(f"Uploaded COG files to S3: {inference_id}")
            else:
                # Local storage fallback
                cog_paths['prospectivity'] = str(prospectivity_path)
                cog_paths['uncertainty'] = str(uncertainty_path)
        
        return cog_paths
    
    async def _write_cog(
        self,
        data: np.ndarray,
        transform: rasterio.Affine,
        crs: CRS,
        output_path: Path,
        title: str,
        description: str
    ):
        """Write data as Cloud-Optimized GeoTIFF"""
        profile = self.cog_profile.copy()
        profile.update({
            'height': data.shape[0],
            'width': data.shape[1],
            'count': 1,
            'dtype': 'float32',
            'crs': crs,
            'transform': transform,
            'nodata': np.nan
        })
        
        with rasterio.open(output_path, 'w', **profile) as dst:
            dst.write(data.astype(np.float32), 1)
            
            # Add metadata
            dst.update_tags(
                TIFFTAG_IMAGEDESCRIPTION=description,
                TIFFTAG_SOFTWARE="GeoVision AI Miner",
                AREA_OR_POINT="Area"
            )
            
            # Add color interpretation
            dst.colorinterp = [rasterio.enums.ColorInterp.gray]
            
            # Build overviews for COG
            dst.build_overviews([2, 4, 8, 16], Resampling.average)
            dst.update_tags(ns='rio_overview', resampling='average')
    
    def _generate_inference_metadata(
        self,
        inference_id: str,
        aoi_geojson: Dict[str, Any],
        bounds: List[float],
        model_version: str,
        feature_count: int,
        feature_names: List[str],
        cog_paths: Dict[str, str]
    ) -> Dict[str, Any]:
        """Generate comprehensive metadata for inference"""
        return {
            'inference_id': inference_id,
            'created_at': datetime.utcnow().isoformat(),
            'model_version': model_version,
            'aoi': aoi_geojson,
            'bounds': bounds,
            'feature_count': feature_count,
            'feature_names': feature_names[:20],  # Limit for metadata size
            'outputs': {
                'prospectivity_cog': cog_paths['prospectivity'],
                'uncertainty_cog': cog_paths['uncertainty']
            },
            'processing_info': {
                'grid_resolution_degrees': 0.001,
                'crs': 'EPSG:4326',
                'interpolation_method': 'local_mean'
            },
            'color_ramps': {
                'prospectivity': {
                    'type': 'continuous',
                    'min': 0.0,
                    'max': 1.0,
                    'colors': ['#000080', '#0000FF', '#00FFFF', '#FFFF00', '#FF0000'],
                    'labels': ['Very Low', 'Low', 'Medium', 'High', 'Very High']
                },
                'uncertainty': {
                    'type': 'continuous',
                    'min': 0.0,
                    'max': 1.0,
                    'colors': ['#FFFFFF', '#FFFF00', '#FF8000', '#FF0000', '#800000'],
                    'labels': ['Very Certain', 'Certain', 'Moderate', 'Uncertain', 'Very Uncertain']
                }
            }
        }
    
    async def _store_inference_metadata(
        self,
        metadata: Dict[str, Any],
        org_id: Optional[UUID],
        project_id: Optional[UUID]
    ):
        """Store inference metadata in database or S3"""
        if self.s3_client:
            # Store metadata as JSON in S3
            metadata_key = f"ai-inference/{metadata['inference_id']}/metadata.json"
            
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=metadata_key,
                Body=json.dumps(metadata, indent=2),
                ContentType='application/json',
                Metadata={
                    'inference_id': metadata['inference_id'],
                    'org_id': str(org_id) if org_id else '',
                    'project_id': str(project_id) if project_id else ''
                }
            )
            
            logger.info(f"Stored inference metadata: {metadata['inference_id']}")