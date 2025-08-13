"""Drill Data QA Service

Service for quality assurance and validation of drill hole data including
interval validation, duplicate detection, and automated report generation.
"""

import json
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID, uuid4
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc, text
from geoalchemy2.functions import ST_Distance
import boto3
from jinja2 import Template
import tempfile
import os
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger
from app.models.drill_data import (
    DrillCollar, DrillSurvey, DrillInterval, DrillAssay,
    QARule, QAResult, QAReport
)


class DrillQAService:
    """Service for drill hole data quality assurance"""
    
    def __init__(self, db: Session):
        self.db = db
        self.s3_client = boto3.client('s3') if settings.AWS_ACCESS_KEY_ID else None
        
        # QA rule definitions
        self.default_rules = [
            {
                'rule_name': 'Interval Overlap Detection',
                'rule_type': 'interval_overlap',
                'severity': 'error',
                'description': 'Detects overlapping intervals within the same hole',
                'parameters': {'tolerance': 0.01}  # 1cm tolerance
            },
            {
                'rule_name': 'Duplicate Hole ID',
                'rule_type': 'duplicate_hole',
                'severity': 'error',
                'description': 'Detects duplicate hole IDs in collar table',
                'parameters': {}
            },
            {
                'rule_name': 'Missing Survey Data',
                'rule_type': 'missing_survey',
                'severity': 'warning',
                'description': 'Identifies holes without survey data',
                'parameters': {}
            },
            {
                'rule_name': 'Invalid Coordinates',
                'rule_type': 'invalid_coordinates',
                'severity': 'error',
                'description': 'Detects invalid or extreme coordinate values',
                'parameters': {
                    'min_longitude': -180,
                    'max_longitude': 180,
                    'min_latitude': -90,
                    'max_latitude': 90,
                    'min_elevation': -500,
                    'max_elevation': 9000
                }
            },
            {
                'rule_name': 'Assay Below Detection Limit',
                'rule_type': 'below_detection_limit',
                'severity': 'info',
                'description': 'Identifies assay values below detection limits',
                'parameters': {}
            },
            {
                'rule_name': 'Missing Total Depth',
                'rule_type': 'missing_total_depth',
                'severity': 'warning',
                'description': 'Identifies holes without total depth information',
                'parameters': {}
            },
            {
                'rule_name': 'Extreme Assay Values',
                'rule_type': 'extreme_assay_values',
                'severity': 'warning',
                'description': 'Detects potentially erroneous extreme assay values',
                'parameters': {
                    'z_score_threshold': 3.0  # Values beyond 3 standard deviations
                }
            }
        ]
    
    async def initialize_qa_rules(self, org_id: UUID) -> List[QARule]:
        """Initialize default QA rules for an organization"""
        logger.info(f"Initializing QA rules for organization: {org_id}")
        
        rules = []
        for rule_def in self.default_rules:
            # Check if rule already exists
            existing_rule = self.db.query(QARule).filter(
                and_(
                    QARule.org_id == org_id,
                    QARule.rule_type == rule_def['rule_type']
                )
            ).first()
            
            if not existing_rule:
                rule = QARule(
                    rule_name=rule_def['rule_name'],
                    rule_type=rule_def['rule_type'],
                    severity=rule_def['severity'],
                    description=rule_def['description'],
                    parameters=rule_def['parameters'],
                    org_id=org_id
                )
                self.db.add(rule)
                rules.append(rule)
        
        self.db.commit()
        logger.info(f"Initialized {len(rules)} QA rules")
        return rules
    
    async def validate_drill_data(
        self,
        org_id: UUID,
        project_id: Optional[UUID] = None,
        hole_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Run comprehensive QA validation on drill data
        
        Args:
            org_id: Organization ID
            project_id: Optional project ID filter
            hole_ids: Optional list of specific hole IDs to validate
            
        Returns:
            Dictionary with validation results and statistics
        """
        logger.info(f"Starting drill data validation for org: {org_id}")
        
        # Clear existing results for this validation run
        await self._clear_existing_results(org_id, project_id, hole_ids)
        
        # Get active QA rules
        rules = self.db.query(QARule).filter(
            and_(QARule.org_id == org_id, QARule.is_active == True)
        ).all()
        
        if not rules:
            rules = await self.initialize_qa_rules(org_id)
        
        validation_results = {
            'total_rules': len(rules),
            'rules_executed': 0,
            'total_issues': 0,
            'error_count': 0,
            'warning_count': 0,
            'info_count': 0,
            'holes_validated': 0,
            'rule_results': {}
        }
        
        # Execute each rule
        for rule in rules:
            logger.info(f"Executing rule: {rule.rule_name}")
            
            try:
                rule_results = await self._execute_qa_rule(rule, org_id, project_id, hole_ids)
                validation_results['rule_results'][rule.rule_type] = rule_results
                validation_results['rules_executed'] += 1
                validation_results['total_issues'] += rule_results['issue_count']
                
                # Count by severity
                if rule.severity == 'error':
                    validation_results['error_count'] += rule_results['issue_count']
                elif rule.severity == 'warning':
                    validation_results['warning_count'] += rule_results['issue_count']
                else:
                    validation_results['info_count'] += rule_results['issue_count']
                    
            except Exception as e:
                logger.error(f"Failed to execute rule {rule.rule_name}: {str(e)}")
                validation_results['rule_results'][rule.rule_type] = {
                    'status': 'failed',
                    'error': str(e),
                    'issue_count': 0
                }
        
        # Count validated holes
        collar_query = self.db.query(DrillCollar).filter(DrillCollar.org_id == org_id)
        if project_id:
            collar_query = collar_query.filter(DrillCollar.project_id == project_id)
        if hole_ids:
            collar_query = collar_query.filter(DrillCollar.hole_id.in_(hole_ids))
        
        validation_results['holes_validated'] = collar_query.count()
        
        logger.info(f"Validation completed: {validation_results['total_issues']} issues found")
        return validation_results
    
    async def _execute_qa_rule(
        self,
        rule: QARule,
        org_id: UUID,
        project_id: Optional[UUID] = None,
        hole_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Execute a specific QA rule"""
        
        if rule.rule_type == 'interval_overlap':
            return await self._check_interval_overlaps(rule, org_id, project_id, hole_ids)
        elif rule.rule_type == 'duplicate_hole':
            return await self._check_duplicate_holes(rule, org_id, project_id, hole_ids)
        elif rule.rule_type == 'missing_survey':
            return await self._check_missing_surveys(rule, org_id, project_id, hole_ids)
        elif rule.rule_type == 'invalid_coordinates':
            return await self._check_invalid_coordinates(rule, org_id, project_id, hole_ids)
        elif rule.rule_type == 'below_detection_limit':
            return await self._check_below_detection_limit(rule, org_id, project_id, hole_ids)
        elif rule.rule_type == 'missing_total_depth':
            return await self._check_missing_total_depth(rule, org_id, project_id, hole_ids)
        elif rule.rule_type == 'extreme_assay_values':
            return await self._check_extreme_assay_values(rule, org_id, project_id, hole_ids)
        else:
            return {'status': 'unknown_rule_type', 'issue_count': 0}
    
    async def _check_interval_overlaps(
        self, rule: QARule, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Check for overlapping intervals within holes"""
        tolerance = rule.parameters.get('tolerance', 0.01)
        issues_found = 0
        
        # Get intervals grouped by hole
        query = self.db.query(DrillInterval).filter(DrillInterval.org_id == org_id)
        if project_id:
            query = query.filter(DrillInterval.project_id == project_id)
        if hole_ids:
            query = query.filter(DrillInterval.hole_id.in_(hole_ids))
        
        intervals = query.order_by(DrillInterval.hole_id, DrillInterval.from_m).all()
        
        # Group by hole_id
        holes_intervals = {}
        for interval in intervals:
            if interval.hole_id not in holes_intervals:
                holes_intervals[interval.hole_id] = []
            holes_intervals[interval.hole_id].append(interval)
        
        # Check for overlaps within each hole
        for hole_id, hole_intervals in holes_intervals.items():
            for i in range(len(hole_intervals) - 1):
                current = hole_intervals[i]
                next_interval = hole_intervals[i + 1]
                
                # Check if current interval's 'to' overlaps with next interval's 'from'
                if current.to_m > (next_interval.from_m + tolerance):
                    overlap_amount = current.to_m - next_interval.from_m
                    
                    qa_result = QAResult(
                        rule_id=rule.id,
                        hole_id=hole_id,
                        severity=rule.severity,
                        message=f"Interval overlap detected: {current.from_m}-{current.to_m}m overlaps with {next_interval.from_m}-{next_interval.to_m}m",
                        details={
                            'interval_1': {'from_m': current.from_m, 'to_m': current.to_m},
                            'interval_2': {'from_m': next_interval.from_m, 'to_m': next_interval.to_m},
                            'overlap_amount': overlap_amount
                        },
                        org_id=org_id,
                        project_id=project_id
                    )
                    self.db.add(qa_result)
                    issues_found += 1
        
        self.db.commit()
        return {'status': 'completed', 'issue_count': issues_found}
    
    async def _check_duplicate_holes(
        self, rule: QARule, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Check for duplicate hole IDs"""
        query = self.db.query(DrillCollar.hole_id, func.count(DrillCollar.hole_id).label('count')).filter(
            DrillCollar.org_id == org_id
        )
        if project_id:
            query = query.filter(DrillCollar.project_id == project_id)
        if hole_ids:
            query = query.filter(DrillCollar.hole_id.in_(hole_ids))
        
        duplicates = query.group_by(DrillCollar.hole_id).having(func.count(DrillCollar.hole_id) > 1).all()
        
        issues_found = 0
        for hole_id, count in duplicates:
            qa_result = QAResult(
                rule_id=rule.id,
                hole_id=hole_id,
                severity=rule.severity,
                message=f"Duplicate hole ID found: {hole_id} appears {count} times",
                details={'duplicate_count': count},
                org_id=org_id,
                project_id=project_id
            )
            self.db.add(qa_result)
            issues_found += 1
        
        self.db.commit()
        return {'status': 'completed', 'issue_count': issues_found}
    
    async def _check_missing_surveys(
        self, rule: QARule, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Check for holes without survey data"""
        # Get holes without surveys
        collar_query = self.db.query(DrillCollar).filter(DrillCollar.org_id == org_id)
        if project_id:
            collar_query = collar_query.filter(DrillCollar.project_id == project_id)
        if hole_ids:
            collar_query = collar_query.filter(DrillCollar.hole_id.in_(hole_ids))
        
        # Left join to find holes without surveys
        holes_without_surveys = collar_query.outerjoin(DrillSurvey).filter(
            DrillSurvey.hole_id.is_(None)
        ).all()
        
        issues_found = 0
        for collar in holes_without_surveys:
            qa_result = QAResult(
                rule_id=rule.id,
                hole_id=collar.hole_id,
                severity=rule.severity,
                message=f"No survey data found for hole {collar.hole_id}",
                details={'total_depth': collar.total_depth},
                org_id=org_id,
                project_id=project_id
            )
            self.db.add(qa_result)
            issues_found += 1
        
        self.db.commit()
        return {'status': 'completed', 'issue_count': issues_found}
    
    async def _check_invalid_coordinates(
        self, rule: QARule, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Check for invalid coordinate values"""
        params = rule.parameters
        issues_found = 0
        
        query = self.db.query(DrillCollar).filter(DrillCollar.org_id == org_id)
        if project_id:
            query = query.filter(DrillCollar.project_id == project_id)
        if hole_ids:
            query = query.filter(DrillCollar.hole_id.in_(hole_ids))
        
        collars = query.all()
        
        for collar in collars:
            issues = []
            
            # Extract coordinates from geometry
            lon = self.db.scalar(func.ST_X(collar.geom))
            lat = self.db.scalar(func.ST_Y(collar.geom))
            
            # Check longitude
            if lon < params['min_longitude'] or lon > params['max_longitude']:
                issues.append(f"Invalid longitude: {lon}")
            
            # Check latitude
            if lat < params['min_latitude'] or lat > params['max_latitude']:
                issues.append(f"Invalid latitude: {lat}")
            
            # Check elevation
            if collar.elevation is not None:
                if collar.elevation < params['min_elevation'] or collar.elevation > params['max_elevation']:
                    issues.append(f"Extreme elevation: {collar.elevation}m")
            
            if issues:
                qa_result = QAResult(
                    rule_id=rule.id,
                    hole_id=collar.hole_id,
                    severity=rule.severity,
                    message=f"Invalid coordinates detected: {', '.join(issues)}",
                    details={
                        'longitude': lon,
                        'latitude': lat,
                        'elevation': collar.elevation,
                        'issues': issues
                    },
                    org_id=org_id,
                    project_id=project_id
                )
                self.db.add(qa_result)
                issues_found += 1
        
        self.db.commit()
        return {'status': 'completed', 'issue_count': issues_found}
    
    async def _check_below_detection_limit(
        self, rule: QARule, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Check for assay values below detection limits"""
        query = self.db.query(DrillAssay).filter(
            and_(
                DrillAssay.org_id == org_id,
                DrillAssay.value.isnot(None),
                DrillAssay.detection_limit.isnot(None),
                DrillAssay.value < DrillAssay.detection_limit
            )
        )
        if project_id:
            query = query.filter(DrillAssay.project_id == project_id)
        if hole_ids:
            query = query.filter(DrillAssay.hole_id.in_(hole_ids))
        
        below_limit_assays = query.all()
        
        issues_found = 0
        for assay in below_limit_assays:
            qa_result = QAResult(
                rule_id=rule.id,
                hole_id=assay.hole_id,
                severity=rule.severity,
                message=f"Assay value below detection limit: {assay.element} = {assay.value} < {assay.detection_limit} {assay.units}",
                details={
                    'element': assay.element,
                    'value': assay.value,
                    'detection_limit': assay.detection_limit,
                    'units': assay.units,
                    'from_m': assay.from_m,
                    'to_m': assay.to_m
                },
                org_id=org_id,
                project_id=project_id
            )
            self.db.add(qa_result)
            issues_found += 1
        
        self.db.commit()
        return {'status': 'completed', 'issue_count': issues_found}
    
    async def _check_missing_total_depth(
        self, rule: QARule, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Check for holes without total depth information"""
        query = self.db.query(DrillCollar).filter(
            and_(
                DrillCollar.org_id == org_id,
                or_(DrillCollar.total_depth.is_(None), DrillCollar.total_depth <= 0)
            )
        )
        if project_id:
            query = query.filter(DrillCollar.project_id == project_id)
        if hole_ids:
            query = query.filter(DrillCollar.hole_id.in_(hole_ids))
        
        missing_depth_holes = query.all()
        
        issues_found = 0
        for collar in missing_depth_holes:
            qa_result = QAResult(
                rule_id=rule.id,
                hole_id=collar.hole_id,
                severity=rule.severity,
                message=f"Missing or invalid total depth for hole {collar.hole_id}",
                details={'total_depth': collar.total_depth},
                org_id=org_id,
                project_id=project_id
            )
            self.db.add(qa_result)
            issues_found += 1
        
        self.db.commit()
        return {'status': 'completed', 'issue_count': issues_found}
    
    async def _check_extreme_assay_values(
        self, rule: QARule, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Check for extreme assay values using statistical analysis"""
        z_threshold = rule.parameters.get('z_score_threshold', 3.0)
        issues_found = 0
        
        # Get assay data grouped by element
        query = self.db.query(DrillAssay).filter(
            and_(
                DrillAssay.org_id == org_id,
                DrillAssay.value.isnot(None),
                DrillAssay.value > 0  # Exclude zero/negative values
            )
        )
        if project_id:
            query = query.filter(DrillAssay.project_id == project_id)
        if hole_ids:
            query = query.filter(DrillAssay.hole_id.in_(hole_ids))
        
        assays = query.all()
        
        # Group by element for statistical analysis
        element_groups = {}
        for assay in assays:
            if assay.element not in element_groups:
                element_groups[assay.element] = []
            element_groups[assay.element].append(assay)
        
        # Check each element group
        for element, element_assays in element_groups.items():
            if len(element_assays) < 10:  # Need minimum samples for statistics
                continue
            
            values = [assay.value for assay in element_assays]
            mean_val = np.mean(values)
            std_val = np.std(values)
            
            if std_val == 0:  # All values are the same
                continue
            
            # Check for outliers
            for assay in element_assays:
                z_score = abs((assay.value - mean_val) / std_val)
                
                if z_score > z_threshold:
                    qa_result = QAResult(
                        rule_id=rule.id,
                        hole_id=assay.hole_id,
                        severity=rule.severity,
                        message=f"Extreme {element} value detected: {assay.value} {assay.units} (Z-score: {z_score:.2f})",
                        details={
                            'element': element,
                            'value': assay.value,
                            'units': assay.units,
                            'z_score': z_score,
                            'mean': mean_val,
                            'std': std_val,
                            'from_m': assay.from_m,
                            'to_m': assay.to_m
                        },
                        org_id=org_id,
                        project_id=project_id
                    )
                    self.db.add(qa_result)
                    issues_found += 1
        
        self.db.commit()
        return {'status': 'completed', 'issue_count': issues_found}
    
    async def _clear_existing_results(
        self, org_id: UUID, project_id: Optional[UUID], hole_ids: Optional[List[str]]
    ):
        """Clear existing QA results for a validation run"""
        query = self.db.query(QAResult).filter(QAResult.org_id == org_id)
        if project_id:
            query = query.filter(QAResult.project_id == project_id)
        if hole_ids:
            query = query.filter(QAResult.hole_id.in_(hole_ids))
        
        query.delete()
        self.db.commit()
    
    async def get_qa_results(
        self,
        org_id: UUID,
        project_id: Optional[UUID] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 1000
    ) -> List[QAResult]:
        """Get QA results with optional filtering"""
        query = self.db.query(QAResult).filter(QAResult.org_id == org_id)
        
        if project_id:
            query = query.filter(QAResult.project_id == project_id)
        if severity:
            query = query.filter(QAResult.severity == severity)
        if status:
            query = query.filter(QAResult.status == status)
        
        results = query.order_by(desc(QAResult.created_at)).limit(limit).all()
        
        logger.info(f"Retrieved {len(results)} QA results")
        return results
    
    async def resolve_qa_issue(
        self, result_id: UUID, user_id: UUID, resolution_note: Optional[str] = None
    ) -> QAResult:
        """Mark a QA issue as resolved"""
        result = self.db.query(QAResult).filter(QAResult.id == result_id).first()
        
        if not result:
            raise ValueError(f"QA result not found: {result_id}")
        
        result.status = 'resolved'
        result.resolved_at = datetime.utcnow()
        result.resolved_by = user_id
        
        if resolution_note:
            if not result.details:
                result.details = {}
            result.details['resolution_note'] = resolution_note
        
        self.db.commit()
        self.db.refresh(result)
        
        logger.info(f"Resolved QA issue: {result_id}")
        return result