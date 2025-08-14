"""STAC (SpatioTemporal Asset Catalog) services"""

from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from uuid import UUID
from datetime import datetime
import json

from app.models.core import STACCollection, STACItem, Project, Export
from app.models.drilling import DrillCollar
from app.models.geology import RasterAsset, RemoteSensing
from app.core.config import settings

async def create_project_collection(db: Session, project: Project) -> STACCollection:
    """Create STAC collection for a project"""
    
    collection_id = f"project-{project.slug}-{project.org_id}"
    
    # Check if collection already exists
    existing_collection = db.query(STACCollection).filter(
        STACCollection.id == collection_id
    ).first()
    
    if existing_collection:
        return existing_collection
    
    # Calculate spatial extent from project AOI
    spatial_extent = None
    if project.aoi_geom:
        # This would typically use PostGIS functions to get bbox
        # For now, using placeholder values
        spatial_extent = {
            "bbox": [[-180, -90, 180, 90]]  # Global bbox as placeholder
        }
    
    # Create collection
    collection = STACCollection(
        id=collection_id,
        org_id=project.org_id,
        project_id=project.id,
        title=f"{project.name} - Geological Data Collection",
        description=f"STAC collection for geological data from project {project.name}",
        keywords=["geology", "mining", "exploration"] + project.countries,
        license="proprietary",
        extent_spatial=spatial_extent,
        extent_temporal={
            "interval": [[datetime.utcnow().isoformat(), None]]
        }
    )
    
    db.add(collection)
    db.commit()
    db.refresh(collection)
    
    return collection

async def register_drilling_data(db: Session, collar: DrillCollar) -> STACItem:
    """Register drilling data as STAC item"""
    
    # Get or create project collection
    project = db.query(Project).filter(Project.id == collar.project_id).first()
    collection = await create_project_collection(db, project)
    
    item_id = f"drill-collar-{collar.hole_id}-{collar.id}"
    
    # Check if item already exists
    existing_item = db.query(STACItem).filter(STACItem.id == item_id).first()
    if existing_item:
        return existing_item
    
    # Create STAC item
    bbox = [collar.easting, collar.northing, collar.easting, collar.northing]
    
    properties = {
        "datetime": collar.created_at.isoformat(),
        "hole_id": collar.hole_id,
        "total_depth": collar.total_depth,
        "drill_type": collar.drill_type,
        "status": collar.status,
        "country_code": collar.country_code,
        "data_classification": collar.data_classification
    }
    
    if collar.drill_date:
        properties["drill_date"] = collar.drill_date.isoformat()
    
    assets = {
        "metadata": {
            "href": f"{settings.BASE_URL}/api/v1/drilling/collars/{collar.id}",
            "type": "application/json",
            "title": "Drill Collar Metadata"
        }
    }
    
    # Add survey data if available
    if collar.surveys:
        assets["surveys"] = {
            "href": f"{settings.BASE_URL}/api/v1/drilling/surveys?collar_id={collar.id}",
            "type": "application/json",
            "title": "Downhole Survey Data"
        }
    
    # Add interval data if available
    if collar.intervals:
        assets["intervals"] = {
            "href": f"{settings.BASE_URL}/api/v1/drilling/intervals?collar_id={collar.id}",
            "type": "application/json",
            "title": "Geological Intervals"
        }
    
    # Add assay data if available
    if collar.assays:
        assets["assays"] = {
            "href": f"{settings.BASE_URL}/api/v1/drilling/assays?collar_id={collar.id}",
            "type": "application/json",
            "title": "Assay Results"
        }
    
    links = [
        {
            "rel": "collection",
            "href": f"{settings.BASE_URL}/api/v1/stac/collections/{collection.id}",
            "type": "application/json"
        },
        {
            "rel": "self",
            "href": f"{settings.BASE_URL}/api/v1/stac/items/{item_id}",
            "type": "application/json"
        }
    ]
    
    item = STACItem(
        id=item_id,
        collection_id=collection.id,
        bbox=bbox,
        geometry=f"SRID=4326;POINT({collar.easting} {collar.northing})",
        properties=properties,
        assets=assets,
        links=links
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return item

async def register_raster_asset(db: Session, raster: RasterAsset) -> STACItem:
    """Register raster asset as STAC item"""
    
    # Get or create project collection
    project = db.query(Project).filter(Project.id == raster.project_id).first()
    collection = await create_project_collection(db, project)
    
    item_id = f"raster-{raster.asset_type}-{raster.id}"
    
    # Check if item already exists
    existing_item = db.query(STACItem).filter(STACItem.id == item_id).first()
    if existing_item:
        return existing_item
    
    # Create STAC item
    bbox = raster.bbox or [-180, -90, 180, 90]  # Use actual bbox or global as fallback
    
    properties = {
        "datetime": raster.created_at.isoformat(),
        "asset_type": raster.asset_type,
        "name": raster.name,
        "crs": raster.crs,
        "pixel_size_x": raster.pixel_size_x,
        "pixel_size_y": raster.pixel_size_y,
        "units": raster.units,
        "cog_optimized": raster.cog_optimized,
        "overviews_built": raster.overviews_built,
        "country_code": raster.country_code,
        "data_classification": raster.data_classification
    }
    
    if raster.nodata_value is not None:
        properties["nodata_value"] = raster.nodata_value
    
    # Generate signed URL for the raster file
    import boto3
    s3_client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )
    
    signed_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.S3_BUCKET, 'Key': raster.s3_key},
        ExpiresIn=3600 * 24  # 24 hours
    )
    
    assets = {
        "data": {
            "href": signed_url,
            "type": "image/tiff; application=geotiff; profile=cloud-optimized" if raster.cog_optimized else "image/tiff",
            "title": f"{raster.asset_type.title()} Raster Data",
            "roles": ["data"]
        },
        "metadata": {
            "href": f"{settings.BASE_URL}/api/v1/geology/raster-assets/{raster.id}",
            "type": "application/json",
            "title": "Raster Asset Metadata"
        }
    }
    
    links = [
        {
            "rel": "collection",
            "href": f"{settings.BASE_URL}/api/v1/stac/collections/{collection.id}",
            "type": "application/json"
        },
        {
            "rel": "self",
            "href": f"{settings.BASE_URL}/api/v1/stac/items/{item_id}",
            "type": "application/json"
        }
    ]
    
    item = STACItem(
        id=item_id,
        collection_id=collection.id,
        bbox=bbox,
        geometry=raster.footprint,
        properties=properties,
        assets=assets,
        links=links
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return item

async def register_remote_sensing_data(db: Session, rs_data: RemoteSensing) -> STACItem:
    """Register remote sensing data as STAC item"""
    
    # Get or create project collection
    project = db.query(Project).filter(Project.id == rs_data.project_id).first()
    collection = await create_project_collection(db, project)
    
    item_id = f"remote-sensing-{rs_data.satellite}-{rs_data.scene_id}"
    
    # Check if item already exists
    existing_item = db.query(STACItem).filter(STACItem.id == item_id).first()
    if existing_item:
        return existing_item
    
    # Create STAC item
    bbox = rs_data.bbox or [-180, -90, 180, 90]
    
    properties = {
        "datetime": rs_data.acquisition_date,
        "satellite": rs_data.satellite,
        "scene_id": rs_data.scene_id,
        "cloud_cover": rs_data.cloud_cover_percent,
        "season": rs_data.season,
        "processing_level": rs_data.processing_level,
        "bands_available": rs_data.bands_available,
        "indices_computed": rs_data.indices_computed,
        "country_code": rs_data.country_code,
        "data_classification": rs_data.data_classification
    }
    
    # Generate signed URLs for the files
    import boto3
    s3_client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )
    
    assets = {}
    
    if rs_data.s3_key_composite:
        composite_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.S3_BUCKET, 'Key': rs_data.s3_key_composite},
            ExpiresIn=3600 * 24
        )
        assets["composite"] = {
            "href": composite_url,
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Satellite Composite Image",
            "roles": ["data", "visual"]
        }
    
    if rs_data.s3_key_indices:
        indices_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.S3_BUCKET, 'Key': rs_data.s3_key_indices},
            ExpiresIn=3600 * 24
        )
        assets["indices"] = {
            "href": indices_url,
            "type": "image/tiff; application=geotiff; profile=cloud-optimized",
            "title": "Spectral Indices",
            "roles": ["data", "derived"]
        }
    
    assets["metadata"] = {
        "href": f"{settings.BASE_URL}/api/v1/geology/remote-sensing/{rs_data.id}",
        "type": "application/json",
        "title": "Remote Sensing Metadata"
    }
    
    links = [
        {
            "rel": "collection",
            "href": f"{settings.BASE_URL}/api/v1/stac/collections/{collection.id}",
            "type": "application/json"
        },
        {
            "rel": "self",
            "href": f"{settings.BASE_URL}/api/v1/stac/items/{item_id}",
            "type": "application/json"
        }
    ]
    
    item = STACItem(
        id=item_id,
        collection_id=collection.id,
        bbox=bbox,
        geometry=rs_data.footprint,
        properties=properties,
        assets=assets,
        links=links
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return item

async def register_export_item(db: Session, export: Export) -> STACItem:
    """Register export as STAC item"""
    
    # Get project and collection
    project = db.query(Project).filter(Project.id == export.project_id).first()
    collection = await create_project_collection(db, project)
    
    item_id = f"export-{export.module}-{export.format}-{export.id}"
    
    # Check if item already exists
    existing_item = db.query(STACItem).filter(STACItem.id == item_id).first()
    if existing_item:
        return existing_item
    
    # Create STAC item for export
    bbox = [-180, -90, 180, 90]  # Global bbox for exports
    
    properties = {
        "datetime": export.created_at.isoformat(),
        "module": export.module,
        "format": export.format,
        "status": export.status,
        "file_size_bytes": export.file_size_bytes
    }
    
    if export.completed_at:
        properties["completed_at"] = export.completed_at.isoformat()
    
    assets = {}
    
    if export.signed_url and export.status == "completed":
        # Determine media type based on format
        media_types = {
            "csv": "text/csv",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "json": "application/json",
            "gpkg": "application/geopackage+sqlite3",
            "geojson": "application/geo+json",
            "pdf": "application/pdf",
            "png": "image/png",
            "cog": "image/tiff; application=geotiff; profile=cloud-optimized",
            "mvt": "application/vnd.mapbox-vector-tile"
        }
        
        assets["data"] = {
            "href": export.signed_url,
            "type": media_types.get(export.format, "application/octet-stream"),
            "title": f"{export.module.title()} Export ({export.format.upper()})",
            "roles": ["data"]
        }
    
    assets["metadata"] = {
        "href": f"{settings.BASE_URL}/api/v1/exports/{export.id}",
        "type": "application/json",
        "title": "Export Metadata"
    }
    
    links = [
        {
            "rel": "collection",
            "href": f"{settings.BASE_URL}/api/v1/stac/collections/{collection.id}",
            "type": "application/json"
        },
        {
            "rel": "self",
            "href": f"{settings.BASE_URL}/api/v1/stac/items/{item_id}",
            "type": "application/json"
        }
    ]
    
    item = STACItem(
        id=item_id,
        collection_id=collection.id,
        bbox=bbox,
        properties=properties,
        assets=assets,
        links=links
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return item

async def get_stac_collection(db: Session, collection_id: str) -> Optional[Dict[str, Any]]:
    """Get STAC collection in standard format"""
    
    collection = db.query(STACCollection).filter(
        STACCollection.id == collection_id
    ).first()
    
    if not collection:
        return None
    
    # Get items count
    items_count = db.query(STACItem).filter(
        STACItem.collection_id == collection_id
    ).count()
    
    return {
        "type": "Collection",
        "stac_version": "1.0.0",
        "id": collection.id,
        "title": collection.title,
        "description": collection.description,
        "keywords": collection.keywords or [],
        "license": collection.license or "proprietary",
        "extent": {
            "spatial": collection.extent_spatial or {"bbox": [[-180, -90, 180, 90]]},
            "temporal": collection.extent_temporal or {"interval": [[None, None]]}
        },
        "summaries": {
            "items_count": items_count
        },
        "links": [
            {
                "rel": "self",
                "href": f"{settings.BASE_URL}/api/v1/stac/collections/{collection.id}",
                "type": "application/json"
            },
            {
                "rel": "items",
                "href": f"{settings.BASE_URL}/api/v1/stac/collections/{collection.id}/items",
                "type": "application/geo+json"
            }
        ]
    }

async def get_stac_item(db: Session, item_id: str) -> Optional[Dict[str, Any]]:
    """Get STAC item in standard format"""
    
    item = db.query(STACItem).filter(STACItem.id == item_id).first()
    
    if not item:
        return None
    
    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": item.id,
        "collection": item.collection_id,
        "bbox": item.bbox,
        "geometry": json.loads(item.geometry) if item.geometry else None,
        "properties": item.properties,
        "assets": item.assets,
        "links": item.links or []
    }