"""Tests for AI Inference functionality"""

import pytest
import json
import numpy as np
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.main import app
from app.services.ai_inference import AIInferenceService
from app.services.stac_integration import STACIntegrationService
from app.tasks.ai_inference import run_prospectivity_inference
from tests.utils.utils import create_random_user

client = TestClient(app)


class TestAIInferenceService:
    """Test AI inference service functionality"""
    
    @pytest.fixture
    def sample_aoi(self):
        """Sample AOI GeoJSON for testing"""
        return {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [28.0, -26.0],
                    [28.1, -26.0],
                    [28.1, -25.9],
                    [28.0, -25.9],
                    [28.0, -26.0]
                ]]
            },
            "properties": {},
            "bbox": [28.0, -26.0, 28.1, -25.9]
        }
    
    @pytest.fixture
    def mock_features_data(self):
        """Mock features data for testing"""
        return [
            {
                'cell_id': 'test-cell-1',
                'longitude': 28.05,
                'latitude': -25.95,
                'country': 'ZA',
                'province': 'Gauteng',
                'scale': 1,
                'dist_to_faults': 1500.0,
                'mag_mean': 52000.0,
                'elevation': 1200.0
            },
            {
                'cell_id': 'test-cell-2',
                'longitude': 28.06,
                'latitude': -25.94,
                'country': 'ZA',
                'province': 'Gauteng',
                'scale': 1,
                'dist_to_faults': 2000.0,
                'mag_mean': 51000.0,
                'elevation': 1250.0
            }
        ]
    
    def test_extract_bounds(self, db: Session, sample_aoi):
        """Test bounding box extraction from GeoJSON"""
        service = AIInferenceService(db)
        bounds = service._extract_bounds(sample_aoi)
        
        assert bounds == [28.0, -26.0, 28.1, -25.9]
    
    def test_prepare_feature_matrix(self, db: Session, mock_features_data):
        """Test feature matrix preparation"""
        service = AIInferenceService(db)
        X, coords, feature_names = service._prepare_feature_matrix(mock_features_data)
        
        # Check shapes
        assert X.shape[0] == 2  # Two samples
        assert X.shape[1] == 50  # Padded to expected feature count
        assert coords.shape == (2, 2)  # Two coordinates (lon, lat)
        
        # Check feature names
        assert 'dist_to_faults' in feature_names
        assert 'mag_mean' in feature_names
        assert 'elevation' in feature_names
        
        # Check coordinate values
        assert coords[0, 0] == 28.05  # First longitude
        assert coords[0, 1] == -25.95  # First latitude
    
    def test_predict_with_uncertainty(self, db: Session):
        """Test prediction with uncertainty quantification"""
        service = AIInferenceService(db)
        
        # Create mock model
        model = MagicMock()
        model.estimators_ = [MagicMock() for _ in range(10)]
        
        # Mock tree predictions
        for i, tree in enumerate(model.estimators_):
            tree.predict.return_value = np.array([0.5 + i * 0.01, 0.6 + i * 0.01])
        
        # Test prediction
        X = np.random.randn(2, 50)
        prospectivity, uncertainty = service._predict_with_uncertainty(model, X)
        
        # Check output shapes
        assert prospectivity.shape == (2,)
        assert uncertainty.shape == (2,)
        
        # Check value ranges
        assert 0 <= prospectivity.min() <= prospectivity.max() <= 1
        assert 0 <= uncertainty.min() <= uncertainty.max() <= 1
    
    def test_create_raster_grids(self, db: Session):
        """Test raster grid creation from point predictions"""
        service = AIInferenceService(db)
        
        # Mock data
        coordinates = np.array([[28.05, -25.95], [28.06, -25.94]])
        prospectivity = np.array([0.7, 0.8])
        uncertainty = np.array([0.3, 0.2])
        bounds = [28.0, -26.0, 28.1, -25.9]
        
        prosp_grid, unc_grid, transform, crs = service._create_raster_grids(
            coordinates, prospectivity, uncertainty, bounds
        )
        
        # Check grid shapes
        expected_height = int((bounds[3] - bounds[1]) / 0.001)
        expected_width = int((bounds[2] - bounds[0]) / 0.001)
        
        assert prosp_grid.shape == (expected_height, expected_width)
        assert unc_grid.shape == (expected_height, expected_width)
        
        # Check CRS
        assert crs.to_epsg() == 4326
        
        # Check that grids contain non-NaN values
        assert not np.all(np.isnan(prosp_grid))
        assert not np.all(np.isnan(unc_grid))
    
    @patch('app.services.ai_inference.AIInferenceService._get_features_for_inference')
    @patch('app.services.ai_inference.AIInferenceService._create_cog_files')
    @patch('app.services.ai_inference.AIInferenceService._store_inference_metadata')
    async def test_run_inference_complete_workflow(
        self, 
        mock_store_metadata,
        mock_create_cogs,
        mock_get_features,
        db: Session,
        sample_aoi,
        mock_features_data
    ):
        """Test complete inference workflow"""
        # Setup mocks
        mock_get_features.return_value = mock_features_data
        mock_create_cogs.return_value = {
            'prospectivity': 's3://test-bucket/inference-123/prospectivity.tif',
            'uncertainty': 's3://test-bucket/inference-123/uncertainty.tif'
        }
        mock_store_metadata.return_value = None
        
        service = AIInferenceService(db)
        
        # Run inference
        result = await service.run_inference(sample_aoi)
        
        # Check result structure
        assert 'inference_id' in result
        assert 'status' in result
        assert 'prospectivity_cog' in result
        assert 'uncertainty_cog' in result
        assert 'metadata' in result
        assert 'statistics' in result
        assert 'stac_item' in result
        
        # Check status
        assert result['status'] == 'completed'
        
        # Check COG paths
        assert result['prospectivity_cog'].endswith('prospectivity.tif')
        assert result['uncertainty_cog'].endswith('uncertainty.tif')
        
        # Check statistics structure
        assert 'prospectivity' in result['statistics']
        assert 'uncertainty' in result['statistics']
        
        for stat_type in ['prospectivity', 'uncertainty']:
            stats = result['statistics'][stat_type]
            assert 'min' in stats
            assert 'max' in stats
            assert 'mean' in stats
            assert 'std' in stats


class TestSTACIntegration:
    """Test STAC catalog integration"""
    
    @pytest.fixture
    def sample_metadata(self):
        """Sample inference metadata"""
        return {
            'inference_id': 'test-inference-123',
            'created_at': '2024-01-15T10:00:00Z',
            'model_version': 'v1.0.0',
            'bounds': [28.0, -26.0, 28.1, -25.9],
            'feature_count': 100,
            'feature_names': ['dist_to_faults', 'mag_mean', 'elevation'],
            'aoi': {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[28.0, -26.0], [28.1, -26.0], [28.1, -25.9], [28.0, -25.9], [28.0, -26.0]]]
                }
            },
            'processing_info': {
                'grid_resolution_degrees': 0.001,
                'crs': 'EPSG:4326'
            },
            'color_ramps': {
                'prospectivity': {
                    'type': 'continuous',
                    'min': 0.0,
                    'max': 1.0,
                    'colors': ['#000080', '#0000FF', '#00FFFF', '#FFFF00', '#FF0000']
                },
                'uncertainty': {
                    'type': 'continuous',
                    'min': 0.0,
                    'max': 1.0,
                    'colors': ['#FFFFFF', '#FFFF00', '#FF8000', '#FF0000', '#800000']
                }
            }
        }
    
    async def test_create_stac_item(self, sample_metadata):
        """Test STAC item creation"""
        service = STACIntegrationService()
        
        stac_item = await service.create_stac_item(
            inference_id='test-inference-123',
            metadata=sample_metadata,
            prospectivity_cog_path='s3://test-bucket/prospectivity.tif',
            uncertainty_cog_path='s3://test-bucket/uncertainty.tif'
        )
        
        # Check STAC item structure
        assert stac_item['type'] == 'Feature'
        assert stac_item['stac_version'] == '1.0.0'
        assert stac_item['id'] == 'test-inference-123'
        
        # Check geometry
        assert stac_item['geometry']['type'] == 'Polygon'
        assert stac_item['bbox'] == [28.0, -26.0, 28.1, -25.9]
        
        # Check assets
        assert 'prospectivity' in stac_item['assets']
        assert 'uncertainty' in stac_item['assets']
        assert 'metadata' in stac_item['assets']
        
        # Check asset properties
        prosp_asset = stac_item['assets']['prospectivity']
        assert prosp_asset['type'] == 'image/tiff; application=geotiff; profile=cloud-optimized'
        assert 'data' in prosp_asset['roles']
        
        unc_asset = stac_item['assets']['uncertainty']
        assert unc_asset['type'] == 'image/tiff; application=geotiff; profile=cloud-optimized'
        assert 'data' in unc_asset['roles']
        
        # Check custom properties
        assert stac_item['properties']['ai:model_version'] == 'v1.0.0'
        assert stac_item['properties']['geovision:inference_id'] == 'test-inference-123'
    
    async def test_validate_stac_item(self, sample_metadata):
        """Test STAC item validation"""
        service = STACIntegrationService()
        
        # Create valid STAC item
        stac_item = await service.create_stac_item(
            inference_id='test-inference-123',
            metadata=sample_metadata,
            prospectivity_cog_path='s3://test-bucket/prospectivity.tif',
            uncertainty_cog_path='s3://test-bucket/uncertainty.tif'
        )
        
        # Validate
        validation_result = await service.validate_stac_item(stac_item)
        
        assert validation_result['valid'] is True
        assert len(validation_result['errors']) == 0
        
        # Test invalid STAC item
        invalid_item = {'type': 'Feature'}  # Missing required fields
        validation_result = await service.validate_stac_item(invalid_item)
        
        assert validation_result['valid'] is False
        assert len(validation_result['errors']) > 0


class TestAIInferenceAPI:
    """Test AI inference API endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Authentication headers for API requests"""
        user = create_random_user()
        return {"Authorization": f"Bearer {user['access_token']}"}
    
    @pytest.fixture
    def sample_inference_request(self):
        """Sample inference request"""
        return {
            "aoi": {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [28.0, -26.0],
                        [28.1, -26.0],
                        [28.1, -25.9],
                        [28.0, -25.9],
                        [28.0, -26.0]
                    ]]
                }
            },
            "model_version": "latest"
        }
    
    def test_run_inference_endpoint(self, sample_inference_request, auth_headers):
        """Test inference API endpoint"""
        with patch('app.tasks.ai_inference.run_prospectivity_inference.delay') as mock_task:
            mock_task.return_value.id = "test-task-id"
            
            response = client.post(
                "/api/v1/inference/run",
                json=sample_inference_request,
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'task_id' in data
        assert data['status'] == 'started'
        assert 'estimated_completion_minutes' in data
    
    def test_inference_status_endpoint(self, auth_headers):
        """Test inference status endpoint"""
        with patch('app.core.celery_app.celery_app.AsyncResult') as mock_result:
            mock_result.return_value.state = 'SUCCESS'
            mock_result.return_value.result = {
                'inference_id': 'test-123',
                'status': 'completed',
                'prospectivity_cog': 's3://bucket/prospectivity.tif',
                'uncertainty_cog': 's3://bucket/uncertainty.tif'
            }
            
            response = client.get(
                "/api/v1/inference/status/test-task-id",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['status'] == 'completed'
        assert 'result' in data
    
    def test_get_inference_result_endpoint(self, auth_headers):
        """Test get inference result endpoint"""
        with patch('app.core.celery_app.celery_app.AsyncResult') as mock_result:
            mock_result.return_value.state = 'SUCCESS'
            mock_result.return_value.result = {
                'inference_id': 'test-123',
                'status': 'completed',
                'prospectivity_cog': 's3://bucket/prospectivity.tif',
                'uncertainty_cog': 's3://bucket/uncertainty.tif',
                'metadata': {'model_version': 'v1.0.0'},
                'statistics': {
                    'prospectivity': {'min': 0.0, 'max': 1.0, 'mean': 0.5, 'std': 0.2},
                    'uncertainty': {'min': 0.0, 'max': 1.0, 'mean': 0.3, 'std': 0.1}
                }
            }
            
            response = client.get(
                "/api/v1/inference/result/test-task-id",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['inference_id'] == 'test-123'
        assert data['status'] == 'completed'
        assert 'prospectivity_cog' in data
        assert 'uncertainty_cog' in data
        assert 'metadata' in data
        assert 'statistics' in data
    
    def test_invalid_aoi_format(self, auth_headers):
        """Test API handles invalid AOI format"""
        invalid_request = {
            "aoi": {
                "type": "Feature",
                "geometry": {
                    "type": "Point",  # Invalid - should be Polygon
                    "coordinates": [28.0, -26.0]
                }
            }
        }
        
        response = client.post(
            "/api/v1/inference/run",
            json=invalid_request,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "Polygon" in response.json()['detail']


class TestAIInferenceTask:
    """Test AI inference Celery task"""
    
    @pytest.fixture
    def sample_aoi(self):
        """Sample AOI for task testing"""
        return {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [28.0, -26.0],
                    [28.1, -26.0],
                    [28.1, -25.9],
                    [28.0, -25.9],
                    [28.0, -26.0]
                ]]
            }
        }
    
    @patch('app.services.ai_inference.AIInferenceService.run_inference')
    async def test_prospectivity_inference_task(self, mock_run_inference, sample_aoi):
        """Test prospectivity inference Celery task"""
        # Mock service response
        mock_run_inference.return_value = {
            'inference_id': 'test-123',
            'status': 'completed',
            'prospectivity_cog': 's3://bucket/prospectivity.tif',
            'uncertainty_cog': 's3://bucket/uncertainty.tif',
            'metadata': {'model_version': 'v1.0.0'},
            'statistics': {
                'prospectivity': {'min': 0.0, 'max': 1.0, 'mean': 0.5, 'std': 0.2},
                'uncertainty': {'min': 0.0, 'max': 1.0, 'mean': 0.3, 'std': 0.1}
            }
        }
        
        # Run task
        result = await run_prospectivity_inference(
            aoi_geojson=sample_aoi,
            model_version="latest",
            org_id="test-org-id",
            project_id="test-project-id"
        )
        
        # Check result
        assert result['inference_id'] == 'test-123'
        assert result['status'] == 'completed'
        assert 'task_id' in result
        assert 'model_version' in result


class TestAIInferenceAcceptance:
    """Acceptance tests for AI inference functionality"""
    
    def test_dual_cog_generation_workflow(self, auth_headers):
        """Test that inference generates both prospectivity and uncertainty COGs"""
        # This would be an integration test that:
        # 1. Submits inference request
        # 2. Waits for completion
        # 3. Verifies both COG files exist
        # 4. Validates STAC item creation
        # 5. Checks file formats and metadata
        
        # Mock implementation for now
        inference_request = {
            "aoi": {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [28.0, -26.0],
                        [28.05, -26.0],
                        [28.05, -25.95],
                        [28.0, -25.95],
                        [28.0, -26.0]
                    ]]
                }
            }
        }
        
        with patch('app.tasks.ai_inference.run_prospectivity_inference.delay') as mock_task:
            mock_task.return_value.id = "test-task-id"
            
            # Start inference
            response = client.post(
                "/api/v1/inference/run",
                json=inference_request,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            task_id = response.json()['task_id']
            
            # Mock completed result
            with patch('app.core.celery_app.celery_app.AsyncResult') as mock_result:
                mock_result.return_value.state = 'SUCCESS'
                mock_result.return_value.result = {
                    'inference_id': 'test-123',
                    'status': 'completed',
                    'prospectivity_cog': 's3://bucket/ai-inference/test-123/prospectivity.tif',
                    'uncertainty_cog': 's3://bucket/ai-inference/test-123/uncertainty.tif',
                    'metadata': {
                        'model_version': 'latest',
                        'color_ramps': {
                            'prospectivity': {'min': 0.0, 'max': 1.0},
                            'uncertainty': {'min': 0.0, 'max': 1.0}
                        }
                    },
                    'statistics': {
                        'prospectivity': {'min': 0.0, 'max': 1.0, 'mean': 0.5, 'std': 0.2},
                        'uncertainty': {'min': 0.0, 'max': 1.0, 'mean': 0.3, 'std': 0.1}
                    },
                    'stac_item': {
                        'type': 'Feature',
                        'id': 'test-123',
                        'assets': {
                            'prospectivity': {'href': 's3://bucket/prospectivity.tif'},
                            'uncertainty': {'href': 's3://bucket/uncertainty.tif'}
                        }
                    }
                }
                
                # Get result
                result_response = client.get(
                    f"/api/v1/inference/result/{task_id}",
                    headers=auth_headers
                )
                
                assert result_response.status_code == 200
                result_data = result_response.json()
                
                # Verify dual COG outputs
                assert 'prospectivity_cog' in result_data
                assert 'uncertainty_cog' in result_data
                assert result_data['prospectivity_cog'].endswith('prospectivity.tif')
                assert result_data['uncertainty_cog'].endswith('uncertainty.tif')
                
                # Verify STAC item structure
                assert 'stac_item' in result_data['metadata']
                stac_item = result_data['metadata']['stac_item']
                assert 'prospectivity' in stac_item['assets']
                assert 'uncertainty' in stac_item['assets']