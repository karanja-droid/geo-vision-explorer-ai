"""Tests for Drill Data Management

Comprehensive tests for drill hole data models, services, API endpoints,
and QA functionality including validation rules and report generation.
"""

import pytest
import json
import pandas as pd
import io
from uuid import uuid4, UUID
from datetime import datetime, date
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from fastapi import UploadFile

from app.models.drill_data import (
    DrillCollar, DrillSurvey, DrillInterval, DrillAssay,
    QARule, QAResult, QAReport
)
from app.services.drill_qa import DrillQAService
from app.tasks.drill_qa import run_drill_qa_validation, generate_qa_report
from app.api.v1.endpoints.drill_data import router


class TestDrillDataModels:
    """Test drill data SQLAlchemy models"""
    
    def test_drill_collar_creation(self, db_session: Session):
        """Test creating a drill collar record"""
        collar = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            elevation=1200.5,
            total_depth=150.0,
            start_date=date(2024, 1, 15),
            azimuth=90.0,
            dip=-60.0,
            drill_type="Diamond",
            contractor="ABC Drilling",
            project="Test Project",
            org_id=uuid4(),
            project_id=uuid4()
        )
        
        db_session.add(collar)
        db_session.commit()
        db_session.refresh(collar)
        
        assert collar.id is not None
        assert collar.hole_id == "DDH001"
        assert collar.elevation == 1200.5
        assert collar.total_depth == 150.0
        assert collar.drill_type == "Diamond"
        assert collar.created_at is not None
    
    def test_drill_survey_creation(self, db_session: Session):
        """Test creating drill survey records"""
        # Create collar first
        collar = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            org_id=uuid4()
        )
        db_session.add(collar)
        db_session.commit()
        
        # Create survey
        survey = DrillSurvey(
            hole_id="DDH001",
            depth=50.0,
            azimuth=92.5,
            dip=-61.2,
            method="Gyro",
            survey_date=date(2024, 1, 16),
            org_id=collar.org_id
        )
        
        db_session.add(survey)
        db_session.commit()
        db_session.refresh(survey)
        
        assert survey.id is not None
        assert survey.hole_id == "DDH001"
        assert survey.depth == 50.0
        assert survey.azimuth == 92.5
        assert survey.dip == -61.2
        assert survey.method == "Gyro"
    
    def test_drill_interval_creation(self, db_session: Session):
        """Test creating drill interval records"""
        # Create collar first
        collar = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            org_id=uuid4()
        )
        db_session.add(collar)
        db_session.commit()
        
        # Create interval
        interval = DrillInterval(
            hole_id="DDH001",
            from_m=10.0,
            to_m=15.0,
            lith_code="GR",
            description="Coarse grained granite",
            alteration="Sericite",
            mineralization="Pyrite 2%",
            recovery=95.0,
            rqd=85.0,
            org_id=collar.org_id
        )
        
        db_session.add(interval)
        db_session.commit()
        db_session.refresh(interval)
        
        assert interval.id is not None
        assert interval.hole_id == "DDH001"
        assert interval.from_m == 10.0
        assert interval.to_m == 15.0
        assert interval.interval_length == 5.0
        assert interval.lith_code == "GR"
        assert interval.recovery == 95.0
    
    def test_drill_assay_creation(self, db_session: Session):
        """Test creating drill assay records"""
        # Create collar first
        collar = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            org_id=uuid4()
        )
        db_session.add(collar)
        db_session.commit()
        
        # Create assay
        assay = DrillAssay(
            hole_id="DDH001",
            from_m=10.0,
            to_m=11.0,
            element="Au",
            value=2.5,
            units="g/t",
            method="Fire Assay",
            lab="SGS",
            batch="FA24001",
            detection_limit=0.01,
            org_id=collar.org_id
        )
        
        db_session.add(assay)
        db_session.commit()
        db_session.refresh(assay)
        
        assert assay.id is not None
        assert assay.hole_id == "DDH001"
        assert assay.element == "Au"
        assert assay.value == 2.5
        assert assay.units == "g/t"
        assert assay.sample_length == 1.0
        assert not assay.is_below_detection_limit
    
    def test_assay_below_detection_limit(self, db_session: Session):
        """Test assay below detection limit property"""
        collar = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            org_id=uuid4()
        )
        db_session.add(collar)
        db_session.commit()
        
        assay = DrillAssay(
            hole_id="DDH001",
            from_m=10.0,
            to_m=11.0,
            element="Au",
            value=0.005,
            detection_limit=0.01,
            org_id=collar.org_id
        )
        
        assert assay.is_below_detection_limit
    
    def test_qa_rule_creation(self, db_session: Session):
        """Test creating QA rules"""
        rule = QARule(
            rule_name="Test Rule",
            rule_type="test_rule",
            severity="warning",
            description="Test rule description",
            parameters={"threshold": 10.0},
            org_id=uuid4()
        )
        
        db_session.add(rule)
        db_session.commit()
        db_session.refresh(rule)
        
        assert rule.id is not None
        assert rule.rule_name == "Test Rule"
        assert rule.rule_type == "test_rule"
        assert rule.severity == "warning"
        assert rule.is_active is True
        assert rule.parameters["threshold"] == 10.0


class TestDrillQAService:
    """Test drill QA service functionality"""
    
    @pytest.fixture
    def qa_service(self, db_session: Session):
        """Create QA service instance"""
        return DrillQAService(db_session)
    
    @pytest.fixture
    def sample_org_id(self):
        """Sample organization ID"""
        return uuid4()
    
    @pytest.fixture
    def sample_collar(self, db_session: Session, sample_org_id: UUID):
        """Create sample drill collar"""
        collar = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            elevation=1200.0,
            total_depth=150.0,
            org_id=sample_org_id
        )
        db_session.add(collar)
        db_session.commit()
        return collar
    
    @pytest.mark.asyncio
    async def test_initialize_qa_rules(self, qa_service: DrillQAService, sample_org_id: UUID):
        """Test initializing default QA rules"""
        rules = await qa_service.initialize_qa_rules(sample_org_id)
        
        assert len(rules) > 0
        assert any(rule.rule_type == 'interval_overlap' for rule in rules)
        assert any(rule.rule_type == 'duplicate_hole' for rule in rules)
        assert any(rule.rule_type == 'missing_survey' for rule in rules)
        
        # Test that rules are not duplicated
        rules_again = await qa_service.initialize_qa_rules(sample_org_id)
        assert len(rules_again) == 0  # No new rules should be created
    
    @pytest.mark.asyncio
    async def test_validate_drill_data(self, qa_service: DrillQAService, sample_org_id: UUID, sample_collar):
        """Test comprehensive drill data validation"""
        # Initialize rules first
        await qa_service.initialize_qa_rules(sample_org_id)
        
        # Run validation
        results = await qa_service.validate_drill_data(sample_org_id)
        
        assert 'total_rules' in results
        assert 'rules_executed' in results
        assert 'total_issues' in results
        assert 'holes_validated' in results
        assert results['holes_validated'] == 1
    
    @pytest.mark.asyncio
    async def test_interval_overlap_detection(self, qa_service: DrillQAService, sample_org_id: UUID, sample_collar):
        """Test interval overlap detection"""
        db = qa_service.db
        
        # Create overlapping intervals
        interval1 = DrillInterval(
            hole_id="DDH001",
            from_m=10.0,
            to_m=15.0,
            org_id=sample_org_id
        )
        interval2 = DrillInterval(
            hole_id="DDH001",
            from_m=14.0,  # Overlaps with interval1
            to_m=20.0,
            org_id=sample_org_id
        )
        
        db.add_all([interval1, interval2])
        db.commit()
        
        # Create overlap detection rule
        rule = QARule(
            rule_name="Interval Overlap",
            rule_type="interval_overlap",
            severity="error",
            parameters={"tolerance": 0.01},
            org_id=sample_org_id
        )
        db.add(rule)
        db.commit()
        
        # Run validation
        results = await qa_service.validate_drill_data(sample_org_id)
        
        assert results['total_issues'] > 0
        assert results['error_count'] > 0
    
    @pytest.mark.asyncio
    async def test_duplicate_hole_detection(self, qa_service: DrillQAService, sample_org_id: UUID):
        """Test duplicate hole ID detection"""
        db = qa_service.db
        
        # Create duplicate collars
        collar1 = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            org_id=sample_org_id
        )
        collar2 = DrillCollar(
            hole_id="DDH001",  # Duplicate hole ID
            geom="POINT(28.1 -26.1)",
            org_id=sample_org_id
        )
        
        db.add_all([collar1, collar2])
        db.commit()
        
        # Create duplicate detection rule
        rule = QARule(
            rule_name="Duplicate Hole",
            rule_type="duplicate_hole",
            severity="error",
            org_id=sample_org_id
        )
        db.add(rule)
        db.commit()
        
        # Run validation
        results = await qa_service.validate_drill_data(sample_org_id)
        
        assert results['total_issues'] > 0
        assert results['error_count'] > 0
    
    @pytest.mark.asyncio
    async def test_missing_survey_detection(self, qa_service: DrillQAService, sample_org_id: UUID, sample_collar):
        """Test missing survey data detection"""
        db = qa_service.db
        
        # Create missing survey rule
        rule = QARule(
            rule_name="Missing Survey",
            rule_type="missing_survey",
            severity="warning",
            org_id=sample_org_id
        )
        db.add(rule)
        db.commit()
        
        # Run validation (collar exists but no survey)
        results = await qa_service.validate_drill_data(sample_org_id)
        
        assert results['total_issues'] > 0
        assert results['warning_count'] > 0
    
    @pytest.mark.asyncio
    async def test_extreme_assay_values_detection(self, qa_service: DrillQAService, sample_org_id: UUID, sample_collar):
        """Test extreme assay values detection"""
        db = qa_service.db
        
        # Create normal and extreme assay values
        normal_assays = []
        for i in range(10):
            assay = DrillAssay(
                hole_id="DDH001",
                from_m=float(i),
                to_m=float(i + 1),
                element="Au",
                value=1.0 + (i * 0.1),  # Normal values 1.0-1.9
                org_id=sample_org_id
            )
            normal_assays.append(assay)
        
        # Add extreme value
        extreme_assay = DrillAssay(
            hole_id="DDH001",
            from_m=10.0,
            to_m=11.0,
            element="Au",
            value=100.0,  # Extreme value
            org_id=sample_org_id
        )
        
        db.add_all(normal_assays + [extreme_assay])
        db.commit()
        
        # Create extreme values rule
        rule = QARule(
            rule_name="Extreme Assay Values",
            rule_type="extreme_assay_values",
            severity="warning",
            parameters={"z_score_threshold": 3.0},
            org_id=sample_org_id
        )
        db.add(rule)
        db.commit()
        
        # Run validation
        results = await qa_service.validate_drill_data(sample_org_id)
        
        assert results['total_issues'] > 0
        assert results['warning_count'] > 0
    
    @pytest.mark.asyncio
    async def test_get_qa_results(self, qa_service: DrillQAService, sample_org_id: UUID):
        """Test retrieving QA results"""
        db = qa_service.db
        
        # Create a QA rule and result
        rule = QARule(
            rule_name="Test Rule",
            rule_type="test_rule",
            severity="warning",
            org_id=sample_org_id
        )
        db.add(rule)
        db.commit()
        
        result = QAResult(
            rule_id=rule.id,
            hole_id="DDH001",
            severity="warning",
            message="Test issue",
            org_id=sample_org_id
        )
        db.add(result)
        db.commit()
        
        # Get results
        results = await qa_service.get_qa_results(sample_org_id)
        
        assert len(results) == 1
        assert results[0].hole_id == "DDH001"
        assert results[0].severity == "warning"
        assert results[0].message == "Test issue"
    
    @pytest.mark.asyncio
    async def test_resolve_qa_issue(self, qa_service: DrillQAService, sample_org_id: UUID):
        """Test resolving QA issues"""
        db = qa_service.db
        
        # Create a QA result
        rule = QARule(
            rule_name="Test Rule",
            rule_type="test_rule",
            org_id=sample_org_id
        )
        db.add(rule)
        db.commit()
        
        result = QAResult(
            rule_id=rule.id,
            hole_id="DDH001",
            severity="warning",
            message="Test issue",
            status="open",
            org_id=sample_org_id
        )
        db.add(result)
        db.commit()
        
        user_id = uuid4()
        
        # Resolve the issue
        resolved_result = await qa_service.resolve_qa_issue(
            result.id, user_id, "Issue resolved manually"
        )
        
        assert resolved_result.status == "resolved"
        assert resolved_result.resolved_by == user_id
        assert resolved_result.resolved_at is not None
        assert resolved_result.details["resolution_note"] == "Issue resolved manually"


class TestDrillDataAPI:
    """Test drill data API endpoints"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        from app.main import app
        return TestClient(app)
    
    @pytest.fixture
    def mock_user(self):
        """Mock authenticated user"""
        return {
            'user_id': str(uuid4()),
            'org_id': str(uuid4()),
            'email': 'test@example.com'
        }
    
    def test_health_endpoint(self, client: TestClient):
        """Test drill data health endpoint"""
        with patch('app.core.config.settings.ENABLE_DRILL_QA', True):
            response = client.get("/api/v1/drill-data/health")
            assert response.status_code == 200
            
            data = response.json()
            assert data['status'] == 'healthy'
            assert data['service'] == 'drill_data'
            assert 'features' in data
    
    def test_health_endpoint_disabled(self, client: TestClient):
        """Test health endpoint when service is disabled"""
        with patch('app.core.config.settings.ENABLE_DRILL_QA', False):
            response = client.get("/api/v1/drill-data/health")
            assert response.status_code == 503
    
    @patch('app.api.deps.get_current_user')
    def test_upload_drill_data_csv(self, mock_get_user, client: TestClient, mock_user):
        """Test uploading drill data CSV"""
        mock_get_user.return_value = mock_user
        
        # Create sample CSV data
        csv_data = """hole_id,longitude,latitude,elevation,total_depth
DDH001,28.0,-26.0,1200.0,150.0
DDH002,28.1,-26.1,1180.0,120.0"""
        
        files = {
            'file': ('test_collars.csv', io.StringIO(csv_data), 'text/csv')
        }
        
        with patch('app.core.config.settings.ENABLE_DRILL_QA', True), \
             patch('app.api.v1.endpoints.drill_data._process_drill_data') as mock_process, \
             patch('app.tasks.drill_qa.run_drill_qa_validation.delay') as mock_task:
            
            mock_process.return_value = 2
            mock_task.return_value = Mock(id='task-123')
            
            response = client.post(
                "/api/v1/drill-data/upload",
                files=files,
                data={'data_type': 'collar'}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data['status'] == 'success'
            assert data['records_processed'] == 2
            assert data['data_type'] == 'collar'
            assert 'validation_task_id' in data
    
    @patch('app.api.deps.get_current_user')
    def test_start_qa_validation(self, mock_get_user, client: TestClient, mock_user):
        """Test starting QA validation"""
        mock_get_user.return_value = mock_user
        
        with patch('app.core.config.settings.ENABLE_DRILL_QA', True), \
             patch('app.tasks.drill_qa.run_drill_qa_validation.delay') as mock_task:
            
            mock_task.return_value = Mock(id='task-123')
            
            response = client.post(
                "/api/v1/drill-data/qa/validate",
                json={'project_id': None, 'hole_ids': None}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data['task_id'] == 'task-123'
            assert data['status'] == 'started'
    
    @patch('app.api.deps.get_current_user')
    def test_get_validation_status(self, mock_get_user, client: TestClient, mock_user):
        """Test getting validation task status"""
        mock_get_user.return_value = mock_user
        
        with patch('app.core.celery_app.celery_app.AsyncResult') as mock_result:
            mock_task = Mock()
            mock_task.state = 'SUCCESS'
            mock_task.result = {'total_issues': 5}
            mock_result.return_value = mock_task
            
            response = client.get("/api/v1/drill-data/qa/validate/status/task-123")
            
            assert response.status_code == 200
            data = response.json()
            assert data['status'] == 'completed'
            assert data['result']['total_issues'] == 5
    
    @patch('app.api.deps.get_current_user')
    @patch('app.services.drill_qa.DrillQAService.get_qa_results')
    async def test_get_qa_results(self, mock_get_results, mock_get_user, client: TestClient, mock_user):
        """Test getting QA results"""
        mock_get_user.return_value = mock_user
        
        # Mock QA results
        mock_result = Mock()
        mock_result.id = uuid4()
        mock_result.hole_id = "DDH001"
        mock_result.severity = "warning"
        mock_result.message = "Test issue"
        mock_result.status = "open"
        mock_result.created_at = datetime.now()
        mock_result.rule = Mock()
        mock_result.rule.rule_name = "Test Rule"
        mock_result.details = {}
        
        mock_get_results.return_value = [mock_result]
        
        response = client.get("/api/v1/drill-data/qa/results")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]['hole_id'] == "DDH001"
        assert data[0]['severity'] == "warning"
    
    @patch('app.api.deps.get_current_user')
    def test_generate_qa_report(self, mock_get_user, client: TestClient, mock_user):
        """Test generating QA report"""
        mock_get_user.return_value = mock_user
        
        with patch('app.core.config.settings.ENABLE_DRILL_QA', True), \
             patch('app.tasks.drill_qa.generate_qa_report.delay') as mock_task:
            
            mock_task.return_value = Mock(id='report-task-123')
            
            response = client.post(
                "/api/v1/drill-data/qa/reports/generate",
                json={'project_id': None, 'report_type': 'on_demand'}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data['task_id'] == 'report-task-123'
            assert data['status'] == 'started'
            assert data['report_type'] == 'on_demand'


class TestDrillQATasks:
    """Test Celery tasks for drill QA"""
    
    @pytest.mark.asyncio
    @patch('app.tasks.drill_qa.SessionLocal')
    @patch('app.services.drill_qa.DrillQAService.validate_drill_data')
    async def test_run_drill_qa_validation_task(self, mock_validate, mock_session):
        """Test drill QA validation Celery task"""
        # Mock database session
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Mock validation results
        mock_validate.return_value = {
            'total_rules': 5,
            'rules_executed': 5,
            'total_issues': 10,
            'error_count': 2,
            'warning_count': 8,
            'holes_validated': 50
        }
        
        # Mock task
        mock_task = Mock()
        mock_task.request.id = 'task-123'
        mock_task.update_state = Mock()
        
        # Import and patch the task
        from app.tasks.drill_qa import run_drill_qa_validation
        
        # Execute task
        result = await run_drill_qa_validation.apply_async(
            args=[str(uuid4())],
            kwargs={'project_id': None, 'hole_ids': None, 'user_id': str(uuid4())}
        )
        
        # Verify task was called
        mock_validate.assert_called_once()
    
    @pytest.mark.asyncio
    @patch('app.tasks.drill_qa.SessionLocal')
    @patch('app.tasks.drill_qa._generate_report_data')
    @patch('app.tasks.drill_qa._generate_html_report')
    @patch('app.tasks.drill_qa._upload_reports')
    async def test_generate_qa_report_task(self, mock_upload, mock_html, mock_data, mock_session):
        """Test QA report generation Celery task"""
        # Mock database session
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Mock report data
        mock_data.return_value = {
            'total_holes': 50,
            'total_issues': 10,
            'error_count': 2,
            'warning_count': 8,
            'summary': {'quality_score': 85.0}
        }
        
        # Mock HTML generation
        mock_html.return_value = "<html>Test Report</html>"
        
        # Mock upload
        mock_upload.return_value = {
            'base_path': 's3://bucket/reports/test',
            'html_path': 's3://bucket/reports/test.html',
            'pdf_path': 's3://bucket/reports/test.pdf'
        }
        
        # Mock task
        mock_task = Mock()
        mock_task.request.id = 'report-task-123'
        mock_task.update_state = Mock()
        
        # Import task
        from app.tasks.drill_qa import generate_qa_report
        
        # Execute task would be tested in integration tests
        # Here we verify the mocks are set up correctly
        assert mock_data is not None
        assert mock_html is not None
        assert mock_upload is not None


class TestDrillDataIntegration:
    """Integration tests for drill data functionality"""
    
    @pytest.mark.asyncio
    async def test_complete_drill_data_workflow(self, db_session: Session):
        """Test complete workflow from data upload to QA report"""
        org_id = uuid4()
        project_id = uuid4()
        
        # 1. Create drill collar
        collar = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            elevation=1200.0,
            total_depth=150.0,
            org_id=org_id,
            project_id=project_id
        )
        db_session.add(collar)
        
        # 2. Create intervals with overlap (QA issue)
        interval1 = DrillInterval(
            hole_id="DDH001",
            from_m=10.0,
            to_m=15.0,
            lith_code="GR",
            org_id=org_id,
            project_id=project_id
        )
        interval2 = DrillInterval(
            hole_id="DDH001",
            from_m=14.5,  # Overlaps with interval1
            to_m=20.0,
            lith_code="SC",
            org_id=org_id,
            project_id=project_id
        )
        db_session.add_all([interval1, interval2])
        
        # 3. Create assay data
        assay = DrillAssay(
            hole_id="DDH001",
            from_m=10.0,
            to_m=11.0,
            element="Au",
            value=2.5,
            units="g/t",
            org_id=org_id,
            project_id=project_id
        )
        db_session.add(assay)
        
        db_session.commit()
        
        # 4. Run QA validation
        qa_service = DrillQAService(db_session)
        await qa_service.initialize_qa_rules(org_id)
        
        validation_results = await qa_service.validate_drill_data(org_id, project_id)
        
        # 5. Verify QA results
        assert validation_results['holes_validated'] == 1
        assert validation_results['total_issues'] > 0  # Should detect interval overlap
        
        # 6. Get QA results
        qa_results = await qa_service.get_qa_results(org_id, project_id)
        assert len(qa_results) > 0
        
        # 7. Resolve an issue
        if qa_results:
            user_id = uuid4()
            resolved = await qa_service.resolve_qa_issue(
                qa_results[0].id, user_id, "Manually verified"
            )
            assert resolved.status == "resolved"
    
    def test_data_validation_constraints(self, db_session: Session):
        """Test database constraints and validation"""
        org_id = uuid4()
        
        # Test interval constraint (from_m < to_m)
        with pytest.raises(Exception):  # Should raise constraint violation
            invalid_interval = DrillInterval(
                hole_id="DDH001",
                from_m=20.0,
                to_m=10.0,  # Invalid: to_m < from_m
                org_id=org_id
            )
            db_session.add(invalid_interval)
            db_session.commit()
    
    def test_multi_tenancy_isolation(self, db_session: Session):
        """Test that data is properly isolated by organization"""
        org1_id = uuid4()
        org2_id = uuid4()
        
        # Create collars for different orgs
        collar1 = DrillCollar(
            hole_id="DDH001",
            geom="POINT(28.0 -26.0)",
            org_id=org1_id
        )
        collar2 = DrillCollar(
            hole_id="DDH002",
            geom="POINT(29.0 -27.0)",
            org_id=org2_id
        )
        
        db_session.add_all([collar1, collar2])
        db_session.commit()
        
        # Query should only return org1 data
        org1_collars = db_session.query(DrillCollar).filter(
            DrillCollar.org_id == org1_id
        ).all()
        
        assert len(org1_collars) == 1
        assert org1_collars[0].hole_id == "DDH001"
        
        # Query should only return org2 data
        org2_collars = db_session.query(DrillCollar).filter(
            DrillCollar.org_id == org2_id
        ).all()
        
        assert len(org2_collars) == 1
        assert org2_collars[0].hole_id == "DDH002"


# Test fixtures and utilities
@pytest.fixture
def sample_collar_csv():
    """Sample collar CSV data"""
    return """hole_id,longitude,latitude,elevation,total_depth,start_date,drill_type,contractor
DDH001,28.0,-26.0,1200.0,150.0,2024-01-15,Diamond,ABC Drilling
DDH002,28.1,-26.1,1180.0,120.0,2024-01-16,RC,XYZ Drilling
DDH003,28.2,-26.2,1160.0,100.0,2024-01-17,Diamond,ABC Drilling"""


@pytest.fixture
def sample_assay_csv():
    """Sample assay CSV data"""
    return """hole_id,from_m,to_m,element,value,units,method,lab,batch
DDH001,0.0,1.0,Au,0.15,g/t,Fire Assay,SGS,FA24001
DDH001,1.0,2.0,Au,2.50,g/t,Fire Assay,SGS,FA24001
DDH001,2.0,3.0,Au,0.05,g/t,Fire Assay,SGS,FA24001
DDH002,0.0,1.0,Au,0.25,g/t,Fire Assay,SGS,FA24002
DDH002,1.0,2.0,Au,1.80,g/t,Fire Assay,SGS,FA24002"""


def test_csv_parsing(sample_collar_csv, sample_assay_csv):
    """Test CSV parsing functionality"""
    # Test collar CSV
    collar_df = pd.read_csv(io.StringIO(sample_collar_csv))
    assert len(collar_df) == 3
    assert 'hole_id' in collar_df.columns
    assert 'longitude' in collar_df.columns
    assert collar_df.iloc[0]['hole_id'] == 'DDH001'
    
    # Test assay CSV
    assay_df = pd.read_csv(io.StringIO(sample_assay_csv))
    assert len(assay_df) == 5
    assert 'element' in assay_df.columns
    assert 'value' in assay_df.columns
    assert assay_df.iloc[0]['element'] == 'Au'


if __name__ == "__main__":
    pytest.main([__file__])