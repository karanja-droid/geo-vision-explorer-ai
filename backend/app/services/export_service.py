"""Export service for role-based reports and data exports."""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
import tempfile
import zipfile

from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import boto3
from botocore.exceptions import ClientError

from ..core.config import settings
from ..core.database import get_db
from ..models.core import ExportJob
from ..services.pdf_generator import PDFGenerator
from ..services.stac import STACService
from .validation import ValidationService

# Initialize Celery
celery_app = Celery(
    'geovision_exports',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

# S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION
)

class ExportService:
    """Service for managing data exports and reports."""
    
    def __init__(self):
        self.pdf_generator = PDFGenerator()
        self.stac_service = STACService()
        self.validation_service = ValidationService()
    
    async def create_export_job(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        org_id: uuid.UUID,
        project_id: Optional[uuid.UUID],
        module: str,
        report_type: str,
        format: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new export job and queue it for processing."""
        
        job_id = str(uuid.uuid4())
        
        # Create export job record
        export_job = ExportJob(
            job_id=job_id,
            user_id=user_id,
            org_id=org_id,
            project_id=project_id,
            module=module,
            report_type=report_type,
            format=format,
            parameters=parameters or {},
            status='pending'
        )
        
        db.add(export_job)
        await db.commit()
        
        # Queue the export job
        process_export_job.delay(job_id)
        
        return job_id
    
    async def get_export_job(self, db: AsyncSession, job_id: str) -> Optional[ExportJob]:
        """Get export job by ID."""
        result = await db.execute(
            select(ExportJob).where(ExportJob.job_id == job_id)
        )
        return result.scalar_one_or_none()
    
    async def list_export_jobs(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        org_id: uuid.UUID,
        limit: int = 50
    ) -> List[ExportJob]:
        """List export jobs for a user/org."""
        result = await db.execute(
            select(ExportJob)
            .where(ExportJob.user_id == user_id, ExportJob.org_id == org_id)
            .order_by(ExportJob.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
    
    def generate_signed_url(self, s3_key: str, expiration: int = 3600) -> str:
        """Generate a signed URL for S3 object."""
        try:
            response = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.S3_BUCKET, 'Key': s3_key},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            raise Exception(f"Failed to generate signed URL: {e}")
    
    async def upload_to_s3(self, file_path: Path, s3_key: str, content_type: str) -> str:
        """Upload file to S3 and return the key."""
        try:
            s3_client.upload_file(
                str(file_path),
                settings.S3_BUCKET,
                s3_key,
                ExtraArgs={'ContentType': content_type}
            )
            return s3_key
        except ClientError as e:
            raise Exception(f"Failed to upload to S3: {e}")

@celery_app.task(bind=True)
def process_export_job(self, job_id: str):
    """Process an export job asynchronously."""
    
    async def _process():
        async for db in get_db():
            try:
                # Update job status to processing
                await db.execute(
                    update(ExportJob)
                    .where(ExportJob.job_id == job_id)
                    .values(status='processing')
                )
                await db.commit()
                
                # Get job details
                result = await db.execute(
                    select(ExportJob).where(ExportJob.job_id == job_id)
                )
                job = result.scalar_one_or_none()
                
                if not job:
                    raise Exception(f"Export job {job_id} not found")
                
                export_service = ExportService()
                
                # Process based on module and format
                file_path, mime_type = await export_service._process_export(job)
                
                # Upload to S3
                s3_key = f"exports/{job.org_id}/{job_id}/{file_path.name}"
                await export_service.upload_to_s3(file_path, s3_key, mime_type)
                
                # Generate signed URL
                file_url = export_service.generate_signed_url(s3_key, expiration=86400)  # 24 hours
                
                # Get file size
                file_size = file_path.stat().st_size
                
                # Update job with results
                await db.execute(
                    update(ExportJob)
                    .where(ExportJob.job_id == job_id)
                    .values(
                        status='completed',
                        file_url=file_url,
                        file_size=file_size,
                        mime_type=mime_type,
                        completed_at=datetime.utcnow()
                    )
                )
                await db.commit()
                
                # Register with STAC if applicable
                if job.format in ['gpkg', 'geojson', 'cog', 'glb']:
                    await export_service._register_stac_item(job, s3_key)
                
                # Clean up temp file
                file_path.unlink()
                
            except Exception as e:
                # Update job with error
                await db.execute(
                    update(ExportJob)
                    .where(ExportJob.job_id == job_id)
                    .values(
                        status='failed',
                        error_message=str(e),
                        completed_at=datetime.utcnow()
                    )
                )
                await db.commit()
                raise
    
    # Run the async function
    asyncio.run(_process())

class ExportProcessor:
    """Handles the actual export processing for different formats."""
    
    def __init__(self):
        self.pdf_generator = PDFGenerator()
    
    async def process_csv_export(self, job: ExportJob, data: List[Dict]) -> Path:
        """Process CSV export."""
        import pandas as pd
        
        df = pd.DataFrame(data)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            df.to_csv(f.name, index=False)
            return Path(f.name)
    
    async def process_xlsx_export(self, job: ExportJob, data: List[Dict]) -> Path:
        """Process Excel export."""
        import pandas as pd
        
        df = pd.DataFrame(data)
        
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as f:
            df.to_excel(f.name, index=False, engine='openpyxl')
            return Path(f.name)
    
    async def process_pdf_report(self, job: ExportJob, template_data: Dict) -> Path:
        """Process PDF report generation."""
        
        template_name = f"{job.module}_{job.report_type}.html"
        
        # Generate PDF from template
        pdf_content = await self.pdf_generator.generate_from_template(
            template_name, template_data
        )
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
            f.write(pdf_content)
            return Path(f.name)
    
    async def process_geojson_export(self, job: ExportJob, features: List[Dict]) -> Path:
        """Process GeoJSON export."""
        
        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "job_id": job.job_id,
                "module": job.module,
                "report_type": job.report_type
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.geojson', delete=False) as f:
            json.dump(geojson, f, indent=2)
            return Path(f.name)
    
    async def process_gpkg_export(self, job: ExportJob, features: List[Dict]) -> Path:
        """Process GeoPackage export."""
        import geopandas as gpd
        from shapely.geometry import shape
        
        # Convert features to GeoDataFrame
        geometries = [shape(f['geometry']) for f in features]
        properties = [f['properties'] for f in features]
        
        gdf = gpd.GeoDataFrame(properties, geometry=geometries, crs='EPSG:4326')
        
        with tempfile.NamedTemporaryFile(suffix='.gpkg', delete=False) as f:
            gdf.to_file(f.name, driver='GPKG')
            return Path(f.name)

# Export format mappings
EXPORT_FORMATS = {
    'csv': {
        'mime_type': 'text/csv',
        'processor': 'process_csv_export'
    },
    'xlsx': {
        'mime_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'processor': 'process_xlsx_export'
    },
    'pdf': {
        'mime_type': 'application/pdf',
        'processor': 'process_pdf_report'
    },
    'geojson': {
        'mime_type': 'application/geo+json',
        'processor': 'process_geojson_export'
    },
    'gpkg': {
        'mime_type': 'application/geopackage+sqlite3',
        'processor': 'process_gpkg_export'
    }
}