"""Remote sensing data processing services"""

import rasterio
import numpy as np
import boto3
from typing import Dict, List, Any, Optional
from datetime import date
import tempfile
import os
from PIL import Image
import json

from app.core.config import settings

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION
)

async def process_satellite_scene(
    file_path: str,
    satellite: str,
    scene_id: str,
    acquisition_date: date
) -> Dict[str, Any]:
    """Process uploaded satellite scene"""
    
    try:
        with rasterio.open(file_path) as src:
            # Get basic metadata
            metadata = {
                'width': src.width,
                'height': src.height,
                'count': src.count,
                'dtype': str(src.dtype),
                'crs': str(src.crs),
                'transform': list(src.transform),
                'nodata': src.nodata
            }
            
            # Get spatial bounds
            bounds = src.bounds
            bbox = [bounds.left, bounds.bottom, bounds.right, bounds.top]
            
            # Get band information
            bands_available = []
            for i in range(1, src.count + 1):
                band_name = get_band_name(satellite, i)
                bands_available.append(band_name)
            
            # Create RGB composite if possible
            rgb_bands = get_rgb_bands(satellite, src.count)
            composite_data = None
            
            if rgb_bands and all(band <= src.count for band in rgb_bands):
                # Read RGB bands
                red = src.read(rgb_bands[0])
                green = src.read(rgb_bands[1])
                blue = src.read(rgb_bands[2])
                
                # Stack and normalize
                composite_data = np.stack([red, green, blue], axis=0)
                composite_data = normalize_for_display(composite_data)
            
            # Upload original file to S3
            s3_key_original = f"remote-sensing/{scene_id}/original.tif"
            s3_client.upload_file(file_path, settings.S3_BUCKET, s3_key_original)
            
            # Upload composite if created
            s3_key_composite = None
            if composite_data is not None:
                composite_path = create_composite_cog(composite_data, src.transform, src.crs)
                s3_key_composite = f"remote-sensing/{scene_id}/composite.tif"
                s3_client.upload_file(composite_path, settings.S3_BUCKET, s3_key_composite)
                os.remove(composite_path)
            
            # Clean up temp file
            os.remove(file_path)
            
            return {
                'processing_level': determine_processing_level(satellite, metadata),
                'bands_available': bands_available,
                'indices_computed': [],
                's3_key_composite': s3_key_composite,
                's3_key_indices': None,
                'bbox': bbox,
                'metadata': metadata
            }
            
    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise e

async def calculate_spectral_indices(
    s3_key_composite: str,
    indices: List[str],
    satellite: str
) -> Dict[str, Any]:
    """Calculate spectral indices from satellite data"""
    
    # Download composite from S3
    temp_file = tempfile.NamedTemporaryFile(suffix='.tif', delete=False)
    s3_client.download_file(settings.S3_BUCKET, s3_key_composite, temp_file.name)
    
    try:
        with rasterio.open(temp_file.name) as src:
            # Get band mapping for satellite
            band_mapping = get_band_mapping(satellite)
            
            # Read required bands
            bands_data = {}
            for i in range(1, src.count + 1):
                band_name = get_band_name(satellite, i)
                bands_data[band_name] = src.read(i).astype(np.float32)
            
            # Calculate indices
            indices_data = {}
            
            for index in indices:
                if index == 'NDVI':
                    if 'red' in bands_data and 'nir' in bands_data:
                        red = bands_data['red']
                        nir = bands_data['nir']
                        indices_data['NDVI'] = calculate_ndvi(red, nir)
                
                elif index == 'NDWI':
                    if 'green' in bands_data and 'nir' in bands_data:
                        green = bands_data['green']
                        nir = bands_data['nir']
                        indices_data['NDWI'] = calculate_ndwi(green, nir)
                
                elif index == 'NBR':
                    if 'nir' in bands_data and 'swir2' in bands_data:
                        nir = bands_data['nir']
                        swir2 = bands_data['swir2']
                        indices_data['NBR'] = calculate_nbr(nir, swir2)
                
                elif index == 'ferric':
                    if 'red' in bands_data and 'swir1' in bands_data:
                        red = bands_data['red']
                        swir1 = bands_data['swir1']
                        indices_data['ferric'] = calculate_ferric_index(red, swir1)
                
                elif index == 'ferrous':
                    if 'nir' in bands_data and 'swir1' in bands_data:
                        nir = bands_data['nir']
                        swir1 = bands_data['swir1']
                        indices_data['ferrous'] = calculate_ferrous_index(nir, swir1)
                
                elif index == 'clay':
                    if 'swir1' in bands_data and 'swir2' in bands_data:
                        swir1 = bands_data['swir1']
                        swir2 = bands_data['swir2']
                        indices_data['clay'] = calculate_clay_index(swir1, swir2)
            
            # Create multi-band indices file
            if indices_data:
                indices_path = create_indices_cog(indices_data, src.transform, src.crs)
                
                # Upload to S3
                scene_id = s3_key_composite.split('/')[1]
                s3_key_indices = f"remote-sensing/{scene_id}/indices.tif"
                s3_client.upload_file(indices_path, settings.S3_BUCKET, s3_key_indices)
                os.remove(indices_path)
                
                return {
                    's3_key_indices': s3_key_indices,
                    'metadata': {
                        'indices_calculated': list(indices_data.keys()),
                        'calculation_date': date.today().isoformat()
                    }
                }
            
            return {'s3_key_indices': None, 'metadata': {}}
            
    finally:
        os.remove(temp_file.name)

async def generate_quicklook(
    s3_key_composite: str,
    bands: List[str],
    satellite: str
) -> Dict[str, Any]:
    """Generate quicklook PNG image"""
    
    # Download composite from S3
    temp_file = tempfile.NamedTemporaryFile(suffix='.tif', delete=False)
    s3_client.download_file(settings.S3_BUCKET, s3_key_composite, temp_file.name)
    
    try:
        with rasterio.open(temp_file.name) as src:
            # Get RGB band indices
            rgb_indices = []
            for band in bands:
                band_idx = get_band_index(satellite, band)
                if band_idx and band_idx <= src.count:
                    rgb_indices.append(band_idx)
            
            if len(rgb_indices) != 3:
                raise ValueError("Could not map RGB bands for quicklook")
            
            # Read and process bands
            red = src.read(rgb_indices[0])
            green = src.read(rgb_indices[1])
            blue = src.read(rgb_indices[2])
            
            # Normalize and create RGB image
            rgb_data = np.stack([red, green, blue], axis=0)
            rgb_normalized = normalize_for_display(rgb_data)
            
            # Convert to PIL Image
            rgb_uint8 = (rgb_normalized * 255).astype(np.uint8)
            rgb_transposed = np.transpose(rgb_uint8, (1, 2, 0))
            image = Image.fromarray(rgb_transposed)
            
            # Resize for quicklook (max 1024px)
            max_size = 1024
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
            
            # Save as PNG
            quicklook_path = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            image.save(quicklook_path.name, 'PNG', optimize=True)
            
            # Upload to S3
            scene_id = s3_key_composite.split('/')[1]
            s3_key_quicklook = f"remote-sensing/{scene_id}/quicklook.png"
            s3_client.upload_file(quicklook_path.name, settings.S3_BUCKET, s3_key_quicklook)
            
            # Generate signed URL
            quicklook_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.S3_BUCKET, 'Key': s3_key_quicklook},
                ExpiresIn=3600 * 24  # 24 hours
            )
            
            os.remove(quicklook_path.name)
            
            return {
                's3_key': s3_key_quicklook,
                'url': quicklook_url,
                'size': image.size,
                'bands_used': bands
            }
            
    finally:
        os.remove(temp_file.name)

def validate_scene_metadata(scene_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate satellite scene metadata"""
    
    errors = []
    warnings = []
    
    # Check required fields
    required_fields = ['satellite', 'scene_id', 'acquisition_date']
    for field in required_fields:
        if not scene_data.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Validate satellite
    supported_satellites = ['Sentinel-2', 'Landsat-8', 'Landsat-9', 'ASTER']
    if scene_data.get('satellite') not in supported_satellites:
        warnings.append(f"Satellite {scene_data.get('satellite')} may not be fully supported")
    
    # Validate cloud cover
    cloud_cover = scene_data.get('cloud_cover_percent')
    if cloud_cover is not None:
        if cloud_cover < 0 or cloud_cover > 100:
            errors.append("Cloud cover must be between 0 and 100")
        elif cloud_cover > 80:
            warnings.append("High cloud cover (>80%) may affect data quality")
    
    # Validate bbox
    bbox = scene_data.get('bbox')
    if bbox and len(bbox) == 4:
        minx, miny, maxx, maxy = bbox
        if minx >= maxx or miny >= maxy:
            errors.append("Invalid bounding box coordinates")
        if not (-180 <= minx <= 180 and -180 <= maxx <= 180):
            errors.append("Longitude values must be between -180 and 180")
        if not (-90 <= miny <= 90 and -90 <= maxy <= 90):
            errors.append("Latitude values must be between -90 and 90")
    
    return {
        'is_valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }

# Helper functions
def get_band_name(satellite: str, band_index: int) -> str:
    """Get standardized band name for satellite and band index"""
    
    band_mappings = {
        'Sentinel-2': {
            1: 'coastal', 2: 'blue', 3: 'green', 4: 'red',
            5: 'red_edge_1', 6: 'red_edge_2', 7: 'red_edge_3', 8: 'nir',
            9: 'red_edge_4', 10: 'water_vapor', 11: 'swir1', 12: 'swir2'
        },
        'Landsat-8': {
            1: 'coastal', 2: 'blue', 3: 'green', 4: 'red',
            5: 'nir', 6: 'swir1', 7: 'swir2', 8: 'pan',
            9: 'cirrus', 10: 'tir1', 11: 'tir2'
        },
        'Landsat-9': {
            1: 'coastal', 2: 'blue', 3: 'green', 4: 'red',
            5: 'nir', 6: 'swir1', 7: 'swir2', 8: 'pan',
            9: 'cirrus', 10: 'tir1', 11: 'tir2'
        }
    }
    
    mapping = band_mappings.get(satellite, {})
    return mapping.get(band_index, f'band_{band_index}')

def get_rgb_bands(satellite: str, band_count: int) -> Optional[List[int]]:
    """Get RGB band indices for satellite"""
    
    rgb_mappings = {
        'Sentinel-2': [4, 3, 2],  # Red, Green, Blue
        'Landsat-8': [4, 3, 2],
        'Landsat-9': [4, 3, 2],
        'ASTER': [3, 2, 1]
    }
    
    rgb_bands = rgb_mappings.get(satellite)
    if rgb_bands and all(band <= band_count for band in rgb_bands):
        return rgb_bands
    
    return None

def get_band_mapping(satellite: str) -> Dict[str, int]:
    """Get band name to index mapping"""
    
    mappings = {
        'Sentinel-2': {
            'blue': 2, 'green': 3, 'red': 4, 'nir': 8,
            'swir1': 11, 'swir2': 12
        },
        'Landsat-8': {
            'blue': 2, 'green': 3, 'red': 4, 'nir': 5,
            'swir1': 6, 'swir2': 7
        },
        'Landsat-9': {
            'blue': 2, 'green': 3, 'red': 4, 'nir': 5,
            'swir1': 6, 'swir2': 7
        }
    }
    
    return mappings.get(satellite, {})

def get_band_index(satellite: str, band_name: str) -> Optional[int]:
    """Get band index for satellite and band name"""
    
    mapping = get_band_mapping(satellite)
    return mapping.get(band_name)

def determine_processing_level(satellite: str, metadata: Dict[str, Any]) -> str:
    """Determine processing level from metadata"""
    
    # This would typically analyze metadata to determine processing level
    # For now, return a default based on satellite
    
    defaults = {
        'Sentinel-2': 'L2A',
        'Landsat-8': 'L2',
        'Landsat-9': 'L2',
        'ASTER': 'L1T'
    }
    
    return defaults.get(satellite, 'L1')

def normalize_for_display(data: np.ndarray, percentiles: tuple = (2, 98)) -> np.ndarray:
    """Normalize data for display using percentile stretch"""
    
    normalized = np.zeros_like(data, dtype=np.float32)
    
    for i in range(data.shape[0]):
        band = data[i]
        
        # Calculate percentiles
        p_low, p_high = np.percentile(band[band > 0], percentiles)
        
        # Clip and normalize
        band_clipped = np.clip(band, p_low, p_high)
        if p_high > p_low:
            normalized[i] = (band_clipped - p_low) / (p_high - p_low)
        else:
            normalized[i] = band_clipped
    
    return np.clip(normalized, 0, 1)

def create_composite_cog(data: np.ndarray, transform, crs) -> str:
    """Create Cloud Optimized GeoTIFF from composite data"""
    
    temp_file = tempfile.NamedTemporaryFile(suffix='.tif', delete=False)
    
    # Convert to uint16 for better compression
    data_uint16 = (data * 65535).astype(np.uint16)
    
    with rasterio.open(
        temp_file.name,
        'w',
        driver='GTiff',
        height=data.shape[1],
        width=data.shape[2],
        count=data.shape[0],
        dtype=np.uint16,
        crs=crs,
        transform=transform,
        compress='lzw',
        tiled=True,
        blockxsize=512,
        blockysize=512
    ) as dst:
        for i in range(data.shape[0]):
            dst.write(data_uint16[i], i + 1)
    
    return temp_file.name

def create_indices_cog(indices_data: Dict[str, np.ndarray], transform, crs) -> str:
    """Create Cloud Optimized GeoTIFF from indices data"""
    
    temp_file = tempfile.NamedTemporaryFile(suffix='.tif', delete=False)
    
    # Stack indices
    indices_list = list(indices_data.values())
    stacked_data = np.stack(indices_list, axis=0)
    
    # Convert to float32
    stacked_data = stacked_data.astype(np.float32)
    
    with rasterio.open(
        temp_file.name,
        'w',
        driver='GTiff',
        height=stacked_data.shape[1],
        width=stacked_data.shape[2],
        count=stacked_data.shape[0],
        dtype=np.float32,
        crs=crs,
        transform=transform,
        compress='lzw',
        tiled=True,
        blockxsize=512,
        blockysize=512
    ) as dst:
        for i, (index_name, _) in enumerate(indices_data.items()):
            dst.write(stacked_data[i], i + 1)
            dst.set_band_description(i + 1, index_name)
    
    return temp_file.name

# Spectral index calculation functions
def calculate_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Calculate Normalized Difference Vegetation Index"""
    
    with np.errstate(divide='ignore', invalid='ignore'):
        ndvi = (nir - red) / (nir + red)
        ndvi = np.where(np.isfinite(ndvi), ndvi, 0)
    
    return np.clip(ndvi, -1, 1)

def calculate_ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """Calculate Normalized Difference Water Index"""
    
    with np.errstate(divide='ignore', invalid='ignore'):
        ndwi = (green - nir) / (green + nir)
        ndwi = np.where(np.isfinite(ndwi), ndwi, 0)
    
    return np.clip(ndwi, -1, 1)

def calculate_nbr(nir: np.ndarray, swir2: np.ndarray) -> np.ndarray:
    """Calculate Normalized Burn Ratio"""
    
    with np.errstate(divide='ignore', invalid='ignore'):
        nbr = (nir - swir2) / (nir + swir2)
        nbr = np.where(np.isfinite(nbr), nbr, 0)
    
    return np.clip(nbr, -1, 1)

def calculate_ferric_index(red: np.ndarray, swir1: np.ndarray) -> np.ndarray:
    """Calculate Ferric Iron Index"""
    
    with np.errstate(divide='ignore', invalid='ignore'):
        ferric = swir1 / red
        ferric = np.where(np.isfinite(ferric), ferric, 0)
    
    return np.clip(ferric, 0, 10)

def calculate_ferrous_index(nir: np.ndarray, swir1: np.ndarray) -> np.ndarray:
    """Calculate Ferrous Iron Index"""
    
    with np.errstate(divide='ignore', invalid='ignore'):
        ferrous = swir1 / nir
        ferrous = np.where(np.isfinite(ferrous), ferrous, 0)
    
    return np.clip(ferrous, 0, 10)

def calculate_clay_index(swir1: np.ndarray, swir2: np.ndarray) -> np.ndarray:
    """Calculate Clay Minerals Index"""
    
    with np.errstate(divide='ignore', invalid='ignore'):
        clay = swir1 / swir2
        clay = np.where(np.isfinite(clay), clay, 0)
    
    return np.clip(clay, 0, 5)