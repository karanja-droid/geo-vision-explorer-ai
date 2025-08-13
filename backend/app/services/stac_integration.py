"""STAC Catalog Integration Service

Service for creating and managing STAC items with dual COG assets
(prospectivity and uncertainty) for AI inference results.
"""

import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from uuid import UUID
import boto3
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger


class STACIntegrationService:
    """Service for STAC catalog integration with dual COG assets"""
    
    def __init__(self):
        self.s3_client = boto3.client('s3') if settings.AWS_ACCESS_KEY_ID else None
        
        # STAC specification version
        self.stac_version = "1.0.0"
        
        # Collection metadata
        self.collection_metadata = {
            "id": "ai-prospectivity-results",
            "type": "Collection",
            "stac_version": self.stac_version,
            "description": "AI-generated prospectivity and uncertainty maps",
            "license": "proprietary",
            "extent": {
                "spatial": {
                    "bbox": [[-180, -90, 180, 90]]
                },
                "temporal": {
                    "interval": [["2024-01-01T00:00:00Z", None]]
                }
            },
            "summaries": {
                "gsd": [100],  # Ground sample distance in meters
                "platform": ["ai-model"],
                "instruments": ["prospectivity-model", "uncertainty-estimator"]
            }
        }
    
    async def create_stac_item(
        self,
        inference_id: str,
        metadata: Dict[str, Any],
        prospectivity_cog_path: str,
        uncertainty_cog_path: str
    ) -> Dict[str, Any]:
        """Create STAC item for AI inference results with dual COG assets
        
        Args:
            inference_id: Unique inference identifier
            metadata: Inference metadata
            prospectivity_cog_path: S3 path to prospectivity COG
            uncertainty_cog_path: S3 path to uncertainty COG
            
        Returns:
            STAC item dictionary
        """
        logger.info(f"Creating STAC item for inference: {inference_id}")
        
        try:
            # Extract bounds and datetime
            bounds = metadata['bounds']  # [min_lon, min_lat, max_lon, max_lat]
            created_at = metadata['created_at']
            
            # Create STAC item
            stac_item = {
                "type": "Feature",
                "stac_version": self.stac_version,
                "id": inference_id,
                "properties": {
                    "datetime": created_at,
                    "created": created_at,
                    "updated": created_at,
                    "platform": "ai-model",
                    "instruments": ["prospectivity-model", "uncertainty-estimator"],
                    "gsd": 100,  # Ground sample distance in meters
                    "proj:epsg": 4326,
                    "proj:bbox": bounds,
                    "proj:shape": [
                        int((bounds[3] - bounds[1]) / 0.001),  # Height in pixels
                        int((bounds[2] - bounds[0]) / 0.001)   # Width in pixels
                    ],
                    "proj:transform": [
                        0.001, 0.0, bounds[0],  # Pixel size X, rotation, top-left X
                        0.0, -0.001, bounds[3]  # Rotation, pixel size Y (negative), top-left Y
                    ],
                    # Custom properties
                    "ai:model_version": metadata['model_version'],
                    "ai:feature_count": metadata['feature_count'],
                    "ai:processing_info": metadata['processing_info'],
                    "geovision:inference_id": inference_id,
                    "geovision:aoi": metadata['aoi']
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [bounds[0], bounds[1]],  # Bottom-left
                        [bounds[2], bounds[1]],  # Bottom-right
                        [bounds[2], bounds[3]],  # Top-right
                        [bounds[0], bounds[3]],  # Top-left
                        [bounds[0], bounds[1]]   # Close polygon
                    ]]
                },
                "bbox": bounds,
                "assets": {},
                "links": [
                    {
                        "rel": "collection",
                        "href": f"./collection.json",
                        "type": "application/json"
                    },
                    {
                        "rel": "self",
                        "href": f"./{inference_id}.json",
                        "type": "application/json"
                    }
                ],
                "stac_extensions": [
                    "https://stac-extensions.github.io/projection/v1.0.0/schema.json",
                    "https://stac-extensions.github.io/raster/v1.1.0/schema.json"
                ]
            }
            
            # Add prospectivity asset
            stac_item["assets"]["prospectivity"] = self._create_cog_asset(
                prospectivity_cog_path,
                "prospectivity",
                "Mineral prospectivity probability map",
                metadata['color_ramps']['prospectivity']
            )
            
            # Add uncertainty asset
            stac_item["assets"]["uncertainty"] = self._create_cog_asset(
                uncertainty_cog_path,
                "uncertainty",
                "Prediction uncertainty map",
                metadata['color_ramps']['uncertainty']
            )
            
            # Add metadata asset
            metadata_path = prospectivity_cog_path.replace('/prospectivity.tif', '/metadata.json')
            stac_item["assets"]["metadata"] = {
                "href": metadata_path,
                "type": "application/json",
                "roles": ["metadata"],
                "title": "Inference Metadata",
                "description": "Complete inference metadata including processing parameters"
            }
            
            # Store STAC item
            await self._store_stac_item(stac_item, inference_id)
            
            logger.info(f"Created STAC item: {inference_id}")
            return stac_item
            
        except Exception as e:
            logger.error(f"Failed to create STAC item: {str(e)}")
            raise
    
    def _create_cog_asset(
        self,
        cog_path: str,
        asset_type: str,
        description: str,
        color_ramp: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create STAC asset definition for COG file"""
        return {
            "href": cog_path,
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "roles": ["data"],
            "title": asset_type.title(),
            "description": description,
            "raster:bands": [
                {
                    "nodata": "nan",
                    "data_type": "float32",
                    "spatial_resolution": 100,
                    "unit": "probability" if asset_type == "prospectivity" else "uncertainty",
                    "scale": 1.0,
                    "offset": 0.0,
                    "statistics": {
                        "minimum": color_ramp['min'],
                        "maximum": color_ramp['max']
                    },
                    "histogram": {
                        "count": 256,
                        "min": color_ramp['min'],
                        "max": color_ramp['max']
                    }
                }
            ],
            "eo:bands": [
                {
                    "name": asset_type,
                    "description": description,
                    "center_wavelength": None,
                    "full_width_half_max": None
                }
            ],
            # Custom visualization properties
            "geovision:color_ramp": color_ramp,
            "geovision:asset_type": asset_type
        }
    
    async def _store_stac_item(self, stac_item: Dict[str, Any], inference_id: str):
        """Store STAC item in S3"""
        if not self.s3_client:
            logger.warning("S3 not configured, skipping STAC item storage")
            return
        
        try:
            # Store STAC item
            stac_key = f"stac/ai-prospectivity-results/{inference_id}.json"
            
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=stac_key,
                Body=json.dumps(stac_item, indent=2),
                ContentType='application/json',
                Metadata={
                    'stac_version': self.stac_version,
                    'item_type': 'ai-inference',
                    'inference_id': inference_id
                }
            )
            
            # Update collection if needed
            await self._update_collection()
            
            logger.info(f"Stored STAC item: s3://{settings.S3_BUCKET}/{stac_key}")
            
        except Exception as e:
            logger.error(f"Failed to store STAC item: {str(e)}")
            raise
    
    async def _update_collection(self):
        """Update STAC collection with latest extent and item count"""
        if not self.s3_client:
            return
        
        try:
            collection_key = "stac/ai-prospectivity-results/collection.json"
            
            # Try to get existing collection
            try:
                response = self.s3_client.get_object(
                    Bucket=settings.S3_BUCKET,
                    Key=collection_key
                )
                collection = json.loads(response['Body'].read())
            except self.s3_client.exceptions.NoSuchKey:
                # Create new collection
                collection = self.collection_metadata.copy()
            
            # Update temporal extent
            collection["extent"]["temporal"]["interval"][0][1] = datetime.utcnow().isoformat() + "Z"
            
            # Count items in collection
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=settings.S3_BUCKET,
                Prefix='stac/ai-prospectivity-results/',
                Delimiter='/'
            )
            
            item_count = 0
            for page in pages:
                if 'Contents' in page:
                    # Count JSON files (exclude collection.json)
                    item_count += len([
                        obj for obj in page['Contents'] 
                        if obj['Key'].endswith('.json') and not obj['Key'].endswith('collection.json')
                    ])
            
            # Add item count to summaries
            collection["summaries"]["item_count"] = item_count
            
            # Store updated collection
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=collection_key,
                Body=json.dumps(collection, indent=2),
                ContentType='application/json',
                Metadata={
                    'stac_version': self.stac_version,
                    'collection_type': 'ai-prospectivity-results',
                    'item_count': str(item_count)
                }
            )
            
            logger.info(f"Updated STAC collection with {item_count} items")
            
        except Exception as e:
            logger.error(f"Failed to update STAC collection: {str(e)}")
    
    async def get_stac_item(self, inference_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve STAC item by inference ID"""
        if not self.s3_client:
            return None
        
        try:
            stac_key = f"stac/ai-prospectivity-results/{inference_id}.json"
            
            response = self.s3_client.get_object(
                Bucket=settings.S3_BUCKET,
                Key=stac_key
            )
            
            stac_item = json.loads(response['Body'].read())
            logger.info(f"Retrieved STAC item: {inference_id}")
            
            return stac_item
            
        except self.s3_client.exceptions.NoSuchKey:
            logger.warning(f"STAC item not found: {inference_id}")
            return None
        except Exception as e:
            logger.error(f"Failed to retrieve STAC item: {str(e)}")
            return None
    
    async def list_stac_items(
        self,
        limit: int = 100,
        bbox: Optional[List[float]] = None,
        datetime_range: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """List STAC items with optional filtering"""
        if not self.s3_client:
            return {"type": "FeatureCollection", "features": []}
        
        try:
            # List all STAC items
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=settings.S3_BUCKET,
                Prefix='stac/ai-prospectivity-results/',
                MaxKeys=limit
            )
            
            features = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        if obj['Key'].endswith('.json') and not obj['Key'].endswith('collection.json'):
                            # Get STAC item
                            response = self.s3_client.get_object(
                                Bucket=settings.S3_BUCKET,
                                Key=obj['Key']
                            )
                            stac_item = json.loads(response['Body'].read())
                            
                            # Apply filters
                            if bbox and not self._bbox_intersects(stac_item['bbox'], bbox):
                                continue
                            
                            if datetime_range and not self._datetime_in_range(
                                stac_item['properties']['datetime'], datetime_range
                            ):
                                continue
                            
                            features.append(stac_item)
                            
                            if len(features) >= limit:
                                break
                
                if len(features) >= limit:
                    break
            
            return {
                "type": "FeatureCollection",
                "features": features,
                "numberMatched": len(features),
                "numberReturned": len(features)
            }
            
        except Exception as e:
            logger.error(f"Failed to list STAC items: {str(e)}")
            return {"type": "FeatureCollection", "features": []}
    
    def _bbox_intersects(self, item_bbox: List[float], filter_bbox: List[float]) -> bool:
        """Check if bounding boxes intersect"""
        return not (
            item_bbox[2] < filter_bbox[0] or  # item right < filter left
            item_bbox[0] > filter_bbox[2] or  # item left > filter right
            item_bbox[3] < filter_bbox[1] or  # item top < filter bottom
            item_bbox[1] > filter_bbox[3]     # item bottom > filter top
        )
    
    def _datetime_in_range(self, item_datetime: str, datetime_range: List[str]) -> bool:
        """Check if datetime is in range"""
        try:
            item_dt = datetime.fromisoformat(item_datetime.replace('Z', '+00:00'))
            start_dt = datetime.fromisoformat(datetime_range[0].replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(datetime_range[1].replace('Z', '+00:00'))
            
            return start_dt <= item_dt <= end_dt
        except:
            return True  # If parsing fails, include item
    
    async def validate_stac_item(self, stac_item: Dict[str, Any]) -> Dict[str, Any]:
        """Validate STAC item against specification"""
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Check required fields
            required_fields = ['type', 'stac_version', 'id', 'properties', 'geometry', 'bbox', 'assets']
            for field in required_fields:
                if field not in stac_item:
                    validation_result['errors'].append(f"Missing required field: {field}")
                    validation_result['valid'] = False
            
            # Check STAC version
            if stac_item.get('stac_version') != self.stac_version:
                validation_result['warnings'].append(
                    f"STAC version mismatch: expected {self.stac_version}, got {stac_item.get('stac_version')}"
                )
            
            # Check assets
            if 'assets' in stac_item:
                required_assets = ['prospectivity', 'uncertainty']
                for asset in required_assets:
                    if asset not in stac_item['assets']:
                        validation_result['errors'].append(f"Missing required asset: {asset}")
                        validation_result['valid'] = False
            
            # Check geometry
            if 'geometry' in stac_item:
                geom = stac_item['geometry']
                if geom['type'] != 'Polygon':
                    validation_result['errors'].append("Geometry must be a Polygon")
                    validation_result['valid'] = False
            
            logger.info(f"STAC validation result: {'valid' if validation_result['valid'] else 'invalid'}")
            
        except Exception as e:
            validation_result['valid'] = False
            validation_result['errors'].append(f"Validation error: {str(e)}")
        
        return validation_result