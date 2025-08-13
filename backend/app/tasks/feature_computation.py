"""Feature Computation Celery Tasks

Background tasks for computing geological features at multiple scales.
Implements distance calculations, statistical measures, and geological classifications.
"""

import json
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4
from shapely.geometry import shape, Point
from shapely.ops import transform
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_Contains
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from celery import Task
from celery.utils.log import get_task_logger

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.feature_store import FSCell, FSFeature
from app.core.config import settings

logger = get_task_logger(__name__)


class FeatureComputationTask(Task):
    """Base task class for feature computation with error handling"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Feature computation task {task_id} failed: {exc}")
        # Could send notification or update status here
    
    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"Feature computation task {task_id} completed successfully")


@celery_app.task(base=FeatureComputationTask, bind=True)
def compute_features_for_aoi(
    self,
    aoi_geojson: Dict[str, Any],
    scales: List[int] = [1, 3, 5],
    org_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> Dict[str, Any]:
    """Compute multi-scale features for an Area of Interest
    
    Args:
        aoi_geojson: GeoJSON polygon defining the area of interest
        scales: List of scales in kilometers (1, 3, 5)
        org_id: Organization ID for access control
        project_id: Project ID for organization
        
    Returns:
        Dictionary with computation results and statistics
    """
    logger.info(f"Starting feature computation for AOI with scales {scales}")
    
    db = SessionLocal()
    try:
        # Parse AOI geometry
        aoi_shape = shape(aoi_geojson['geometry'])
        
        # Get country and province from AOI centroid
        centroid = aoi_shape.centroid
        country, province = _get_location_info(db, centroid.x, centroid.y)
        
        results = {
            'task_id': self.request.id,
            'aoi': aoi_geojson,
            'scales_processed': [],
            'cells_created': 0,
            'features_computed': 0,
            'processing_time': 0
        }
        
        import time
        start_time = time.time()
        
        for scale in scales:
            logger.info(f"Processing scale {scale}km")
            
            # Generate grid cells for this scale
            cells = _generate_grid_cells(aoi_shape, scale, country, province, org_id, project_id)
            
            # Store cells in database
            cell_objects = []
            for cell_data in cells:
                cell = FSCell(
                    geom=f"POINT({cell_data['longitude']} {cell_data['latitude']})",
                    country=country,
                    province=province,
                    scale=scale,
                    org_id=UUID(org_id) if org_id else None,
                    project_id=UUID(project_id) if project_id else None
                )
                db.add(cell)
                cell_objects.append(cell)
            
            db.flush()  # Get cell IDs
            
            # Compute features for each cell
            for cell in cell_objects:
                features = _compute_cell_features(db, cell, scale)
                
                for feature_key, feature_val in features.items():
                    if not np.isnan(feature_val):  # Skip NaN values
                        feature = FSFeature(
                            cell_id=cell.cell_id,
                            feature_key=feature_key,
                            feature_val=float(feature_val)
                        )
                        db.add(feature)
            
            db.commit()
            
            results['scales_processed'].append(scale)
            results['cells_created'] += len(cell_objects)
            results['features_computed'] += len(cell_objects) * len(_get_feature_keys())
        
        results['processing_time'] = time.time() - start_time
        
        logger.info(f"Feature computation completed: {results['cells_created']} cells, "
                   f"{results['features_computed']} features in {results['processing_time']:.2f}s")
        
        return results
        
    except Exception as e:
        db.rollback()
        logger.error(f"Feature computation failed: {str(e)}")
        raise
    finally:
        db.close()


def _generate_grid_cells(aoi_shape, scale_km: int, country: str, province: str, org_id: str, project_id: str) -> List[Dict]:
    """Generate regular grid cells within AOI at specified scale"""
    # Convert scale from km to degrees (approximate)
    scale_deg = scale_km / 111.0  # 1 degree ≈ 111 km
    
    # Get AOI bounds
    minx, miny, maxx, maxy = aoi_shape.bounds
    
    # Generate grid points
    cells = []
    x = minx
    while x <= maxx:
        y = miny
        while y <= maxy:
            point = Point(x, y)
            if aoi_shape.contains(point) or aoi_shape.intersects(point.buffer(scale_deg/2)):
                cells.append({
                    'longitude': x,
                    'latitude': y
                })
            y += scale_deg
        x += scale_deg
    
    return cells


def _compute_cell_features(db: Session, cell: FSCell, scale: int) -> Dict[str, float]:
    """Compute all features for a single grid cell"""
    features = {}
    
    # Get cell coordinates
    lon = db.scalar(func.ST_X(cell.geom))
    lat = db.scalar(func.ST_Y(cell.geom))
    
    # Distance features
    features.update(_compute_distance_features(db, lon, lat, scale))
    
    # Statistical features (geophysical data)
    features.update(_compute_statistical_features(db, lon, lat, scale))
    
    # Morphometry features
    features.update(_compute_morphometry_features(db, lon, lat, scale))
    
    # Geological features
    features.update(_compute_geological_features(db, lon, lat, scale))
    
    return features


def _compute_distance_features(db: Session, lon: float, lat: float, scale: int) -> Dict[str, float]:
    """Compute distance to geological features"""
    features = {}
    buffer_size = scale * 1000  # Convert km to meters for buffer
    
    # Distance to faults (mock implementation - would query actual geological data)
    features['dist_to_faults'] = np.random.exponential(5000)  # Mock distance in meters
    
    # Distance to geological contacts
    features['dist_to_contacts'] = np.random.exponential(3000)
    
    # Distance to rivers
    features['dist_to_rivers'] = np.random.exponential(8000)
    
    # Distance to roads
    features['dist_to_roads'] = np.random.exponential(12000)
    
    # Distance to known mineral occurrences
    features['dist_to_occurrences'] = np.random.exponential(15000)
    
    return features


def _compute_statistical_features(db: Session, lon: float, lat: float, scale: int) -> Dict[str, float]:
    """Compute statistical measures of geophysical data"""
    features = {}
    
    # Mock geophysical data - in reality would query raster data
    # Magnetic data statistics
    mag_data = np.random.normal(50000, 5000, 100)  # nT
    features[f'magnetics_mean_scale{scale}'] = float(np.mean(mag_data))
    features[f'magnetics_std_scale{scale}'] = float(np.std(mag_data))
    features[f'magnetics_entropy_scale{scale}'] = float(_compute_entropy(mag_data))
    
    # Gravity data statistics
    grav_data = np.random.normal(9.8, 0.1, 100)  # m/s²
    features[f'gravity_mean_scale{scale}'] = float(np.mean(grav_data))
    features[f'gravity_std_scale{scale}'] = float(np.std(grav_data))
    features[f'gravity_entropy_scale{scale}'] = float(_compute_entropy(grav_data))
    
    # Spectral indices
    ndvi_data = np.random.uniform(-1, 1, 100)
    features[f'ndvi_mean_scale{scale}'] = float(np.mean(ndvi_data))
    features[f'ndvi_std_scale{scale}'] = float(np.std(ndvi_data))
    
    return features


def _compute_morphometry_features(db: Session, lon: float, lat: float, scale: int) -> Dict[str, float]:
    """Compute terrain and morphological features"""
    features = {}
    
    # Mock DEM-derived features - would query actual elevation data
    features[f'elevation_mean_scale{scale}'] = float(np.random.uniform(500, 2000))
    features[f'slope_mean_scale{scale}'] = float(np.random.exponential(10))
    features[f'curvature_mean_scale{scale}'] = float(np.random.normal(0, 0.1))
    
    return features


def _compute_geological_features(db: Session, lon: float, lat: float, scale: int) -> Dict[str, float]:
    """Compute geological classification features (one-hot encoded)"""
    features = {}
    
    # Mock geological units - would query actual geological maps
    lithologies = ['granite', 'sandstone', 'shale', 'limestone', 'basalt']
    selected_lith = np.random.choice(lithologies)
    
    for lith in lithologies:
        features[f'lithology_{lith}'] = 1.0 if lith == selected_lith else 0.0
    
    # Age groups
    age_groups = ['precambrian', 'paleozoic', 'mesozoic', 'cenozoic']
    selected_age = np.random.choice(age_groups)
    
    for age in age_groups:
        features[f'age_{age}'] = 1.0 if age == selected_age else 0.0
    
    # Structure density
    features['structure_density'] = float(np.random.exponential(0.1))
    
    return features


def _compute_entropy(data: np.ndarray, bins: int = 10) -> float:
    """Compute entropy of data distribution"""
    hist, _ = np.histogram(data, bins=bins)
    hist = hist / np.sum(hist)  # Normalize
    hist = hist[hist > 0]  # Remove zeros
    return -np.sum(hist * np.log2(hist))


def _get_location_info(db: Session, lon: float, lat: float) -> tuple:
    """Get country and province for coordinates"""
    # Mock implementation - would query actual administrative boundaries
    if -35 < lat < -15 and 15 < lon < 35:
        countries = ['ZA', 'NA', 'BW', 'ZW', 'ZM', 'MW', 'MZ']
        country = np.random.choice(countries)
        province = f"Province_{np.random.randint(1, 10)}"
        return country, province
    else:
        return 'Unknown', None


def _get_feature_keys() -> List[str]:
    """Get list of all possible feature keys"""
    keys = []
    
    # Distance features
    keys.extend(['dist_to_faults', 'dist_to_contacts', 'dist_to_rivers', 'dist_to_roads', 'dist_to_occurrences'])
    
    # Statistical features for each scale
    for scale in [1, 3, 5]:
        keys.extend([
            f'magnetics_mean_scale{scale}', f'magnetics_std_scale{scale}', f'magnetics_entropy_scale{scale}',
            f'gravity_mean_scale{scale}', f'gravity_std_scale{scale}', f'gravity_entropy_scale{scale}',
            f'ndvi_mean_scale{scale}', f'ndvi_std_scale{scale}'
        ])
    
    # Morphometry features for each scale
    for scale in [1, 3, 5]:
        keys.extend([
            f'elevation_mean_scale{scale}', f'slope_mean_scale{scale}', f'curvature_mean_scale{scale}'
        ])
    
    # Geological features
    lithologies = ['granite', 'sandstone', 'shale', 'limestone', 'basalt']
    keys.extend([f'lithology_{lith}' for lith in lithologies])
    
    age_groups = ['precambrian', 'paleozoic', 'mesozoic', 'cenozoic']
    keys.extend([f'age_{age}' for age in age_groups])
    
    keys.append('structure_density')
    
    return keys