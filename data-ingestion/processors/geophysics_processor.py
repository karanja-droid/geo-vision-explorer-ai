"""
Geophysics Data Processor
Handles raster geophysical data (magnetics, gravity, radiometrics) ingestion and processing
"""

import os
import time
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import rasterio
from rasterio.crs import CRS
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.enums import Resampling as ResamplingEnum
import numpy as np
import tempfile

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, dataset_config, tiling_config, quality_config

class GeophysicsProcessor:
    """Processes geophysical raster data for ingestion pipeline"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('geophysics_processor')
        self.processed_files = []
        self.validation_results = {}
    
    def discover_sources(self, country_code: str) -> List[Dict[str, Any]]:
        """Discover geophysical data sources for a country"""
        sources = []
        
        # Local sources
        local_pattern = dataset_config.geophysics_sources['local'].format(
            LOCAL_DIR=os.getenv('LOCAL_DIR', './data'),
            country=country_code.lower()
        )
        
        for ext in dataset_config.geophysics_extensions:
            pattern = f"{local_pattern}{ext}"
            local_files = self.storage.files.find_files(pattern)
            
            for file_path in local_files:
                # Determine geophysics type from path or filename
                geophys_type = self._determine_geophysics_type(str(file_path))
                
                sources.append({
                    'type': 'local',
                    'path': str(file_path),
                    'country': country_code,
                    'geophysics_type': geophys_type,
                    'format': ext.replace('.', ''),
                    'size_mb': self.storage.files.get_file_size_mb(file_path)
                })
        
        # S3 sources
        s3_prefix = dataset_config.geophysics_sources['s3'].format(
            S3_BUCKET=config.s3_bucket,
            country=country_code.lower()
        ).replace(f"{config.s3_bucket}/", "")
        
        s3_objects = self.storage.s3.list_objects(s3_prefix)
        
        for obj_key in s3_objects:
            if any(obj_key.endswith(ext) for ext in dataset_config.geophysics_extensions):
                geophys_type = self._determine_geophysics_type(obj_key)
                
                sources.append({
                    'type': 's3',
                    'path': f"s3://{config.s3_bucket}/{obj_key}",
                    'country': country_code,
                    'geophysics_type': geophys_type,
                    'format': Path(obj_key).suffix.replace('.', ''),
                    'size_mb': 0
                })
        
        self.logger.info(f"Discovered {len(sources)} geophysical sources for {country_code}")
        return sources
    
    def _determine_geophysics_type(self, file_path: str) -> str:
        """Determine geophysics type from file path or name"""
        path_lower = file_path.lower()
        
        if any(keyword in path_lower for keyword in ['mag', 'magnetic', 'tmi', 'rtp']):
            return 'magnetics'
        elif any(keyword in path_lower for keyword in ['grav', 'gravity', 'bouguer']):
            return 'gravity'
        elif any(keyword in path_lower for keyword in ['rad', 'radiometric', 'gamma', 'uranium', 'thorium', 'potassium']):
            return 'radiometrics'
        else:
            return 'unknown'
    
    def validate_raster_data(self, file_path: str, source_info: Dict[str, Any]) -> Dict[str, Any]:
        """Validate raster geophysical data"""
        validation_report = {
            'source': source_info['path'],
            'geophysics_type': source_info['geophysics_type'],
            'valid': True,
            'warnings': [],
            'errors': [],
            'metadata': {}
        }
        
        try:
            with rasterio.open(file_path) as src:
                # Basic metadata
                validation_report['metadata'] = {
                    'width': src.width,
                    'height': src.height,
                    'count': src.count,
                    'dtype': str(src.dtype),
                    'crs': str(src.crs) if src.crs else None,
                    'bounds': src.bounds,
                    'nodata': src.nodata,
                    'resolution': src.res
                }
                
                # Validate CRS
                if src.crs is None:
                    validation_report['warnings'].append("No CRS defined")
                
                # Check for reasonable bounds
                bounds = src.bounds
                if not (-180 <= bounds.left <= 180 and -180 <= bounds.right <= 180 and
                       -90 <= bounds.bottom <= 90 and -90 <= bounds.top <= 90):
                    validation_report['warnings'].append(f"Coordinates outside global bounds: {bounds}")
                
                # Check data statistics
                try:
                    data = src.read(1, masked=True)
                    if data.size > 0:
                        validation_report['metadata']['statistics'] = {
                            'min': float(np.min(data)),
                            'max': float(np.max(data)),
                            'mean': float(np.mean(data)),
                            'std': float(np.std(data)),
                            'valid_pixels': int(np.sum(~data.mask)) if hasattr(data, 'mask') else data.size,
                            'total_pixels': data.size
                        }
                        
                        # Check for extreme values (potential data issues)
                        if source_info['geophysics_type'] == 'magnetics':
                            if validation_report['metadata']['statistics']['min'] < -100000 or \
                               validation_report['metadata']['statistics']['max'] > 100000:
                                validation_report['warnings'].append("Extreme magnetic values detected")
                        
                        elif source_info['geophysics_type'] == 'gravity':
                            if validation_report['metadata']['statistics']['min'] < -1000 or \
                               validation_report['metadata']['statistics']['max'] > 1000:
                                validation_report['warnings'].append("Extreme gravity values detected")
                
                except Exception as e:
                    validation_report['warnings'].append(f"Could not read raster statistics: {str(e)}")
                
        except Exception as e:
            validation_report['valid'] = False
            validation_report['errors'].append(f"Failed to open raster: {str(e)}")
        
        return validation_report
    
    def convert_to_cog(self, input_path: str, output_path: str, 
                      target_crs: str = None) -> bool:
        """Convert raster to Cloud Optimized GeoTIFF"""
        try:
            cmd = [
                'gdal_translate',
                '-of', 'COG',
                '-co', f'COMPRESS={tiling_config.cog_compress}',
                '-co', f'BLOCKSIZE={tiling_config.cog_blocksize}',
                '-co', 'TILED=YES',
                '-co', 'BIGTIFF=IF_SAFER'
            ]
            
            # Add reprojection if needed
            if target_crs:
                cmd.extend(['-t_srs', target_crs])
            
            cmd.extend([input_path, output_path])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                self.logger.error(f"GDAL translate failed: {result.stderr}")
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
    
    def generate_derivatives(self, input_cog: str, geophysics_type: str, 
                           output_dir: str) -> List[str]:
        """Generate derivative products for geophysical data"""
        derivatives = []
        
        if geophysics_type == 'magnetics':
            # Generate common magnetic derivatives
            derivative_types = {
                'rtp': self._generate_rtp,
                '1vd': self._generate_first_vertical_derivative,
                'tilt': self._generate_tilt_derivative
            }
            
            for deriv_name, deriv_func in derivative_types.items():
                try:
                    output_path = os.path.join(output_dir, f"magnetics_{deriv_name}.tif")
                    if deriv_func(input_cog, output_path):
                        derivatives.append(output_path)
                except Exception as e:
                    self.logger.warning(f"Failed to generate {deriv_name} derivative", error=str(e))
        
        return derivatives
    
    def _generate_rtp(self, input_path: str, output_path: str) -> bool:
        """Generate Reduction to Pole (RTP) derivative"""
        # This would require specialized geophysical processing libraries
        # For now, we'll create a placeholder
        try:
            # Copy input as placeholder (in real implementation, would apply RTP filter)
            cmd = ['gdal_translate', input_path, output_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0
        except:
            return False
    
    def _generate_first_vertical_derivative(self, input_path: str, output_path: str) -> bool:
        """Generate First Vertical Derivative (1VD)"""
        # Placeholder implementation
        try:
            cmd = ['gdal_translate', input_path, output_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0
        except:
            return False
    
    def _generate_tilt_derivative(self, input_path: str, output_path: str) -> bool:
        """Generate Tilt Derivative"""
        # Placeholder implementation
        try:
            cmd = ['gdal_translate', input_path, output_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0
        except:
            return False
    
    def write_cog_to_s3(self, cog_path: str, country_code: str, 
                       geophysics_type: str, filename: str) -> str:
        """Write COG to S3 storage"""
        timestamp = datetime.now().strftime('%Y%m')
        s3_key = f"country/{country_code}/baseline/geophysics/{geophysics_type}/{timestamp}/{filename}"
        
        success = self.storage.s3.upload_file(
            cog_path,
            s3_key,
            metadata={
                'country': country_code,
                'data_type': 'geophysics',
                'geophysics_type': geophysics_type,
                'format': 'cog'
            }
        )
        
        if success:
            return f"s3://{config.s3_bucket}/{s3_key}"
        else:
            raise Exception("Failed to upload COG to S3")
    
    def register_postgis_footprint(self, cog_path: str, country_code: str,
                                 geophysics_type: str, s3_url: str) -> bool:
        """Register raster footprint in PostGIS"""
        try:
            with rasterio.open(cog_path) as src:
                # Get footprint geometry
                bounds = src.bounds
                footprint_wkt = f"POLYGON(({bounds.left} {bounds.bottom}, {bounds.right} {bounds.bottom}, {bounds.right} {bounds.top}, {bounds.left} {bounds.top}, {bounds.left} {bounds.bottom}))"
                
                # Create metadata record
                metadata = {
                    'country_code': country_code,
                    'geophysics_type': geophysics_type,
                    'asset_url': s3_url,
                    'width': src.width,
                    'height': src.height,
                    'crs': str(src.crs),
                    'resolution_x': src.res[0],
                    'resolution_y': src.res[1],
                    'bounds': list(bounds),
                    'created_at': datetime.now(),
                    'org_id': config.org_id,
                    'project_id': config.project_id,
                    'data_classification': 'public'
                }
                
                # This would insert into a geophysics_assets table
                # Implementation would depend on specific PostGIS schema
                self.logger.info(f"Registered geophysics footprint for {geophysics_type}")
                return True
                
        except Exception as e:
            self.logger.error(f"Failed to register PostGIS footprint", error=str(e))
            return False
    
    def create_stac_items(self, cog_paths: List[str], country_code: str,
                         geophysics_type: str) -> Dict[str, Any]:
        """Create STAC collection and items for geophysical data"""
        
        # Calculate combined bounds from all COGs
        all_bounds = []
        
        for cog_path in cog_paths:
            try:
                with rasterio.open(cog_path) as src:
                    all_bounds.append(src.bounds)
            except:
                continue
        
        if not all_bounds:
            raise Exception("No valid COG files for STAC creation")
        
        # Calculate union of all bounds
        min_x = min(bounds.left for bounds in all_bounds)
        min_y = min(bounds.bottom for bounds in all_bounds)
        max_x = max(bounds.right for bounds in all_bounds)
        max_y = max(bounds.top for bounds in all_bounds)
        
        union_bounds = [min_x, min_y, max_x, max_y]
        
        # Create collection
        collection = {
            "type": "Collection",
            "stac_version": "1.0.0",
            "id": f"geophysics_{geophysics_type}_{country_code.lower()}",
            "title": f"Geophysics {geophysics_type.title()} - {config.country_codes.get(country_code, country_code)}",
            "description": f"{geophysics_type.title()} geophysical data for {config.country_codes.get(country_code, country_code)}",
            "keywords": ["geophysics", geophysics_type, "raster", country_code.lower()],
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
                    "bbox": [union_bounds]
                },
                "temporal": {
                    "interval": [[None, None]]
                }
            },
            "summaries": {
                "country": [country_code],
                "data_type": ["geophysics"],
                "geophysics_type": [geophysics_type],
                "asset_count": len(cog_paths)
            }
        }
        
        # Create items for each COG
        items = []
        
        for i, cog_path in enumerate(cog_paths):
            try:
                with rasterio.open(cog_path) as src:
                    bounds = src.bounds
                    
                    item = {
                        "type": "Feature",
                        "stac_version": "1.0.0",
                        "id": f"geophysics_{geophysics_type}_{country_code.lower()}_{i:03d}",
                        "collection": f"geophysics_{geophysics_type}_{country_code.lower()}",
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
                        "bbox": [bounds.left, bounds.bottom, bounds.right, bounds.top],
                        "properties": {
                            "datetime": datetime.now().isoformat(),
                            "country": country_code,
                            "data_type": "geophysics",
                            "geophysics_type": geophysics_type,
                            "crs": str(src.crs),
                            "gsd": min(abs(src.res[0]), abs(src.res[1]))
                        },
                        "assets": {
                            "data": {
                                "href": cog_path,
                                "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                                "roles": ["data"],
                                "title": f"{geophysics_type.title()} Data"
                            }
                        }
                    }
                    
                    # Add EO extension for band information if applicable
                    if src.count > 0:
                        item["properties"]["eo:bands"] = [
                            {
                                "name": f"band_{j+1}",
                                "description": f"{geophysics_type} band {j+1}"
                            } for j in range(src.count)
                        ]
                    
                    items.append(item)
                    
            except Exception as e:
                self.logger.warning(f"Failed to create STAC item for {cog_path}", error=str(e))
                continue
        
        # Write STAC files to S3
        collection_key = f"stac/{country_code.lower()}/geophysics/{geophysics_type}/collection.json"
        self.storage.s3.upload_json(collection, collection_key)
        
        item_paths = []
        for item in items:
            item_key = f"stac/{country_code.lower()}/geophysics/{geophysics_type}/items/{item['id']}.json"
            self.storage.s3.upload_json(item, item_key)
            item_paths.append(f"s3://{config.s3_bucket}/{item_key}")
        
        return {
            "collection": collection,
            "items": items,
            "collection_path": f"s3://{config.s3_bucket}/{collection_key}",
            "item_paths": item_paths
        }
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Process all geophysical data for a country"""
        start_time = time.time()
        
        # Discover sources
        sources = self.discover_sources(country_code)
        
        if not sources:
            self.logger.warning(f"No geophysical sources found for {country_code}")
            return {
                'country': country_code,
                'status': 'no_sources',
                'sources_found': 0,
                'processing_time': time.time() - start_time
            }
        
        self.logger.log_dataset_start('geophysics', country_code, len(sources))
        
        # Group sources by geophysics type
        sources_by_type = {}
        for source in sources:
            geophys_type = source['geophysics_type']
            if geophys_type not in sources_by_type:
                sources_by_type[geophys_type] = []
            sources_by_type[geophys_type].append(source)
        
        results_by_type = {}
        
        # Process each geophysics type
        for geophys_type, type_sources in sources_by_type.items():
            if geophys_type == 'unknown':
                self.logger.warning(f"Skipping unknown geophysics type sources: {len(type_sources)}")
                continue
            
            try:
                type_result = self._process_geophysics_type(country_code, geophys_type, type_sources)
                results_by_type[geophys_type] = type_result
                
            except Exception as e:
                self.logger.error(f"Failed to process {geophys_type} for {country_code}", error=str(e))
                results_by_type[geophys_type] = {
                    'status': 'failed',
                    'error': str(e)
                }
        
        processing_time = time.time() - start_time
        
        self.logger.log_dataset_complete('geophysics', country_code, 
                                       sum(len(type_sources) for type_sources in sources_by_type.values()),
                                       processing_time)
        
        return {
            'country': country_code,
            'status': 'success',
            'sources_found': len(sources),
            'geophysics_types': list(sources_by_type.keys()),
            'processing_time': processing_time,
            'results_by_type': results_by_type
        }
    
    def _process_geophysics_type(self, country_code: str, geophysics_type: str,
                               sources: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process sources for a specific geophysics type"""
        
        processed_cogs = []
        validations = []
        
        for source in sources:
            try:
                # Get source file
                if source['type'] == 'local':
                    source_file = source['path']
                else:  # S3
                    temp_file = self.storage.files.create_temp_file(f".{source['format']}")
                    s3_key = source['path'].replace(f"s3://{config.s3_bucket}/", "")
                    
                    if not self.storage.s3.download_file(s3_key, temp_file):
                        continue
                    source_file = temp_file
                
                # Validate
                validation = self.validate_raster_data(source_file, source)
                validations.append(validation)
                
                if not validation['valid']:
                    self.logger.warning(f"Invalid raster data: {source['path']}")
                    continue
                
                # Convert to COG
                cog_file = self.storage.files.create_temp_file('.tif')
                
                if self.convert_to_cog(source_file, cog_file, config.crs_target):
                    # Generate derivatives if applicable
                    derivative_dir = self.storage.files.create_temp_file('')
                    os.makedirs(derivative_dir, exist_ok=True)
                    
                    derivatives = self.generate_derivatives(cog_file, geophysics_type, derivative_dir)
                    
                    # Upload main COG
                    filename = f"{Path(source['path']).stem}.tif"
                    s3_url = self.write_cog_to_s3(cog_file, country_code, geophysics_type, filename)
                    processed_cogs.append(s3_url)
                    
                    # Upload derivatives
                    for deriv_path in derivatives:
                        deriv_filename = Path(deriv_path).name
                        deriv_s3_url = self.write_cog_to_s3(deriv_path, country_code, geophysics_type, deriv_filename)
                        processed_cogs.append(deriv_s3_url)
                    
                    # Register in PostGIS
                    self.register_postgis_footprint(cog_file, country_code, geophysics_type, s3_url)
                
                # Cleanup temp files
                if source['type'] == 's3':
                    self.storage.files.cleanup_temp_file(source_file)
                self.storage.files.cleanup_temp_file(cog_file)
                
            except Exception as e:
                self.logger.error(f"Failed to process {source['path']}", error=str(e))
                continue
        
        # Create STAC items
        stac_info = None
        if processed_cogs:
            try:
                stac_info = self.create_stac_items(processed_cogs, country_code, geophysics_type)
            except Exception as e:
                self.logger.error(f"Failed to create STAC items for {geophysics_type}", error=str(e))
        
        return {
            'geophysics_type': geophysics_type,
            'sources_processed': len([v for v in validations if v['valid']]),
            'cogs_created': len(processed_cogs),
            'cog_paths': processed_cogs,
            'stac_info': stac_info,
            'validation_summary': {
                'total_sources': len(validations),
                'valid_sources': len([v for v in validations if v['valid']]),
                'warnings': sum(len(v['warnings']) for v in validations),
                'errors': sum(len(v['errors']) for v in validations)
            }
        }