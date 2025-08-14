"""Export services for data modules"""

from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from uuid import UUID
import asyncio
import pandas as pd
import geopandas as gpd
from io import BytesIO
import boto3
from datetime import datetime, timedelta
import json

from app.models.core import Export, ExportStatus, ExportFormat
from app.models.drilling import DrillCollar, DrillSurvey, DrillInterval, DrillAssay
from app.models.geology import RasterAsset, RemoteSensing
from app.core.config import settings
from app.services.pdf_generator import generate_drilling_report, generate_project_summary
from app.services.stac import register_export_item

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION
)

async def create_export_job(
    db: Session,
    module: str,
    format: str,
    project_id: UUID,
    org_id: Optional[UUID] = None,
    filters: Optional[Dict[str, Any]] = None
) -> Export:
    """Create a new export job"""
    
    export = Export(
        org_id=org_id or project_id,  # Temporary - should get from context
        project_id=project_id,
        module=module,
        format=ExportFormat(format),
        status=ExportStatus.PENDING
    )
    
    db.add(export)
    db.commit()
    db.refresh(export)
    
    # Start async export task
    asyncio.create_task(process_export_job(export.id, filters or {}))
    
    return export

async def process_export_job(export_id: UUID, filters: Dict[str, Any]):
    """Process export job asynchronously"""
    
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        export = db.query(Export).filter(Export.id == export_id).first()
        if not export:
            return
        
        # Update status to processing
        export.status = ExportStatus.PROCESSING
        db.commit()
        
        # Generate export based on module and format
        if export.module == "drilling":
            await export_drilling_data(db, export, filters)
        elif export.module == "geology":
            await export_geology_data(db, export, filters)
        elif export.module == "geochemistry":
            await export_geochemistry_data(db, export, filters)
        elif export.module == "projects":
            await export_project_data(db, export, filters)
        else:
            raise ValueError(f"Unsupported module: {export.module}")
        
        # Update status to completed
        export.status = ExportStatus.COMPLETED
        export.completed_at = datetime.utcnow()
        db.commit()
        
        # Register in STAC
        await register_export_item(db, export)
        
    except Exception as e:
        # Update status to failed
        export.status = ExportStatus.FAILED
        export.error_message = str(e)
        db.commit()
        
    finally:
        db.close()

async def export_drilling_data(db: Session, export: Export, filters: Dict[str, Any]):
    """Export drilling data in specified format"""
    
    data_type = filters.get('data_type', 'all')
    
    if export.format == ExportFormat.CSV:
        await export_drilling_csv(db, export, data_type)
    elif export.format == ExportFormat.XLSX:
        await export_drilling_xlsx(db, export, data_type)
    elif export.format == ExportFormat.GPKG:
        await export_drilling_gpkg(db, export, data_type)
    elif export.format == ExportFormat.PDF:
        await export_drilling_pdf(db, export, data_type)
    else:
        raise ValueError(f"Unsupported format for drilling data: {export.format}")

async def export_drilling_csv(db: Session, export: Export, data_type: str):
    """Export drilling data as CSV"""
    
    if data_type == "collars" or data_type == "all":
        # Export collar data
        collars = db.query(DrillCollar).filter(
            DrillCollar.project_id == export.project_id
        ).all()
        
        collar_data = []
        for collar in collars:
            collar_data.append({
                'hole_id': collar.hole_id,
                'easting': collar.easting,
                'northing': collar.northing,
                'elevation': collar.elevation,
                'total_depth': collar.total_depth,
                'azimuth': collar.azimuth,
                'dip': collar.dip,
                'drill_date': collar.drill_date,
                'drill_type': collar.drill_type,
                'contractor': collar.contractor,
                'status': collar.status
            })
        
        df = pd.DataFrame(collar_data)
        
        # Upload to S3
        csv_buffer = BytesIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        
        s3_key = f"exports/{export.project_id}/drilling/collars_{export.id}.csv"
        
        s3_client.upload_fileobj(
            csv_buffer,
            settings.S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': 'text/csv'}
        )
        
        # Generate signed URL
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600 * 24  # 24 hours
        )
        
        export.s3_key = s3_key
        export.signed_url = signed_url
        export.expires_at = datetime.utcnow() + timedelta(hours=24)
        export.file_size_bytes = len(csv_buffer.getvalue())

async def export_drilling_xlsx(db: Session, export: Export, data_type: str):
    """Export drilling data as Excel file with multiple sheets"""
    
    excel_buffer = BytesIO()
    
    with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
        # Collars sheet
        if data_type == "collars" or data_type == "all":
            collars = db.query(DrillCollar).filter(
                DrillCollar.project_id == export.project_id
            ).all()
            
            collar_data = []
            for collar in collars:
                collar_data.append({
                    'hole_id': collar.hole_id,
                    'easting': collar.easting,
                    'northing': collar.northing,
                    'elevation': collar.elevation,
                    'total_depth': collar.total_depth,
                    'azimuth': collar.azimuth,
                    'dip': collar.dip,
                    'drill_date': collar.drill_date,
                    'drill_type': collar.drill_type,
                    'contractor': collar.contractor,
                    'status': collar.status
                })
            
            df_collars = pd.DataFrame(collar_data)
            df_collars.to_excel(writer, sheet_name='Collars', index=False)
        
        # Surveys sheet
        if data_type == "surveys" or data_type == "all":
            surveys = db.query(DrillSurvey).join(DrillCollar).filter(
                DrillCollar.project_id == export.project_id
            ).all()
            
            survey_data = []
            for survey in surveys:
                survey_data.append({
                    'hole_id': survey.collar.hole_id,
                    'depth_m': survey.depth_m,
                    'azimuth': survey.azimuth,
                    'dip': survey.dip,
                    'survey_method': survey.survey_method
                })
            
            df_surveys = pd.DataFrame(survey_data)
            df_surveys.to_excel(writer, sheet_name='Surveys', index=False)
        
        # Intervals sheet
        if data_type == "intervals" or data_type == "all":
            intervals = db.query(DrillInterval).join(DrillCollar).filter(
                DrillCollar.project_id == export.project_id
            ).all()
            
            interval_data = []
            for interval in intervals:
                interval_data.append({
                    'hole_id': interval.collar.hole_id,
                    'from_m': interval.from_m,
                    'to_m': interval.to_m,
                    'lithology': interval.lithology,
                    'alteration': interval.alteration,
                    'mineralization': interval.mineralization,
                    'recovery_percent': interval.recovery_percent,
                    'rqd_percent': interval.rqd_percent,
                    'description': interval.description,
                    'geologist': interval.geologist,
                    'logged_date': interval.logged_date
                })
            
            df_intervals = pd.DataFrame(interval_data)
            df_intervals.to_excel(writer, sheet_name='Intervals', index=False)
        
        # Assays sheet
        if data_type == "assays" or data_type == "all":
            assays = db.query(DrillAssay).join(DrillCollar).filter(
                DrillCollar.project_id == export.project_id
            ).all()
            
            assay_data = []
            for assay in assays:
                # Flatten elements dictionary
                row = {
                    'hole_id': assay.collar.hole_id,
                    'from_m': assay.from_m,
                    'to_m': assay.to_m,
                    'sample_id': assay.sample_id,
                    'batch_id': assay.batch_id,
                    'lab': assay.lab,
                    'assay_date': assay.assay_date
                }
                
                # Add element values
                for element, result in assay.elements.items():
                    row[f'{element}_value'] = result.get('value')
                    row[f'{element}_unit'] = result.get('unit')
                    row[f'{element}_detection_limit'] = result.get('detection_limit')
                
                assay_data.append(row)
            
            df_assays = pd.DataFrame(assay_data)
            df_assays.to_excel(writer, sheet_name='Assays', index=False)
    
    excel_buffer.seek(0)
    
    # Upload to S3
    s3_key = f"exports/{export.project_id}/drilling/drilling_data_{export.id}.xlsx"
    
    s3_client.upload_fileobj(
        excel_buffer,
        settings.S3_BUCKET,
        s3_key,
        ExtraArgs={'ContentType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
    )
    
    # Generate signed URL
    signed_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.S3_BUCKET, 'Key': s3_key},
        ExpiresIn=3600 * 24  # 24 hours
    )
    
    export.s3_key = s3_key
    export.signed_url = signed_url
    export.expires_at = datetime.utcnow() + timedelta(hours=24)
    export.file_size_bytes = len(excel_buffer.getvalue())

async def export_drilling_gpkg(db: Session, export: Export, data_type: str):
    """Export drilling data as GeoPackage"""
    
    # Get collar data with geometry
    collars = db.query(DrillCollar).filter(
        DrillCollar.project_id == export.project_id
    ).all()
    
    collar_data = []
    for collar in collars:
        collar_data.append({
            'hole_id': collar.hole_id,
            'easting': collar.easting,
            'northing': collar.northing,
            'elevation': collar.elevation,
            'total_depth': collar.total_depth,
            'azimuth': collar.azimuth,
            'dip': collar.dip,
            'drill_date': collar.drill_date,
            'drill_type': collar.drill_type,
            'contractor': collar.contractor,
            'status': collar.status,
            'geometry': f'POINT({collar.easting} {collar.northing})'
        })
    
    # Create GeoDataFrame
    gdf = gpd.GeoDataFrame(collar_data)
    gdf['geometry'] = gpd.points_from_xy(gdf.easting, gdf.northing)
    gdf.crs = 'EPSG:4326'
    
    # Save to buffer
    gpkg_buffer = BytesIO()
    gdf.to_file(gpkg_buffer, driver='GPKG')
    gpkg_buffer.seek(0)
    
    # Upload to S3
    s3_key = f"exports/{export.project_id}/drilling/collars_{export.id}.gpkg"
    
    s3_client.upload_fileobj(
        gpkg_buffer,
        settings.S3_BUCKET,
        s3_key,
        ExtraArgs={'ContentType': 'application/geopackage+sqlite3'}
    )
    
    # Generate signed URL
    signed_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.S3_BUCKET, 'Key': s3_key},
        ExpiresIn=3600 * 24  # 24 hours
    )
    
    export.s3_key = s3_key
    export.signed_url = signed_url
    export.expires_at = datetime.utcnow() + timedelta(hours=24)
    export.file_size_bytes = len(gpkg_buffer.getvalue())

async def export_drilling_pdf(db: Session, export: Export, data_type: str):
    """Export drilling data as PDF report"""
    
    # Generate PDF report
    pdf_buffer = await generate_drilling_report(db, export.project_id)
    
    # Upload to S3
    s3_key = f"exports/{export.project_id}/drilling/drilling_report_{export.id}.pdf"
    
    s3_client.upload_fileobj(
        pdf_buffer,
        settings.S3_BUCKET,
        s3_key,
        ExtraArgs={'ContentType': 'application/pdf'}
    )
    
    # Generate signed URL
    signed_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.S3_BUCKET, 'Key': s3_key},
        ExpiresIn=3600 * 24  # 24 hours
    )
    
    export.s3_key = s3_key
    export.signed_url = signed_url
    export.expires_at = datetime.utcnow() + timedelta(hours=24)
    export.file_size_bytes = len(pdf_buffer.getvalue())

async def export_geology_data(db: Session, export: Export, filters: Dict[str, Any]):
    """Export geology data"""
    # Implementation for geology data export
    pass

async def export_geochemistry_data(db: Session, export: Export, filters: Dict[str, Any]):
    """Export geochemistry data"""
    # Implementation for geochemistry data export
    pass

async def export_project_data(db: Session, export: Export, filters: Dict[str, Any]):
    """Export project data"""
    
    if export.format == ExportFormat.PDF:
        # Generate project summary PDF
        pdf_buffer = await generate_project_summary(db, export.project_id)
        
        # Upload to S3
        s3_key = f"exports/{export.project_id}/project_summary_{export.id}.pdf"
        
        s3_client.upload_fileobj(
            pdf_buffer,
            settings.S3_BUCKET,
            s3_key,
            ExtraArgs={'ContentType': 'application/pdf'}
        )
        
        # Generate signed URL
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600 * 24  # 24 hours
        )
        
        export.s3_key = s3_key
        export.signed_url = signed_url
        export.expires_at = datetime.utcnow() + timedelta(hours=24)
        export.file_size_bytes = len(pdf_buffer.getvalue())

async def get_export_status(db: Session, export_id: UUID) -> Optional[Export]:
    """Get export job status"""
    
    return db.query(Export).filter(Export.id == export_id).first()

async def cleanup_expired_exports(db: Session):
    """Clean up expired export files"""
    
    expired_exports = db.query(Export).filter(
        Export.expires_at < datetime.utcnow(),
        Export.status == ExportStatus.COMPLETED
    ).all()
    
    for export in expired_exports:
        if export.s3_key:
            try:
                # Delete from S3
                s3_client.delete_object(
                    Bucket=settings.S3_BUCKET,
                    Key=export.s3_key
                )
                
                # Clear export record
                export.s3_key = None
                export.signed_url = None
                export.expires_at = None
                
            except Exception as e:
                print(f"Failed to cleanup export {export.id}: {e}")
    
    db.commit()