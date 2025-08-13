"""
Satellite & Spectral Indices Processor
Handles Sentinel-2/Landsat composites and spectral index calculation
"""

import os
import time
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
import numpy as np

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, dataset_config, tiling_config, quality_config

class SatelliteProcessor:
    """Processes satellite imagery and spectral indices for ingestion pipeline"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('satellite_processor')
        self.processed_files = []
    
    def discover_sources(self, country_code: str) -> List[Dict[str, Any]]:
        """Discover satellite data sources for a country"""
        sources = []
        
        # Local sources
        local_pattern = dataset_config.satellite_sources['local'].format(
            LOCAL_DIR=os.getenv('LOCAL_DIR', './data'),
            country=country_code.lower()
        )
        
        local_files = self.storage.files.find_files(f"{local_pattern}*.tif")
        
        for file_path in local_files:
            # Determine satellite type and seasonality from filename
            satellite_info = self._parse_satellite_filename(str(file_path))
            
            sources.append({
                'type': 'local',
                'path': str(file_path),
                'country': country_code,
                'satellite_type': satellite_info['satellite_type'],
                'seasonality': satellite_info['seasonality'],
                'bands': satellite_info['bands'],
                'format': 'tif',
                'size_mb': self.storage.files.get_file_size_mb(file_path)
            })
        
        # S3 sources
        s3_prefix = dataset_config.satellite_sources['s3'].format(
            S3_BUCKET=config.s3_bucket,
            country=country_code.lower()
        ).replace(f"{config.s3_bucket}/", "")
        
        s3_objects = self.storage.s3.list_objects(s3_prefix)
        
        for obj_key in s3_objects:
            if obj_key.endswith('.tif'):
                satellite_info = self._parse_satellite_filename(obj_key)
                
                sources.append({
                    'type': 's3',
                    'path': f"s3://{config.s3_bucket}/{obj_key}",
                    'country': country_code,
                    'satellite_type': satellite_info['satellite_type'],
                    'seasonality': satellite_info['seasonality'],
                    'bands': satellite_info['bands'],
                    'format': 'tif',
                    'size_mb': 0
                })
        
        self.logger.info(f"Discovered {len(sources)} satellite sources for {country_code}")
        return sources
    
    def _parse_satellite_filename(self, filename: str) -> Dict[str, Any]:
        """Parse satellite filename to extract metadata"""
        filename_lower = filename.lower()
        
        # Determine satellite type
        if 'sentinel' in filename_lower or 's2' in filename_lower:
            satellite_type = 'sentinel-2'
        elif 'landsat' in filename_lower or 'l8' in filename_lower or 'l9' in filename_lower:
            satellite_type = 'landsat'
        else:
            satellite_type = 'unknown'
        
        # Determine seasonality
        if any(season in filename_lower for season in ['dry', 'winter', 'jun', 'jul', 'aug', 'sep']):
            seasonality = 'dry'
        elif any(season in filename_lower for season in ['wet', 'summer', 'dec', 'jan', 'feb', 'mar']):
            seasonality = 'wet'
        else:
            seasonality = 'unknown'
        
        # Determine bands (simplified - would need more sophisticated parsing)
        bands = []
        if 'rgb' in filename_lower:
            bands = ['red', 'green', 'blue']
        elif 'multispectral' in filename_lower or 'ms' in filename_lower:
            if satellite_type == 'sentinel-2':
                bands = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2']
            elif satellite_type == 'landsat':
                bands = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2']
        
        return {
            'satellite_type': satellite_type,
            'seasonality': seasonality,
            'bands': bands
        }
    
    def calculate_spectral_indices(self, raster_path: str, bands_info: List[str]) -> Dict[str, str]:
        """Calculate spectral indices from multispectral imagery"""
        indices = {}
        
        try:
            with rasterio.open(raster_path) as src:
                # Read bands based on available band information
                band_data = {}
                
                # Map band names to indices (simplified mapping)
                band_mapping = {
                    'blue': 1, 'green': 2, 'red': 3, 'nir': 4, 'swir1': 5, 'swir2': 6
                }
                
                # Read available bands
                for band_name in bands_info:
                    if band_name in band_mapping and band_mapping[band_name] <= src.count:
                        band_data[band_name] = src.read(band_mapping[band_name]).astype(np.float32)
                
                # Calculate indices
                work_dir = os.path.dirname(raster_path)
                
                # NDVI (Normalized Difference Vegetation Index)
                if 'red' in band_data and 'nir' in band_data:
                    ndvi = self._calculate_ndvi(band_data['red'], band_data['nir'])
                    ndvi_path = os.path.join(work_dir, 'ndvi.tif')
                    self._write_index_raster(ndvi, src, ndvi_path)
                    indices['ndvi'] = ndvi_path
                
                # NDWI (Normalized Difference Water Index)
                if 'green' in band_data and 'nir' in band_data:
                    ndwi = self._calculate_ndwi(band_data['green'], band_data['nir'])
                    ndwi_path = os.path.join(work_dir, 'ndwi.tif')
                    self._write_index_raster(ndwi, src, ndwi_path)
                    indices['ndwi'] = ndwi_path
                
                # NBR (Normalized Burn Ratio)
                if 'nir' in band_data and 'swir2' in band_data:
                    nbr = self._calculate_nbr(band_data['nir'], band_data['swir2'])
                    nbr_path = os.path.join(work_dir, 'nbr.tif')
                    self._write_index_raster(nbr, src, nbr_path)
                    indices['nbr'] = nbr_path
                
                # Ferric Iron Index
                if 'red' in band_data and 'swir1' in band_data:
                    ferric = self._calculate_ferric_iron(band_data['red'], band_data['swir1'])
                    ferric_path = os.path.join(work_dir, 'ferric.tif')
                    self._write_index_raster(ferric, src, ferric_path)
                    indices['ferric'] = ferric_path
                
                # Ferrous Iron Index
                if 'swir1' in band_data and 'swir2' in band_data:
                    ferrous = self._calculate_ferrous_iron(band_data['swir1'], band_data['swir2'])
                    ferrous_path = os.path.join(work_dir, 'ferrous.tif')
                    self._write_index_raster(ferrous, src, ferrous_path)
                    indices['ferrous'] = ferrous_path
        
        except Exception as e:
            self.logger.error(f"Failed to calculate spectral indices", error=str(e))
        
        return indices
    
    def _calculate_ndvi(self, red: np.ndarray, nir: np.ndarray) -> np.ndarray:
        """Calculate NDVI: (NIR - Red) / (NIR + Red)"""
        with np.errstate(divide='ignore', invalid='ignore'):
            ndvi = (nir - red) / (nir + red)
            ndvi = np.where(np.isfinite(ndvi), ndvi, -9999)
        return ndvi
    
    def _calculate_ndwi(self, green: np.ndarray, nir: np.ndarray) -> np.ndarray:
        """Calculate NDWI: (Green - NIR) / (Green + NIR)"""
        with np.errstate(divide='ignore', invalid='ignore'):
            ndwi = (green - nir) / (green + nir)
            ndwi = np.where(np.isfinite(ndwi), ndwi, -9999)
        return ndwi
    
    def _calculate_nbr(self, nir: np.ndarray, swir2: np.ndarray) -> np.ndarray:
        """Calculate NBR: (NIR - SWIR2) / (NIR + SWIR2)"""
        with np.errstate(divide='ignore', invalid='ignore'):
            nbr = (nir - swir2) / (nir + swir2)
            nbr = np.where(np.isfinite(nbr), nbr, -9999)
        return nbr
    
    def _calculate_ferric_iron(self, red: np.ndarray, swir1: np.ndarray) -> np.ndarray:
        """Calculate Ferric Iron Index: SWIR1 / Red"""
        with np.errstate(divide='ignore', invalid='ignore'):
            ferric = swir1 / red
            ferric = np.where(np.isfinite(ferric), ferric, -9999)
        return ferric
    
    def _calculate_ferrous_iron(self, swir1: np.ndarray, swir2: np.ndarray) -> np.ndarray:
        """Calculate Ferrous Iron Index: SWIR1 / SWIR2"""
        with np.errstate(divide='ignore', invalid='ignore'):
            ferrous = swir1 / swir2
            ferrous = np.where(np.isfinite(ferrous), ferrous, -9999)
        return ferrous
    
    def _write_index_raster(self, index_data: np.ndarray, template_src, output_path: str):
        """Write spectral index to raster file"""
        out_meta = template_src.meta.copy()
        out_meta.update({
            'dtype': rasterio.float32,
            'count': 1,
            'nodata': -9999
        })
        
        with rasterio.open(output_path, 'w', **out_meta) as dst:
            dst.write(index_data, 1)
    
    def convert_to_cog(self, input_path: str, output_path: str) -> bool:
        """Convert raster to Cloud Optimized GeoTIFF"""
        try:
            cmd = [
                'gdal_translate',
                '-of', 'COG',
                '-co', f'COMPRESS={tiling_config.cog_compress}',
                '-co', f'BLOCKSIZE={tiling_config.cog_blocksize}',
                '-co', 'TILED=YES',
                '-co', 'BIGTIFF=IF_SAFER',
                input_path,
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                self.logger.error(f"GDAL translate to COG failed: {result.stderr}")
                return False
            
            # Build overviews
            overview_cmd = [
                'gdaladdo',
                '-r', config.tile_resampling.lower(),
                output_path
            ] + [str(level) for level in tiling_config.cog_overview_levels]
            
            overview_result = subprocess.run(overview_cmd, capture_output=True, text=True)
            
            if overview_result.returncode != 0:
                self.logger.warning(f"Failed to build overviews: {overview_result.stderr}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to convert to COG", error=str(e))
            return False
    
    def write_cog_to_s3(self, cog_path: str, country_code: str, 
                       product_type: str, seasonality: str, filename: str) -> str:
        """Write COG to S3 storage"""
        timestamp = datetime.now().strftime('%Y%m')
        s3_key = f"country/{country_code}/baseline/satellite/{timestamp}/{seasonality}/{filename}"
        
        success = self.storage.s3.upload_file(
            cog_path,
            s3_key,
            metadata={
                'country': country_code,
                'data_type': 'satellite',
                'product_type': product_type,
                'seasonality': seasonality,
                'format': 'cog'
            }
        )
        
        if success:
            return f"s3://{config.s3_bucket}/{s3_key}"
        else:
            raise Exception("Failed to upload COG to S3")
    
    def create_stac_items(self, processed_data: Dict[str, Any], country_code: str) -> Dict[str, Any]:
        """Create STAC collection and items for satellite data"""
        
        # Get bounds from first available raster
        bounds = None
        sample_cog = None
        
        for seasonality_data in processed_data.values():
            for product_data in seasonality_data.values():
                if 'cog_path' in product_data:
                    sample_cog = product_data['cog_path']
                    break
            if sample_cog:
                break
        
        if not sample_cog:
            raise Exception("No COG files found for STAC creation")
        
        # Download sample COG to read metadata
        temp_cog = self.storage.files.create_temp_file('.tif')
        s3_key = sample_cog.replace(f"s3://{config.s3_bucket}/", "")
        
        try:
            if not self.storage.s3.download_file(s3_key, temp_cog):
                raise Exception("Failed to download COG for STAC creation")
            
            with rasterio.open(temp_cog) as src:
                bounds = src.bounds
                bounds_list = [bounds.left, bounds.bottom, bounds.right, bounds.top]
                
                # Create collection
                collection = {
                    "type": "Collection",
                    "stac_version": "1.0.0",
                    "id": f"satellite_{country_code.lower()}",
                    "title": f"Satellite Imagery & Indices - {config.country_codes.get(country_code, country_code)}",
                    "description": f"Satellite imagery composites and spectral indices for {config.country_codes.get(country_code, country_code)}",
                    "keywords": ["satellite", "spectral", "indices", "sentinel", "landsat", country_code.lower()],
                    "license": "proprietary",
                    "providers": [
                        {
                            "name": "GeoVision AI Miner",
                            "roles": ["processor", "host"],
                            "url": "https://geovision.ai"
                        }
                    ],
                    "extent": {
                        "spatial": {
                            "bbox": [bounds_list]
                        },
                        "temporal": {
                            "interval": [[None, None]]
                        }
                    },
                    "summaries": {
                        "country": [country_code],
                        "data_type": ["satellite"],
                        "seasonality": list(processed_data.keys()),
                        "gsd": [abs(src.res[0])]
                    }
                }
                
                # Create items for each product
                items = []
                
                for seasonality, seasonality_data in processed_data.items():
                    for product_type, product_data in seasonality_data.items():
                        if 'cog_path' not in product_data:
                            continue
                        
                        item = {
                            "type": "Feature",
                            "stac_version": "1.0.0",
                            "id": f"satellite_{product_type}_{seasonality}_{country_code.lower()}_{datetime.now().strftime('%Y%m%d')}",
                            "collection": f"satellite_{country_code.lower()}",
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [[
                                    [bounds.left, bounds.bottom],
                                    [bounds.right, bounds.bottom],
                                    [bounds.right, bounds.top],
                                    [bounds.left, bounds.top],
                                    [bounds.left, bounds.bottom]
                                ]]
                            },
                            "bbox": bounds_list,
                            "properties": {
                                "datetime": datetime.now().isoformat(),
                                "country": country_code,
                                "data_type": "satellite",
                                "product_type": product_type,
                                "seasonality": seasonality,
                                "crs": str(src.crs),
                                "gsd": abs(src.res[0])
                            },
                            "assets": {
                                "data": {
                                    "href": product_data['cog_path'],
                                    "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                                    "roles": ["data"],
                                    "title": f"{product_type.upper()} {seasonality.title()} Data"
                                }
                            }
                        }
                        
                        # Add specific properties for spectral indices
                        if product_type in ['ndvi', 'ndwi', 'nbr']:
                            item["properties"]["index_range"] = [-1, 1]
                        elif product_type in ['ferric', 'ferrous']:
                            item["properties"]["index_range"] = [0, None]
                        
                        items.append(item)
        
        finally:
            self.storage.files.cleanup_temp_file(temp_cog)
        
        # Write STAC files to S3
        collection_key = f"stac/{country_code.lower()}/satellite/collection.json"
        self.storage.s3.upload_json(collection, collection_key)
        
        item_paths = []
        for item in items:
            item_key = f"stac/{country_code.lower()}/satellite/items/{item['id']}.json"
            self.storage.s3.upload_json(item, item_key)
            item_paths.append(f"s3://{config.s3_bucket}/{item_key}")
        
        return {
            "collection": collection,
            "items": items,
            "collection_path": f"s3://{config.s3_bucket}/{collection_key}",
            "item_paths": item_paths
        }
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Process all satellite data for a country"""
        start_time = time.time()
        
        # Discover sources
        sources = self.discover_sources(country_code)
        
        if not sources:
            self.logger.warning(f"No satellite sources found for {country_code}")
            return {
                'country': country_code,
                'status': 'no_sources',
                'sources_found': 0,
                'processing_time': time.time() - start_time
            }
        
        self.logger.log_dataset_start('satellite', country_code, len(sources))
        
        try:
            # Group sources by seasonality
            sources_by_season = {}
            for source in sources:
                seasonality = source['seasonality']
                if seasonality not in sources_by_season:
                    sources_by_season[seasonality] = []
                sources_by_season[seasonality].append(source)
            
            processed_data = {}
            
            # Process each seasonality group
            for seasonality, season_sources in sources_by_season.items():
                if seasonality == 'unknown':
                    seasonality = 'annual'  # Default for unknown seasonality
                
                processed_data[seasonality] = {}
                
                for source in season_sources:
                    try:
                        # Get source file
                        if source['type'] == 'local':
                            source_file = source['path']
                        else:  # S3
                            temp_file = self.storage.files.create_temp_file('.tif')
                            s3_key = source['path'].replace(f"s3://{config.s3_bucket}/", "")
                            
                            if not self.storage.s3.download_file(s3_key, temp_file):
                                continue
                            source_file = temp_file
                        
                        # Create working directory
                        work_dir = self.storage.files.create_temp_file('')
                        os.makedirs(work_dir, exist_ok=True)
                        
                        # Convert original to COG
                        original_cog = os.path.join(work_dir, 'original.tif')
                        if self.convert_to_cog(source_file, original_cog):
                            # Upload original
                            filename = f"composite_{source['satellite_type']}.tif"
                            s3_url = self.write_cog_to_s3(original_cog, country_code, 'composite', seasonality, filename)
                            processed_data[seasonality]['composite'] = {'cog_path': s3_url}
                        
                        # Calculate spectral indices
                        if source['bands']:
                            indices = self.calculate_spectral_indices(source_file, source['bands'])
                            
                            for index_name, index_path in indices.items():
                                # Convert index to COG
                                index_cog = os.path.join(work_dir, f'{index_name}_cog.tif')
                                if self.convert_to_cog(index_path, index_cog):
                                    # Upload index
                                    filename = f"{index_name}.tif"
                                    s3_url = self.write_cog_to_s3(index_cog, country_code, index_name, seasonality, filename)
                                    processed_data[seasonality][index_name] = {'cog_path': s3_url}
                        
                        # Cleanup temp files
                        if source['type'] == 's3':
                            self.storage.files.cleanup_temp_file(source_file)
                        
                    except Exception as e:
                        self.logger.error(f"Failed to process satellite source {source['path']}", error=str(e))
                        continue
            
            # Create STAC items
            stac_info = None
            if processed_data:
                try:
                    stac_info = self.create_stac_items(processed_data, country_code)
                except Exception as e:
                    self.logger.error(f"Failed to create STAC items for satellite data", error=str(e))
            
            processing_time = time.time() - start_time
            
            # Count total products
            total_products = sum(len(season_data) for season_data in processed_data.values())
            
            self.logger.log_dataset_complete('satellite', country_code, total_products, processing_time)
            
            return {
                'country': country_code,
                'status': 'success',
                'sources_found': len(sources),
                'seasonalities_processed': list(processed_data.keys()),
                'total_products': total_products,
                'processing_time': processing_time,
                'outputs': {
                    'products_by_season': processed_data,
                    'stac_collection': stac_info['collection_path'] if stac_info else None,
                    'stac_items': stac_info['item_paths'] if stac_info else []
                }
            }
            
        except Exception as e:
            self.logger.error(f"Failed to process satellite data for {country_code}", error=str(e))
            return {
                'country': country_code,
                'status': 'failed',
                'sources_found': len(sources),
                'processing_time': time.time() - start_time,
                'error': str(e)
            }