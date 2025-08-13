"""
ESG/Environmental Data Processor
Handles environmental overlays, protected areas, and regulatory compliance data
"""

import os
import time
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon, LineString, MultiPolygon
from shapely.validation import make_valid
from shapely.ops import unary_union
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
import numpy as np
import tempfile

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, dataset_config, tiling_config, quality_config

class ESGProcessor:
    """Processes ESG/Environmental data for ingestion pipeline"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('esg_processor')
        self.processed_files = []
        self.validation_results = {}
        
        # ESG data categories and their processing requirements
        self.esg_categories = {
            'protected_areas': {
                'type': 'vector',
                'buffer_distances': [0, 1000, 5000, 10000],  # meters
                'risk_levels': ['prohibited', 'high_risk', 'medium_risk', 'low_risk'],
                'required_fields': ['name', 'protection_level', 'designation_date']
            },
            'water_bodies': {
                'type': 'vector',
                'buffer_distances': [0, 100, 500, 1000],
                'risk_levels': ['prohibited', 'high_risk', 'medium_risk', 'low_risk'],
                'required_fields': ['name', 'water_type', 'flow_rate']
            },
            'settlements': {
                'type': 'vector',
                'buffer_distances': [0, 500, 2000, 5000],
                'risk_levels': ['prohibited', 'high_risk', 'medium_risk', 'low_risk'],
                'required_fields': ['name', 'population', 'settlement_type']
            },
            'infrastructure': {
                'type': 'vector',
                'buffer_distances': [0, 100, 500, 1000],
                'risk_levels': ['prohibited', 'high_risk', 'medium_risk', 'low_risk'],
                'required_fields': ['name', 'infrastructure_type', 'status']
            },
            'slopes': {
                'type': 'raster',
                'thresholds': [15, 25, 35, 45],  # degrees
                'risk_levels': ['low_risk', 'medium_risk', 'high_risk', 'very_high_risk'],
                'source': 'derived_from_dem'
            },
            'permits': {
                'type': 'vector',
                'buffer_distances': [0],
                'risk_levels': ['permitted', 'pending', 'restricted', 'prohibited'],
                'required_fields': ['permit_id', 'permit_type', 'status', 'expiry_date']
            },
            'cultural_heritage': {
                'type': 'vector',
                'buffer_distances': [0, 500, 1000, 2000],
                'risk_levels': ['prohibited', 'high_risk', 'medium_risk', 'low_risk'],
                'required_fields': ['name', 'heritage_type', 'significance_level']
            },
            'biodiversity': {
                'type': 'vector',
                'buffer_distances': [0, 1000, 2000, 5000],
                'risk_levels': ['critical', 'high_risk', 'medium_risk', 'low_risk'],
                'required_fields': ['habitat_type', 'species_count', 'conservation_status']
            }
        }
        
        # Risk scoring weights
        self.risk_weights = {
            'protected_areas': 0.25,
            'water_bodies': 0.20,
            'settlements': 0.15,
            'slopes': 0.15,
            'cultural_heritage': 0.10,
            'biodiversity': 0.10,
            'infrastructure': 0.05
        }
    
    def discover_sources(self, country_code: str) -> List[Dict[str, Any]]:
        """Discover ESG/Environmental data sources for a country"""
        sources = []
        
        # Local sources
        local_pattern = dataset_config.esg_sources['local'].format(
            LOCAL_DIR=os.getenv('LOCAL_DIR', './data'),
            country=country_code.lower()
        )
        
        # Common file extensions for environmental data
        extensions = ['.shp', '.gpkg', '.geojson', '.tif', '.csv', '.xlsx']
        
        for ext in extensions:
            pattern = f"{local_pattern}{ext}"
            local_files = self.storage.files.find_files(pattern)
            
            for file_path in local_files:
                # Determine ESG category from filename
                esg_category = self._determine_esg_category(str(file_path))
                data_type = self._determine_data_type(str(file_path))
                
                sources.append({
                    'type': 'local',
                    'path': str(file_path),
                    'country': country_code,
                    'esg_category': esg_category,
                    'data_type': data_type,
                    'format': ext.replace('.', ''),
                    'size_mb': self.storage.files.get_file_size_mb(file_path)
                })
        
        # S3 sources
        s3_prefix = dataset_config.esg_sources['s3'].format(
            S3_BUCKET=config.s3_bucket,
            country=country_code.lower()
        ).replace(f"{config.s3_bucket}/", "")
        
        s3_objects = self.storage.s3.list_objects(s3_prefix)
        
        for obj_key in s3_objects:
            if any(obj_key.endswith(ext) for ext in extensions):
                esg_category = self._determine_esg_category(obj_key)
                data_type = self._determine_data_type(obj_key)
                
                sources.append({
                    'type': 's3',
                    'path': f"s3://{config.s3_bucket}/{obj_key}",
                    'country': country_code,
                    'esg_category': esg_category,
                    'data_type': data_type,
                    'format': Path(obj_key).suffix.replace('.', ''),
                    'size_mb': 0
                })
        
        self.logger.info(f"Discovered {len(sources)} ESG sources for {country_code}")
        return sources
    
    def _determine_esg_category(self, file_path: str) -> str:
        """Determine ESG category from file path or name"""
        path_lower = file_path.lower()
        
        # Check for category keywords
        for category in self.esg_categories.keys():
            category_keywords = {
                'protected_areas': ['protected', 'park', 'reserve', 'conservation', 'sanctuary'],
                'water_bodies': ['water', 'river', 'lake', 'stream', 'wetland', 'hydro'],
                'settlements': ['settlement', 'village', 'town', 'city', 'community', 'population'],
                'infrastructure': ['road', 'railway', 'power', 'pipeline', 'transmission', 'infrastructure'],
                'slopes': ['slope', 'gradient', 'terrain', 'topography'],
                'permits': ['permit', 'license', 'concession', 'mining_rights', 'exploration'],
                'cultural_heritage': ['heritage', 'cultural', 'archaeological', 'historical', 'sacred'],
                'biodiversity': ['biodiversity', 'habitat', 'species', 'ecosystem', 'wildlife', 'flora', 'fauna']
            }
            
            keywords = category_keywords.get(category, [category])
            if any(keyword in path_lower for keyword in keywords):
                return category
        
        return 'unknown'
    
    def _determine_data_type(self, file_path: str) -> str:
        """Determine if data is vector or raster"""
        ext = Path(file_path).suffix.lower()
        
        vector_extensions = ['.shp', '.gpkg', '.geojson', '.csv', '.xlsx']
        raster_extensions = ['.tif', '.tiff', '.img', '.jp2']
        
        if ext in vector_extensions:
            return 'vector'
        elif ext in raster_extensions:
            return 'raster'
        else:
            return 'unknown'
    
    def load_esg_data(self, file_path: str, data_type: str, file_format: str) -> Any:
        """Load ESG data from various formats"""
        try:
            if data_type == 'vector':
                if file_format in ['csv', 'xlsx']:
                    # Load tabular data and convert to spatial if coordinates exist
                    if file_format == 'csv':
                        df = pd.read_csv(file_path)
                    else:
                        df = pd.read_excel(file_path)
                    
                    # Check for coordinate columns
                    coord_cols = ['longitude', 'latitude', 'lon', 'lat', 'x', 'y', 'easting', 'northing']
                    x_col = None
                    y_col = None
                    
                    for col in df.columns:
                        col_lower = col.lower()
                        if any(coord in col_lower for coord in ['lon', 'x', 'east']):
                            x_col = col
                        elif any(coord in col_lower for coord in ['lat', 'y', 'north']):
                            y_col = col
                    
                    if x_col and y_col:
                        # Create GeoDataFrame from coordinates
                        geometry = [Point(x, y) for x, y in zip(df[x_col], df[y_col]) if pd.notna(x) and pd.notna(y)]
                        gdf = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')
                        return gdf
                    else:
                        return df
                else:
                    # Load spatial vector data
                    gdf = gpd.read_file(file_path)
                    return gdf
            
            elif data_type == 'raster':
                # Return file path for raster data (processed later)
                return file_path
            
            else:
                raise ValueError(f"Unknown data type: {data_type}")
                
        except Exception as e:
            self.logger.error(f"Failed to load {file_path}", error=str(e))
            raise
    
    def validate_esg_data(self, data: Any, esg_category: str, data_type: str, 
                         source_info: Dict[str, Any]) -> Tuple[Any, Dict[str, Any]]:
        """Validate ESG data based on category and type"""
        validation_report = {
            'source': source_info['path'],
            'esg_category': esg_category,
            'data_type': data_type,
            'original_count': 0,
            'missing_required_fields': [],
            'invalid_geometries': 0,
            'warnings': [],
            'errors': []
        }
        
        if esg_category not in self.esg_categories:
            validation_report['warnings'].append(f"Unknown ESG category: {esg_category}")
            return data, validation_report
        
        category_config = self.esg_categories[esg_category]
        
        if data_type == 'vector':
            if isinstance(data, gpd.GeoDataFrame):
                validation_report['original_count'] = len(data)
                
                # Check for required fields
                required_fields = category_config.get('required_fields', [])
                missing_fields = []
                
                for field in required_fields:
                    # Flexible field matching
                    found = False
                    for col in data.columns:
                        if field.lower() in col.lower() or col.lower() in field.lower():
                            found = True
                            break
                    
                    if not found:
                        missing_fields.append(field)
                
                if missing_fields:
                    validation_report['missing_required_fields'] = missing_fields
                    validation_report['warnings'].append(f"Missing recommended fields: {missing_fields}")
                
                # Validate geometries
                if 'geometry' in data.columns:
                    invalid_mask = ~data.geometry.is_valid
                    invalid_count = invalid_mask.sum()
                    
                    if invalid_count > 0:
                        validation_report['invalid_geometries'] = invalid_count
                        validation_report['warnings'].append(f"Found {invalid_count} invalid geometries")
                        
                        # Fix invalid geometries
                        data.loc[invalid_mask, 'geometry'] = data.loc[invalid_mask, 'geometry'].apply(make_valid)
                
                # Check for empty geometries
                if 'geometry' in data.columns:
                    empty_mask = data.geometry.is_empty
                    empty_count = empty_mask.sum()
                    
                    if empty_count > 0:
                        validation_report['warnings'].append(f"Found {empty_count} empty geometries")
                        data = data[~empty_mask]
                
            elif isinstance(data, pd.DataFrame):
                validation_report['original_count'] = len(data)
                validation_report['warnings'].append("Non-spatial data - consider adding coordinates")
        
        elif data_type == 'raster':
            # Validate raster data
            try:
                with rasterio.open(data) as src:
                    validation_report['original_count'] = src.width * src.height
                    
                    if src.crs is None:
                        validation_report['warnings'].append("No CRS defined for raster")
                    
                    # Check for reasonable bounds
                    bounds = src.bounds
                    if not (-180 <= bounds.left <= 180 and -180 <= bounds.right <= 180):
                        validation_report['warnings'].append("Raster bounds outside global extent")
                        
            except Exception as e:
                validation_report['errors'].append(f"Failed to validate raster: {str(e)}")
        
        validation_report['final_count'] = validation_report['original_count']
        validation_report['validity_rate'] = 100.0  # Assume valid after processing
        
        return data, validation_report
    
    def enrich_esg_data(self, data: Any, esg_category: str, data_type: str,
                       country_code: str, source_info: Dict[str, Any]) -> Any:
        """Enrich ESG data with additional fields and risk assessments"""
        
        if data_type == 'vector' and isinstance(data, gpd.GeoDataFrame):
            # Add standard metadata
            data = data.copy()
            data['country_code'] = country_code
            data['esg_category'] = esg_category
            data['data_source'] = source_info['path']
            data['ingested_at'] = datetime.now()
            
            # Reproject to target CRS if needed
            if data.crs != config.crs_target:
                original_crs = str(data.crs)
                data = data.to_crs(config.crs_target)
                data['original_crs'] = original_crs
            
            # Add category-specific enrichment
            if esg_category == 'protected_areas':
                data = self._enrich_protected_areas(data)
            elif esg_category == 'water_bodies':
                data = self._enrich_water_bodies(data)
            elif esg_category == 'settlements':
                data = self._enrich_settlements(data)
            elif esg_category == 'infrastructure':
                data = self._enrich_infrastructure(data)
            elif esg_category == 'permits':
                data = self._enrich_permits(data)
            elif esg_category == 'cultural_heritage':
                data = self._enrich_cultural_heritage(data)
            elif esg_category == 'biodiversity':
                data = self._enrich_biodiversity(data)
            
            # Calculate area for polygon features
            if data.geometry.geom_type.iloc[0] in ['Polygon', 'MultiPolygon']:
                data['area_km2'] = data.geometry.area / 1e6  # Convert to km²
            
        return data
    
    def _enrich_protected_areas(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Enrich protected areas data"""
        # Standardize protection levels
        if 'protection_level' in gdf.columns:
            protection_mapping = {
                'strict': 'I', 'wilderness': 'Ib', 'national_park': 'II',
                'natural_monument': 'III', 'habitat_management': 'IV',
                'landscape': 'V', 'sustainable_use': 'VI'
            }
            
            gdf['iucn_category'] = gdf['protection_level'].apply(
                lambda x: protection_mapping.get(str(x).lower(), 'Unknown') if pd.notna(x) else 'Unknown'
            )
        
        # Calculate protection priority score
        priority_scores = {'I': 5, 'Ib': 5, 'II': 4, 'III': 3, 'IV': 3, 'V': 2, 'VI': 1}
        gdf['protection_priority'] = gdf.get('iucn_category', 'Unknown').map(priority_scores).fillna(0)
        
        return gdf
    
    def _enrich_water_bodies(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Enrich water bodies data"""
        # Standardize water types
        if 'water_type' in gdf.columns:
            water_type_mapping = {
                'river': 'flowing', 'stream': 'flowing', 'creek': 'flowing',
                'lake': 'standing', 'pond': 'standing', 'reservoir': 'standing',
                'wetland': 'wetland', 'marsh': 'wetland', 'swamp': 'wetland'
            }
            
            gdf['water_category'] = gdf['water_type'].apply(
                lambda x: water_type_mapping.get(str(x).lower(), 'other') if pd.notna(x) else 'other'
            )
        
        # Calculate water sensitivity score
        sensitivity_scores = {'flowing': 4, 'wetland': 5, 'standing': 3, 'other': 2}
        gdf['water_sensitivity'] = gdf.get('water_category', 'other').map(sensitivity_scores).fillna(2)
        
        return gdf
    
    def _enrich_settlements(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Enrich settlements data"""
        # Categorize by population size
        if 'population' in gdf.columns:
            gdf['population'] = pd.to_numeric(gdf['population'], errors='coerce')
            gdf['settlement_size'] = pd.cut(
                gdf['population'],
                bins=[0, 1000, 10000, 100000, float('inf')],
                labels=['small', 'medium', 'large', 'major']
            )
        
        # Calculate social impact score
        size_scores = {'small': 1, 'medium': 2, 'large': 3, 'major': 4}
        gdf['social_impact_score'] = gdf.get('settlement_size', 'small').map(size_scores).fillna(1)
        
        return gdf
    
    def _enrich_infrastructure(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Enrich infrastructure data"""
        # Standardize infrastructure types
        if 'infrastructure_type' in gdf.columns:
            infra_mapping = {
                'road': 'transport', 'railway': 'transport', 'airport': 'transport',
                'power_line': 'energy', 'substation': 'energy', 'pipeline': 'energy',
                'water_treatment': 'utilities', 'waste_facility': 'utilities'
            }
            
            gdf['infra_category'] = gdf['infrastructure_type'].apply(
                lambda x: infra_mapping.get(str(x).lower(), 'other') if pd.notna(x) else 'other'
            )
        
        # Calculate infrastructure importance
        importance_scores = {'energy': 4, 'transport': 3, 'utilities': 3, 'other': 2}
        gdf['importance_score'] = gdf.get('infra_category', 'other').map(importance_scores).fillna(2)
        
        return gdf
    
    def _enrich_permits(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Enrich permits data"""
        # Parse expiry dates
        if 'expiry_date' in gdf.columns:
            gdf['expiry_date'] = pd.to_datetime(gdf['expiry_date'], errors='coerce')
            gdf['days_to_expiry'] = (gdf['expiry_date'] - datetime.now()).dt.days
            gdf['permit_status_derived'] = gdf['days_to_expiry'].apply(
                lambda x: 'expired' if pd.notna(x) and x < 0 else
                         'expiring_soon' if pd.notna(x) and x < 90 else
                         'active' if pd.notna(x) else 'unknown'
            )
        
        return gdf
    
    def _enrich_cultural_heritage(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Enrich cultural heritage data"""
        # Standardize significance levels
        if 'significance_level' in gdf.columns:
            significance_mapping = {
                'world': 5, 'national': 4, 'regional': 3, 'local': 2, 'minor': 1
            }
            
            gdf['heritage_priority'] = gdf['significance_level'].apply(
                lambda x: significance_mapping.get(str(x).lower(), 2) if pd.notna(x) else 2
            )
        
        return gdf
    
    def _enrich_biodiversity(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Enrich biodiversity data"""
        # Standardize conservation status
        if 'conservation_status' in gdf.columns:
            status_mapping = {
                'critical': 5, 'endangered': 4, 'vulnerable': 3, 'near_threatened': 2, 'least_concern': 1
            }
            
            gdf['conservation_priority'] = gdf['conservation_status'].apply(
                lambda x: status_mapping.get(str(x).lower(), 1) if pd.notna(x) else 1
            )
        
        return gdf
    
    def generate_buffer_zones(self, gdf: gpd.GeoDataFrame, esg_category: str) -> gpd.GeoDataFrame:
        """Generate buffer zones for ESG features"""
        if esg_category not in self.esg_categories:
            return gdf
        
        category_config = self.esg_categories[esg_category]
        buffer_distances = category_config.get('buffer_distances', [0])
        risk_levels = category_config.get('risk_levels', ['unknown'])
        
        # Create buffer zones
        buffer_gdfs = []
        
        for i, distance in enumerate(buffer_distances):
            if distance == 0:
                # Original features
                buffer_gdf = gdf.copy()
                buffer_gdf['buffer_distance'] = 0
                buffer_gdf['risk_level'] = risk_levels[min(i, len(risk_levels)-1)]
            else:
                # Buffered features
                buffer_gdf = gdf.copy()
                buffer_gdf['geometry'] = gdf.geometry.buffer(distance)
                buffer_gdf['buffer_distance'] = distance
                buffer_gdf['risk_level'] = risk_levels[min(i, len(risk_levels)-1)]
            
            buffer_gdfs.append(buffer_gdf)
        
        # Combine all buffer zones
        combined_gdf = gpd.GeoDataFrame(pd.concat(buffer_gdfs, ignore_index=True))
        
        return combined_gdf
    
    def create_risk_heatmap(self, gdf: gpd.GeoDataFrame, esg_category: str, 
                           bounds: Tuple[float, float, float, float], 
                           resolution: float = 100) -> str:
        """Create raster heatmap from vector ESG data"""
        
        # Calculate raster dimensions
        width = int((bounds[2] - bounds[0]) / resolution)
        height = int((bounds[3] - bounds[1]) / resolution)
        
        # Create transform
        transform = from_bounds(bounds[0], bounds[1], bounds[2], bounds[3], width, height)
        
        # Assign risk scores based on category
        risk_score_mapping = {
            'prohibited': 5, 'critical': 5, 'very_high_risk': 4,
            'high_risk': 3, 'medium_risk': 2, 'low_risk': 1, 'permitted': 0
        }
        
        gdf['risk_score'] = gdf.get('risk_level', 'low_risk').map(risk_score_mapping).fillna(1)
        
        # Rasterize the vector data
        shapes = [(geom, score) for geom, score in zip(gdf.geometry, gdf.risk_score)]
        
        raster = rasterize(
            shapes,
            out_shape=(height, width),
            transform=transform,
            fill=0,
            dtype=rasterio.uint8
        )
        
        # Write raster to temporary file
        temp_file = self.storage.files.create_temp_file('.tif')
        
        with rasterio.open(
            temp_file, 'w',
            driver='GTiff',
            height=height, width=width,
            count=1, dtype=rasterio.uint8,
            crs=config.crs_target,
            transform=transform,
            compress='deflate'
        ) as dst:
            dst.write(raster, 1)
        
        return temp_file
    
    def generate_mvt_tiles(self, gdf: gpd.GeoDataFrame, esg_category: str, country_code: str) -> str:
        """Generate MVT tiles for ESG vector data"""
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
                '-l', f'esg_{esg_category}',
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
            
            # Upload mbtiles to S3
            s3_key = f"tiles/mbtiles/{country_code}/esg_{esg_category}.mbtiles"
            success = self.storage.s3.upload_file(temp_mbtiles, s3_key)
            
            if success:
                self.logger.info(f"Generated MVT tiles for {esg_category}: {country_code}")
                return f"s3://{config.s3_bucket}/{s3_key}"
            else:
                raise Exception("Failed to upload MVT tiles")
                
        except Exception as e:
            self.logger.error(f"Failed to generate MVT tiles for {esg_category}", error=str(e))
            return ""
            
        finally:
            self.storage.files.cleanup_temp_file(temp_geojson)
            self.storage.files.cleanup_temp_file(temp_mbtiles)
    
    def write_to_postgis(self, gdf: gpd.GeoDataFrame, esg_category: str, country_code: str) -> bool:
        """Write ESG data to PostGIS"""
        table_name = f"esg_{esg_category}_{country_code.lower()}"
        
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
            index_columns = ['esg_category', 'risk_level']
            if 'buffer_distance' in gdf.columns:
                index_columns.append('buffer_distance')
            
            self.storage.postgis.create_attribute_index(table_name, index_columns)
            
            # Enable RLS
            self.storage.postgis.enable_rls(table_name)
            
            # Analyze table
            self.storage.postgis.analyze_table(table_name)
            
            self.logger.info(f"Successfully wrote {esg_category} data to PostGIS table: {table_name}")
        
        return success
    
    def create_stac_items(self, processed_data: Dict[str, Any], country_code: str) -> Dict[str, Any]:
        """Create STAC collection and items for ESG data"""
        
        # Calculate combined bounds from all categories
        all_bounds = []
        
        for category_data in processed_data.values():
            if 'bounds' in category_data:
                all_bounds.append(category_data['bounds'])
        
        if not all_bounds:
            # Default global bounds
            union_bounds = [-180, -90, 180, 90]
        else:
            # Calculate union of all bounds
            min_x = min(bounds[0] for bounds in all_bounds)
            min_y = min(bounds[1] for bounds in all_bounds)
            max_x = max(bounds[2] for bounds in all_bounds)
            max_y = max(bounds[3] for bounds in all_bounds)
            union_bounds = [min_x, min_y, max_x, max_y]
        
        # Create collection
        collection = {
            "type": "Collection",
            "stac_version": "1.0.0",
            "id": f"esg_{country_code.lower()}",
            "title": f"ESG/Environmental Data - {config.country_codes.get(country_code, country_code)}",
            "description": f"Environmental, Social, and Governance data for {config.country_codes.get(country_code, country_code)}",
            "keywords": ["esg", "environmental", "social", "governance", "sustainability", "compliance"] + [country_code.lower()],
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
                "data_type": ["esg"],
                "categories": list(processed_data.keys())
            }
        }
        
        # Create items for each category
        items = []
        
        for category, category_data in processed_data.items():
            if 'vector_path' not in category_data:
                continue
            
            item = {
                "type": "Feature",
                "stac_version": "1.0.0",
                "id": f"esg_{category}_{country_code.lower()}_{datetime.now().strftime('%Y%m%d')}",
                "collection": f"esg_{country_code.lower()}",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [union_bounds[0], union_bounds[1]],
                        [union_bounds[2], union_bounds[1]],
                        [union_bounds[2], union_bounds[3]],
                        [union_bounds[0], union_bounds[3]],
                        [union_bounds[0], union_bounds[1]]
                    ]]
                },
                "bbox": union_bounds,
                "properties": {
                    "datetime": datetime.now().isoformat(),
                    "country": country_code,
                    "data_type": "esg",
                    "esg_category": category,
                    "feature_count": category_data.get('feature_count', 0),
                    "crs": config.crs_target
                },
                "assets": {
                    "data": {
                        "href": category_data['vector_path'],
                        "type": "application/geopackage+sqlite3",
                        "roles": ["data"],
                        "title": f"ESG {category.replace('_', ' ').title()} Data"
                    }
                }
            }
            
            # Add tiles asset if available
            if 'mvt_path' in category_data and category_data['mvt_path']:
                item["assets"]["tiles"] = {
                    "href": category_data['mvt_path'],
                    "type": "application/vnd.mapbox-vector-tile",
                    "roles": ["tiles"],
                    "title": "Vector Tiles"
                }
            
            # Add heatmap asset if available
            if 'heatmap_path' in category_data and category_data['heatmap_path']:
                item["assets"]["heatmap"] = {
                    "href": category_data['heatmap_path'],
                    "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                    "roles": ["data"],
                    "title": "Risk Heatmap"
                }
            
            items.append(item)
        
        # Write STAC files to S3
        collection_key = f"stac/{country_code.lower()}/esg/collection.json"
        self.storage.s3.upload_json(collection, collection_key)
        
        item_paths = []
        for item in items:
            item_key = f"stac/{country_code.lower()}/esg/items/{item['id']}.json"
            self.storage.s3.upload_json(item, item_key)
            item_paths.append(f"s3://{config.s3_bucket}/{item_key}")
        
        return {
            "collection": collection,
            "items": items,
            "collection_path": f"s3://{config.s3_bucket}/{collection_key}",
            "item_paths": item_paths
        }
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Process all ESG/Environmental data for a country"""
        start_time = time.time()
        
        # Discover sources
        sources = self.discover_sources(country_code)
        
        if not sources:
            self.logger.warning(f"No ESG sources found for {country_code}")
            return {
                'country': country_code,
                'status': 'no_sources',
                'sources_found': 0,
                'processing_time': time.time() - start_time
            }
        
        self.logger.log_dataset_start('esg', country_code, len(sources))
        
        # Group sources by ESG category
        sources_by_category = {}
        for source in sources:
            category = source['esg_category']
            if category == 'unknown':
                self.logger.warning(f"Skipping unknown ESG category: {source['path']}")
                continue
            
            if category not in sources_by_category:
                sources_by_category[category] = []
            sources_by_category[category].append(source)
        
        # Process each ESG category
        processed_data = {}
        all_validations = []
        
        for category, category_sources in sources_by_category.items():
            try:
                category_result = self._process_esg_category(country_code, category, category_sources)
                processed_data[category] = category_result
                
                # Collect validation results
                if 'validations' in category_result:
                    all_validations.extend(category_result['validations'])
                
            except Exception as e:
                self.logger.error(f"Failed to process {category} for {country_code}", error=str(e))
                processed_data[category] = {
                    'status': 'failed',
                    'error': str(e)
                }
        
        # Create STAC items
        stac_info = None
        if processed_data:
            try:
                stac_info = self.create_stac_items(processed_data, country_code)
            except Exception as e:
                self.logger.error(f"Failed to create STAC items for ESG data", error=str(e))
        
        processing_time = time.time() - start_time
        
        # Count total features
        total_features = sum(
            cat_data.get('feature_count', 0) 
            for cat_data in processed_data.values() 
            if isinstance(cat_data, dict)
        )
        
        self.logger.log_dataset_complete('esg', country_code, total_features, processing_time)
        
        return {
            'country': country_code,
            'status': 'success',
            'sources_found': len(sources),
            'categories_processed': list(processed_data.keys()),
            'total_features': total_features,
            'processing_time': processing_time,
            'outputs': {
                'categories': processed_data,
                'stac_collection': stac_info['collection_path'] if stac_info else None,
                'stac_items': stac_info['item_paths'] if stac_info else []
            },
            'validation_summary': {
                'total_sources': len(all_validations),
                'total_original_features': sum(v['original_count'] for v in all_validations),
                'total_final_features': sum(v['final_count'] for v in all_validations),
                'categories_with_data': list(processed_data.keys())
            }
        }
    
    def _process_esg_category(self, country_code: str, category: str, 
                             sources: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process sources for a specific ESG category"""
        
        category_gdfs = []
        validations = []
        
        for source in sources:
            try:
                # Load data
                if source['type'] == 'local':
                    data = self.load_esg_data(source['path'], source['data_type'], source['format'])
                else:  # S3
                    temp_file = self.storage.files.create_temp_file(f".{source['format']}")
                    s3_key = source['path'].replace(f"s3://{config.s3_bucket}/", "")
                    
                    if not self.storage.s3.download_file(s3_key, temp_file):
                        continue
                    
                    data = self.load_esg_data(temp_file, source['data_type'], source['format'])
                    self.storage.files.cleanup_temp_file(temp_file)
                
                # Skip raster data for now (would need separate processing)
                if source['data_type'] == 'raster':
                    continue
                
                # Validate data
                data_clean, validation = self.validate_esg_data(data, category, source['data_type'], source)
                validations.append(validation)
                
                # Enrich data
                if isinstance(data_clean, gpd.GeoDataFrame):
                    data_enriched = self.enrich_esg_data(data_clean, category, source['data_type'], country_code, source)
                    category_gdfs.append(data_enriched)
                
            except Exception as e:
                self.logger.error(f"Failed to process ESG source {source['path']}", error=str(e))
                continue
        
        if not category_gdfs:
            return {
                'status': 'no_valid_data',
                'validations': validations
            }
        
        # Combine all data for this category
        combined_gdf = gpd.GeoDataFrame(pd.concat(category_gdfs, ignore_index=True))
        
        # Generate buffer zones
        buffered_gdf = self.generate_buffer_zones(combined_gdf, category)
        
        # Calculate bounds
        bounds = buffered_gdf.total_bounds.tolist()
        
        # Write vector archive to S3
        timestamp = datetime.now().strftime('%Y%m')
        vector_s3_key = f"country/{country_code}/baseline/esg/{category}/{timestamp}/{category}.gpkg"
        
        temp_gpkg = self.storage.files.create_temp_file('.gpkg')
        
        try:
            buffered_gdf.to_file(temp_gpkg, driver='GPKG')
            
            success = self.storage.s3.upload_file(
                temp_gpkg,
                vector_s3_key,
                metadata={
                    'country': country_code,
                    'data_type': 'esg',
                    'esg_category': category,
                    'format': 'gpkg',
                    'feature_count': str(len(buffered_gdf))
                }
            )
            
            if not success:
                raise Exception("Failed to upload vector data")
            
            vector_path = f"s3://{config.s3_bucket}/{vector_s3_key}"
            
        finally:
            self.storage.files.cleanup_temp_file(temp_gpkg)
        
        # Generate MVT tiles
        mvt_path = self.generate_mvt_tiles(buffered_gdf, category, country_code)
        
        # Create risk heatmap
        heatmap_path = None
        try:
            temp_heatmap = self.create_risk_heatmap(buffered_gdf, category, bounds)
            
            # Convert to COG and upload
            heatmap_cog = self.storage.files.create_temp_file('.tif')
            
            cmd = [
                'gdal_translate',
                '-of', 'COG',
                '-co', 'COMPRESS=DEFLATE',
                '-co', 'BLOCKSIZE=512',
                temp_heatmap,
                heatmap_cog
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                heatmap_s3_key = f"country/{country_code}/baseline/esg/{category}/{timestamp}/{category}_heatmap.tif"
                
                success = self.storage.s3.upload_file(heatmap_cog, heatmap_s3_key)
                
                if success:
                    heatmap_path = f"s3://{config.s3_bucket}/{heatmap_s3_key}"
            
            self.storage.files.cleanup_temp_file(temp_heatmap)
            self.storage.files.cleanup_temp_file(heatmap_cog)
            
        except Exception as e:
            self.logger.warning(f"Failed to create heatmap for {category}", error=str(e))
        
        # Write to PostGIS
        postgis_success = self.write_to_postgis(buffered_gdf, category, country_code)
        
        return {
            'status': 'success',
            'feature_count': len(buffered_gdf),
            'bounds': bounds,
            'vector_path': vector_path,
            'mvt_path': mvt_path,
            'heatmap_path': heatmap_path,
            'postgis_table': f"esg_{category}_{country_code.lower()}",
            'postgis_success': postgis_success,
            'validations': validations
        }