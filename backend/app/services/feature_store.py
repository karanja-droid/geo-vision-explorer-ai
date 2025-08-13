"""Feature Store Service

Service layer for computing and retrieving geological features at multiple scales.
Handles feature computation, caching, and export functionality.
"""

import json
import hashlib
from typing import List, Optional, Dict, Any, Union
from uuid import UUID, uuid4
import pandas as pd
import numpy as np
from shapely.geometry import shape, Point
from shapely.ops import transform
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_Contains
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import redis
import boto3
from io import BytesIO

from app.models.feature_store import FSCell, FSFeature
from app.core.config import settings
from app.core.logging import logger


class FeatureStoreService:
    """Service for managing geological feature computation and retrieval"""
    
    def __init__(self, db: Session):
        self.db = db
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL) if settings.REDIS_URL else None
        self.s3_client = boto3.client('s3') if settings.AWS_ACCESS_KEY_ID else None
        
    def _generate_cache_key(self, bbox: List[float], keys: Optional[List[str]], scales: Optional[List[int]]) -> str:
        """Generate cache key from request parameters"""
        cache_data = {
            'bbox': bbox,
            'keys': sorted(keys) if keys else None,
            'scales': sorted(scales) if scales else None
        }
        cache_str = json.dumps(cache_data, sort_keys=True)
        return f"features:{hashlib.md5(cache_str.encode()).hexdigest()}"
    
    async def get_features(
        self,
        bbox: List[float],
        keys: Optional[List[str]] = None,
        scales: Optional[List[int]] = None,
        format: str = "parquet",
        org_id: Optional[UUID] = None
    ) -> Union[bytes, Dict[str, Any]]:
        """Retrieve features for a bounding box with optional filtering
        
        Args:
            bbox: [min_lon, min_lat, max_lon, max_lat]
            keys: Optional list of feature keys to filter
            scales: Optional list of scales to filter (1, 3, 5)
            format: Output format ('parquet', 'csv', 'json')
            org_id: Organization ID for access control
            
        Returns:
            Features data in requested format plus summary statistics
        """
        # Check cache first
        cache_key = self._generate_cache_key(bbox, keys, scales)
        if self.redis_client:
            cached_result = self.redis_client.get(cache_key)
            if cached_result:
                logger.info(f"Cache hit for features request: {cache_key}")
                return json.loads(cached_result)
        
        # Build spatial query
        bbox_geom = f"POLYGON(({bbox[0]} {bbox[1]}, {bbox[2]} {bbox[1]}, {bbox[2]} {bbox[3]}, {bbox[0]} {bbox[3]}, {bbox[0]} {bbox[1]}))"
        
        # Query cells within bounding box
        query = self.db.query(FSCell).filter(
            func.ST_Intersects(FSCell.geom, func.ST_GeomFromText(bbox_geom, 4326))
        )
        
        # Apply org filter if provided
        if org_id:
            query = query.filter(FSCell.org_id == org_id)
        
        # Apply scale filter
        if scales:
            query = query.filter(FSCell.scale.in_(scales))
        
        cells = query.all()
        
        if not cells:
            return {"features": [], "summary": {"count": 0}}
        
        # Get cell IDs for feature lookup
        cell_ids = [cell.cell_id for cell in cells]
        
        # Query features
        feature_query = self.db.query(FSFeature).filter(FSFeature.cell_id.in_(cell_ids))
        
        # Apply feature key filter
        if keys:
            feature_query = feature_query.filter(FSFeature.feature_key.in_(keys))
        
        features = feature_query.all()
        
        # Build result dataset
        result_data = []
        for cell in cells:
            cell_features = {f.feature_key: f.feature_val for f in features if f.cell_id == cell.cell_id}
            if not keys or any(k in cell_features for k in keys):
                result_data.append({
                    'cell_id': str(cell.cell_id),
                    'longitude': self.db.scalar(func.ST_X(cell.geom)),
                    'latitude': self.db.scalar(func.ST_Y(cell.geom)),
                    'country': cell.country,
                    'province': cell.province,
                    'scale': cell.scale,
                    **cell_features
                })
        
        # Generate summary statistics
        if result_data:
            df = pd.DataFrame(result_data)
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            summary = {
                'count': len(result_data),
                'scales': sorted(df['scale'].unique().tolist()),
                'countries': sorted(df['country'].unique().tolist()),
                'feature_keys': sorted([col for col in df.columns if col not in ['cell_id', 'longitude', 'latitude', 'country', 'province', 'scale']]),
                'statistics': {
                    col: {
                        'mean': float(df[col].mean()),
                        'std': float(df[col].std()),
                        'min': float(df[col].min()),
                        'max': float(df[col].max()),
                        'count': int(df[col].count())
                    } for col in numeric_cols if col not in ['longitude', 'latitude', 'scale']
                }
            }
        else:
            summary = {'count': 0}
        
        result = {
            'features': result_data,
            'summary': summary
        }
        
        # Format output
        if format == "parquet":
            if result_data:
                df = pd.DataFrame(result_data)
                buffer = BytesIO()
                df.to_parquet(buffer, index=False)
                result_bytes = buffer.getvalue()
                
                # Cache result
                if self.redis_client:
                    self.redis_client.setex(cache_key, 3600, json.dumps({
                        'format': 'parquet',
                        'summary': summary,
                        'data_size': len(result_bytes)
                    }))
                
                return result_bytes
            else:
                return b''
                
        elif format == "csv":
            if result_data:
                df = pd.DataFrame(result_data)
                csv_data = df.to_csv(index=False).encode('utf-8')
                
                # Cache result
                if self.redis_client:
                    self.redis_client.setex(cache_key, 3600, json.dumps({
                        'format': 'csv',
                        'summary': summary,
                        'data_size': len(csv_data)
                    }))
                
                return csv_data
            else:
                return b''
        
        # JSON format (default)
        if self.redis_client:
            self.redis_client.setex(cache_key, 3600, json.dumps(result))
        
        return result
    
    async def export_to_s3(
        self,
        bbox: List[float],
        keys: Optional[List[str]] = None,
        scales: Optional[List[int]] = None,
        org_id: Optional[UUID] = None
    ) -> str:
        """Export features to S3 as parquet file
        
        Returns:
            S3 path of exported file
        """
        if not self.s3_client:
            raise ValueError("S3 client not configured")
        
        # Get features as parquet
        parquet_data = await self.get_features(bbox, keys, scales, format="parquet", org_id=org_id)
        
        if not parquet_data:
            raise ValueError("No features found for export")
        
        # Generate S3 path
        export_id = str(uuid4())
        org_prefix = f"org_{org_id}" if org_id else "public"
        s3_key = f"feature-exports/{org_prefix}/{export_id}/features.parquet"
        
        # Upload to S3
        self.s3_client.put_object(
            Bucket=settings.S3_BUCKET,
            Key=s3_key,
            Body=parquet_data,
            ContentType='application/octet-stream',
            Metadata={
                'export_id': export_id,
                'bbox': json.dumps(bbox),
                'feature_keys': json.dumps(keys) if keys else '',
                'scales': json.dumps(scales) if scales else '',
                'org_id': str(org_id) if org_id else ''
            }
        )
        
        s3_path = f"s3://{settings.S3_BUCKET}/{s3_key}"
        logger.info(f"Features exported to S3: {s3_path}")
        
        return s3_path
    
    def get_available_features(self, org_id: Optional[UUID] = None) -> Dict[str, Any]:
        """Get list of available feature keys and metadata"""
        query = self.db.query(FSFeature.feature_key, func.count().label('count'))
        
        if org_id:
            query = query.join(FSCell).filter(FSCell.org_id == org_id)
        
        feature_stats = query.group_by(FSFeature.feature_key).all()
        
        return {
            'available_features': [
                {
                    'key': stat.feature_key,
                    'count': stat.count,
                    'category': self._categorize_feature(stat.feature_key)
                }
                for stat in feature_stats
            ],
            'categories': {
                'distance': 'Distance to geological features',
                'statistics': 'Statistical measures of geophysical data',
                'morphometry': 'Terrain and morphological features',
                'geology': 'Geological classifications and properties'
            }
        }
    
    def _categorize_feature(self, feature_key: str) -> str:
        """Categorize feature key into logical groups"""
        if feature_key.startswith('dist_to_'):
            return 'distance'
        elif any(x in feature_key for x in ['mean', 'std', 'min', 'max', 'entropy']):
            return 'statistics'
        elif any(x in feature_key for x in ['slope', 'curvature', 'elevation']):
            return 'morphometry'
        elif any(x in feature_key for x in ['lithology', 'age', 'formation']):
            return 'geology'
        else:
            return 'other'