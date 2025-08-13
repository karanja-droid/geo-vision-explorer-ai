"""Drill QA Celery Tasks

Background tasks for drill hole data QA validation and report generation.
"""

import json
import os
import tempfile
from typing import Dict, Any, Optional, List
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from celery import Task
from celery.utils.log import get_task_logger
from sqlalchemy.orm import Session
from jinja2 import Template
import boto3
import pandas as pd
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.services.drill_qa import DrillQAService
from app.models.drill_data import QAReport, QAResult, DrillCollar
from app.core.config import settings

logger = get_task_logger(__name__)


class DrillQATask(Task):
    """Base task class for drill QA with error handling"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Drill QA task {task_id} failed: {exc}")
    
    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"Drill QA task {task_id} completed successfully")


@celery_app.task(base=DrillQATask, bind=True)
def run_drill_qa_validation(
    self,
    org_id: str,
    project_id: Optional[str] = None,
    hole_ids: Optional[List[str]] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Run comprehensive QA validation on drill data
    
    Args:
        org_id: Organization ID
        project_id: Optional project ID filter
        hole_ids: Optional list of specific hole IDs to validate
        user_id: User ID who initiated the validation
        
    Returns:
        Dictionary with validation results and statistics
    """
    logger.info(f"Starting drill QA validation task {self.request.id}")
    
    # Update task state
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 4, 'status': 'Initializing QA validation'}
    )
    
    db = SessionLocal()
    try:
        service = DrillQAService(db)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 4, 'status': 'Running QA rules'}
        )
        
        # Run validation
        validation_results = await service.validate_drill_data(
            org_id=UUID(org_id),
            project_id=UUID(project_id) if project_id else None,
            hole_ids=hole_ids
        )
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 3, 'total': 4, 'status': 'Generating summary'}
        )
        
        # Add task metadata
        result = {
            'task_id': self.request.id,
            'org_id': org_id,
            'project_id': project_id,
            'validation_results': validation_results,
            'completed_at': datetime.utcnow().isoformat()
        }
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 4, 'total': 4, 'status': 'QA validation completed'}
        )
        
        logger.info(f"Drill QA validation completed: {validation_results['total_issues']} issues found")
        return result
        
    except Exception as e:
        logger.error(f"Drill QA validation failed: {str(e)}")
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        db.close()


@celery_app.task(base=DrillQATask, bind=True)
def generate_qa_report(
    self,
    org_id: str,
    project_id: Optional[str] = None,
    report_type: str = 'nightly',
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Generate comprehensive QA report
    
    Args:
        org_id: Organization ID
        project_id: Optional project ID filter
        report_type: Type of report (nightly, on_demand, upload)
        user_id: User ID who requested the report
        
    Returns:
        Dictionary with report generation results
    """
    logger.info(f"Starting QA report generation task {self.request.id}")
    
    # Update task state
    self.update_state(
        state='PROGRESS',
        meta={'current': 0, 'total': 6, 'status': 'Initializing report generation'}
    )
    
    db = SessionLocal()
    try:
        service = DrillQAService(db)
        
        # Create report record
        report_name = f"QA_Report_{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        qa_report = QAReport(
            report_name=report_name,
            report_type=report_type,
            status='generating',
            org_id=UUID(org_id),
            project_id=UUID(project_id) if project_id else None,
            created_by=UUID(user_id) if user_id else None
        )
        db.add(qa_report)
        db.commit()
        db.refresh(qa_report)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 1, 'total': 6, 'status': 'Collecting QA results'}
        )
        
        # Get QA results
        qa_results = await service.get_qa_results(
            org_id=UUID(org_id),
            project_id=UUID(project_id) if project_id else None
        )
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 2, 'total': 6, 'status': 'Analyzing data'}
        )
        
        # Generate report data
        report_data = await _generate_report_data(db, org_id, project_id, qa_results)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 3, 'total': 6, 'status': 'Creating HTML report'}
        )
        
        # Generate HTML report
        html_content = await _generate_html_report(report_data)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 4, 'total': 6, 'status': 'Creating PDF report'}
        )
        
        # Generate PDF report
        pdf_content = await _generate_pdf_report(html_content)
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 5, 'total': 6, 'status': 'Uploading reports'}
        )
        
        # Upload reports to S3
        report_paths = await _upload_reports(
            qa_report.id, html_content, pdf_content, report_name
        )
        
        # Update report record
        qa_report.status = 'completed'
        qa_report.completed_at = datetime.utcnow()
        qa_report.total_holes = report_data['total_holes']
        qa_report.total_issues = report_data['total_issues']
        qa_report.error_count = report_data['error_count']
        qa_report.warning_count = report_data['warning_count']
        qa_report.report_path = report_paths['base_path']
        qa_report.summary = report_data['summary']
        
        db.commit()
        
        result = {
            'task_id': self.request.id,
            'report_id': str(qa_report.id),
            'report_name': report_name,
            'report_paths': report_paths,
            'summary': report_data['summary'],
            'total_issues': report_data['total_issues'],
            'status': 'completed'
        }
        
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'current': 6, 'total': 6, 'status': 'Report generation completed'}
        )
        
        logger.info(f"QA report generation completed: {report_name}")
        return result
        
    except Exception as e:
        logger.error(f"QA report generation failed: {str(e)}")
        
        # Update report status if created
        try:
            if 'qa_report' in locals():
                qa_report.status = 'failed'
                db.commit()
        except:
            pass
        
        self.update_state(
            state='FAILURE',
            meta={'error': str(e)}
        )
        raise
    finally:
        db.close()


@celery_app.task(base=DrillQATask)
def nightly_qa_report(org_id: str, project_id: Optional[str] = None) -> Dict[str, Any]:
    """Generate nightly QA report for an organization
    
    This task is scheduled to run nightly to provide regular QA monitoring.
    """
    logger.info(f"Starting nightly QA report for org: {org_id}")
    
    # First run validation
    validation_task = run_drill_qa_validation.delay(
        org_id=org_id,
        project_id=project_id
    )
    
    # Wait for validation to complete (with timeout)
    try:
        validation_result = validation_task.get(timeout=300)  # 5 minutes timeout
    except Exception as e:
        logger.error(f"Validation failed for nightly report: {str(e)}")
        return {'status': 'failed', 'error': 'Validation timeout or failure'}
    
    # Generate report
    report_task = generate_qa_report.delay(
        org_id=org_id,
        project_id=project_id,
        report_type='nightly'
    )
    
    try:
        report_result = report_task.get(timeout=600)  # 10 minutes timeout
        return report_result
    except Exception as e:
        logger.error(f"Report generation failed for nightly report: {str(e)}")
        return {'status': 'failed', 'error': 'Report generation timeout or failure'}


async def _generate_report_data(
    db: Session, org_id: str, project_id: Optional[str], qa_results: List[QAResult]
) -> Dict[str, Any]:
    """Generate comprehensive report data"""
    
    # Basic statistics
    total_issues = len(qa_results)
    error_count = len([r for r in qa_results if r.severity == 'error'])
    warning_count = len([r for r in qa_results if r.severity == 'warning'])
    info_count = len([r for r in qa_results if r.severity == 'info'])
    
    # Count total holes
    collar_query = db.query(DrillCollar).filter(DrillCollar.org_id == UUID(org_id))
    if project_id:
        collar_query = collar_query.filter(DrillCollar.project_id == UUID(project_id))
    total_holes = collar_query.count()
    
    # Group issues by rule type
    rule_summary = {}
    for result in qa_results:
        rule_type = result.rule.rule_type if result.rule else 'unknown'
        if rule_type not in rule_summary:
            rule_summary[rule_type] = {
                'count': 0,
                'severity': result.severity,
                'description': result.rule.description if result.rule else 'Unknown rule'
            }
        rule_summary[rule_type]['count'] += 1
    
    # Group issues by hole
    hole_summary = {}
    for result in qa_results:
        if result.hole_id not in hole_summary:
            hole_summary[result.hole_id] = {
                'error_count': 0,
                'warning_count': 0,
                'info_count': 0,
                'total_issues': 0
            }
        
        hole_summary[result.hole_id]['total_issues'] += 1
        if result.severity == 'error':
            hole_summary[result.hole_id]['error_count'] += 1
        elif result.severity == 'warning':
            hole_summary[result.hole_id]['warning_count'] += 1
        else:
            hole_summary[result.hole_id]['info_count'] += 1
    
    # Calculate quality score (percentage of holes without errors)
    holes_with_errors = len([h for h, s in hole_summary.items() if s['error_count'] > 0])
    quality_score = ((total_holes - holes_with_errors) / total_holes * 100) if total_holes > 0 else 100
    
    return {
        'generated_at': datetime.utcnow().isoformat(),
        'org_id': org_id,
        'project_id': project_id,
        'total_holes': total_holes,
        'total_issues': total_issues,
        'error_count': error_count,
        'warning_count': warning_count,
        'info_count': info_count,
        'quality_score': quality_score,
        'rule_summary': rule_summary,
        'hole_summary': hole_summary,
        'top_issues': qa_results[:20],  # Top 20 issues for detailed display
        'summary': {
            'data_quality_score': quality_score,
            'holes_with_issues': len(hole_summary),
            'most_common_issue': max(rule_summary.items(), key=lambda x: x[1]['count'])[0] if rule_summary else None,
            'critical_holes': [h for h, s in hole_summary.items() if s['error_count'] > 0][:10]
        }
    }


async def _generate_html_report(report_data: Dict[str, Any]) -> str:
    """Generate HTML report from data"""
    
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Drill Hole QA Report - {{ report_data.generated_at[:10] }}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
            .metric { background-color: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
            .metric-value { font-size: 24px; font-weight: bold; color: #495057; }
            .metric-label { font-size: 12px; color: #6c757d; margin-top: 5px; }
            .error { color: #dc3545; }
            .warning { color: #fd7e14; }
            .info { color: #17a2b8; }
            .success { color: #28a745; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; }
            .section { margin-bottom: 30px; }
            .section h2 { color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Drill Hole QA Report</h1>
            <p>Generated: {{ report_data.generated_at }}</p>
            <p>Organization: {{ report_data.org_id }}</p>
            {% if report_data.project_id %}
            <p>Project: {{ report_data.project_id }}</p>
            {% endif %}
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">{{ report_data.total_holes }}</div>
                <div class="metric-label">Total Holes</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ report_data.total_issues }}</div>
                <div class="metric-label">Total Issues</div>
            </div>
            <div class="metric">
                <div class="metric-value error">{{ report_data.error_count }}</div>
                <div class="metric-label">Errors</div>
            </div>
            <div class="metric">
                <div class="metric-value warning">{{ report_data.warning_count }}</div>
                <div class="metric-label">Warnings</div>
            </div>
            <div class="metric">
                <div class="metric-value {% if report_data.quality_score >= 90 %}success{% elif report_data.quality_score >= 70 %}warning{% else %}error{% endif %}">
                    {{ "%.1f"|format(report_data.quality_score) }}%
                </div>
                <div class="metric-label">Quality Score</div>
            </div>
        </div>
        
        <div class="section">
            <h2>Issues by Rule Type</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rule Type</th>
                        <th>Description</th>
                        <th>Count</th>
                        <th>Severity</th>
                    </tr>
                </thead>
                <tbody>
                    {% for rule_type, data in report_data.rule_summary.items() %}
                    <tr>
                        <td>{{ rule_type.replace('_', ' ').title() }}</td>
                        <td>{{ data.description }}</td>
                        <td>{{ data.count }}</td>
                        <td class="{{ data.severity }}">{{ data.severity.title() }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>Top Issues</h2>
            <table>
                <thead>
                    <tr>
                        <th>Hole ID</th>
                        <th>Severity</th>
                        <th>Message</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {% for issue in report_data.top_issues %}
                    <tr>
                        <td>{{ issue.hole_id }}</td>
                        <td class="{{ issue.severity }}">{{ issue.severity.title() }}</td>
                        <td>{{ issue.message }}</td>
                        <td>{{ issue.created_at.strftime('%Y-%m-%d %H:%M') }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        
        {% if report_data.summary.critical_holes %}
        <div class="section">
            <h2>Critical Holes (With Errors)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Hole ID</th>
                        <th>Errors</th>
                        <th>Warnings</th>
                        <th>Total Issues</th>
                    </tr>
                </thead>
                <tbody>
                    {% for hole_id in report_data.summary.critical_holes %}
                    {% set hole_data = report_data.hole_summary[hole_id] %}
                    <tr>
                        <td>{{ hole_id }}</td>
                        <td class="error">{{ hole_data.error_count }}</td>
                        <td class="warning">{{ hole_data.warning_count }}</td>
                        <td>{{ hole_data.total_issues }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        {% endif %}
        
        <div class="section">
            <h2>Summary</h2>
            <ul>
                <li>Data Quality Score: <strong>{{ "%.1f"|format(report_data.quality_score) }}%</strong></li>
                <li>Holes with Issues: <strong>{{ report_data.summary.holes_with_issues }}</strong> out of {{ report_data.total_holes }}</li>
                {% if report_data.summary.most_common_issue %}
                <li>Most Common Issue: <strong>{{ report_data.summary.most_common_issue.replace('_', ' ').title() }}</strong></li>
                {% endif %}
            </ul>
        </div>
    </body>
    </html>
    """
    
    template = Template(html_template)
    return template.render(report_data=report_data)


async def _generate_pdf_report(html_content: str) -> bytes:
    """Generate PDF report from HTML content"""
    try:
        # Configure fonts
        font_config = FontConfiguration()
        
        # Create PDF from HTML
        html_doc = HTML(string=html_content)
        pdf_bytes = html_doc.write_pdf(font_config=font_config)
        
        return pdf_bytes
        
    except Exception as e:
        logger.error(f"Failed to generate PDF: {str(e)}")
        # Return empty bytes if PDF generation fails
        return b''


async def _upload_reports(
    report_id: UUID, html_content: str, pdf_content: bytes, report_name: str
) -> Dict[str, str]:
    """Upload HTML and PDF reports to S3"""
    
    if not settings.AWS_ACCESS_KEY_ID:
        logger.warning("S3 not configured, skipping report upload")
        return {
            'base_path': f"local://reports/{report_name}",
            'html_path': f"local://reports/{report_name}.html",
            'pdf_path': f"local://reports/{report_name}.pdf"
        }
    
    try:
        s3_client = boto3.client('s3')
        base_path = f"qa-reports/{report_id}"
        
        # Upload HTML report
        html_key = f"{base_path}/{report_name}.html"
        s3_client.put_object(
            Bucket=settings.S3_BUCKET,
            Key=html_key,
            Body=html_content.encode('utf-8'),
            ContentType='text/html',
            Metadata={
                'report_id': str(report_id),
                'report_name': report_name,
                'format': 'html'
            }
        )
        
        # Upload PDF report if available
        pdf_key = f"{base_path}/{report_name}.pdf"
        if pdf_content:
            s3_client.put_object(
                Bucket=settings.S3_BUCKET,
                Key=pdf_key,
                Body=pdf_content,
                ContentType='application/pdf',
                Metadata={
                    'report_id': str(report_id),
                    'report_name': report_name,
                    'format': 'pdf'
                }
            )
        
        return {
            'base_path': f"s3://{settings.S3_BUCKET}/{base_path}",
            'html_path': f"s3://{settings.S3_BUCKET}/{html_key}",
            'pdf_path': f"s3://{settings.S3_BUCKET}/{pdf_key}" if pdf_content else None
        }
        
    except Exception as e:
        logger.error(f"Failed to upload reports: {str(e)}")
        return {
            'base_path': f"local://reports/{report_name}",
            'html_path': f"local://reports/{report_name}.html",
            'pdf_path': f"local://reports/{report_name}.pdf"
        }