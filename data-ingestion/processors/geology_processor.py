"""
Geology & Structures Data Processor
Handles vector geological data ingestion, validation, and processing
"""

import os
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, Polygon, LineString
from shapely.validation import make_valid
import fiona

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, dataset_config, tiling_config, quality_config

class GeologyProcessor:
    """Processes geological vector data for ingestion pipeline"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('geology_processor')
        self.processed_files = []
        self.validation_results = {}
    
    def discover_sources(self, country_code: str) -> List[Dict[str, Any]]:
        """Discover geological data sources for a country"""
        sources = []
        
        # Local sources
        local_pattern = dataset_config.geology_sources['local'].format(
            LOCAL_DIR=os.getenv('LOCAL_DIR', './data'),
            country=country_code.lower()
        )
        
        for ext in dataset_config.geology_extensions:
            pattern = f"{local_pattern}{ext}"
            local_files = self.storage.files.find_files(pattern)
            
            for file_path in local_files:
                sources.append({
                    'type': 'local',
                    'path': str(file_path),
                    'country': country_code,
                    'format': ext.replace('.', ''),
                    'size_mb': self.storage.files.get_file_size_mb(file_path)
                })
        
        # S3 sources
        s3_prefix = dataset_config.geology_sources['s3'].format(
            S3_BUCKET=config.s3_bucket,
            country=country_code.lower()
        ).replace(f"{config.s3_bucket}/", "")
        
        s3_objects = self.storage.s3.list_objects(s3_prefix)
        
        for obj_key in s3_objects:
            if any(obj_key.endswith(ext) for ext in dataset_config.geology_extensions):
                sources.append({
                    'type': 's3',
                    'path': f"s3://{config.s3_bucket}/{obj_key}",
                    'country': country_code,
                    'format': Path(obj_key).suffix.replace('.', ''),
                    'size_mb': 0  # Would need additional S3 call to get size
                })
        
        self.logger.info(f"Discovered {len(sources)} geological sources for {country_code}")
        return sources
    
    def validate_geology_data(self, gdf: gpd.GeoDataFrame, source_info: Dict[str, Any]) -> Tuple[gpd.GeoDataFrame, Dict[str, Any]]:
        """Validate and clean geological vector data"""
        validation_report = {
            'source': source_info['path'],
            'original_count': len(gdf),
            'invalid_geometries': 0,
            'fixed_geometries': 0,
            'missing_attributes': 0,
            'warnings': [],
            'errors': []
        }
        
        # Check for required columns
        required_fields = ['geometry']
        missing_fields = [field for field in required_fields if field not in gdf.columns]
        
        if missing_fields:
            validation_report['errors'].append(f"Missing required fields: {missing_fields}")
            if config.halt_on_critical:
                raise ValueError(f"Critical validation error: Missing required fields {missing_fields}")
        
        # Validate geometries
        invalid_mask = ~gdf.geometry.is_valid
        invalid_count = invalid_mask.sum()
        
        if invalid_count > 0:
            validation_report['invalid_geometries'] = invalid_count
            validation_report['warnings'].append(f"Found {invalid_count} invalid geometries")
            
            if quality_config.fix_invalid_geometries:
                # Fix invalid geometries
                gdf.loc[invalid_mask, 'geometry'] = gdf.loc[invalid_mask, 'geometry'].apply(make_valid)
                validation_report['fixed_geometries'] = invalid_count
                self.logger.info(f"Fixed {invalid_count} invalid geometries")
        
        # Check for empty geometries
        empty_mask = gdf.geometry.is_empty
        empty_count = empty_mask.sum()
        
        if empty_count > 0:
            validation_report['warnings'].append(f"Found {empty_count} empty geometries")
            gdf = gdf[~empty_mask]  # Remove empty geometries
        
        # Validate CRS
        if gdf.crs is None:
            validation_report['warnings'].append("No CRS defined, assuming EPSG:4326")
            gdf.crs = 'EPSG:4326'
        
        # Check coordinate bounds (rough global bounds check)
        if quality_config.coordinate_bounds_check:
            bounds = gdf.total_bounds
            if not (-180 <= bounds[0] <= 180 and -180 <= bounds[2] <= 180 and
                   -90 <= bounds[1] <= 90 and -90 <= bounds[3] <= 90):
                validation_report['warnings'].append(f"Coordinates outside global bounds: {bounds}")
        
        validation_report['final_count'] = len(gdf)
        validation_report['validity_rate'] = (validation_report['final_count'] / validation_report['original_count']) * 100
        
        return gdf, validation_report
    
    def enrich_geology_data(self, gdf: gpd.GeoDataFrame, country_code: str, source_info: Dict[str, Any]) -> gpd.GeoDataFrame:
        """Enrich geological data with additional fields"""
        # Add standard fields
        gdf = gdf.copy()
        gdf['country_code'] = country_code
        gdf['data_source'] = source_info['path']
        gdf['collected_at'] = datetime.now()
        gdf['original_crs'] = str(gdf.crs) if gdf.crs else 'EPSG:4326'
        
        # Reproject to target CRS if needed
        if str(gdf.crs) != config.crs_target:
            original_crs = str(gdf.crs)
            gdf = gdf.to_crs(config.crs_target)
            self.logger.info(f"Reprojected from {original_crs} to {config.crs_target}")
        
        # Add geometry statistics
        gdf['geom_area'] = gdf.geometry.area
        gdf['geom_length'] = gdf.geometry.length
        
        # Standardize common geological fields
        geology_field_mapping = {
            'UNIT': 'unit',
            'LITHOLOGY': 'lithology', 
            'AGE': 'age_group',
            'FORMATION': 'formation',
            'ROCK_TYPE': 'rock_type'
        }
        
        for old_field, new_field in geology_field_mapping.items():
            if old_field in gdf.columns and new_field not in gdf.columns:
                gdf[new_field] = gdf[old_field]
        
        return gdf
    
    def write_vector_archive(self, gdf: gpd.GeoDataFrame, country_code: str) -> str:
        """Write vector data to GeoPackage archive in S3"""
        timestamp = datetime.now().strftime('%Y%m')
        s3_key = f"country/{country_code}/baseline/geology/{timestamp}/geology.gpkg"
        
        # Create temporary file
        temp_file = self.storage.files.create_temp_file('.gpkg')
        
        try:
            # Write to temporary GeoPackage
            gdf.to_file(temp_file, driver='GPKG')
            
            # Upload to S3
            success = self.storage.s3.upload_file(
                temp_file, 
                s3_key,
                metadata={
                    'country': country_code,
                    'data_type': 'geology',
                    'format': 'gpkg',
                    'crs': config.crs_target,
                    'record_count': str(len(gdf))
                }
            )
            
            if success:
                self.logger.info(f"Wrote geology archive to s3://{config.s3_bucket}/{s3_key}")
                return f"s3://{config.s3_bucket}/{s3_key}"
            else:
                raise Exception("Failed to upload to S3")
                
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def generate_mvt_tiles(self, gdf: gpd.GeoDataFrame, country_code: str) -> str:
        """Generate MVT tiles using tippecanoe"""
        import subprocess
        import json
        
        # Create temporary GeoJSON file
        temp_geojson = self.storage.files.create_temp_file('.geojson')
        temp_mbtiles = self.storage.files.create_temp_file('.mbtiles')
        
        try:
            # Write to GeoJSON
            gdf.to_file(temp_geojson, driver='GeoJSON')
            
            # Run tippecanoe
            cmd = [
                'tippecanoe',
                '-o', temp_mbtiles,
                '-l', 'geology',
                f'-z{tiling_config.mvt_maxzoom}',
                f'-Z{tiling_config.mvt_minzoom}',
                '--drop-densest-as-needed' if tiling_config.mvt_drop_densest else '--no-drop-densest-as-needed',
                '--no-tile-size-limit' if tiling_config.mvt_no_tile_size_limit else '',
                temp_geojson
            ]
            
            # Remove empty strings from command
            cmd = [arg for arg in cmd if arg]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f"Tippecanoe failed: {result.stderr}")
            
            # Extract tiles from mbtiles and upload to S3
            # This would require additional logic to extract individual MVT tiles
            # For now, we'll upload the mbtiles file
            
            s3_key = f"tiles/mbtiles/{country_code}/geology.mbtiles"
            success = self.storage.s3.upload_file(temp_mbtiles, s3_key)
            
            if success:
                self.logger.info(f"Generated MVT tiles for geology data: {country_code}")
                return f"s3://{config.s3_bucket}/{s3_key}"
            else:
                raise Exception("Failed to upload MVT tiles")
                
        except Exception as e:
            self.logger.error(f"Failed to generate MVT tiles", error=str(e))
            return ""
            
        finally:
            self.storage.files.cleanup_temp_file(temp_geojson)
            self.storage.files.cleanup_temp_file(temp_mbtiles)
    
    def write_to_postgis(self, gdf: gpd.GeoDataFrame, country_code: str) -> bool:
        """Write geological data to PostGIS"""
        table_name = f"geology_{country_code.lower()}"
        
        # Write to PostGIS
        success = self.storage.postgis.create_table_from_gdf(
            gdf, 
            table_name,
            add_rls_columns=True,
            org_id=config.org_id,
            project_id=config.project_id
        )
        
        if success:
            # Create spatial index
            self.storage.postgis.create_spatial_index(table_name)
            
            # Create attribute indexes
            if 'unit' in gdf.columns and 'age_group' in gdf.columns:
                self.storage.postgis.create_attribute_index(table_name, ['unit', 'age_group'])
            
            # Enable RLS
            self.storage.postgis.enable_rls(table_name)
            
            # Analyze table
            self.storage.postgis.analyze_table(table_name)
            
            self.logger.info(f"Successfully wrote geology data to PostGIS table: {table_name}")
        
        return success
    
    def create_stac_items(self, gdf: gpd.GeoDataFrame, country_code: str, 
                         archive_path: str, mvt_path: str) -> Dict[str, Any]:
        """Create STAC collection and items for geological data"""
        
        # Calculate bounds
        bounds = gdf.total_bounds.tolist()  # [minx, miny, maxx, maxy]
        
        # Create collection
        collection = {
            "type": "Collection",
            "stac_version": "1.0.0",
            "id": f"geology_{country_code.lower()}",
            "title": f"Geological Data - {config.country_codes.get(country_code, country_code)}",
            "description": f"Geological units and structures for {config.country_codes.get(country_code, country_code)}",
            "keywords": ["geology", "structures", "lithology", country_code.lower()],
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
                    "bbox": [bounds]
                },
                "temporal": {
                    "interval": [[None, None]]
                }
            },
            "summaries": {
                "country": [country_code],
                "data_type": ["geology"],
                "record_count": len(gdf)
            }
        }
        
        # Create item for the dataset
        item = {
            "type": "Feature",
            "stac_version": "1.0.0",
            "id": f"geology_{country_code.lower()}_{datetime.now().strftime('%Y%m%d')}",
            "collection": f"geology_{country_code.lower()}",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [bounds[0], bounds[1]],
                    [bounds[2], bounds[1]], 
                    [bounds[2], bounds[3]],
                    [bounds[0], bounds[3]],
                    [bounds[0], bounds[1]]
                ]]
            },
            "bbox": bounds,
            "properties": {
                "datetime": datetime.now().isoformat(),
                "country": country_code,
                "data_type": "geology",
                "record_count": len(gdf),
                "crs": config.crs_target
            },
            "assets": {
                "data": {
                    "href": archive_path,
                    "type": "application/geopackage+sqlite3",
                    "roles": ["data"],
                    "title": "Geological Vector Data"
                }
            }
        }
        
        if mvt_path:
            item["assets"]["tiles"] = {
                "href": mvt_path,
                "type": "application/vnd.mapbox-vector-tile",
                "roles": ["tiles"],
                "title": "Vector Tiles"
            }
        
        # Write STAC files to S3
        collection_key = f"stac/{country_code.lower()}/geology/collection.json"
        item_key = f"stac/{country_code.lower()}/geology/items/{item['id']}.json"
        
        self.storage.s3.upload_json(collection, collection_key)
        self.storage.s3.upload_json(item, item_key)
        
        return {
            "collection": collection,
            "item": item,
            "collection_path": f"s3://{config.s3_bucket}/{collection_key}",
            "item_path": f"s3://{config.s3_bucket}/{item_key}"
        }
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Process all geological data for a country"""
        start_time = time.time()
        
        self.logger.log_dataset_start('geology', country_code, 0)
        
        # Discover sources
        sources = self.discover_sources(country_code)
        
        if not sources:
            self.logger.warning(f"No geological sources found for {country_code}")
            return {
                'country': country_code,
                'status': 'no_sources',
                'sources_found': 0,
                'processing_time': time.time() - start_time
            }
        
        self.logger.log_dataset_start('geology', country_code, len(sources))
        
        # Process all sources and combine
        all_gdfs = []
        all_validations = []
        
        for source in sources:
            try:
                # Load data
                if source['type'] == 'local':
                    gdf = gpd.read_file(source['path'])
                else:  # S3
                    # Download to temp file first
                    temp_file = self.storage.files.create_temp_file(f".{source['format']}")
                    s3_key = source['path'].replace(f"s3://{config.s3_bucket}/", "")
                    
                    if self.storage.s3.download_file(s3_key, temp_file):
                        gdf = gpd.read_file(temp_file)
                        self.storage.files.cleanup_temp_file(temp_file)
                    else:
                        continue
                
                # Validate data
                gdf, validation = self.validate_geology_data(gdf, source)
                all_validations.append(validation)
                
                # Enrich data
                gdf = self.enrich_geology_data(gdf, country_code, source)
                
                all_gdfs.append(gdf)
                
            except Exception as e:
                self.logger.error(f"Failed to process source {source['path']}", error=str(e))
                continue
        
        if not all_gdfs:
            return {
                'country': country_code,
                'status': 'processing_failed',
                'sources_found': len(sources),
                'processing_time': time.time() - start_time
            }
        
        # Combine all data
        combined_gdf = gpd.GeoDataFrame(pd.concat(all_gdfs, ignore_index=True))
        
        # Write outputs
        try:
            # Vector archive
            archive_path = self.write_vector_archive(combined_gdf, country_code)
            
            # MVT tiles
            mvt_path = self.generate_mvt_tiles(combined_gdf, country_code)
            
            # PostGIS
            postgis_success = self.write_to_postgis(combined_gdf, country_code)
            
            # STAC
            stac_info = self.create_stac_items(combined_gdf, country_code, archive_path, mvt_path)
            
            processing_time = time.time() - start_time
            
            self.logger.log_dataset_complete('geology', country_code, len(combined_gdf), processing_time)
            
            return {
                'country': country_code,
                'status': 'success',
                'sources_found': len(sources),
                'sources_processed': len(all_gdfs),
                'total_records': len(combined_gdf),
                'processing_time': processing_time,
                'outputs': {
                    'archive_path': archive_path,
                    'mvt_path': mvt_path,
                    'postgis_table': f"geology_{country_code.lower()}",
                    'postgis_success': postgis_success,
                    'stac_collection': stac_info['collection_path'],
                    'stac_item': stac_info['item_path']
                },
                'validation_summary': {
                    'total_sources': len(all_validations),
                    'total_original_records': sum(v['original_count'] for v in all_validations),
                    'total_final_records': sum(v['final_count'] for v in all_validations),
                    'total_invalid_geometries': sum(v['invalid_geometries'] for v in all_validations),
                    'total_fixed_geometries': sum(v['fixed_geometries'] for v in all_validations)
                }
            }
            
        except Exception as e:
            self.logger.error(f"Failed to write outputs for {country_code}", error=str(e))
            return {
                'country': country_code,
                'status': 'output_failed',
                'sources_found': len(sources),
                'processing_time': time.time() - start_time,
                'error': str(e)
            }