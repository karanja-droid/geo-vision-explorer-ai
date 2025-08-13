"""Tests for Feature Store Service

Comprehensive tests for feature store functionality including
database operations, API endpoints, and Celery tasks.
"""

import pytest
import json
from uuid import uuid4
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from shapely.geometry import Polygon

from app.main import app
from app.models.feature_store import FSCell, FSFeature, Organization, Project
from app.services.feature_store import FeatureStoreService
from app.tasks.feature_computation import compute_features_for_aoi
from tests.utils import create_test_user, create_test_org, create_test_project


class TestFeatureStoreModels:
    """Test feature store database models"""
    
    def test_create_fs_cell(self, db: Session):
        """Test creating a feature store cell"""
        org = create_test_org(db)
        project = create_test_project(db, org.id)
        
        cell = FSCell(
            geom="POINT(25.0 -15.0)",
            country="ZM",
            province="Copperbelt",
            scale=1,
            org_id=org.id,
            project_id=project.id
        )
        
        db.add(cell)
        db.commit()
        db.refresh(cell)
        
        assert cell.cell_id is not None
        assert cell.country == "ZM"
        assert cell.scale == 1
        assert cell.org_id == org.id
    
    def test_create_fs_feature(self, db: Session):
        """Test creating a feature value"""
        org = create_test_org(db)
        project = create_test_project(db, org.id)
        
        cell = FSCell(
            geom="POINT(25.0 -15.0)",
            country="ZM",
            scale=1,
            org_id=org.id,
            project_id=project.id
        )
        db.add(cell)
        db.commit()
        db.refresh(cell)
        
        feature = FSFeature(
            cell_id=cell.cell_id,
            feature_key="dist_to_faults",
            feature_val=1500.0
        )
        
        db.add(feature)
        db.commit()
        db.refresh(feature)
        
        assert feature.cell_id == cell.cell_id
        assert feature.feature_key == "dist_to_faults"
        assert feature.feature_val == 1500.0
    
    def test_cascade_delete(self, db: Session):
        """Test that features are deleted when cell is deleted"""
        org = create_test_org(db)
        project = create_test_project(db, org.id)
        
        cell = FSCell(
            geom="POINT(25.0 -15.0)",
            country="ZM",
            scale=1,
            org_id=org.id,
            project_id=project.id
        )
        db.add(cell)
        db.commit()
        db.refresh(cell)
        
        feature = FSFeature(
            cell_id=cell.cell_id,
            feature_key="dist_to_faults",
            feature_val=1500.0
        )
        db.add(feature)
        db.commit()
        
        # Delete cell should cascade to features
        db.delete(cell)
        db.commit()
        
        # Feature should be deleted
        remaining_features = db.query(FSFeature).filter(FSFeature.cell_id == cell.cell_id).all()
        assert len(remaining_features) == 0


class TestFeatureStoreService:
    """Test feature store service layer"""
    
    @pytest.fixture
    def service(self, db: Session):
        return FeatureStoreService(db)
    
    @pytest.fixture
    def sample_data(self, db: Session):
        """Create sample data for testing"""
        org = create_test_org(db)
        project = create_test_project(db, org.id)
        
        # Create cells at different scales
        cells = []
        for scale in [1, 3, 5]:
            for i, (lon, lat) in enumerate([(25.0, -15.0), (25.1, -15.1), (25.2, -15.2)]):
                cell = FSCell(
                    geom=f"POINT({lon} {lat})",
                    country="ZM",
                    province="Copperbelt",
                    scale=scale,
                    org_id=org.id,
                    project_id=project.id
                )
                db.add(cell)
                cells.append(cell)
        
        db.commit()
        
        # Add features to cells
        for cell in cells:
            db.refresh(cell)
            features = [
                FSFeature(cell_id=cell.cell_id, feature_key="dist_to_faults", feature_val=1000.0 + cell.scale * 100),
                FSFeature(cell_id=cell.cell_id, feature_key="magnetics_mean_scale1", feature_val=50000.0),
                FSFeature(cell_id=cell.cell_id, feature_key="elevation_mean_scale1", feature_val=1200.0)
            ]
            for feature in features:
                db.add(feature)
        
        db.commit()
        
        return org, project, cells
    
    @pytest.mark.asyncio
    async def test_get_features_json(self, service: FeatureStoreService, sample_data):
        """Test getting features in JSON format"""
        org, project, cells = sample_data
        
        bbox = [24.9, -15.3, 25.3, -14.7]
        result = await service.get_features(bbox=bbox, format="json", org_id=org.id)
        
        assert isinstance(result, dict)
        assert "features" in result
        assert "summary" in result
        assert result["summary"]["count"] > 0
        assert len(result["features"]) > 0
        
        # Check feature structure
        feature = result["features"][0]
        assert "cell_id" in feature
        assert "longitude" in feature
        assert "latitude" in feature
        assert "country" in feature
        assert "scale" in feature
    
    @pytest.mark.asyncio
    async def test_get_features_with_filters(self, service: FeatureStoreService, sample_data):
        """Test getting features with key and scale filters"""
        org, project, cells = sample_data
        
        bbox = [24.9, -15.3, 25.3, -14.7]
        result = await service.get_features(
            bbox=bbox,
            keys=["dist_to_faults"],
            scales=[1, 3],
            format="json",
            org_id=org.id
        )
        
        assert result["summary"]["count"] > 0
        
        # Check that only requested scales are returned
        scales_returned = set(f["scale"] for f in result["features"])
        assert scales_returned.issubset({1, 3})
        
        # Check that features contain the requested key
        for feature in result["features"]:
            assert "dist_to_faults" in feature
    
    @pytest.mark.asyncio
    async def test_get_features_parquet(self, service: FeatureStoreService, sample_data):
        """Test getting features in parquet format"""
        org, project, cells = sample_data
        
        bbox = [24.9, -15.3, 25.3, -14.7]
        result = await service.get_features(bbox=bbox, format="parquet", org_id=org.id)
        
        assert isinstance(result, bytes)
        assert len(result) > 0
    
    @pytest.mark.asyncio
    async def test_get_features_csv(self, service: FeatureStoreService, sample_data):
        """Test getting features in CSV format"""
        org, project, cells = sample_data
        
        bbox = [24.9, -15.3, 25.3, -14.7]
        result = await service.get_features(bbox=bbox, format="csv", org_id=org.id)
        
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert b"cell_id" in result  # Check CSV header
    
    @pytest.mark.asyncio
    @patch('boto3.client')
    async def test_export_to_s3(self, mock_boto3, service: FeatureStoreService, sample_data):
        """Test exporting features to S3"""
        org, project, cells = sample_data
        
        # Mock S3 client
        mock_s3 = Mock()
        mock_boto3.return_value = mock_s3
        service.s3_client = mock_s3
        
        bbox = [24.9, -15.3, 25.3, -14.7]
        s3_path = await service.export_to_s3(bbox=bbox, org_id=org.id)
        
        assert s3_path.startswith("s3://")
        assert f"org_{org.id}" in s3_path
        mock_s3.put_object.assert_called_once()
    
    def test_get_available_features(self, service: FeatureStoreService, sample_data):
        """Test getting available feature keys"""
        org, project, cells = sample_data
        
        result = service.get_available_features(org_id=org.id)
        
        assert "available_features" in result
        assert "categories" in result
        assert len(result["available_features"]) > 0
        
        # Check feature structure
        feature = result["available_features"][0]
        assert "key" in feature
        assert "count" in feature
        assert "category" in feature


class TestFeatureComputationTask:
    """Test feature computation Celery task"""
    
    @pytest.fixture
    def sample_aoi(self):
        """Sample AOI GeoJSON for testing"""
        return {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [25.0, -15.0],
                    [25.2, -15.0],
                    [25.2, -14.8],
                    [25.0, -14.8],
                    [25.0, -15.0]
                ]]
            },
            "properties": {}
        }
    
    @patch('app.tasks.feature_computation.SessionLocal')
    def test_compute_features_for_aoi(self, mock_session, sample_aoi):
        """Test feature computation task"""
        # Mock database session
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Mock task request
        mock_task = Mock()
        mock_task.request.id = "test-task-id"
        
        # Run task
        with patch.object(compute_features_for_aoi, 'request', mock_task.request):
            result = compute_features_for_aoi(
                aoi_geojson=sample_aoi,
                scales=[1, 3],
                org_id=str(uuid4()),
                project_id=str(uuid4())
            )
        
        assert result["task_id"] == "test-task-id"
        assert result["scales_processed"] == [1, 3]
        assert result["cells_created"] > 0
        assert result["features_computed"] > 0
        assert result["processing_time"] > 0


class TestFeatureStoreAPI:
    """Test feature store API endpoints"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers"""
        return {"Authorization": "Bearer test-token"}
    
    @patch('app.api.deps.get_current_user')
    def test_get_features_endpoint(self, mock_get_user, client: TestClient, auth_headers):
        """Test GET /features endpoint"""
        # Mock user
        mock_get_user.return_value = {"org_id": str(uuid4())}
        
        response = client.get(
            "/api/v1/features?bbox=25.0,-15.0,25.2,-14.8&format=json",
            headers=auth_headers
        )
        
        # Should return 200 even with no data
        assert response.status_code == 200
        data = response.json()
        assert "features" in data
        assert "summary" in data
    
    @patch('app.api.deps.get_current_user')
    def test_get_features_invalid_bbox(self, mock_get_user, client: TestClient, auth_headers):
        """Test GET /features with invalid bbox"""
        mock_get_user.return_value = {"org_id": str(uuid4())}
        
        response = client.get(
            "/api/v1/features?bbox=invalid",
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "Bounding box must have 4 coordinates" in response.json()["detail"]
    
    @patch('app.api.deps.get_current_user')
    @patch('app.tasks.feature_computation.compute_features_for_aoi.delay')
    def test_compute_features_endpoint(self, mock_task, mock_get_user, client: TestClient, auth_headers):
        """Test POST /features/compute endpoint"""
        mock_get_user.return_value = {"org_id": str(uuid4())}
        mock_task.return_value.id = "test-task-id"
        
        aoi_request = {
            "aoi": {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [25.0, -15.0],
                        [25.2, -15.0],
                        [25.2, -14.8],
                        [25.0, -14.8],
                        [25.0, -15.0]
                    ]]
                }
            },
            "scales": [1, 3]
        }
        
        response = client.post(
            "/api/v1/features/compute",
            json=aoi_request,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "test-task-id"
        assert data["status"] == "started"
    
    @patch('app.api.deps.get_current_user')
    def test_compute_features_invalid_aoi(self, mock_get_user, client: TestClient, auth_headers):
        """Test POST /features/compute with invalid AOI"""
        mock_get_user.return_value = {"org_id": str(uuid4())}
        
        aoi_request = {
            "aoi": {
                "type": "Feature",
                "geometry": {
                    "type": "Point",  # Invalid - should be Polygon
                    "coordinates": [25.0, -15.0]
                }
            }
        }
        
        response = client.post(
            "/api/v1/features/compute",
            json=aoi_request,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "AOI geometry must be Polygon or MultiPolygon" in response.json()["detail"]
    
    def test_feature_store_health(self, client: TestClient):
        """Test feature store health check"""
        with patch('app.core.config.settings.ENABLE_FEATURE_STORE', True):
            response = client.get("/api/v1/features/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["service"] == "feature_store"
    
    def test_feature_store_health_disabled(self, client: TestClient):
        """Test feature store health check when disabled"""
        with patch('app.core.config.settings.ENABLE_FEATURE_STORE', False):
            response = client.get("/api/v1/features/health")
            
            assert response.status_code == 503
            assert "Feature store service is disabled" in response.json()["detail"]


class TestFeatureStoreIntegration:
    """Integration tests for complete feature store workflow"""
    
    @pytest.mark.asyncio
    async def test_complete_workflow(self, db: Session):
        """Test complete workflow from computation to retrieval"""
        # Create test organization and project
        org = create_test_org(db)
        project = create_test_project(db, org.id)
        
        # Create sample AOI
        aoi = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [25.0, -15.0],
                    [25.1, -15.0],
                    [25.1, -14.9],
                    [25.0, -14.9],
                    [25.0, -15.0]
                ]]
            }
        }
        
        # Mock the computation task (would normally be async)
        with patch('app.tasks.feature_computation.SessionLocal', return_value=db):
            result = compute_features_for_aoi(
                aoi_geojson=aoi,
                scales=[1],
                org_id=str(org.id),
                project_id=str(project.id)
            )
        
        assert result["cells_created"] > 0
        assert result["features_computed"] > 0
        
        # Now test retrieval
        service = FeatureStoreService(db)
        bbox = [24.9, -15.1, 25.2, -14.8]
        features = await service.get_features(bbox=bbox, org_id=org.id)
        
        assert features["summary"]["count"] > 0
        assert len(features["features"]) > 0
        
        # Verify feature data structure
        feature = features["features"][0]
        assert feature["country"] in ["ZM", "Unknown"]  # Mock data
        assert feature["scale"] == 1
        assert "dist_to_faults" in feature