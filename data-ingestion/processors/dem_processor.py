"""
DEM & Morphometry Data Processor
Handles Digital Elevation Model data and derived morphometric products
"""

import os
import time
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import rasterio
from rasterio.merge import merge
from rasterio.warp import calculate_default_transform, reproject, Resampling
import numpy as np
from scipy import ndimage
import tempfile

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, dataset_config, tiling_config, quality_config

class DEMProcessor:
    """Processes DEM and morphometry data for ingestion pipeline"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('dem_processor')
        self.processed_files = []
    
    def discover_sources(self, country_code: str) -> List[Dict[str, Any]]:
        """Discover DEM data sources for a country"""
        sources = []
        
        # Local sources
        local_pattern = dataset_config.dem_sources['local'].format(
            LOCAL_DIR=os.getenv('LOCAL_DIR', './data'),
            country=country_code.lower()
        )
        
        local_files = self.storage.files.find_files(local_pattern)
        
        for file_path in local_files:
            sources.append({
                'type': 'local',
                'path': str(file_path),
                'country': country_code,
                'format': 'tif',
                'size_mb': self.storage.files.get_file_size_mb(file_path)
            })
        
        # S3 sources
        s3_prefix = dataset_config.dem_sources['s3'].format(
            S3_BUCKET=config.s3_bucket,
            country=country_code.lower()
        ).replace(f"{config.s3_bucket}/", "")
        
        s3_objects = self.storage.s3.list_objects(s3_prefix)
        
        for obj_key in s3_objects:
            if obj_key.endswith('.tif'):
                sources.append({
                    'type': 's3',
                    'path': f"s3://{config.s3_bucket}/{obj_key}",
                    'country': country_code,
                    'format': 'tif',
                    'size_mb': 0
                })
        
        self.logger.info(f"Discovered {len(sources)} DEM sources for {country_code}")
        return sources
    
    def mosaic_dem_tiles(self, dem_files: List[str], output_path: str) -> bool:
        """Mosaic multiple DEM tiles into a single raster"""
        try:
            # Open all DEM files
            src_files_to_mosaic = []
            
            for dem_file in dem_files:
                src = rasterio.open(dem_file)
                src_files_to_mosaic.append(src)
            
            # Merge/mosaic the rasters
            mosaic, out_trans = merge(src_files_to_mosaic)
            
            # Get metadata from first file
            out_meta = src_files_to_mosaic[0].meta.copy()
            
            # Update metadata
            out_meta.update({
                "driver": "GTiff",
                "height": mosaic.shape[1],
                "width": mosaic.shape[2],
                "transform": out_trans,
                "crs": src_files_to_mosaic[0].crs
            })
            
            # Write mosaic
            with rasterio.open(output_path, "w", **out_meta) as dest:
                dest.write(mosaic)
            
            # Close source files
            for src in src_files_to_mosaic:
                src.close()
            
            self.logger.info(f"Created DEM mosaic from {len(dem_files)} tiles")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to mosaic DEM tiles", error=str(e))
            return False
    
    def calculate_slope(self, dem_path: str, output_path: str) -> bool:
        """Calculate slope from DEM using GDAL"""
        try:
            cmd = [
                'gdaldem', 'slope',
                dem_path,
                output_path,
                '-of', 'GTiff',
                '-co', 'COMPRESS=DEFLATE',
                '-co', 'TILED=YES'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                self.logger.error(f"GDAL slope calculation failed: {result.stderr}")
                return False
            
            self.logger.info("Calculated slope from DEM")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to calculate slope", error=str(e))
            return False
    
    def calculate_curvature(self, dem_path: str, output_path: str) -> bool:
        """Calculate curvature from DEM using custom algorithm"""
        try:
            with rasterio.open(dem_path) as src:
                dem_data = src.read(1)
                
                # Calculate second derivatives for curvature
                # Using Sobel operators for first derivatives
                dx = ndimage.sobel(dem_data, axis=1)
                dy = ndimage.sobel(dem_data, axis=0)
                
                # Second derivatives
                dxx = ndimage.sobel(dx, axis=1)
                dyy = ndimage.sobel(dy, axis=0)
                dxy = ndimage.sobel(dx, axis=0)
                
                # Profile curvature calculation
                # curvature = (dxx * dy^2 - 2*dxy*dx*dy + dyy*dx^2) / (dx^2 + dy^2)^1.5
                denominator = np.power(dx**2 + dy**2, 1.5)
                denominator[denominator == 0] = 1e-10  # Avoid division by zero
                
                curvature = (dxx * dy**2 - 2*dxy*dx*dy + dyy*dx**2) / denominator
                
                # Write curvature raster
                out_meta = src.meta.copy()
                out_meta.update(dtype=rasterio.float32)
                
                with rasterio.open(output_path, 'w', **out_meta) as dst:
                    dst.write(curvature.astype(rasterio.float32), 1)
            
            self.logger.info("Calculated curvature from DEM")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to calculate curvature", error=str(e))
            return False
    
    def calculate_hillshade(self, dem_path: str, output_path: str,
                          azimuth: float = 315.0, altitude: float = 45.0) -> bool:
        """Calculate hillshade from DEM using GDAL"""
        try:
            cmd = [
                'gdaldem', 'hillshade',
                dem_path,
                output_path,
                '-of', 'GTiff',
                '-co', 'COMPRESS=DEFLATE',
                '-co', 'TILED=YES',
                '-az', str(azimuth),
                '-alt', str(altitude)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                self.logger.error(f"GDAL hillshade calculation failed: {result.stderr}")
                return False
            
            self.logger.info("Calculated hillshade from DEM")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to calculate hillshade", error=str(e))
            return False
    
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
                       product_type: str, filename: str) -> str:
        """Write COG to S3 storage"""
        timestamp = datetime.now().strftime('%Y%m')
        s3_key = f"country/{country_code}/baseline/dem/{product_type}/{timestamp}/{filename}"
        
        success = self.storage.s3.upload_file(
            cog_path,
            s3_key,
            metadata={
                'country': country_code,
                'data_type': 'dem',
                'product_type': product_type,
                'format': 'cog'
            }
        )
        
        if success:
            return f"s3://{config.s3_bucket}/{s3_key}"
        else:
            raise Exception("Failed to upload COG to S3")
    
    def create_stac_items(self, cog_info: Dict[str, str], country_code: str) -> Dict[str, Any]:
        """Create STAC collection and items for DEM data"""
        
        # Get bounds from DEM COG
        dem_cog_path = None
        for product_type, cog_path in cog_info.items():
            if product_type == 'dem':
                dem_cog_path = cog_path
                break
        
        if not dem_cog_path:
            raise Exception("No DEM COG found for STAC creation")
        
        # Download DEM COG temporarily to read metadata
        temp_dem = self.storage.files.create_temp_file('.tif')
        s3_key = dem_cog_path.replace(f"s3://{config.s3_bucket}/", "")
        
        try:
            if not self.storage.s3.download_file(s3_key, temp_dem):
                raise Exception("Failed to download DEM for STAC creation")
            
            with rasterio.open(temp_dem) as src:
                bounds = src.bounds
                bounds_list = [bounds.left, bounds.bottom, bounds.right, bounds.top]
                
                # Create collection
                collection = {
                    "type": "Collection",
                    "stac_version": "1.0.0",
                    "id": f"dem_{country_code.lower()}",
                    "title": f"DEM & Morphometry - {config.country_codes.get(country_code, country_code)}",
                    "description": f"Digital Elevation Model and derived morphometric products for {config.country_codes.get(country_code, country_code)}",
                    "keywords": ["dem", "elevation", "morphometry", "slope", "curvature", "hillshade", country_code.lower()],
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
                        "data_type": ["dem"],
                        "products": list(cog_info.keys()),
                        "gsd": [abs(src.res[0])]
                    }
                }
                
                # Create items for each product
                items = []
                
                for product_type, cog_path in cog_info.items():
                    item = {
                        "type": "Feature",
                        "stac_version": "1.0.0",
                        "id": f"dem_{product_type}_{country_code.lower()}_{datetime.now().strftime('%Y%m%d')}",
                        "collection": f"dem_{country_code.lower()}",
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
                            "data_type": "dem",
                            "product_type": product_type,
                            "crs": str(src.crs),
                            "gsd": abs(src.res[0])
                        },
                        "assets": {
                            "data": {
                                "href": cog_path,
                                "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                                "roles": ["data"],
                                "title": f"{product_type.upper()} Data"
                            }
                        }
                    }
                    
                    # Add specific properties for each product type
                    if product_type == 'dem':
                        item["properties"]["units"] = "meters"
                    elif product_type == 'slope':
                        item["properties"]["units"] = "degrees"
                    elif product_type == 'curvature':
                        item["properties"]["units"] = "1/meters"
                    elif product_type == 'hillshade':
                        item["properties"]["units"] = "0-255"
                    
                    items.append(item)
        
        finally:
            self.storage.files.cleanup_temp_file(temp_dem)
        
        # Write STAC files to S3
        collection_key = f"stac/{country_code.lower()}/dem/collection.json"
        self.storage.s3.upload_json(collection, collection_key)
        
        item_paths = []
        for item in items:
            item_key = f"stac/{country_code.lower()}/dem/items/{item['id']}.json"
            self.storage.s3.upload_json(item, item_key)
            item_paths.append(f"s3://{config.s3_bucket}/{item_key}")
        
        return {
            "collection": collection,
            "items": items,
            "collection_path": f"s3://{config.s3_bucket}/{collection_key}",
            "item_paths": item_paths
        }
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Process all DEM data for a country"""
        start_time = time.time()
        
        # Discover sources
        sources = self.discover_sources(country_code)
        
        if not sources:
            self.logger.warning(f"No DEM sources found for {country_code}")
            return {
                'country': country_code,
                'status': 'no_sources',
                'sources_found': 0,
                'processing_time': time.time() - start_time
            }
        
        self.logger.log_dataset_start('dem', country_code, len(sources))
        
        try:
            # Download/collect all DEM files
            dem_files = []
            
            for source in sources:
                if source['type'] == 'local':
                    dem_files.append(source['path'])
                else:  # S3
                    temp_file = self.storage.files.create_temp_file('.tif')
                    s3_key = source['path'].replace(f"s3://{config.s3_bucket}/", "")
                    
                    if self.storage.s3.download_file(s3_key, temp_file):
                        dem_files.append(temp_file)
            
            if not dem_files:
                raise Exception("No valid DEM files found")
            
            # Create working directory
            work_dir = self.storage.files.create_temp_file('')
            os.makedirs(work_dir, exist_ok=True)
            
            # Mosaic DEM tiles if multiple files
            if len(dem_files) > 1:
                mosaic_path = os.path.join(work_dir, 'dem_mosaic.tif')
                if not self.mosaic_dem_tiles(dem_files, mosaic_path):
                    raise Exception("Failed to mosaic DEM tiles")
                dem_path = mosaic_path
            else:
                dem_path = dem_files[0]
            
            # Generate morphometric products
            products = {}
            
            # DEM (convert to COG)
            dem_cog = os.path.join(work_dir, 'dem.tif')
            if self.convert_to_cog(dem_path, dem_cog):
                products['dem'] = dem_cog
            
            # Slope
            slope_path = os.path.join(work_dir, 'slope.tif')
            slope_cog = os.path.join(work_dir, 'slope_cog.tif')
            if self.calculate_slope(dem_path, slope_path):
                if self.convert_to_cog(slope_path, slope_cog):
                    products['slope'] = slope_cog
            
            # Curvature
            curvature_path = os.path.join(work_dir, 'curvature.tif')
            curvature_cog = os.path.join(work_dir, 'curvature_cog.tif')
            if self.calculate_curvature(dem_path, curvature_path):
                if self.convert_to_cog(curvature_path, curvature_cog):
                    products['curvature'] = curvature_cog
            
            # Hillshade
            hillshade_path = os.path.join(work_dir, 'hillshade.tif')
            hillshade_cog = os.path.join(work_dir, 'hillshade_cog.tif')
            if self.calculate_hillshade(dem_path, hillshade_path):
                if self.convert_to_cog(hillshade_path, hillshade_cog):
                    products['hillshade'] = hillshade_cog
            
            # Upload products to S3
            s3_paths = {}
            for product_type, cog_path in products.items():
                filename = f"{product_type}.tif"
                s3_url = self.write_cog_to_s3(cog_path, country_code, product_type, filename)
                s3_paths[product_type] = s3_url
            
            # Create STAC items
            stac_info = self.create_stac_items(s3_paths, country_code)
            
            # Flag feature store inputs
            feature_store_flags = {}
            for product_type in ['dem', 'slope', 'curvature']:
                if product_type in s3_paths:
                    feature_store_flags[f"{product_type}_*"] = True
            
            processing_time = time.time() - start_time
            
            self.logger.log_dataset_complete('dem', country_code, len(products), processing_time)
            
            return {
                'country': country_code,
                'status': 'success',
                'sources_found': len(sources),
                'sources_processed': len(dem_files),
                'products_created': len(products),
                'processing_time': processing_time,
                'outputs': {
                    'products': s3_paths,
                    'stac_collection': stac_info['collection_path'],
                    'stac_items': stac_info['item_paths'],
                    'feature_store_flags': feature_store_flags
                }
            }
            
        except Exception as e:
            self.logger.error(f"Failed to process DEM data for {country_code}", error=str(e))
            return {
                'country': country_code,
                'status': 'failed',
                'sources_found': len(sources),
                'processing_time': time.time() - start_time,
                'error': str(e)
            }
        
        finally:
            # Cleanup temp files
            for source in sources:
                if source['type'] == 's3':
                    # Clean up downloaded temp files
                    pass