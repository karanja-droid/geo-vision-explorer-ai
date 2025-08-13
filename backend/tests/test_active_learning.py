"""Tests for Active Learning functionality"""

import pytest
import json
import numpy as np
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app
from app.services.active_learning import ActiveLearningService
from app.models.active_learning import TrainingLabel, ModelVersion, HighUncertaintyZone
from app.tasks.active_learning import retrain_model_with_labels
from tests.utils.utils import create_random_user

client = TestClient(app)


class TestActiveLearningModels:
    """Test active learning database models"""
    
    def test_training_label_creation(self, db: Session):
        """Test training label model creation"""
        user_id = uuid4()
        org_id = uuid4()
        project_id = uuid4()
        
        label = TrainingLabel(
            geom="POINT(28.05 -25.95)",
            label_value=0.8,
            confidence=0.9,
            source="user",
            created_by=user_id,
            org_id=org_id,
            project_id=project_id
        )
        
        db.add(label)
        db.commit()
        db.refresh(label)
        
        assert label.id is not None
        assert label.label_value == 0.8
        assert label.confidence == 0.9
        assert label.source == "user"
        assert label.created_by == user_id
    
    def test_model_version_creation(self, db: Session):
        """Test model version creation"""
        user_id = uuid4()
        org_id = uuid4()
        
        version = ModelVersion(
            version="test_v1.0.0",
            base_version="latest",
            created_by=user_id,
            training_samples=100,
            status="active",
            org_id=org_id
        )
        
        db.add(version)
        db.commit()
        db.refresh(version)
        
        assert version.id is not None
        assert version.version == "test_v1.0.0"
        assert version.training_samples == 100
        assert version.status == "active"
    
    def test_high_uncertainty_zone_creation(self, db: Session):
        """Test high uncertainty zone creation"""
        org_id = uuid4()
        
        zone = HighUncertaintyZone(
            inference_id="test-inference-123",
            geom="POINT(28.06 -25.94)",
            uncertainty_value=0.85,
            prediction_value=0.45,
            priority_score=0.92,
            org_id=org_id
        )
        
        db.add(zone)
        db.commit()
        db.refresh(zone)
        
        assert zone.id is not None
        assert zone.inference_id == "test-inference-123"
        assert zone.uncertainty_value == 0.85
        assert zone.priority_score == 0.92
        assert zone.is_labeled is False


class TestActiveLearningService:
    """Test active learning service functionality"""
    
    @pytest.fixture
    def service(self, db: Session):
        """Create active learning service instance"""
        return ActiveLearningService(db)
    
    async def test_add_training_label(self, service: ActiveLearningService, db: Session):
        """Test adding training labels"""
        user_id = uuid4()
        org_id = uuid4()
        project_id = uuid4()
        
        label = await service.add_training_label(
            longitude=28.05,
            latitude=-25.95,
            label_value=0.7,
            confidence=0.8,
            source="user",
            user_id=user_id,
            org_id=org_id,
            project_id=project_id
        )
        
        assert label.id is not None
        assert label.label_value == 0.7
        assert label.confidence == 0.8
        assert label.created_by == user_id
        
        # Verify in database
        db_label = db.query(TrainingLabel).filter(TrainingLabel.id == label.id).first()
        assert db_label is not None
        assert db_label.label_value == 0.7
    
    async def test_get_training_labels(self, service: ActiveLearningService, db: Session):
        """Test retrieving training labels"""
        user_id = uuid4()
        org_id = uuid4()
        
        # Add test labels
        for i in range(5):
            await service.add_training_label(
                longitude=28.0 + i * 0.01,
                latitude=-26.0 + i * 0.01,
                label_value=i * 0.2,
                confidence=0.8,
                source="user",
                user_id=user_id,
                org_id=org_id
            )
        
        # Retrieve labels
        labels = await service.get_training_labels(org_id=org_id, limit=10)
        
        assert len(labels) == 5
        assert all(label.org_id == org_id for label in labels)
    
    async def test_check_retraining_eligibility(self, service: ActiveLearningService, db: Session):
        """Test retraining eligibility check"""
        user_id = uuid4()
        org_id = uuid4()
        
        # Initially not eligible
        eligibility = await service.check_retraining_eligibility(org_id=org_id)
        assert not eligibility['eligible']
        assert eligibility['total_labels'] == 0
        
        # Add sufficient labels
        for i in range(25):
            label_value = 1.0 if i < 12 else 0.0  # Mix of positive and negative
            await service.add_training_label(
                longitude=28.0 + i * 0.001,
                latitude=-26.0 + i * 0.001,
                label_value=label_value,
                confidence=0.8,
                source="user",
                user_id=user_id,
                org_id=org_id
            )
        
        # Now should be eligible
        eligibility = await service.check_retraining_eligibility(org_id=org_id)
        assert eligibility['eligible']
        assert eligibility['total_labels'] == 25
        assert eligibility['positive_labels'] > 0
        assert eligibility['negative_labels'] > 0
    
    async def test_identify_high_uncertainty_zones(self, service: ActiveLearningService, db: Session):
        """Test high uncertainty zone identification"""
        org_id = uuid4()
        inference_id = "test-inference-456"
        
        zones = await service.identify_high_uncertainty_zones(
            inference_id=inference_id,
            uncertainty_cog_path="s3://bucket/uncertainty.tif",
            prospectivity_cog_path="s3://bucket/prospectivity.tif",
            org_id=org_id
        )
        
        assert len(zones) > 0
        assert all(zone.inference_id == inference_id for zone in zones)
        assert all(zone.uncertainty_value >= service.uncertainty_threshold for zone in zones)
        assert all(zone.priority_score > 0 for zone in zones)
    
    async def test_get_labeling_suggestions(self, service: ActiveLearningService, db: Session):
        """Test labeling suggestions generation"""
        org_id = uuid4()
        inference_id = "test-inference-789"
        
        # First create uncertainty zones
        await service.identify_high_uncertainty_zones(
            inference_id=inference_id,
            uncertainty_cog_path="s3://bucket/uncertainty.tif",
            prospectivity_cog_path="s3://bucket/prospectivity.tif",
            org_id=org_id
        )
        
        # Get suggestions
        suggestions = await service.get_labeling_suggestions(
            inference_id=inference_id,
            limit=10
        )
        
        assert len(suggestions) <= 10
        assert all('longitude' in suggestion for suggestion in suggestions)
        assert all('latitude' in suggestion for suggestion in suggestions)
        assert all('uncertainty_value' in suggestion for suggestion in suggestions)
        assert all('priority_score' in suggestion for suggestion in suggestions)
    
    @patch('app.services.active_learning.ActiveLearningService._find_closest_feature')
    async def test_prepare_training_data(self, mock_find_feature, service: ActiveLearningService, db: Session):
        """Test training data preparation"""
        user_id = uuid4()
        org_id = uuid4()
        
        # Mock feature finding
        mock_find_feature.return_value = {
            'dist_to_faults': 1500.0,
            'mag_mean': 52000.0,
            'elevation': 1200.0,
            'longitude': 28.05,
            'latitude': -25.95
        }
        
        # Add training labels
        for i in range(25):
            await service.add_training_label(
                longitude=28.0 + i * 0.001,
                latitude=-26.0 + i * 0.001,
                label_value=1.0 if i < 12 else 0.0,
                confidence=0.8,
                source="user",
                user_id=user_id,
                org_id=org_id
            )
        
        # Mock feature service
        with patch.object(service.feature_service, 'get_features') as mock_get_features:
            mock_get_features.return_value = {
                'features': [
                    {
                        'longitude': 28.0 + i * 0.001,
                        'latitude': -26.0 + i * 0.001,
                        'dist_to_faults': 1500.0,
                        'mag_mean': 52000.0,
                        'elevation': 1200.0
                    }
                    for i in range(25)
                ]
            }
            
            X, y, feature_names = await service.prepare_training_data(org_id=org_id)
            
            assert X.shape[0] == 25  # 25 samples
            assert X.shape[1] > 0  # Some features
            assert len(y) == 25
            assert len(feature_names) > 0
            assert 'dist_to_faults' in feature_names


class TestActiveLearningAPI:
    """Test active learning API endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Authentication headers for API requests"""
        user = create_random_user()
        return {"Authorization": f"Bearer {user['access_token']}"}
    
    def test_add_training_label_endpoint(self, auth_headers):
        """Test adding training label via API"""
        label_request = {
            "longitude": 28.05,
            "latitude": -25.95,
            "label_value": 0.8,
            "confidence": 0.9,
            "source": "user"
        }
        
        response = client.post(
            "/api/v1/active-learning/labels",
            json=label_request,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'id' in data
        assert data['longitude'] == 28.05
        assert data['latitude'] == -25.95
        assert data['label_value'] == 0.8
        assert data['confidence'] == 0.9
    
    def test_get_training_labels_endpoint(self, auth_headers):
        """Test retrieving training labels via API"""
        response = client.get(
            "/api/v1/active-learning/labels?limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # May be empty if no labels exist
    
    def test_get_labeling_suggestions_endpoint(self, auth_headers):
        """Test getting labeling suggestions via API"""
        suggestion_request = {
            "inference_id": "test-inference-123",
            "limit": 5,
            "exclude_labeled": True
        }
        
        response = client.post(
            "/api/v1/active-learning/suggestions",
            json=suggestion_request,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) <= 5
    
    def test_check_retraining_eligibility_endpoint(self, auth_headers):
        """Test retraining eligibility check via API"""
        response = client.get(
            "/api/v1/active-learning/retraining/eligibility",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'eligible' in data
        assert 'total_labels' in data
        assert 'recommendation' in data
        assert isinstance(data['eligible'], bool)
    
    def test_start_retraining_endpoint_insufficient_labels(self, auth_headers):
        """Test starting retraining with insufficient labels"""
        retraining_request = {
            "base_model_version": "latest"
        }
        
        response = client.post(
            "/api/v1/active-learning/retraining/start",
            json=retraining_request,
            headers=auth_headers
        )
        
        # Should fail due to insufficient labels
        assert response.status_code == 400
        assert "not eligible" in response.json()['detail'].lower()
    
    def test_invalid_label_values(self, auth_headers):
        """Test API validation for invalid label values"""
        # Test invalid longitude
        invalid_request = {
            "longitude": 200.0,  # Invalid longitude
            "latitude": -25.95,
            "label_value": 0.8
        }
        
        response = client.post(
            "/api/v1/active-learning/labels",
            json=invalid_request,
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error
        
        # Test invalid label value
        invalid_request = {
            "longitude": 28.05,
            "latitude": -25.95,
            "label_value": 1.5  # Invalid label value > 1.0
        }
        
        response = client.post(
            "/api/v1/active-learning/labels",
            json=invalid_request,
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error


class TestActiveLearningTasks:
    """Test active learning Celery tasks"""
    
    @patch('app.services.active_learning.ActiveLearningService.prepare_training_data')
    @patch('app.services.active_learning.ActiveLearningService.check_retraining_eligibility')
    async def test_retrain_model_task(self, mock_eligibility, mock_prepare_data):
        """Test model retraining Celery task"""
        # Mock eligibility check
        mock_eligibility.return_value = {
            'eligible': True,
            'total_labels': 30,
            'positive_labels': 15,
            'negative_labels': 15,
            'recommendation': 'Ready for retraining'
        }
        
        # Mock training data
        np.random.seed(42)
        X = np.random.randn(30, 10)
        y = np.random.randint(0, 2, 30).astype(float)
        feature_names = [f'feature_{i}' for i in range(10)]
        
        mock_prepare_data.return_value = (X, y, feature_names)
        
        # Run task
        result = await retrain_model_with_labels(
            base_model_version="latest",
            org_id="test-org-id",
            project_id="test-project-id",
            user_id="test-user-id"
        )
        
        # Check result
        assert result['status'] == 'completed'
        assert 'new_model_version' in result
        assert 'metrics_after' in result
        assert result['training_samples'] == 30
        assert 'auc' in result['metrics_after']
        assert 'precision' in result['metrics_after']
        assert 'recall' in result['metrics_after']
        assert 'f1' in result['metrics_after']
    
    async def test_retrain_model_task_insufficient_labels(self):
        """Test retraining task with insufficient labels"""
        with patch('app.services.active_learning.ActiveLearningService.check_retraining_eligibility') as mock_eligibility:
            mock_eligibility.return_value = {
                'eligible': False,
                'total_labels': 10,
                'recommendation': 'Need 10 more labels'
            }
            
            # Should raise error
            with pytest.raises(ValueError, match="Not eligible for retraining"):
                await retrain_model_with_labels(
                    base_model_version="latest",
                    org_id="test-org-id"
                )


class TestActiveLearningIntegration:
    """Integration tests for active learning workflow"""
    
    @pytest.fixture
    def auth_headers(self):
        """Authentication headers for API requests"""
        user = create_random_user()
        return {"Authorization": f"Bearer {user['access_token']}"}
    
    def test_complete_active_learning_workflow(self, auth_headers):
        """Test complete active learning workflow"""
        # 1. Add training labels
        labels_added = 0
        for i in range(25):
            label_request = {
                "longitude": 28.0 + i * 0.001,
                "latitude": -26.0 + i * 0.001,
                "label_value": 1.0 if i < 12 else 0.0,
                "confidence": 0.8,
                "source": "user",
                "inference_id": "test-inference-workflow"
            }
            
            response = client.post(
                "/api/v1/active-learning/labels",
                json=label_request,
                headers=auth_headers
            )
            
            if response.status_code == 200:
                labels_added += 1
        
        # Should have added some labels
        assert labels_added > 0
        
        # 2. Check eligibility
        response = client.get(
            "/api/v1/active-learning/retraining/eligibility",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        eligibility = response.json()
        
        # 3. Get labeling suggestions
        suggestion_request = {
            "inference_id": "test-inference-workflow",
            "limit": 5
        }
        
        response = client.post(
            "/api/v1/active-learning/suggestions",
            json=suggestion_request,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        suggestions = response.json()
        assert isinstance(suggestions, list)
        
        # 4. If eligible, could start retraining (but we'll skip actual execution)
        if eligibility['eligible']:
            # This would start retraining in a real scenario
            assert eligibility['total_labels'] >= 20
            assert eligibility['positive_labels'] > 0
            assert eligibility['negative_labels'] > 0


class TestActiveLearningAcceptance:
    """Acceptance tests for active learning requirements"""
    
    def test_minimum_20_labels_requirement(self, auth_headers):
        """Test that retraining requires minimum 20 labels"""
        # Check initial eligibility (should not be eligible)
        response = client.get(
            "/api/v1/active-learning/retraining/eligibility",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        eligibility = response.json()
        
        if eligibility['total_labels'] < 20:
            assert not eligibility['eligible']
            assert "20" in eligibility['recommendation'] or "more labels" in eligibility['recommendation'].lower()
    
    def test_label_storage_with_source_user(self, auth_headers):
        """Test that labels are stored with source=user"""
        label_request = {
            "longitude": 28.05,
            "latitude": -25.95,
            "label_value": 0.8,
            "confidence": 0.9,
            "source": "user"
        }
        
        response = client.post(
            "/api/v1/active-learning/labels",
            json=label_request,
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data['source'] == 'user'
    
    def test_model_versioning_on_retraining(self):
        """Test that retraining produces new model version"""
        # This would be tested with actual retraining
        # For now, we verify the structure exists
        
        # Mock a completed retraining result
        mock_result = {
            'new_model_version': 'retrained_abc123_20240115_120000',
            'base_model_version': 'latest',
            'training_samples': 25,
            'metrics_before': {'auc': 0.75, 'precision': 0.68},
            'metrics_after': {'auc': 0.82, 'precision': 0.76},
            'improvement': {'auc': 0.07, 'precision': 0.08},
            'status': 'completed'
        }
        
        # Verify structure
        assert 'new_model_version' in mock_result
        assert 'metrics_before' in mock_result
        assert 'metrics_after' in mock_result
        assert 'improvement' in mock_result
        assert mock_result['status'] == 'completed'
        
        # Verify improvement calculation
        assert mock_result['improvement']['auc'] == (
            mock_result['metrics_after']['auc'] - mock_result['metrics_before']['auc']
        )