#!/usr/bin/env python3
"""
GeoVision AI Miner - FastAPI STAC Server
High-performance STAC API server for geological data catalogs
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Union, Any
from pathlib import Path

import boto3
from fastapi import FastAPI, HTTPException, Query, Path as FastAPIPath, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import pystac
from pystac_client import Client
import rasterio
from rasterio.warp import transform_bounds
import uvicorn

# Pydantic models for request/response validation
class STACLink(BaseModel):
    rel: str
    href: str
    type: Optional[str] = None
    title: Optional[str] = None

class STACExtent(BaseModel):
    spatial: Dict[str, List[List[float]]]
    temporal: Dict[str, List[List[Optional[str]]]]

class STACProvider(BaseModel):
    name: str
    roles: List[str]
    url: Optional[str] = None

class STACCollection(BaseModel):
    type: str = "Collection"
    stac_version: str = "1.0.0"
    id: str
    title: Optional[str] = None
    description: str
    keywords: Optional[List[str]] = None
    license: str
    providers: Optional[List[STACProvider]] = None
    extent: STACExtent
    summaries: Optional[Dict[str, Any]] = None
    links: List[STACLink]

class STACItem(BaseModel):
    type: str = "Feature"
    stac_version: str = "1.0.0"
    id: str
    collection: Optional[str] = None
    geometry: Dict[str, Any]
    bbox: List[float]
    properties: Dict[str, Any]
    assets: Dict[str, Dict[str, Any]]
    links: List[STACLink]

class STACCatalog(BaseModel):
    type: str = "Catalog"
    stac_version: str = "1.0.0"
    id: str
    title: Optional[str] = None
    description: str
    links: List[STACLink]

class SearchRequest(BaseModel):
    bbox: Optional[List[float]] = None
    datetime: Optional[str] = None
    collections: Optional[List[str]] = None
    ids: Optional[List[str]] = None
    query: Optional[Dict[str, Any]] = None
    limit: Optional[int] = Field(default=10, le=1000)

# FastAPI app configuration
app = FastAPI(
    title="GeoVision AI Miner STAC API",
    description="STAC API for geological and geophysical datasets",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
STAC_CATALOG_ROOT = os.getenv("STAC_CATALOG_ROOT", "./stac_catalogs")
S3_BUCKET = os.getenv("GEOVISION_S3_BUCKET", "s3://geovision-ai-miner-data")
API_BASE_URL = os.getenv("BASE_URL", os.getenv("STAC_API_BASE_URL", "http://localhost:8000"))

# Global variables for caching
_catalog_cache = {}
_collection_cache = {}
_item_cache = {}

class STACServer:
    """STAC server implementation with caching and S3 integration"""
    
    def __init__(self):
        self.s3_client = boto3.client('s3') if S3_BUCKET.startswith('s3://') else None
        self.catalog_root = Path(STAC_CATALOG_ROOT)
        self.base_url = API_BASE_URL
        
    async def load_catalog(self, catalog_id: str = "root") -> pystac.Catalog:
        """Load STAC catalog with caching"""
        if catalog_id in _catalog_cache:
            return _catalog_cache[catalog_id]
        
        try:
            # Try to load from local filesystem first
            if catalog_id == "root":
                catalog_path = self.catalog_root / "catalog.json"
            else:
                catalog_path = self.catalog_root / f"{catalog_id}/catalog.json"
                
            if catalog_path.exists():
                catalog = pystac.Catalog.from_file(str(catalog_path))
            else:
                # Try to load from S3
                catalog = await self._load_catalog_from_s3(catalog_id)
            
            _catalog_cache[catalog_id] = catalog
            return catalog
            
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Catalog {catalog_id} not found: {str(e)}")
    
    async def _load_catalog_from_s3(self, catalog_id: str) -> pystac.Catalog:
        """Load catalog from S3"""
        if not self.s3_client:
            raise HTTPException(status_code=500, detail="S3 client not configured")
        
        bucket_name = S3_BUCKET.replace('s3://', '')
        key = f"stac/{catalog_id}/catalog.json"
        
        try:
            response = self.s3_client.get_object(Bucket=bucket_name, Key=key)
            catalog_dict = json.loads(response['Body'].read())
            return pystac.Catalog.from_dict(catalog_dict)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Catalog {catalog_id} not found in S3: {str(e)}")
    
    async def get_collections(self, catalog_id: str = "root") -> List[pystac.Collection]:
        """Get all collections from a catalog"""
        catalog = await self.load_catalog(catalog_id)
        collections = []
        
        for child in catalog.get_children():
            if isinstance(child, pystac.Collection):
                collections.append(child)
        
        return collections
    
    async def get_collection(self, collection_id: str) -> pystac.Collection:
        """Get a specific collection"""
        if collection_id in _collection_cache:
            return _collection_cache[collection_id]
        
        # Search through all catalogs for the collection
        try:
            # Try local filesystem first
            collection_path = self.catalog_root / f"*/{collection_id}/collection.json"
            collection_files = list(Path(".").glob(str(collection_path)))
            
            if collection_files:
                collection = pystac.Collection.from_file(str(collection_files[0]))
            else:
                # Try S3
                collection = await self._load_collection_from_s3(collection_id)
            
            _collection_cache[collection_id] = collection
            return collection
            
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Collection {collection_id} not found: {str(e)}")
    
    async def _load_collection_from_s3(self, collection_id: str) -> pystac.Collection:
        """Load collection from S3"""
        if not self.s3_client:
            raise HTTPException(status_code=500, detail="S3 client not configured")
        
        bucket_name = S3_BUCKET.replace('s3://', '')
        
        # Search for collection in S3
        paginator = self.s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket_name, Prefix="stac/")
        
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    if obj['Key'].endswith(f"{collection_id}/collection.json"):
                        response = self.s3_client.get_object(Bucket=bucket_name, Key=obj['Key'])
                        collection_dict = json.loads(response['Body'].read())
                        return pystac.Collection.from_dict(collection_dict)
        
        raise HTTPException(status_code=404, detail=f"Collection {collection_id} not found in S3")
    
    async def search_items(self, search_params: SearchRequest) -> Dict[str, Any]:
        """Search for STAC items based on parameters"""
        items = []
        
        # Get collections to search
        collections_to_search = search_params.collections or []
        if not collections_to_search:
            # Search all collections if none specified
            all_collections = await self.get_collections()
            collections_to_search = [col.id for col in all_collections]
        
        for collection_id in collections_to_search:
            try:
                collection = await self.get_collection(collection_id)
                collection_items = await self._search_collection_items(collection, search_params)
                items.extend(collection_items)
            except HTTPException:
                continue  # Skip collections that don't exist
        
        # Apply filters
        filtered_items = self._apply_search_filters(items, search_params)
        
        # Apply limit
        limited_items = filtered_items[:search_params.limit]
        
        return {
            "type": "FeatureCollection",
            "features": [item.to_dict() for item in limited_items],
            "links": [
                {
                    "rel": "self",
                    "href": f"{self.base_url}/search",
                    "type": "application/geo+json"
                }
            ],
            "context": {
                "returned": len(limited_items),
                "matched": len(filtered_items)
            }
        }
    
    async def _search_collection_items(self, collection: pystac.Collection, search_params: SearchRequest) -> List[pystac.Item]:
        """Search items within a specific collection"""
        items = []
        
        for item in collection.get_items():
            # Apply basic filters
            if search_params.ids and item.id not in search_params.ids:
                continue
            
            if search_params.bbox:
                if not self._bbox_intersects(item.bbox, search_params.bbox):
                    continue
            
            if search_params.datetime:
                if not self._datetime_matches(item.datetime, search_params.datetime):
                    continue
            
            items.append(item)
        
        return items
    
    def _apply_search_filters(self, items: List[pystac.Item], search_params: SearchRequest) -> List[pystac.Item]:
        """Apply additional search filters"""
        filtered_items = items
        
        # Apply query filters
        if search_params.query:
            filtered_items = [
                item for item in filtered_items
                if self._query_matches(item, search_params.query)
            ]
        
        return filtered_items
    
    def _bbox_intersects(self, item_bbox: List[float], search_bbox: List[float]) -> bool:
        """Check if bounding boxes intersect"""
        return not (
            item_bbox[2] < search_bbox[0] or  # item right < search left
            item_bbox[0] > search_bbox[2] or  # item left > search right
            item_bbox[3] < search_bbox[1] or  # item top < search bottom
            item_bbox[1] > search_bbox[3]     # item bottom > search top
        )
    
    def _datetime_matches(self, item_datetime: datetime, search_datetime: str) -> bool:
        """Check if datetime matches search criteria"""
        # Simplified datetime matching - could be enhanced
        if "/" in search_datetime:
            # Range query
            start, end = search_datetime.split("/")
            # Implementation would parse and compare dates
            return True  # Placeholder
        else:
            # Single date query
            return True  # Placeholder
    
    def _query_matches(self, item: pystac.Item, query: Dict[str, Any]) -> bool:
        """Check if item matches query parameters"""
        for key, value in query.items():
            if key not in item.properties:
                return False
            
            item_value = item.properties[key]
            
            # Handle different query types
            if isinstance(value, dict):
                # Range or comparison query
                if "gte" in value and item_value < value["gte"]:
                    return False
                if "lte" in value and item_value > value["lte"]:
                    return False
                if "eq" in value and item_value != value["eq"]:
                    return False
            else:
                # Exact match
                if item_value != value:
                    return False
        
        return True

# Initialize STAC server
stac_server = STACServer()

# API Routes
@app.get("/", response_model=STACCatalog)
async def get_root_catalog():
    """Get the root STAC catalog"""
    catalog = await stac_server.load_catalog("root")
    
    # Convert to API response format
    catalog_dict = catalog.to_dict()
    catalog_dict["links"] = [
        {
            "rel": "self",
            "href": f"{API_BASE_URL}/",
            "type": "application/json"
        },
        {
            "rel": "collections",
            "href": f"{API_BASE_URL}/collections",
            "type": "application/json"
        },
        {
            "rel": "search",
            "href": f"{API_BASE_URL}/search",
            "type": "application/geo+json",
            "method": "GET"
        },
        {
            "rel": "search",
            "href": f"{API_BASE_URL}/search",
            "type": "application/geo+json",
            "method": "POST"
        }
    ]
    
    return JSONResponse(content=catalog_dict)

@app.get("/collections", response_model=Dict[str, Any])
async def get_collections():
    """Get all collections"""
    collections = await stac_server.get_collections()
    
    return {
        "collections": [
            {
                **col.to_dict(),
                "links": [
                    {
                        "rel": "self",
                        "href": f"{API_BASE_URL}/collections/{col.id}",
                        "type": "application/json"
                    },
                    {
                        "rel": "items",
                        "href": f"{API_BASE_URL}/collections/{col.id}/items",
                        "type": "application/geo+json"
                    }
                ]
            }
            for col in collections
        ],
        "links": [
            {
                "rel": "self",
                "href": f"{API_BASE_URL}/collections",
                "type": "application/json"
            }
        ]
    }

@app.get("/collections/{collection_id}", response_model=STACCollection)
async def get_collection(collection_id: str = FastAPIPath(..., description="Collection ID")):
    """Get a specific collection"""
    collection = await stac_server.get_collection(collection_id)
    
    collection_dict = collection.to_dict()
    collection_dict["links"] = [
        {
            "rel": "self",
            "href": f"{API_BASE_URL}/collections/{collection_id}",
            "type": "application/json"
        },
        {
            "rel": "items",
            "href": f"{API_BASE_URL}/collections/{collection_id}/items",
            "type": "application/geo+json"
        },
        {
            "rel": "parent",
            "href": f"{API_BASE_URL}/",
            "type": "application/json"
        }
    ]
    
    return JSONResponse(content=collection_dict)

@app.get("/collections/{collection_id}/items", response_model=Dict[str, Any])
async def get_collection_items(
    collection_id: str = FastAPIPath(..., description="Collection ID"),
    limit: int = Query(10, le=1000, description="Maximum number of items to return"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (minx,miny,maxx,maxy)"),
    datetime: Optional[str] = Query(None, description="Datetime filter")
):
    """Get items from a specific collection"""
    collection = await stac_server.get_collection(collection_id)
    
    # Build search parameters
    search_params = SearchRequest(
        collections=[collection_id],
        limit=limit
    )
    
    if bbox:
        try:
            search_params.bbox = [float(x) for x in bbox.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bbox format")
    
    if datetime:
        search_params.datetime = datetime
    
    # Search items
    result = await stac_server.search_items(search_params)
    
    # Add collection-specific links
    result["links"].extend([
        {
            "rel": "collection",
            "href": f"{API_BASE_URL}/collections/{collection_id}",
            "type": "application/json"
        }
    ])
    
    return result

@app.get("/collections/{collection_id}/items/{item_id}", response_model=STACItem)
async def get_item(
    collection_id: str = FastAPIPath(..., description="Collection ID"),
    item_id: str = FastAPIPath(..., description="Item ID")
):
    """Get a specific item"""
    collection = await stac_server.get_collection(collection_id)
    
    # Find the item
    for item in collection.get_items():
        if item.id == item_id:
            item_dict = item.to_dict()
            item_dict["links"] = [
                {
                    "rel": "self",
                    "href": f"{API_BASE_URL}/collections/{collection_id}/items/{item_id}",
                    "type": "application/geo+json"
                },
                {
                    "rel": "collection",
                    "href": f"{API_BASE_URL}/collections/{collection_id}",
                    "type": "application/json"
                },
                {
                    "rel": "parent",
                    "href": f"{API_BASE_URL}/collections/{collection_id}",
                    "type": "application/json"
                }
            ]
            return JSONResponse(content=item_dict)
    
    raise HTTPException(status_code=404, detail=f"Item {item_id} not found in collection {collection_id}")

@app.get("/search", response_model=Dict[str, Any])
async def search_get(
    bbox: Optional[str] = Query(None, description="Bounding box filter (minx,miny,maxx,maxy)"),
    datetime: Optional[str] = Query(None, description="Datetime filter"),
    collections: Optional[str] = Query(None, description="Comma-separated collection IDs"),
    ids: Optional[str] = Query(None, description="Comma-separated item IDs"),
    limit: int = Query(10, le=1000, description="Maximum number of items to return")
):
    """Search items using GET parameters"""
    search_params = SearchRequest(limit=limit)
    
    if bbox:
        try:
            search_params.bbox = [float(x) for x in bbox.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid bbox format")
    
    if datetime:
        search_params.datetime = datetime
    
    if collections:
        search_params.collections = collections.split(",")
    
    if ids:
        search_params.ids = ids.split(",")
    
    return await stac_server.search_items(search_params)

@app.post("/search", response_model=Dict[str, Any])
async def search_post(search_request: SearchRequest):
    """Search items using POST body"""
    return await stac_server.search_items(search_request)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "stac_version": "1.0.0"
    }

# Geological-specific endpoints
@app.get("/geological/minerals/{mineral}")
async def search_by_mineral(
    mineral: str = FastAPIPath(..., description="Target mineral (e.g., gold, copper, iron)"),
    limit: int = Query(10, le=1000)
):
    """Search for geological data by target mineral"""
    search_params = SearchRequest(
        query={"geological:target_mineral": mineral},
        limit=limit
    )
    
    result = await stac_server.search_items(search_params)
    result["links"].append({
        "rel": "self",
        "href": f"{API_BASE_URL}/geological/minerals/{mineral}",
        "type": "application/geo+json"
    })
    
    return result

@app.get("/geological/data-types/{data_type}")
async def search_by_data_type(
    data_type: str = FastAPIPath(..., description="Data type (spectral, hyperspectral, magnetic, gravity)"),
    limit: int = Query(10, le=1000)
):
    """Search for geological data by data type"""
    search_params = SearchRequest(
        query={"geological:data_type": data_type},
        limit=limit
    )
    
    result = await stac_server.search_items(search_params)
    result["links"].append({
        "rel": "self",
        "href": f"{API_BASE_URL}/geological/data-types/{data_type}",
        "type": "application/geo+json"
    })
    
    return result

if __name__ == "__main__":
    uvicorn.run(
        "stac_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )