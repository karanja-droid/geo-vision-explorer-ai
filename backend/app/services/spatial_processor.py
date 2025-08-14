"""Spatial data processing services"""

import geopandas as gpd
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID
import tempfile
import os
import boto3
from shapely.geometry import Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon
from shapely.validation import make_valid
from shapely import wkt
import json
import zipfile
from datetime import datetime, timedelta

from app.core.config import settings
from app.models.spatial import VectorDataset, VectorFeature, VectorTilesCache

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION
)

async def process_vector_file(
    file_path: str,
    dataset_name: str,
    dataset_type: str,
    description: Optional[str] = None
) -> Dict[str, Any]:
    """Process uploaded vector file and extract metadata"""
    
    try:
        # Handle different file formats
        if file_path.lower().endswith('.zip'):
            # Assume it's a shapefile in a zip
            temp_dir = tempfile.mkdtemp()
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # Find the .shp file
            shp_files = [f for f in os.listdir(temp_dir) if f.endswith('.shp')]
            if not shp_files:
                raise ValueError("No shapefile found in zip archive")
            
            file_path = os.path.join(temp_dir, shp_files[0])
        
        # Read the vector data
        gdf = gpd.read_file(file_path)
        
        # Ensure CRS is set
        if gdf.crs is None:
            gdf.crs = 'EPSG:4326'  # Assume WGS84 if no CRS
        
        # Transform to WGS84 if needed
        if gdf.crs.to_string() != 'EPSG:4326':
            gdf = gdf.to_crs('EPSG:4326')
        
        # Get basic metadata
        feature_count = len(gdf)
        geometry_type = get_primary_geometry_type(gdf)
        bounds = gdf.total_bounds  # [minx, miny, maxx, maxy]
        
        # Get attributes schema
        attributes_schema = {}
        for col in gdf.columns:
            if col != 'geometry':
                dtype = str(gdf[col].dtype)
                attributes_schema[col] = {
                    'type': map_pandas_dtype_to_json(dtype),
                    'nullable': gdf[col].isnull().any()
                }
        
        # Validate geometries
        validation_results = validate_geometries(gdf)
        
        # Upload original file to S3
        original_filename = os.path.basename(file_path)
        s3_key_original = f"vector-data/{dataset_name}/original/{original_filename}"
        s3_client.upload_file(file_path, settings.S3_BUCKET, s3_key_original)
        
        # Create processed GeoJSON and upload
        processed_geojson = create_processed_geojson(gdf, validation_results)
        processed_path = tempfile.NamedTemporaryFile(suffix='.geojson', delete=False)
        processed_geojson.to_file(processed_path.name, driver='GeoJSON')
        
        s3_key_processed = f"vector-data/{dataset_name}/processed/data.geojson"
        s3_client.upload_file(processed_path.name, settings.S3_BUCKET, s3_key_processed)
        os.unlink(processed_path.name)
        
        # Extract features for database storage
        features = []
        for idx, row in gdf.iterrows():
            geom = row.geometry
            if geom and geom.is_valid:
                feature = {
                    'id': str(idx),
                    'properties': {k: v for k, v in row.items() if k != 'geometry' and pd.notna(v)},
                    'geometry_wkt': f"SRID=4326;{geom.wkt}"
                }
                features.append(feature)
        
        return {
            'geometry_type': geometry_type,
            'crs': 'EPSG:4326',
            'feature_count': feature_count,
            'bbox': bounds.tolist(),
            'attributes_schema': attributes_schema,
            'validation_results': validation_results,
            's3_key_original': s3_key_original,
            's3_key_processed': s3_key_processed,
            'features': features,
            'metadata': {
                'original_crs': str(gdf.crs) if hasattr(gdf, 'crs') else None,
                'processing_date': datetime.utcnow().isoformat(),
                'file_format': get_file_format(file_path)
            }
        }
        
    except Exception as e:
        raise ValueError(f"Failed to process vector file: {str(e)}")

async def validate_vector_data(
    db: Session,
    dataset_id: UUID,
    fix_invalid: bool = False
) -> Dict[str, Any]:
    """Validate geometries in a vector dataset"""
    
    # Get all features for the dataset
    features = db.query(VectorFeature).filter(
        VectorFeature.dataset_id == dataset_id
    ).all()
    
    validation_results = {
        'total_features': len(features),
        'valid_features': 0,
        'invalid_features': 0,
        'fixed_features': 0,
        'errors': [],
        'warnings': [],
        'is_valid': True
    }
    
    for feature in features:
        try:
            # Parse geometry from WKT
            geom_wkt = feature.geom
            if geom_wkt.startswith('SRID='):
                geom_wkt = geom_wkt.split(';', 1)[1]
            
            geom = wkt.loads(geom_wkt)
            
            if geom.is_valid:
                validation_results['valid_features'] += 1
            else:
                validation_results['invalid_features'] += 1
                validation_results['is_valid'] = False
                
                error_msg = f"Feature {feature.id}: {geom.is_valid_reason}"
                validation_results['errors'].append(error_msg)
                
                if fix_invalid:
                    try:
                        # Try to fix the geometry
                        fixed_geom = make_valid(geom)
                        if fixed_geom.is_valid:
                            # Update the feature with fixed geometry
                            feature.geom = f"SRID=4326;{fixed_geom.wkt}"
                            validation_results['fixed_features'] += 1
                            validation_results['valid_features'] += 1
                            validation_results['invalid_features'] -= 1
                    except Exception as fix_error:
                        validation_results['errors'].append(
                            f"Feature {feature.id}: Could not fix geometry - {str(fix_error)}"
                        )
        
        except Exception as e:
            validation_results['errors'].append(f"Feature {feature.id}: {str(e)}")
            validation_results['invalid_features'] += 1
            validation_results['is_valid'] = False
    
    if fix_invalid and validation_results['fixed_features'] > 0:
        db.commit()
    
    # Update overall validity
    validation_results['is_valid'] = validation_results['invalid_features'] == 0
    
    return validation_results

async def optimize_geometries(
    db: Session,
    dataset_id: UUID,
    simplify_tolerance: Optional[float] = None
) -> Dict[str, Any]:
    """Optimize geometries in a dataset"""
    
    features = db.query(VectorFeature).filter(
        VectorFeature.dataset_id == dataset_id
    ).all()
    
    optimization_results = {
        'total_features': len(features),
        'optimized_features': 0,
        'size_reduction_percent': 0,
        'operations_performed': []
    }
    
    original_size = 0
    optimized_size = 0
    
    for feature in features:
        try:
            # Parse geometry
            geom_wkt = feature.geom
            if geom_wkt.startswith('SRID='):
                geom_wkt = geom_wkt.split(';', 1)[1]
            
            geom = wkt.loads(geom_wkt)
            original_size += len(geom.wkt)
            
            optimized_geom = geom
            operations = []
            
            # Simplify if tolerance provided
            if simplify_tolerance and simplify_tolerance > 0:
                simplified = geom.simplify(simplify_tolerance, preserve_topology=True)
                if simplified.is_valid and not simplified.is_empty:
                    optimized_geom = simplified
                    operations.append('simplified')
            
            # Remove duplicate points for linestrings and polygons
            if hasattr(optimized_geom, 'coords'):
                # For LineString
                coords = list(optimized_geom.coords)
                unique_coords = []
                for coord in coords:
                    if not unique_coords or coord != unique_coords[-1]:
                        unique_coords.append(coord)
                
                if len(unique_coords) != len(coords) and len(unique_coords) >= 2:
                    optimized_geom = LineString(unique_coords)
                    operations.append('removed_duplicates')
            
            # Update feature if geometry was optimized
            if operations:
                feature.geom = f"SRID=4326;{optimized_geom.wkt}"
                optimization_results['optimized_features'] += 1
                
                if operations not in optimization_results['operations_performed']:
                    optimization_results['operations_performed'].extend(operations)
            
            optimized_size += len(optimized_geom.wkt)
            
        except Exception as e:
            print(f"Error optimizing feature {feature.id}: {e}")
    
    # Calculate size reduction
    if original_size > 0:
        size_reduction = ((original_size - optimized_size) / original_size) * 100
        optimization_results['size_reduction_percent'] = round(size_reduction, 2)
    
    if optimization_results['optimized_features'] > 0:
        db.commit()
    
    return optimization_results

async def generate_vector_tiles(
    db: Session,
    dataset_id: UUID,
    z: int,
    x: int,
    y: int
) -> Optional[bytes]:
    """Generate or retrieve cached vector tile"""
    
    # Check cache first
    cached_tile = db.query(VectorTilesCache).filter(
        VectorTilesCache.dataset_id == dataset_id,
        VectorTilesCache.z == z,
        VectorTilesCache.x == x,
        VectorTilesCache.y == y,
        VectorTilesCache.expires_at > datetime.utcnow()
    ).first()
    
    if cached_tile:
        return cached_tile.tile_data
    
    # Generate new tile using PostGIS function
    try:
        result = db.execute(
            "SELECT generate_mvt_tile(:dataset_id, :z, :x, :y)",
            {
                'dataset_id': dataset_id,
                'z': z,
                'x': x,
                'y': y
            }
        ).fetchone()
        
        if result and result[0]:
            tile_data = bytes(result[0])
            
            # Cache the tile
            cache_entry = VectorTilesCache(
                dataset_id=dataset_id,
                z=z,
                x=x,
                y=y,
                tile_data=tile_data,
                expires_at=datetime.utcnow() + timedelta(hours=24)
            )
            
            db.add(cache_entry)
            db.commit()
            
            return tile_data
        
        return None
        
    except Exception as e:
        print(f"Error generating vector tile: {e}")
        return None

# Helper functions
def get_primary_geometry_type(gdf: gpd.GeoDataFrame) -> str:
    """Get the primary geometry type from a GeoDataFrame"""
    
    geom_types = gdf.geometry.geom_type.value_counts()
    primary_type = geom_types.index[0]
    
    # Map to standard geometry types
    type_mapping = {
        'Point': 'POINT',
        'MultiPoint': 'MULTIPOINT',
        'LineString': 'LINESTRING',
        'MultiLineString': 'MULTILINESTRING',
        'Polygon': 'POLYGON',
        'MultiPolygon': 'MULTIPOLYGON'
    }
    
    return type_mapping.get(primary_type, 'GEOMETRY')

def map_pandas_dtype_to_json(dtype: str) -> str:
    """Map pandas dtype to JSON schema type"""
    
    if 'int' in dtype:
        return 'integer'
    elif 'float' in dtype:
        return 'number'
    elif 'bool' in dtype:
        return 'boolean'
    elif 'datetime' in dtype:
        return 'string'  # ISO format
    else:
        return 'string'

def validate_geometries(gdf: gpd.GeoDataFrame) -> Dict[str, Any]:
    """Validate geometries in a GeoDataFrame"""
    
    total_features = len(gdf)
    valid_count = 0
    invalid_count = 0
    errors = []
    
    for idx, geom in gdf.geometry.items():
        if geom is None:
            invalid_count += 1
            errors.append(f"Feature {idx}: Null geometry")
        elif geom.is_empty:
            invalid_count += 1
            errors.append(f"Feature {idx}: Empty geometry")
        elif not geom.is_valid:
            invalid_count += 1
            errors.append(f"Feature {idx}: {geom.is_valid_reason}")
        else:
            valid_count += 1
    
    return {
        'total_features': total_features,
        'valid_features': valid_count,
        'invalid_features': invalid_count,
        'is_valid': invalid_count == 0,
        'errors': errors[:10],  # Limit to first 10 errors
        'validation_date': datetime.utcnow().isoformat()
    }

def create_processed_geojson(
    gdf: gpd.GeoDataFrame,
    validation_results: Dict[str, Any]
) -> gpd.GeoDataFrame:
    """Create processed GeoJSON with cleaned data"""
    
    # Remove invalid geometries if any
    if validation_results['invalid_features'] > 0:
        gdf = gdf[gdf.geometry.is_valid & ~gdf.geometry.is_empty]
    
    # Ensure all geometries are in WGS84
    if gdf.crs.to_string() != 'EPSG:4326':
        gdf = gdf.to_crs('EPSG:4326')
    
    # Clean attribute data
    for col in gdf.columns:
        if col != 'geometry':
            # Convert numpy types to native Python types
            if gdf[col].dtype == 'object':
                gdf[col] = gdf[col].astype(str)
            elif 'int' in str(gdf[col].dtype):
                gdf[col] = gdf[col].astype('Int64')  # Nullable integer
            elif 'float' in str(gdf[col].dtype):
                gdf[col] = gdf[col].astype('float64')
    
    return gdf

def get_file_format(file_path: str) -> str:
    """Determine file format from file path"""
    
    ext = os.path.splitext(file_path.lower())[1]
    
    format_mapping = {
        '.shp': 'shapefile',
        '.geojson': 'geojson',
        '.json': 'geojson',
        '.gpkg': 'geopackage',
        '.kml': 'kml',
        '.kmz': 'kmz',
        '.gml': 'gml'
    }
    
    return format_mapping.get(ext, 'unknown')

def calculate_tile_bounds(z: int, x: int, y: int) -> Tuple[float, float, float, float]:
    """Calculate tile bounds in Web Mercator"""
    
    n = 2.0 ** z
    lon_deg_min = x / n * 360.0 - 180.0
    lat_rad_min = np.arctan(np.sinh(np.pi * (1 - 2 * y / n)))
    lat_deg_min = np.degrees(lat_rad_min)
    
    lon_deg_max = (x + 1) / n * 360.0 - 180.0
    lat_rad_max = np.arctan(np.sinh(np.pi * (1 - 2 * (y + 1) / n)))
    lat_deg_max = np.degrees(lat_rad_max)
    
    return lon_deg_min, lat_deg_min, lon_deg_max, lat_deg_max

def simplify_geometry_for_zoom(geom, zoom_level: int):
    """Simplify geometry based on zoom level"""
    
    # Tolerance increases as zoom level decreases
    tolerance_map = {
        0: 1.0,
        1: 0.5,
        2: 0.25,
        3: 0.125,
        4: 0.0625,
        5: 0.03125,
        6: 0.015625,
        7: 0.0078125,
        8: 0.00390625,
        9: 0.001953125,
        10: 0.0009765625
    }
    
    tolerance = tolerance_map.get(zoom_level, 0.0001)
    
    try:
        simplified = geom.simplify(tolerance, preserve_topology=True)
        return simplified if simplified.is_valid and not simplified.is_empty else geom
    except:
        return geom