"""
STAC Validator
Validates STAC (SpatioTemporal Asset Catalog) metadata compliance
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime
import jsonschema
from jsonschema import validate, ValidationError
import requests
from urllib.parse import urlparse
import tempfile

from .core.logger import get_logger
from .core.storage import StorageManager
from .config import config

class STACValidator:
    """Validates STAC catalogs, collections, and items for compliance"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('stac_validator')
        
        # STAC version and schemas
        self.stac_version = "1.0.0"
        self.schema_urls = {
            'catalog': f'https://schemas.stacspec.org/v{self.stac_version}/catalog-spec/json-schema/catalog.json',
            'collection': f'https://schemas.stacspec.org/v{self.stac_version}/collection-spec/json-schema/collection.json',
            'item': f'https://schemas.stacspec.org/v{self.stac_version}/item-spec/json-schema/item.json'
        }
        
        # Cache for downloaded schemas
        self.schemas = {}
        
        # STAC extensions we support
        self.supported_extensions = {
            'eo': 'https://stac-extensions.github.io/eo/v1.1.0/schema.json',
            'projection': 'https://stac-extensions.github.io/projection/v1.1.0/schema.json',
            'scientific': 'https://stac-extensions.github.io/scientific/v1.0.0/schema.json',
            'processing': 'https://stac-extensions.github.io/processing/v1.1.0/schema.json'
        }
        
        # Validation rules
        self.validation_rules = {
            'required_fields': {
                'catalog': ['type', 'stac_version', 'id', 'description', 'links'],
                'collection': ['type', 'stac_version', 'id', 'description', 'license', 'extent', 'links'],
                'item': ['type', 'stac_version', 'id', 'geometry', 'bbox', 'properties', 'links', 'assets']
            },
            'field_types': {
                'id': str,
                'stac_version': str,
                'description': str,
                'bbox': list,
                'geometry': dict,
                'properties': dict,
                'assets': dict,
                'links': list
            },
            'bbox_constraints': {
                'length': 4,  # [minx, miny, maxx, maxy]
                'longitude_range': [-180, 180],
                'latitude_range': [-90, 90]
            },
            'datetime_format': r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$',
            'url_pattern': r'^https?://[^\s/$.?#].[^\s]*$'
        }
        
        # Geoscience-specific validation rules
        self.geoscience_rules = {
            'geology': {
                'required_properties': ['country', 'data_type'],
                'valid_data_types': ['geology', 'structures', 'lithology'],
                'required_assets': ['data']
            },
            'geophysics': {
                'required_properties': ['country', 'data_type', 'geophysics_type'],
                'valid_geophysics_types': ['magnetics', 'gravity', 'radiometrics'],
                'required_assets': ['data']
            },
            'dem': {
                'required_properties': ['country', 'data_type', 'product_type'],
                'valid_product_types': ['dem', 'slope', 'curvature', 'hillshade'],
                'required_assets': ['data']
            },
            'satellite': {
                'required_properties': ['country', 'data_type', 'product_type'],
                'valid_product_types': ['composite', 'ndvi', 'ndwi', 'nbr', 'ferric', 'ferrous'],
                'required_assets': ['data']
            },
            'geochem': {
                'required_properties': ['country', 'data_type', 'sample_count'],
                'required_assets': ['data']
            },
            'drillhole': {
                'required_properties': ['country', 'data_type', 'table_type'],
                'valid_table_types': ['collars', 'surveys', 'intervals', 'assays'],
                'required_assets': ['data']
            },
            'esg': {
                'required_properties': ['country', 'data_type', 'esg_category'],
                'valid_esg_categories': ['protected_areas', 'water_bodies', 'settlements', 'infrastructure'],
                'required_assets': ['data']
            }
        }
    
    def validate_stac_catalog(self, catalog_path: str) -> Dict[str, Any]:
        """Validate a complete STAC catalog"""
        
        self.logger.info(f"Validating STAC catalog: {catalog_path}")
        
        validation_result = {
            'catalog_path': catalog_path,
            'valid': True,
            'errors': [],
            'warnings': [],
            'collections_validated': 0,
            'items_validated': 0,
            'validation_summary': {
                'total_objects': 0,
                'valid_objects': 0,
                'objects_with_errors': 0,
                'objects_with_warnings': 0
            }
        }
        
        try:
            # Load and validate root catalog
            catalog_data = self._load_stac_object(catalog_path)
            
            if catalog_data:
                catalog_validation = self.validate_catalog(catalog_data, catalog_path)
                validation_result['errors'].extend(catalog_validation['errors'])
                validation_result['warnings'].extend(catalog_validation['warnings'])
                validation_result['validation_summary']['total_objects'] += 1
                
                if catalog_validation['valid']:
                    validation_result['validation_summary']['valid_objects'] += 1
                else:
                    validation_result['validation_summary']['objects_with_errors'] += 1
                
                # Validate collections and items
                collections_result = self._validate_catalog_collections(catalog_data, catalog_path)
                validation_result['collections_validated'] = collections_result['collections_validated']
                validation_result['items_validated'] = collections_result['items_validated']
                validation_result['errors'].extend(collections_result['errors'])
                validation_result['warnings'].extend(collections_result['warnings'])
                
                # Update summary
                validation_result['validation_summary']['total_objects'] += collections_result['total_objects']
                validation_result['validation_summary']['valid_objects'] += collections_result['valid_objects']
                validation_result['validation_summary']['objects_with_errors'] += collections_result['objects_with_errors']
                validation_result['validation_summary']['objects_with_warnings'] += collections_result['objects_with_warnings']
            
            # Determine overall validity
            validation_result['valid'] = len(validation_result['errors']) == 0
            
            self.logger.info(f"Catalog validation complete: {validation_result['valid']}")
            
        except Exception as e:
            error_msg = f"Failed to validate catalog {catalog_path}: {str(e)}"
            self.logger.error(error_msg)
            validation_result['valid'] = False
            validation_result['errors'].append(error_msg)
        
        return validation_result
    
    def validate_collection(self, collection_data: Dict[str, Any], 
                          collection_path: str = "") -> Dict[str, Any]:
        """Validate a STAC collection"""
        
        validation_result = {
            'type': 'collection',
            'path': collection_path,
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Schema validation
            schema_validation = self._validate_against_schema(collection_data, 'collection')
            validation_result['errors'].extend(schema_validation['errors'])
            validation_result['warnings'].extend(schema_validation['warnings'])
            
            # STAC-specific validation
            stac_validation = self._validate_stac_fields(collection_data, 'collection')
            validation_result['errors'].extend(stac_validation['errors'])
            validation_result['warnings'].extend(stac_validation['warnings'])
            
            # Geoscience-specific validation
            if 'summaries' in collection_data and 'data_type' in collection_data['summaries']:
                data_types = collection_data['summaries']['data_type']
                if isinstance(data_types, list) and len(data_types) > 0:
                    data_type = data_types[0]
                    geo_validation = self._validate_geoscience_collection(collection_data, data_type)
                    validation_result['errors'].extend(geo_validation['errors'])
                    validation_result['warnings'].extend(geo_validation['warnings'])
            
            # Extent validation
            extent_validation = self._validate_extent(collection_data.get('extent', {}))
            validation_result['errors'].extend(extent_validation['errors'])
            validation_result['warnings'].extend(extent_validation['warnings'])
            
            validation_result['valid'] = len(validation_result['errors']) == 0
            
        except Exception as e:
            error_msg = f"Collection validation failed: {str(e)}"
            validation_result['errors'].append(error_msg)
            validation_result['valid'] = False
        
        return validation_result
    
    def validate_item(self, item_data: Dict[str, Any], 
                     item_path: str = "") -> Dict[str, Any]:
        """Validate a STAC item"""
        
        validation_result = {
            'type': 'item',
            'path': item_path,
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Schema validation
            schema_validation = self._validate_against_schema(item_data, 'item')
            validation_result['errors'].extend(schema_validation['errors'])
            validation_result['warnings'].extend(schema_validation['warnings'])
            
            # STAC-specific validation
            stac_validation = self._validate_stac_fields(item_data, 'item')
            validation_result['errors'].extend(stac_validation['errors'])
            validation_result['warnings'].extend(stac_validation['warnings'])
            
            # Geometry and bbox validation
            geometry_validation = self._validate_geometry_bbox(item_data)
            validation_result['errors'].extend(geometry_validation['errors'])
            validation_result['warnings'].extend(geometry_validation['warnings'])
            
            # Properties validation
            properties_validation = self._validate_properties(item_data.get('properties', {}))
            validation_result['errors'].extend(properties_validation['errors'])
            validation_result['warnings'].extend(properties_validation['warnings'])
            
            # Assets validation
            assets_validation = self._validate_assets(item_data.get('assets', {}))
            validation_result['errors'].extend(assets_validation['errors'])
            validation_result['warnings'].extend(assets_validation['warnings'])
            
            # Geoscience-specific validation
            if 'properties' in item_data and 'data_type' in item_data['properties']:
                data_type = item_data['properties']['data_type']
                geo_validation = self._validate_geoscience_item(item_data, data_type)
                validation_result['errors'].extend(geo_validation['errors'])
                validation_result['warnings'].extend(geo_validation['warnings'])
            
            validation_result['valid'] = len(validation_result['errors']) == 0
            
        except Exception as e:
            error_msg = f"Item validation failed: {str(e)}"
            validation_result['errors'].append(error_msg)
            validation_result['valid'] = False
        
        return validation_result
    
    def validate_catalog(self, catalog_data: Dict[str, Any], 
                        catalog_path: str = "") -> Dict[str, Any]:
        """Validate a STAC catalog"""
        
        validation_result = {
            'type': 'catalog',
            'path': catalog_path,
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Schema validation
            schema_validation = self._validate_against_schema(catalog_data, 'catalog')
            validation_result['errors'].extend(schema_validation['errors'])
            validation_result['warnings'].extend(schema_validation['warnings'])
            
            # STAC-specific validation
            stac_validation = self._validate_stac_fields(catalog_data, 'catalog')
            validation_result['errors'].extend(stac_validation['errors'])
            validation_result['warnings'].extend(stac_validation['warnings'])
            
            # Links validation
            links_validation = self._validate_links(catalog_data.get('links', []))
            validation_result['errors'].extend(links_validation['errors'])
            validation_result['warnings'].extend(links_validation['warnings'])
            
            validation_result['valid'] = len(validation_result['errors']) == 0
            
        except Exception as e:
            error_msg = f"Catalog validation failed: {str(e)}"
            validation_result['errors'].append(error_msg)
            validation_result['valid'] = False
        
        return validation_result   
 
    def _load_stac_object(self, stac_path: str) -> Optional[Dict[str, Any]]:
        """Load STAC object from S3 or local path"""
        
        try:
            if stac_path.startswith('s3://'):
                # Load from S3
                s3_key = stac_path.replace(f"s3://{config.s3_bucket}/", "")
                temp_file = self.storage.files.create_temp_file('.json')
                
                if self.storage.s3.download_file(s3_key, temp_file):
                    with open(temp_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self.storage.files.cleanup_temp_file(temp_file)
                    return data
                else:
                    self.logger.error(f"Failed to download STAC object from {stac_path}")
                    return None
            
            else:
                # Load from local path
                with open(stac_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
                    
        except Exception as e:
            self.logger.error(f"Failed to load STAC object {stac_path}", error=str(e))
            return None
    
    def _get_schema(self, schema_type: str) -> Optional[Dict[str, Any]]:
        """Get STAC schema, downloading if necessary"""
        
        if schema_type in self.schemas:
            return self.schemas[schema_type]
        
        try:
            schema_url = self.schema_urls.get(schema_type)
            if not schema_url:
                self.logger.error(f"Unknown schema type: {schema_type}")
                return None
            
            # Download schema
            response = requests.get(schema_url, timeout=30)
            response.raise_for_status()
            
            schema = response.json()
            self.schemas[schema_type] = schema
            
            self.logger.info(f"Downloaded STAC schema: {schema_type}")
            return schema
            
        except Exception as e:
            self.logger.error(f"Failed to download schema {schema_type}", error=str(e))
            return None
    
    def _validate_against_schema(self, data: Dict[str, Any], schema_type: str) -> Dict[str, Any]:
        """Validate data against STAC JSON schema"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        try:
            schema = self._get_schema(schema_type)
            
            if schema:
                validate(instance=data, schema=schema)
                self.logger.debug(f"Schema validation passed for {schema_type}")
            else:
                validation_result['warnings'].append(f"Could not load schema for {schema_type}")
                
        except ValidationError as e:
            error_msg = f"Schema validation failed: {e.message}"
            validation_result['errors'].append(error_msg)
            
        except Exception as e:
            error_msg = f"Schema validation error: {str(e)}"
            validation_result['errors'].append(error_msg)
        
        return validation_result
    
    def _validate_stac_fields(self, data: Dict[str, Any], object_type: str) -> Dict[str, Any]:
        """Validate STAC-specific fields"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        # Check required fields
        required_fields = self.validation_rules['required_fields'].get(object_type, [])
        
        for field in required_fields:
            if field not in data:
                validation_result['errors'].append(f"Missing required field: {field}")
            elif data[field] is None:
                validation_result['errors'].append(f"Required field is null: {field}")
        
        # Validate field types
        for field, expected_type in self.validation_rules['field_types'].items():
            if field in data and data[field] is not None:
                if not isinstance(data[field], expected_type):
                    validation_result['errors'].append(
                        f"Field {field} should be {expected_type.__name__}, got {type(data[field]).__name__}"
                    )
        
        # Validate STAC version
        if 'stac_version' in data:
            if data['stac_version'] != self.stac_version:
                validation_result['warnings'].append(
                    f"STAC version {data['stac_version']} differs from expected {self.stac_version}"
                )
        
        # Validate ID format
        if 'id' in data:
            stac_id = data['id']
            if not isinstance(stac_id, str) or len(stac_id) == 0:
                validation_result['errors'].append("ID must be a non-empty string")
            elif not re.match(r'^[a-zA-Z0-9_\-\.]+$', stac_id):
                validation_result['warnings'].append("ID contains special characters that may cause issues")
        
        return validation_result
    
    def _validate_geometry_bbox(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate geometry and bbox consistency"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        geometry = item_data.get('geometry')
        bbox = item_data.get('bbox')
        
        if not geometry:
            validation_result['errors'].append("Missing geometry")
            return validation_result
        
        if not bbox:
            validation_result['errors'].append("Missing bbox")
            return validation_result
        
        # Validate bbox format
        if not isinstance(bbox, list) or len(bbox) != 4:
            validation_result['errors'].append("bbox must be a list of 4 numbers [minx, miny, maxx, maxy]")
            return validation_result
        
        minx, miny, maxx, maxy = bbox
        
        # Validate bbox values
        if not all(isinstance(coord, (int, float)) for coord in bbox):
            validation_result['errors'].append("bbox coordinates must be numbers")
        
        if minx >= maxx:
            validation_result['errors'].append("bbox minx must be less than maxx")
        
        if miny >= maxy:
            validation_result['errors'].append("bbox miny must be less than maxy")
        
        # Validate coordinate ranges
        lon_range = self.validation_rules['bbox_constraints']['longitude_range']
        lat_range = self.validation_rules['bbox_constraints']['latitude_range']
        
        if not (lon_range[0] <= minx <= lon_range[1] and lon_range[0] <= maxx <= lon_range[1]):
            validation_result['errors'].append(f"bbox longitude values outside valid range {lon_range}")
        
        if not (lat_range[0] <= miny <= lat_range[1] and lat_range[0] <= maxy <= lat_range[1]):
            validation_result['errors'].append(f"bbox latitude values outside valid range {lat_range}")
        
        # Validate geometry type
        if 'type' not in geometry:
            validation_result['errors'].append("geometry missing type field")
        else:
            geom_type = geometry['type']
            valid_types = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon']
            
            if geom_type not in valid_types:
                validation_result['errors'].append(f"Invalid geometry type: {geom_type}")
        
        # Validate geometry coordinates
        if 'coordinates' not in geometry:
            validation_result['errors'].append("geometry missing coordinates")
        else:
            coords_validation = self._validate_geometry_coordinates(geometry)
            validation_result['errors'].extend(coords_validation['errors'])
            validation_result['warnings'].extend(coords_validation['warnings'])
        
        return validation_result
    
    def _validate_geometry_coordinates(self, geometry: Dict[str, Any]) -> Dict[str, Any]:
        """Validate geometry coordinates"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        geom_type = geometry.get('type')
        coordinates = geometry.get('coordinates')
        
        if not coordinates:
            return validation_result
        
        try:
            if geom_type == 'Point':
                if not isinstance(coordinates, list) or len(coordinates) < 2:
                    validation_result['errors'].append("Point coordinates must be [x, y] or [x, y, z]")
                else:
                    x, y = coordinates[0], coordinates[1]
                    if not (-180 <= x <= 180 and -90 <= y <= 90):
                        validation_result['warnings'].append(f"Point coordinates outside typical ranges: [{x}, {y}]")
            
            elif geom_type == 'Polygon':
                if not isinstance(coordinates, list) or len(coordinates) == 0:
                    validation_result['errors'].append("Polygon coordinates must be array of linear rings")
                else:
                    # Check exterior ring
                    exterior_ring = coordinates[0]
                    if len(exterior_ring) < 4:
                        validation_result['errors'].append("Polygon exterior ring must have at least 4 coordinates")
                    elif exterior_ring[0] != exterior_ring[-1]:
                        validation_result['errors'].append("Polygon exterior ring must be closed (first == last coordinate)")
            
            # Add more geometry type validations as needed
            
        except Exception as e:
            validation_result['errors'].append(f"Geometry coordinate validation error: {str(e)}")
        
        return validation_result
    
    def _validate_properties(self, properties: Dict[str, Any]) -> Dict[str, Any]:
        """Validate item properties"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        # Validate datetime field
        if 'datetime' in properties:
            datetime_value = properties['datetime']
            
            if datetime_value is None:
                # Null datetime is allowed if start_datetime and end_datetime are provided
                if 'start_datetime' not in properties or 'end_datetime' not in properties:
                    validation_result['errors'].append("datetime is null but start_datetime/end_datetime not provided")
            else:
                # Validate datetime format
                datetime_pattern = self.validation_rules['datetime_format']
                if not re.match(datetime_pattern, str(datetime_value)):
                    validation_result['warnings'].append(f"datetime format may not be RFC 3339 compliant: {datetime_value}")
        
        # Validate common geoscience properties
        if 'country' in properties:
            country = properties['country']
            if country not in config.countries:
                validation_result['warnings'].append(f"Country {country} not in target countries list")
        
        if 'crs' in properties:
            crs = properties['crs']
            if not str(crs).startswith('EPSG:'):
                validation_result['warnings'].append(f"CRS format should be EPSG:XXXX, got: {crs}")
        
        return validation_result
    
    def _validate_assets(self, assets: Dict[str, Any]) -> Dict[str, Any]:
        """Validate item assets"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        if not assets:
            validation_result['errors'].append("Item must have at least one asset")
            return validation_result
        
        for asset_key, asset in assets.items():
            if not isinstance(asset, dict):
                validation_result['errors'].append(f"Asset {asset_key} must be an object")
                continue
            
            # Validate required asset fields
            if 'href' not in asset:
                validation_result['errors'].append(f"Asset {asset_key} missing href")
            else:
                href = asset['href']
                
                # Validate URL format
                url_pattern = self.validation_rules['url_pattern']
                if not re.match(url_pattern, href) and not href.startswith('s3://'):
                    validation_result['warnings'].append(f"Asset {asset_key} href may not be a valid URL: {href}")
            
            # Validate media type
            if 'type' not in asset:
                validation_result['warnings'].append(f"Asset {asset_key} missing media type")
            
            # Validate roles
            if 'roles' in asset:
                roles = asset['roles']
                if not isinstance(roles, list):
                    validation_result['errors'].append(f"Asset {asset_key} roles must be an array")
                else:
                    valid_roles = ['thumbnail', 'overview', 'data', 'metadata', 'tiles']
                    for role in roles:
                        if role not in valid_roles:
                            validation_result['warnings'].append(f"Asset {asset_key} has non-standard role: {role}")
        
        return validation_result
    
    def _validate_extent(self, extent: Dict[str, Any]) -> Dict[str, Any]:
        """Validate collection extent"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        if not extent:
            validation_result['errors'].append("Collection missing extent")
            return validation_result
        
        # Validate spatial extent
        if 'spatial' not in extent:
            validation_result['errors'].append("Extent missing spatial component")
        else:
            spatial = extent['spatial']
            
            if 'bbox' not in spatial:
                validation_result['errors'].append("Spatial extent missing bbox")
            else:
                bbox_list = spatial['bbox']
                
                if not isinstance(bbox_list, list) or len(bbox_list) == 0:
                    validation_result['errors'].append("Spatial bbox must be non-empty array")
                else:
                    # Validate each bbox
                    for i, bbox in enumerate(bbox_list):
                        if not isinstance(bbox, list) or len(bbox) != 4:
                            validation_result['errors'].append(f"Spatial bbox[{i}] must be [minx, miny, maxx, maxy]")
                        else:
                            minx, miny, maxx, maxy = bbox
                            if minx >= maxx or miny >= maxy:
                                validation_result['errors'].append(f"Invalid bbox[{i}]: min values must be less than max")
        
        # Validate temporal extent
        if 'temporal' not in extent:
            validation_result['warnings'].append("Extent missing temporal component")
        else:
            temporal = extent['temporal']
            
            if 'interval' not in temporal:
                validation_result['warnings'].append("Temporal extent missing interval")
            else:
                intervals = temporal['interval']
                
                if not isinstance(intervals, list):
                    validation_result['errors'].append("Temporal interval must be an array")
                else:
                    for i, interval in enumerate(intervals):
                        if not isinstance(interval, list) or len(interval) != 2:
                            validation_result['errors'].append(f"Temporal interval[{i}] must be [start, end]")
        
        return validation_result
    
    def _validate_links(self, links: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate STAC links"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        if not links:
            validation_result['warnings'].append("No links provided")
            return validation_result
        
        required_link_types = ['self', 'root']
        found_link_types = set()
        
        for i, link in enumerate(links):
            if not isinstance(link, dict):
                validation_result['errors'].append(f"Link[{i}] must be an object")
                continue
            
            # Validate required link fields
            if 'href' not in link:
                validation_result['errors'].append(f"Link[{i}] missing href")
            
            if 'rel' not in link:
                validation_result['errors'].append(f"Link[{i}] missing rel")
            else:
                found_link_types.add(link['rel'])
            
            # Validate href format
            if 'href' in link:
                href = link['href']
                url_pattern = self.validation_rules['url_pattern']
                
                if not re.match(url_pattern, href) and not href.startswith('s3://') and not href.startswith('./'):
                    validation_result['warnings'].append(f"Link[{i}] href may not be valid: {href}")
        
        # Check for required link types
        for req_type in required_link_types:
            if req_type not in found_link_types:
                validation_result['warnings'].append(f"Missing recommended link type: {req_type}")
        
        return validation_result
    
    def _validate_geoscience_collection(self, collection_data: Dict[str, Any], 
                                      data_type: str) -> Dict[str, Any]:
        """Validate geoscience-specific collection requirements"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        if data_type not in self.geoscience_rules:
            validation_result['warnings'].append(f"Unknown geoscience data type: {data_type}")
            return validation_result
        
        rules = self.geoscience_rules[data_type]
        summaries = collection_data.get('summaries', {})
        
        # Check required properties in summaries
        for prop in rules.get('required_properties', []):
            if prop not in summaries:
                validation_result['warnings'].append(f"Missing recommended summary property: {prop}")
        
        # Validate specific field values
        if 'valid_data_types' in rules and 'data_type' in summaries:
            data_types = summaries['data_type']
            if isinstance(data_types, list):
                for dt in data_types:
                    if dt not in rules['valid_data_types']:
                        validation_result['warnings'].append(f"Unexpected data_type value: {dt}")
        
        if 'valid_geophysics_types' in rules and 'geophysics_type' in summaries:
            geophys_types = summaries['geophysics_type']
            if isinstance(geophys_types, list):
                for gt in geophys_types:
                    if gt not in rules['valid_geophysics_types']:
                        validation_result['warnings'].append(f"Unexpected geophysics_type value: {gt}")
        
        return validation_result
    
    def _validate_geoscience_item(self, item_data: Dict[str, Any], 
                                data_type: str) -> Dict[str, Any]:
        """Validate geoscience-specific item requirements"""
        
        validation_result = {
            'errors': [],
            'warnings': []
        }
        
        if data_type not in self.geoscience_rules:
            return validation_result
        
        rules = self.geoscience_rules[data_type]
        properties = item_data.get('properties', {})
        assets = item_data.get('assets', {})
        
        # Check required properties
        for prop in rules.get('required_properties', []):
            if prop not in properties:
                validation_result['warnings'].append(f"Missing recommended property: {prop}")
        
        # Check required assets
        for asset_role in rules.get('required_assets', []):
            if asset_role not in assets:
                validation_result['warnings'].append(f"Missing recommended asset: {asset_role}")
        
        # Validate specific field values
        if 'valid_table_types' in rules and 'table_type' in properties:
            table_type = properties['table_type']
            if table_type not in rules['valid_table_types']:
                validation_result['warnings'].append(f"Unexpected table_type value: {table_type}")
        
        if 'valid_product_types' in rules and 'product_type' in properties:
            product_type = properties['product_type']
            if product_type not in rules['valid_product_types']:
                validation_result['warnings'].append(f"Unexpected product_type value: {product_type}")
        
        return validation_result
    
    def _validate_catalog_collections(self, catalog_data: Dict[str, Any], 
                                    catalog_path: str) -> Dict[str, Any]:
        """Validate all collections and items referenced by catalog"""
        
        validation_result = {
            'collections_validated': 0,
            'items_validated': 0,
            'total_objects': 0,
            'valid_objects': 0,
            'objects_with_errors': 0,
            'objects_with_warnings': 0,
            'errors': [],
            'warnings': []
        }
        
        # Find collection links
        links = catalog_data.get('links', [])
        collection_links = [link for link in links if link.get('rel') == 'child']
        
        for link in collection_links:
            try:
                collection_href = link.get('href')
                if not collection_href:
                    continue
                
                # Resolve relative paths
                if collection_href.startswith('./'):
                    base_path = '/'.join(catalog_path.split('/')[:-1])
                    collection_path = f"{base_path}/{collection_href[2:]}"
                else:
                    collection_path = collection_href
                
                # Load and validate collection
                collection_data = self._load_stac_object(collection_path)
                
                if collection_data:
                    collection_validation = self.validate_collection(collection_data, collection_path)
                    validation_result['collections_validated'] += 1
                    validation_result['total_objects'] += 1
                    
                    if collection_validation['valid']:
                        validation_result['valid_objects'] += 1
                    else:
                        validation_result['objects_with_errors'] += 1
                    
                    if collection_validation['warnings']:
                        validation_result['objects_with_warnings'] += 1
                    
                    # Collect errors and warnings
                    for error in collection_validation['errors']:
                        validation_result['errors'].append(f"Collection {collection_path}: {error}")
                    
                    for warning in collection_validation['warnings']:
                        validation_result['warnings'].append(f"Collection {collection_path}: {warning}")
                    
                    # Validate items in collection
                    items_result = self._validate_collection_items(collection_data, collection_path)
                    validation_result['items_validated'] += items_result['items_validated']
                    validation_result['total_objects'] += items_result['total_objects']
                    validation_result['valid_objects'] += items_result['valid_objects']
                    validation_result['objects_with_errors'] += items_result['objects_with_errors']
                    validation_result['objects_with_warnings'] += items_result['objects_with_warnings']
                    validation_result['errors'].extend(items_result['errors'])
                    validation_result['warnings'].extend(items_result['warnings'])
                
            except Exception as e:
                error_msg = f"Failed to validate collection {link.get('href', 'unknown')}: {str(e)}"
                validation_result['errors'].append(error_msg)
        
        return validation_result
    
    def _validate_collection_items(self, collection_data: Dict[str, Any],
                                 collection_path: str) -> Dict[str, Any]:
        """Validate all items in a collection"""
        
        validation_result = {
            'items_validated': 0,
            'total_objects': 0,
            'valid_objects': 0,
            'objects_with_errors': 0,
            'objects_with_warnings': 0,
            'errors': [],
            'warnings': []
        }
        
        # Find item links
        links = collection_data.get('links', [])
        item_links = [link for link in links if link.get('rel') == 'item']
        
        # If no item links, try to discover items from S3
        if not item_links:
            collection_id = collection_data.get('id', '')
            country_match = re.search(r'_([a-z]{2})$', collection_id)
            
            if country_match:
                country_code = country_match.group(1).upper()
                data_type = collection_id.split('_')[0]
                
                # Look for items in S3
                items_prefix = f"stac/{country_code.lower()}/{data_type}/items/"
                item_objects = self.storage.s3.list_objects(items_prefix)
                
                for item_key in item_objects:
                    if item_key.endswith('.json'):
                        item_path = f"s3://{config.s3_bucket}/{item_key}"
                        item_links.append({'href': item_path, 'rel': 'item'})
        
        # Validate each item
        for link in item_links:
            try:
                item_href = link.get('href')
                if not item_href:
                    continue
                
                # Resolve relative paths
                if item_href.startswith('./'):
                    base_path = '/'.join(collection_path.split('/')[:-1])
                    item_path = f"{base_path}/{item_href[2:]}"
                else:
                    item_path = item_href
                
                # Load and validate item
                item_data = self._load_stac_object(item_path)
                
                if item_data:
                    item_validation = self.validate_item(item_data, item_path)
                    validation_result['items_validated'] += 1
                    validation_result['total_objects'] += 1
                    
                    if item_validation['valid']:
                        validation_result['valid_objects'] += 1
                    else:
                        validation_result['objects_with_errors'] += 1
                    
                    if item_validation['warnings']:
                        validation_result['objects_with_warnings'] += 1
                    
                    # Collect errors and warnings
                    for error in item_validation['errors']:
                        validation_result['errors'].append(f"Item {item_path}: {error}")
                    
                    for warning in item_validation['warnings']:
                        validation_result['warnings'].append(f"Item {item_path}: {warning}")
                
            except Exception as e:
                error_msg = f"Failed to validate item {link.get('href', 'unknown')}: {str(e)}"
                validation_result['errors'].append(error_msg)
        
        return validation_result