"""
Storage management for GeoVision AI Miner data ingestion pipeline
Handles S3, PostGIS, and local file operations
"""

import os
import json
import psycopg2
import boto3
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine, text
from botocore.exceptions import ClientError
import tempfile

from .logger import get_logger

class S3Manager:
    """Manages S3 operations for the pipeline"""
    
    def __init__(self, bucket_name: str):
        self.bucket_name = bucket_name.replace('s3://', '')
        self.s3_client = boto3.client('s3')
        self.s3_resource = boto3.resource('s3')
        self.bucket = self.s3_resource.Bucket(self.bucket_name)
        self.logger = get_logger('s3_manager')
    
    def upload_file(self, local_path: str, s3_key: str, 
                   metadata: Optional[Dict[str, str]] = None) -> bool:
        """Upload file to S3 with optional metadata"""
        try:
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = metadata
            
            self.s3_client.upload_file(
                local_path, self.bucket_name, s3_key, ExtraArgs=extra_args
            )
            
            file_size = os.path.getsize(local_path) / (1024 * 1024)  # MB
            self.logger.log_storage_write('S3', f"s3://{self.bucket_name}/{s3_key}", file_size)
            return True
            
        except ClientError as e:
            self.logger.error(f"Failed to upload {local_path} to S3", error=str(e))
            return False
    
    def download_file(self, s3_key: str, local_path: str) -> bool:
        """Download file from S3"""
        try:
            self.s3_client.download_file(self.bucket_name, s3_key, local_path)
            self.logger.info(f"Downloaded s3://{self.bucket_name}/{s3_key} to {local_path}")
            return True
            
        except ClientError as e:
            self.logger.error(f"Failed to download {s3_key} from S3", error=str(e))
            return False
    
    def list_objects(self, prefix: str) -> List[str]:
        """List objects with given prefix"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name, Prefix=prefix
            )
            
            if 'Contents' in response:
                return [obj['Key'] for obj in response['Contents']]
            return []
            
        except ClientError as e:
            self.logger.error(f"Failed to list objects with prefix {prefix}", error=str(e))
            return []
    
    def object_exists(self, s3_key: str) -> bool:
        """Check if object exists in S3"""
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False
    
    def upload_json(self, data: Dict[str, Any], s3_key: str) -> bool:
        """Upload JSON data to S3"""
        try:
            json_str = json.dumps(data, indent=2, default=str)
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=json_str.encode('utf-8'),
                ContentType='application/json'
            )
            
            size_mb = len(json_str.encode('utf-8')) / (1024 * 1024)
            self.logger.log_storage_write('S3', f"s3://{self.bucket_name}/{s3_key}", size_mb)
            return True
            
        except ClientError as e:
            self.logger.error(f"Failed to upload JSON to {s3_key}", error=str(e))
            return False
    
    def get_object_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """Generate presigned URL for S3 object"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            self.logger.error(f"Failed to generate presigned URL for {s3_key}", error=str(e))
            return ""

class PostGISManager:
    """Manages PostGIS operations for the pipeline"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.engine = create_engine(connection_string)
        self.logger = get_logger('postgis_manager')
    
    def create_table_from_gdf(self, gdf: gpd.GeoDataFrame, table_name: str,
                             schema: str = 'public', if_exists: str = 'replace',
                             add_rls_columns: bool = True,
                             org_id: str = None, project_id: str = None) -> bool:
        """Create PostGIS table from GeoDataFrame with RLS columns"""
        try:
            # Add RLS columns if requested
            if add_rls_columns:
                gdf = gdf.copy()
                gdf['org_id'] = org_id
                gdf['project_id'] = project_id
                gdf['data_classification'] = 'public'
                gdf['created_at'] = datetime.now()
                gdf['updated_at'] = datetime.now()
            
            # Write to PostGIS
            gdf.to_postgis(
                table_name, 
                self.engine, 
                schema=schema,
                if_exists=if_exists,
                index=False
            )
            
            self.logger.log_storage_write(
                'PostGIS', 
                f"{schema}.{table_name}", 
                len(gdf) * 0.001  # Rough size estimate
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create table {schema}.{table_name}", error=str(e))
            return False
    
    def create_spatial_index(self, table_name: str, geom_column: str = 'geometry',
                           schema: str = 'public') -> bool:
        """Create spatial index on geometry column"""
        try:
            index_name = f"idx_{table_name}_{geom_column}_gist"
            sql = f"""
            CREATE INDEX IF NOT EXISTS {index_name} 
            ON {schema}.{table_name} 
            USING GIST ({geom_column});
            """
            
            with self.engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
            
            self.logger.info(f"Created spatial index {index_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create spatial index on {table_name}", error=str(e))
            return False
    
    def create_attribute_index(self, table_name: str, columns: List[str],
                             schema: str = 'public') -> bool:
        """Create attribute index on specified columns"""
        try:
            columns_str = ', '.join(columns)
            index_name = f"idx_{table_name}_{'_'.join(columns)}"
            sql = f"""
            CREATE INDEX IF NOT EXISTS {index_name} 
            ON {schema}.{table_name} ({columns_str});
            """
            
            with self.engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
            
            self.logger.info(f"Created attribute index {index_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create attribute index on {table_name}", error=str(e))
            return False
    
    def enable_rls(self, table_name: str, schema: str = 'public') -> bool:
        """Enable Row Level Security on table"""
        try:
            sql = f"ALTER TABLE {schema}.{table_name} ENABLE ROW LEVEL SECURITY;"
            
            with self.engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
            
            self.logger.info(f"Enabled RLS on {schema}.{table_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to enable RLS on {table_name}", error=str(e))
            return False
    
    def analyze_table(self, table_name: str, schema: str = 'public') -> bool:
        """Run ANALYZE on table to update statistics"""
        try:
            sql = f"ANALYZE {schema}.{table_name};"
            
            with self.engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
            
            self.logger.info(f"Analyzed table {schema}.{table_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to analyze table {table_name}", error=str(e))
            return False
    
    def vacuum_table(self, table_name: str, schema: str = 'public') -> bool:
        """Run VACUUM on table"""
        try:
            # VACUUM cannot be run inside a transaction
            conn = psycopg2.connect(self.connection_string)
            conn.autocommit = True
            cursor = conn.cursor()
            
            cursor.execute(f"VACUUM {schema}.{table_name};")
            
            cursor.close()
            conn.close()
            
            self.logger.info(f"Vacuumed table {schema}.{table_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to vacuum table {table_name}", error=str(e))
            return False
    
    def get_table_info(self, table_name: str, schema: str = 'public') -> Dict[str, Any]:
        """Get table information including row count and size"""
        try:
            sql = f"""
            SELECT 
                schemaname,
                tablename,
                attname,
                n_distinct,
                correlation
            FROM pg_stats 
            WHERE schemaname = '{schema}' AND tablename = '{table_name}';
            """
            
            with self.engine.connect() as conn:
                result = conn.execute(text(sql))
                rows = result.fetchall()
            
            return {
                'schema': schema,
                'table': table_name,
                'columns': len(rows),
                'stats': [dict(row._mapping) for row in rows]
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get table info for {table_name}", error=str(e))
            return {}

class FileManager:
    """Manages local file operations"""
    
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path) if base_path else Path.cwd()
        self.logger = get_logger('file_manager')
    
    def ensure_directory(self, path: Union[str, Path]) -> Path:
        """Ensure directory exists, create if not"""
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def find_files(self, pattern: str, recursive: bool = True) -> List[Path]:
        """Find files matching pattern"""
        base = self.base_path
        if recursive:
            return list(base.rglob(pattern))
        else:
            return list(base.glob(pattern))
    
    def get_file_size_mb(self, file_path: Union[str, Path]) -> float:
        """Get file size in MB"""
        return Path(file_path).stat().st_size / (1024 * 1024)
    
    def create_temp_file(self, suffix: str = '.tmp') -> str:
        """Create temporary file and return path"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.close()
        return temp_file.name
    
    def cleanup_temp_file(self, file_path: str):
        """Clean up temporary file"""
        try:
            os.unlink(file_path)
        except OSError:
            pass

class StorageManager:
    """Unified storage manager combining S3, PostGIS, and file operations"""
    
    def __init__(self, s3_bucket: str, postgres_dsn: str, local_base_path: Optional[str] = None):
        self.s3 = S3Manager(s3_bucket)
        self.postgis = PostGISManager(postgres_dsn)
        self.files = FileManager(local_base_path)
        self.logger = get_logger('storage_manager')
    
    def get_storage_summary(self) -> Dict[str, Any]:
        """Get summary of storage operations"""
        return {
            'timestamp': datetime.now().isoformat(),
            's3_bucket': self.s3.bucket_name,
            'postgis_connection': self.postgis.connection_string.split('@')[-1],  # Hide credentials
            'local_base_path': str(self.files.base_path)
        }