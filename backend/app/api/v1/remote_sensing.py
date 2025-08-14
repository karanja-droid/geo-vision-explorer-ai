"""Remote Sensing API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
import rasterio
import numpy as np
from datetime import datetime, date

from app.database import get_db
from app.models.geology import RemoteSensing
from app.schemas.geology import (
    RemoteSensing as RemoteSensingSchema,
    RemoteSensingCreate,
    RemoteSensingUpdate
)
from app.schemas.core import SuccessResponse
from app.services.validation import validate_geometry
from app.services.exports import create_export_job
from app.services.stac import register_remote_sensing_data
from app.services.remote_sensing_processor import (
    process_satellite_scene,
    calculate_spectral_indices,
    generate_quicklook,
    validate_scene_metadata
)
from app.core.security import get_current_user

router = APIRouter()

@router.post("/scenes", response_model=RemoteSensingSchema, status_code=status.HTTP_201_CREATED)
async def create_remote_sensing_scene(
    scene_data: RemoteSensingCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new remote sensing scene record"""
    
    # Check if scene_id already exists in project
    existing_scene = db.query(RemoteSensing).filter(
        RemoteSensing.org_id == scene_data.org_id,
        RemoteSensing.project_id == scene_data.project_id,
        RemoteSensing.scene_id == scene_data.scene_id
    ).first()
    
    if existing_scene:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scene '{scene_data.scene_id}' already exists in this project"
        )
    
    # Validate scene metadata
    validation_result = validate_scene_metadata(scene_data.dict())
    if not validation_result['is_valid']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scene metadata: {validation_result['errors']}"
        )
    
    # Create scene record
    scene_dict = scene_data.dict()
    scene = RemoteSensing(**scene_dict)
    
    # Set geometry from bbox if provided
    if scene_data.bbox and len(scene_data.bbox) == 4:
        minx, miny, maxx, maxy = scene_data.bbox
        scene.footprint = f"SRID=4326;POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
    
    db.add(scene)
    db.commit()
    db.refresh(scene)
    
    # Register in STAC
    try:
        await register_remote_sensing_data(db, scene)
    except Exception as e:
        print(f"Failed to register remote sensing data in STAC: {e}")
    
    return scene

@router.get("/scenes", response_model=List[RemoteSensingSchema])
async def list_remote_sensing_scenes(
    project_id: Optional[UUID] = Query(None),
    satellite: Optional[str] = Query(None),
    country_code: Optional[str] = Query(None, max_length=2),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    max_cloud_cover: Optional[float] = Query(None, ge=0, le=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List remote sensing scenes with optional filtering"""
    
    query = db.query(RemoteSensing)
    
    if project_id:
        query = query.filter(RemoteSensing.project_id == project_id)
    
    if satellite:
        query = query.filter(RemoteSensing.satellite == satellite)
    
    if country_code:
        query = query.filter(RemoteSensing.country_code == country_code.upper())
    
    if start_date:
        query = query.filter(RemoteSensing.acquisition_date >= start_date)
    
    if end_date:
        query = query.filter(RemoteSensing.acquisition_date <= end_date)
    
    if max_cloud_cover is not None:
        query = query.filter(RemoteSensing.cloud_cover_percent <= max_cloud_cover)
    
    scenes = query.order_by(RemoteSensing.acquisition_date.desc()).offset(skip).limit(limit).all()
    return scenes

@router.get("/scenes/{scene_id}", response_model=RemoteSensingSchema)
async def get_remote_sensing_scene(
    scene_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get remote sensing scene by ID"""
    
    scene = db.query(RemoteSensing).filter(RemoteSensing.id == scene_id).first()
    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remote sensing scene not found"
        )
    
    return scene

@router.put("/scenes/{scene_id}", response_model=RemoteSensingSchema)
async def update_remote_sensing_scene(
    scene_id: UUID,
    scene_data: RemoteSensingUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update remote sensing scene"""
    
    scene = db.query(RemoteSensing).filter(RemoteSensing.id == scene_id).first()
    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remote sensing scene not found"
        )
    
    # Update fields
    update_data = scene_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(scene, field, value)
    
    # Update geometry if bbox changed
    if 'bbox' in update_data and update_data['bbox']:
        minx, miny, maxx, maxy = update_data['bbox']
        scene.footprint = f"SRID=4326;POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
    
    db.commit()
    db.refresh(scene)
    
    return scene

@router.delete("/scenes/{scene_id}", response_model=SuccessResponse)
async def delete_remote_sensing_scene(
    scene_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete remote sensing scene"""
    
    scene = db.query(RemoteSensing).filter(RemoteSensing.id == scene_id).first()
    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remote sensing scene not found"
        )
    
    # TODO: Delete associated files from S3
    
    db.delete(scene)
    db.commit()
    
    return SuccessResponse(message="Remote sensing scene deleted successfully")

@router.post("/upload")
async def upload_satellite_scene(
    file: UploadFile = File(...),
    project_id: UUID = Query(...),
    satellite: str = Query(...),
    scene_id: str = Query(...),
    acquisition_date: date = Query(...),
    cloud_cover_percent: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload and process satellite scene"""
    
    if not file.filename.lower().endswith(('.tif', '.tiff')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a GeoTIFF (.tif or .tiff)"
        )
    
    try:
        # Save uploaded file temporarily
        temp_file_path = f"/tmp/{file.filename}"
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Process the satellite scene
        processing_result = await process_satellite_scene(
            temp_file_path,
            satellite,
            scene_id,
            acquisition_date
        )
        
        # Create scene record
        scene_data = {
            'project_id': project_id,
            'satellite': satellite,
            'scene_id': scene_id,
            'acquisition_date': acquisition_date,
            'cloud_cover_percent': cloud_cover_percent,
            'processing_level': processing_result.get('processing_level', 'L1C'),
            'bands_available': processing_result.get('bands_available', []),
            'indices_computed': processing_result.get('indices_computed', []),
            's3_key_composite': processing_result.get('s3_key_composite'),
            's3_key_indices': processing_result.get('s3_key_indices'),
            'bbox': processing_result.get('bbox'),
            'metadata': processing_result.get('metadata', {})
        }
        
        scene = RemoteSensing(**scene_data)
        
        # Set geometry from bbox
        if scene_data['bbox']:
            minx, miny, maxx, maxy = scene_data['bbox']
            scene.footprint = f"SRID=4326;POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
        
        db.add(scene)
        db.commit()
        db.refresh(scene)
        
        # Register in STAC
        await register_remote_sensing_data(db, scene)
        
        return {
            "scene_id": str(scene.id),
            "processing_result": processing_result,
            "message": "Satellite scene uploaded and processed successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process satellite scene: {str(e)}"
        )

@router.post("/scenes/{scene_id}/calculate-indices")
async def calculate_indices_for_scene(
    scene_id: UUID,
    indices: List[str] = Query(..., description="List of indices to calculate: NDVI, NDWI, NBR, ferric, ferrous"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Calculate spectral indices for a scene"""
    
    scene = db.query(RemoteSensing).filter(RemoteSensing.id == scene_id).first()
    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remote sensing scene not found"
        )
    
    if not scene.s3_key_composite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scene composite not available for index calculation"
        )
    
    try:
        # Calculate spectral indices
        indices_result = await calculate_spectral_indices(
            scene.s3_key_composite,
            indices,
            scene.satellite
        )
        
        # Update scene record
        scene.indices_computed = indices
        scene.s3_key_indices = indices_result.get('s3_key_indices')
        
        # Update metadata
        if scene.metadata:
            scene.metadata.update(indices_result.get('metadata', {}))
        else:
            scene.metadata = indices_result.get('metadata', {})
        
        db.commit()
        db.refresh(scene)
        
        return {
            "scene_id": str(scene.id),
            "indices_calculated": indices,
            "s3_key_indices": scene.s3_key_indices,
            "message": "Spectral indices calculated successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to calculate spectral indices: {str(e)}"
        )

@router.post("/scenes/{scene_id}/generate-quicklook")
async def generate_scene_quicklook(
    scene_id: UUID,
    bands: List[str] = Query(default=["red", "green", "blue"], description="Bands for RGB composite"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate quicklook image for a scene"""
    
    scene = db.query(RemoteSensing).filter(RemoteSensing.id == scene_id).first()
    if not scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remote sensing scene not found"
        )
    
    if not scene.s3_key_composite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scene composite not available for quicklook generation"
        )
    
    try:
        # Generate quicklook
        quicklook_result = await generate_quicklook(
            scene.s3_key_composite,
            bands,
            scene.satellite
        )
        
        # Update scene metadata
        if scene.metadata:
            scene.metadata['quicklook'] = quicklook_result
        else:
            scene.metadata = {'quicklook': quicklook_result}
        
        db.commit()
        
        return {
            "scene_id": str(scene.id),
            "quicklook_url": quicklook_result.get('url'),
            "message": "Quicklook generated successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate quicklook: {str(e)}"
        )

@router.get("/satellites")
async def list_supported_satellites():
    """List supported satellite platforms"""
    
    satellites = {
        "Sentinel-2": {
            "description": "ESA Sentinel-2 multispectral imagery",
            "bands": ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B10", "B11", "B12"],
            "resolution": "10-60m",
            "revisit_time": "5 days"
        },
        "Landsat-8": {
            "description": "NASA/USGS Landsat 8 OLI/TIRS",
            "bands": ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11"],
            "resolution": "15-100m",
            "revisit_time": "16 days"
        },
        "Landsat-9": {
            "description": "NASA/USGS Landsat 9 OLI-2/TIRS-2",
            "bands": ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11"],
            "resolution": "15-100m",
            "revisit_time": "16 days"
        },
        "ASTER": {
            "description": "NASA Terra ASTER",
            "bands": ["B01", "B02", "B03N", "B04", "B05", "B06", "B07", "B08", "B09", "B10", "B11", "B12", "B13", "B14"],
            "resolution": "15-90m",
            "revisit_time": "16 days"
        }
    }
    
    return satellites

@router.get("/indices")
async def list_supported_indices():
    """List supported spectral indices"""
    
    indices = {
        "NDVI": {
            "name": "Normalized Difference Vegetation Index",
            "formula": "(NIR - Red) / (NIR + Red)",
            "description": "Vegetation health and density",
            "range": [-1, 1]
        },
        "NDWI": {
            "name": "Normalized Difference Water Index",
            "formula": "(Green - NIR) / (Green + NIR)",
            "description": "Water content and moisture",
            "range": [-1, 1]
        },
        "NBR": {
            "name": "Normalized Burn Ratio",
            "formula": "(NIR - SWIR2) / (NIR + SWIR2)",
            "description": "Burn severity and fire mapping",
            "range": [-1, 1]
        },
        "ferric": {
            "name": "Ferric Iron Index",
            "formula": "SWIR1 / Red",
            "description": "Iron oxide minerals (hematite, goethite)",
            "range": [0, 10]
        },
        "ferrous": {
            "name": "Ferrous Iron Index",
            "formula": "SWIR1 / NIR",
            "description": "Iron-bearing minerals (biotite, amphibole)",
            "range": [0, 10]
        },
        "clay": {
            "name": "Clay Minerals Index",
            "formula": "SWIR1 / SWIR2",
            "description": "Clay and hydroxyl-bearing minerals",
            "range": [0, 5]
        },
        "carbonate": {
            "name": "Carbonate Index",
            "formula": "SWIR2 / SWIR1",
            "description": "Carbonate minerals",
            "range": [0, 5]
        }
    }
    
    return indices

@router.get("/statistics/{project_id}")
async def get_remote_sensing_statistics(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get remote sensing statistics for a project"""
    
    # Scene statistics
    total_scenes = db.query(RemoteSensing).filter(
        RemoteSensing.project_id == project_id
    ).count()
    
    scenes_by_satellite = db.query(
        RemoteSensing.satellite,
        db.func.count(RemoteSensing.id)
    ).filter(
        RemoteSensing.project_id == project_id
    ).group_by(RemoteSensing.satellite).all()
    
    scenes_by_season = db.query(
        RemoteSensing.season,
        db.func.count(RemoteSensing.id)
    ).filter(
        RemoteSensing.project_id == project_id
    ).group_by(RemoteSensing.season).all()
    
    # Cloud cover statistics
    avg_cloud_cover = db.query(
        db.func.avg(RemoteSensing.cloud_cover_percent)
    ).filter(
        RemoteSensing.project_id == project_id,
        RemoteSensing.cloud_cover_percent.isnot(None)
    ).scalar()
    
    # Date range
    date_range = db.query(
        db.func.min(RemoteSensing.acquisition_date),
        db.func.max(RemoteSensing.acquisition_date)
    ).filter(
        RemoteSensing.project_id == project_id
    ).first()
    
    return {
        "scenes": {
            "total": total_scenes,
            "by_satellite": dict(scenes_by_satellite),
            "by_season": dict(scenes_by_season)
        },
        "cloud_cover": {
            "average": round(avg_cloud_cover, 1) if avg_cloud_cover else None
        },
        "temporal": {
            "start_date": date_range[0].isoformat() if date_range[0] else None,
            "end_date": date_range[1].isoformat() if date_range[1] else None
        }
    }

# Export endpoints
@router.post("/export/{format}")
async def export_remote_sensing_data(
    format: str,
    project_id: UUID = Query(...),
    satellite: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export remote sensing data in various formats"""
    
    if format not in ["csv", "json", "stac", "cog"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format"
        )
    
    # Create export job
    export_job = await create_export_job(
        db=db,
        module="remote_sensing",
        format=format,
        project_id=project_id,
        filters={
            "satellite": satellite,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
    )
    
    return {"job_id": export_job.id, "status": "pending"}