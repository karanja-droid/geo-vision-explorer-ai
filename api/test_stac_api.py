#!/usr/bin/env python3
"""
GeoVision AI Miner - STAC API Test Suite
Comprehensive tests for the FastAPI STAC server
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

# Import the FastAPI app
from stac_server import app, stac_server

# Test client
client = TestClient(app)

class TestSTACAPI:
    """Test suite for STAC API endpoints"""
    
    def test_root_catalog(self):
        """Test root catalog endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "Catalog"
        assert data["stac_version"] == "1.0.0"
        assert "links" in data
        
        # Check for required links
        link_rels = [link["rel"] for link in data["links"]]
        assert "self" in link_rels
        assert "collections" in link_rels
        assert "search" in link_rels

    def test_collections_endpoint(self):
        """Test collections listing endpoint"""
        response = client.get("/collections")
        assert response.status_code == 200
        
        data = response.json()
        assert "collections" in data
        assert "links" in data
        assert isinstance(data["collections"], list)

    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
        assert "stac_version" in data

    def test_search_get_endpoint(self):
        """Test search endpoint with GET parameters"""
        response = client.get("/search?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert "features" in data
        assert "links" in data
        assert "context" in data
        
        # Check context
        assert "returned" in data["context"]
        assert "matched" in data["context"]
        assert data["context"]["returned"] <= 5

    def test_search_post_endpoint(self):
        """Test search endpoint with POST body"""
        search_body = {
            "limit": 3,
            "collections": ["test-collection"]
        }
        
        response = client.post("/search", json=search_body)
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) <= 3

    def test_search_with_bbox(self):
        """Test search with bounding box filter"""
        bbox = "-180,-90,180,90"  # Global bbox
        response = client.get(f"/search?bbox={bbox}&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "FeatureCollection"

    def test_search_invalid_bbox(self):
        """Test search with invalid bounding box"""
        bbox = "invalid,bbox,format"
        response = client.get(f"/search?bbox={bbox}")
        assert response.status_code == 400

    def test_geological_mineral_search(self):
        """Test geological mineral search endpoint"""
        response = client.get("/geological/minerals/gold?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "FeatureCollection"
        
        # Check that results are filtered by mineral
        for feature in data["features"]:
            if "geological:target_mineral" in feature["properties"]:
                assert feature["properties"]["geological:target_mineral"] == "gold"

    def test_geological_data_type_search(self):
        """Test geological data type search endpoint"""
        response = client.get("/geological/data-types/spectral?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["type"] == "FeatureCollection"
        
        # Check that results are filtered by data type
        for feature in data["features"]:
            if "geological:data_type" in feature["properties"]:
                assert feature["properties"]["geological:data_type"] == "spectral"

    def test_cors_headers(self):
        """Test CORS headers are present"""
        response = client.get("/")
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "*"

    def test_options_request(self):
        """Test OPTIONS request for CORS preflight"""
        response = client.options("/search")
        assert response.status_code == 200
        assert "access-control-allow-methods" in response.headers

class TestSTACServer:
    """Test suite for STACServer class"""
    
    @pytest.fixture
    def mock_catalog(self):
        """Mock STAC catalog for testing"""
        import pystac
        
        catalog = pystac.Catalog(
            id="test-catalog",
            description="Test catalog",
            title="Test Catalog"
        )
        
        collection = pystac.Collection(
            id="test-collection",
            description="Test collection",
            extent=pystac.Extent(
                spatial=pystac.SpatialExtent([[-180, -90, 180, 90]]),
                temporal=pystac.TemporalExtent([[datetime(2020, 1, 1, tzinfo=timezone.utc), None]])
            )
        )
        
        item = pystac.Item(
            id="test-item",
            geometry={
                "type": "Polygon",
                "coordinates": [[[-1, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]]]
            },
            bbox=[-1, -1, 1, 1],
            datetime=datetime(2024, 1, 1, tzinfo=timezone.utc),
            properties={
                "geological:data_type": "spectral",
                "geological:target_mineral": "gold"
            }
        )
        
        collection.add_item(item)
        catalog.add_child(collection)
        
        return catalog

    @pytest.mark.asyncio
    async def test_bbox_intersection(self):
        """Test bounding box intersection logic"""
        server = stac_server
        
        # Test intersecting bboxes
        item_bbox = [-1, -1, 1, 1]
        search_bbox = [-0.5, -0.5, 0.5, 0.5]
        assert server._bbox_intersects(item_bbox, search_bbox)
        
        # Test non-intersecting bboxes
        item_bbox = [-1, -1, 1, 1]
        search_bbox = [2, 2, 3, 3]
        assert not server._bbox_intersects(item_bbox, search_bbox)

    @pytest.mark.asyncio
    async def test_query_matching(self):
        """Test query parameter matching"""
        import pystac
        
        server = stac_server
        
        item = pystac.Item(
            id="test-item",
            geometry={"type": "Point", "coordinates": [0, 0]},
            bbox=[0, 0, 0, 0],
            datetime=datetime.now(timezone.utc),
            properties={
                "geological:data_type": "spectral",
                "geological:confidence": 0.85
            }
        )
        
        # Test exact match
        query = {"geological:data_type": "spectral"}
        assert server._query_matches(item, query)
        
        # Test range query
        query = {"geological:confidence": {"gte": 0.8}}
        assert server._query_matches(item, query)
        
        # Test non-matching query
        query = {"geological:data_type": "magnetic"}
        assert not server._query_matches(item, query)

class TestSTACValidation:
    """Test STAC specification compliance"""
    
    def test_catalog_structure(self):
        """Test that catalog follows STAC specification"""
        response = client.get("/")
        assert response.status_code == 200
        
        catalog = response.json()
        
        # Required fields
        assert "type" in catalog
        assert "stac_version" in catalog
        assert "id" in catalog
        assert "description" in catalog
        assert "links" in catalog
        
        # Type should be Catalog
        assert catalog["type"] == "Catalog"
        
        # STAC version should be valid
        assert catalog["stac_version"] in ["1.0.0", "1.0.0-beta.1", "1.0.0-beta.2"]

    def test_collection_structure(self):
        """Test that collections follow STAC specification"""
        response = client.get("/collections")
        assert response.status_code == 200
        
        data = response.json()
        
        for collection in data["collections"]:
            # Required fields
            assert "type" in collection
            assert "stac_version" in collection
            assert "id" in collection
            assert "description" in collection
            assert "extent" in collection
            assert "links" in collection
            
            # Type should be Collection
            assert collection["type"] == "Collection"
            
            # Extent should have spatial and temporal
            assert "spatial" in collection["extent"]
            assert "temporal" in collection["extent"]

    def test_item_structure(self):
        """Test that items follow STAC specification"""
        response = client.get("/search?limit=1")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["features"]:
            item = data["features"][0]
            
            # Required fields
            assert "type" in item
            assert "stac_version" in item
            assert "id" in item
            assert "geometry" in item
            assert "bbox" in item
            assert "properties" in item
            assert "assets" in item
            assert "links" in item
            
            # Type should be Feature
            assert item["type"] == "Feature"
            
            # Geometry should be valid GeoJSON
            assert "type" in item["geometry"]
            assert "coordinates" in item["geometry"]
            
            # Bbox should be array of 4 numbers
            assert isinstance(item["bbox"], list)
            assert len(item["bbox"]) == 4

class TestPerformance:
    """Performance tests for STAC API"""
    
    def test_search_response_time(self):
        """Test that search responses are reasonably fast"""
        import time
        
        start_time = time.time()
        response = client.get("/search?limit=10")
        end_time = time.time()
        
        assert response.status_code == 200
        assert (end_time - start_time) < 5.0  # Should respond within 5 seconds

    def test_large_search_limit(self):
        """Test search with large limit"""
        response = client.get("/search?limit=1000")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["features"]) <= 1000

    def test_concurrent_requests(self):
        """Test handling of concurrent requests"""
        import concurrent.futures
        import threading
        
        def make_request():
            return client.get("/search?limit=5")
        
        # Make 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            responses = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # All requests should succeed
        for response in responses:
            assert response.status_code == 200

if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])