"""Spatial vector data ingest API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status, Response
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
import geopandas as gpd
import tempfile
import os
import json
from shapely.geometry import box
from datetime import datetime, timedelta

from app.database import get_db
from app.models.spatial import VectorDataset, VectorFeature, VectorLayer, LayerDataset
from app.schemas.spatial import (
    VectorDataset as VectorDatasetSchema,
    VectorDatasetCreate,
    VectorDatasetUpdate,
    VectorLayer as VectorLayerSchema,
    VectorLayerCreate,
    VectorLayerUpdate,
    VectorFeature as VectorFeatureSchema
)
from app.schemas.core import SuccessResponse
from app.services.validation import validate_geometry, validate_crs
from app.services.exports import create_export_job
from app.services.stac import register_vector_dataset
from app.services.spatial_processor import (
    process_vector_file,
    validate_vector_data,
    generate_vector_tiles,
    optimize_geometries
)
from app.core.security import get_current_user

router = APIRouter()

# Vector Dataset endpoints
@router.post("/datasets", response_model=VectorDatasetSchema, status_code=status.HTTP_201_CREATED)
async def create_vector_dataset(
    dataset_data: VectorDatasetCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new vector dataset record"""
    
    # Check if dataset name already exists in project
    existing_dataset = db.query(VectorDataset).filter(
        VectorDataset.org_id == dataset_data.org_id,
        VectorDataset.project_id == dataset_data.project_id,
        VectorDataset.name == dataset_data.name
    ).first()
    
    if existing_dataset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dataset '{dataset_data.name}' already exists in this project"
        )
    
    # Validate CRS
    if dataset_data.crs:
        crs_validation = validate_crs("POINT(0 0)", dataset_data.crs)
        if not crs_validation.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid CRS: {dataset_data.crs}"
            )
    
    # Create dataset record
    dataset_dict = dataset_data.dict()
    dataset = VectorDataset(**dataset_dict)
    
    # Set extent geometry from bbox if provided
    if dataset_data.bbox and len(dataset_data.bbox) == 4:
        minx, miny, maxx, maxy = dataset_data.bbox
        dataset.extent_geom = f"SRID=4326;POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
    
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    
    # Register in STAC
    try:
        await register_vector_dataset(db, dataset)
    except Exception as e:
        print(f"Failed to register vector dataset in STAC: {e}")
    
    return dataset

@router.get("/datasets", response_model=List[VectorDatasetSchema])
async def list_vector_datasets(
    project_id: Optional[UUID] = Query(None),
    dataset_type: Optional[str] = Query(None),
    geometry_type: Optional[str] = Query(None),
    processing_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List vector datasets with optional filtering"""
    
    query = db.query(VectorDataset)
    
    if project_id:
        query = query.filter(VectorDataset.project_id == project_id)
    
    if dataset_type:
        query = query.filter(VectorDataset.dataset_type == dataset_type)
    
    if geometry_type:
        query = query.filter(VectorDataset.geometry_type == geometry_type)
    
    if processing_status:
        query = query.filter(VectorDataset.processing_status == processing_status)
    
    datasets = query.order_by(VectorDataset.created_at.desc()).offset(skip).limit(limit).all()
    return datasets

@router.get("/datasets/{dataset_id}", response_model=VectorDatasetSchema)
async def get_vector_dataset(
    dataset_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get vector dataset by ID"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector dataset not found"
        )
    
    return dataset

@router.put("/datasets/{dataset_id}", response_model=VectorDatasetSchema)
async def update_vector_dataset(
    dataset_id: UUID,
    dataset_data: VectorDatasetUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update vector dataset"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector dataset not found"
        )
    
    # Update fields
    update_data = dataset_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dataset, field, value)
    
    # Update extent geometry if bbox changed
    if 'bbox' in update_data and update_data['bbox']:
        minx, miny, maxx, maxy = update_data['bbox']
        dataset.extent_geom = f"SRID=4326;POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
    
    db.commit()
    db.refresh(dataset)
    
    return dataset

@router.delete("/datasets/{dataset_id}", response_model=SuccessResponse)
async def delete_vector_dataset(
    dataset_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete vector dataset and all associated features"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector dataset not found"
        )
    
    # Delete associated features and tiles (cascade)
    db.delete(dataset)
    db.commit()
    
    return SuccessResponse(message="Vector dataset deleted successfully")

# File upload and processing endpoints
@router.post("/upload")
async def upload_vector_file(
    file: UploadFile = File(...),
    project_id: UUID = Query(...),
    dataset_name: str = Query(...),
    dataset_type: str = Query(...),
    description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload and process vector file (Shapefile, GeoJSON, GPKG, etc.)"""
    
    # Validate file format
    allowed_extensions = ['.shp', '.geojson', '.json', '.gpkg', '.kml', '.kmz', '.gml']
    file_ext = os.path.splitext(file.filename.lower())[1]
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Save uploaded file temporarily
        temp_dir = tempfile.mkdtemp()
        temp_file_path = os.path.join(temp_dir, file.filename)
        
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Process the vector file
        processing_result = await process_vector_file(
            temp_file_path,
            dataset_name,
            dataset_type,
            description
        )
        
        # Create dataset record
        dataset_data = {
            'project_id': project_id,
            'name': dataset_name,
            'description': description,
            'dataset_type': dataset_type,
            'geometry_type': processing_result.get('geometry_type'),
            'crs': processing_result.get('crs', 'EPSG:4326'),
            'feature_count': processing_result.get('feature_count', 0),
            'file_format': file_ext[1:],  # Remove the dot
            'file_size_bytes': len(content),
            's3_key_original': processing_result.get('s3_key_original'),
            's3_key_processed': processing_result.get('s3_key_processed'),
            'processing_status': 'completed',
            'bbox': processing_result.get('bbox'),
            'attributes_schema': processing_result.get('attributes_schema'),
            'validation_results': processing_result.get('validation_results'),
            'metadata': processing_result.get('metadata', {})
        }
        
        dataset = VectorDataset(**dataset_data)
        
        # Set extent geometry from bbox
        if dataset_data['bbox']:
            minx, miny, maxx, maxy = dataset_data['bbox']
            dataset.extent_geom = f"SRID=4326;POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
        
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        
        # Store features in database
        features_data = processing_result.get('features', [])
        for feature_data in features_data:
            feature = VectorFeature(
                dataset_id=dataset.id,
                feature_id=feature_data.get('id'),
                attributes=feature_data.get('properties', {}),
                geom=feature_data.get('geometry_wkt')
            )
            db.add(feature)
        
        db.commit()
        
        # Register in STAC
        await register_vector_dataset(db, dataset)
        
        # Clean up temp files
        import shutil
        shutil.rmtree(temp_dir)
        
        return {
            "dataset_id": str(dataset.id),
            "processing_result": processing_result,
            "message": "Vector file uploaded and processed successfully"
        }
        
    except Exception as e:
        # Clean up temp files on error
        if 'temp_dir' in locals():
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process vector file: {str(e)}"
        )

@router.post("/datasets/{dataset_id}/validate")
async def validate_dataset_geometries(
    dataset_id: UUID,
    fix_invalid: bool = Query(False, description="Automatically fix invalid geometries"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Validate and optionally fix geometries in a dataset"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector dataset not found"
        )
    
    try:
        # Run validation on all features
        validation_result = await validate_vector_data(db, dataset_id, fix_invalid)
        
        # Update dataset validation results
        dataset.validation_results = validation_result
        dataset.processing_status = 'completed' if validation_result['is_valid'] else 'validation_failed'
        
        db.commit()
        
        return {
            "dataset_id": str(dataset_id),
            "validation_result": validation_result,
            "message": "Geometry validation completed"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation failed: {str(e)}"
        )

@router.post("/datasets/{dataset_id}/optimize")
async def optimize_dataset_geometries(
    dataset_id: UUID,
    simplify_tolerance: Optional[float] = Query(None, ge=0, description="Simplification tolerance in map units"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Optimize geometries in a dataset (simplify, clean, etc.)"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector dataset not found"
        )
    
    try:
        # Run optimization
        optimization_result = await optimize_geometries(db, dataset_id, simplify_tolerance)
        
        # Update dataset metadata
        if dataset.metadata:
            dataset.metadata['optimization'] = optimization_result
        else:
            dataset.metadata = {'optimization': optimization_result}
        
        db.commit()
        
        return {
            "dataset_id": str(dataset_id),
            "optimization_result": optimization_result,
            "message": "Geometry optimization completed"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Optimization failed: {str(e)}"
        )

# Vector tiles endpoints
@router.get("/datasets/{dataset_id}/tiles/{z}/{x}/{y}.mvt")
async def get_vector_tile(
    dataset_id: UUID,
    z: int = Query(..., ge=0, le=20),
    x: int = Query(..., ge=0),
    y: int = Query(..., ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get vector tile (MVT) for a dataset"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector dataset not found"
        )
    
    try:
        # Generate or retrieve cached tile
        tile_data = await generate_vector_tiles(db, dataset_id, z, x, y)
        
        if not tile_data:
            # Return empty tile
            return Response(content=b"", media_type="application/x-protobuf")
        
        return Response(
            content=tile_data,
            media_type="application/x-protobuf",
            headers={
                "Content-Encoding": "gzip",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate tile: {str(e)}"
        )

@router.get("/datasets/{dataset_id}/tilejson")
async def get_dataset_tilejson(
    dataset_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get TileJSON specification for a dataset"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vector dataset not found"
        )
    
    # Calculate bounds from dataset
    bounds = dataset.bbox if dataset.bbox else [-180, -90, 180, 90]
    
    tilejson = {
        "tilejson": "3.0.0",
        "name": dataset.name,
        "description": dataset.description,
        "version": "1.0.0",
        "attribution": "GeoVision AI Miner",
        "scheme": "xyz",
        "tiles": [f"/api/v1/spatial-vector/datasets/{dataset_id}/tiles/{{z}}/{{x}}/{{y}}.mvt"],
        "minzoom": 0,
        "maxzoom": 14,
        "bounds": bounds,
        "center": [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, 8],
        "vector_layers": [
            {
                "id": "features",
                "description": f"{dataset.dataset_type} features",
                "minzoom": 0,
                "maxzoom": 14,
                "fields": dataset.attributes_schema or {}
            }
        ]
    }
    
    return tilejson

# Vector Layer endpoints
@router.post("/layers", response_model=VectorLayerSchema, status_code=status.HTTP_201_CREATED)
async def create_vector_layer(
    layer_data: VectorLayerCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new vector layer"""
    
    layer = VectorLayer(**layer_data.dict())
    db.add(layer)
    db.commit()
    db.refresh(layer)
    
    return layer

@router.get("/layers", response_model=List[VectorLayerSchema])
async def list_vector_layers(
    project_id: Optional[UUID] = Query(None),
    layer_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List vector layers"""
    
    query = db.query(VectorLayer)
    
    if project_id:
        query = query.filter(VectorLayer.project_id == project_id)
    
    if layer_type:
        query = query.filter(VectorLayer.layer_type == layer_type)
    
    layers = query.order_by(VectorLayer.z_index, VectorLayer.name).all()
    return layers

@router.post("/layers/{layer_id}/datasets/{dataset_id}")
async def add_dataset_to_layer(
    layer_id: UUID,
    dataset_id: UUID,
    order_index: int = Query(0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Add a dataset to a layer"""
    
    # Check if layer and dataset exist
    layer = db.query(VectorLayer).filter(VectorLayer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Check if relationship already exists
    existing = db.query(LayerDataset).filter(
        LayerDataset.layer_id == layer_id,
        LayerDataset.dataset_id == dataset_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Dataset already in layer")
    
    # Create relationship
    layer_dataset = LayerDataset(
        layer_id=layer_id,
        dataset_id=dataset_id,
        order_index=order_index
    )
    
    db.add(layer_dataset)
    db.commit()
    
    return SuccessResponse(message="Dataset added to layer successfully")

# Feature query endpoints
@router.get("/datasets/{dataset_id}/features", response_model=List[VectorFeatureSchema])
async def get_dataset_features(
    dataset_id: UUID,
    bbox: Optional[str] = Query(None, description="Bounding box as 'minx,miny,maxx,maxy'"),
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get features from a dataset with optional spatial filtering"""
    
    dataset = db.query(VectorDataset).filter(VectorDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    query = db.query(VectorFeature).filter(VectorFeature.dataset_id == dataset_id)
    
    # Apply spatial filter if bbox provided
    if bbox:
        try:
            minx, miny, maxx, maxy = map(float, bbox.split(','))
            bbox_geom = f"SRID=4326;POLYGON(({minx} {miny},{maxx} {miny},{maxx} {maxy},{minx} {maxy},{minx} {miny}))"
            query = query.filter(db.func.ST_Intersects(VectorFeature.geom, bbox_geom))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bbox format")
    
    features = query.limit(limit).all()
    return features

# Export endpoints
@router.post("/export/{format}")
async def export_vector_data(
    format: str,
    project_id: UUID = Query(...),
    dataset_ids: Optional[List[UUID]] = Query(None),
    layer_ids: Optional[List[UUID]] = Query(None),
    bbox: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export vector data in various formats"""
    
    if format not in ["geojson", "shapefile", "gpkg", "kml", "csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format"
        )
    
    # Create export job
    export_job = await create_export_job(
        db=db,
        module="spatial_vector",
        format=format,
        project_id=project_id,
        filters={
            "dataset_ids": [str(id) for id in dataset_ids] if dataset_ids else None,
            "layer_ids": [str(id) for id in layer_ids] if layer_ids else None,
            "bbox": bbox
        }
    )
    
    return {"job_id": export_job.id, "status": "pending"}

# Statistics endpoints
@router.get("/statistics/{project_id}")
async def get_vector_statistics(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get vector data statistics for a project"""
    
    # Dataset statistics
    total_datasets = db.query(VectorDataset).filter(
        VectorDataset.project_id == project_id
    ).count()
    
    datasets_by_type = db.query(
        VectorDataset.dataset_type,
        db.func.count(VectorDataset.id)
    ).filter(
        VectorDataset.project_id == project_id
    ).group_by(VectorDataset.dataset_type).all()
    
    datasets_by_geometry = db.query(
        VectorDataset.geometry_type,
        db.func.count(VectorDataset.id)
    ).filter(
        VectorDataset.project_id == project_id
    ).group_by(VectorDataset.geometry_type).all()
    
    # Feature statistics
    total_features = db.query(db.func.sum(VectorDataset.feature_count)).filter(
        VectorDataset.project_id == project_id
    ).scalar() or 0
    
    # Processing status
    processing_status = db.query(
        VectorDataset.processing_status,
        db.func.count(VectorDataset.id)
    ).filter(
        VectorDataset.project_id == project_id
    ).group_by(VectorDataset.processing_status).all()
    
    return {
        "datasets": {
            "total": total_datasets,
            "by_type": dict(datasets_by_type),
            "by_geometry": dict(datasets_by_geometry),
            "by_status": dict(processing_status)
        },
        "features": {
            "total": total_features
        }
    }