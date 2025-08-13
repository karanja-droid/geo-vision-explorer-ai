"""
QA/QC Report Generator
Provides consolidated quality reporting across all data processors
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import pandas as pd
import numpy as np
from jinja2 import Template
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import plotly.io as pio

from .core.logger import get_logger
from .core.storage import StorageManager
from .config import config

class QAQCReportGenerator:
    """Generates comprehensive QA/QC reports from pipeline execution results"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('qaqc_report_generator')
        
        # Report templates
        self.html_template = self._get_html_template()
        
        # Quality thresholds
        self.quality_thresholds = {
            'excellent': 95.0,
            'good': 85.0,
            'acceptable': 75.0,
            'poor': 60.0
        }
        
        # Processor-specific quality metrics
        self.processor_metrics = {
            'geology': ['validity_rate', 'invalid_geometries', 'missing_attributes'],
            'geophysics': ['valid_sources', 'cogs_created', 'warnings'],
            'dem': ['products_created', 'processing_success'],
            'satellite': ['total_products', 'seasonalities_processed'],
            'geochem': ['total_samples', 'duplicate_samples', 'invalid_coordinates', 'elements_detected'],
            'drillhole': ['total_records', 'tables_with_data', 'total_issues'],
            'esg': ['total_features', 'categories_with_data'],
            'feature_store': ['grid_cells', 'total_features', 'data_sources_used']
        }
    
    def generate_consolidated_report(self, pipeline_results: Dict[str, Any],
                                   output_format: str = 'html') -> str:
        """Generate consolidated QA/QC report from pipeline results"""
        
        self.logger.info("Generating consolidated QA/QC report")
        
        # Extract and analyze data
        report_data = self._analyze_pipeline_results(pipeline_results)
        
        # Generate visualizations
        charts = self._generate_charts(report_data)
        
        # Create report content
        if output_format.lower() == 'html':
            report_content = self._generate_html_report(report_data, charts)
            file_extension = '.html'
        elif output_format.lower() == 'json':
            report_content = json.dumps(report_data, indent=2, default=str)
            file_extension = '.json'
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
        
        # Write report to S3
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_key = f"reports/qaqc/consolidated/pipeline_qaqc_{timestamp}{file_extension}"
        
        temp_file = self.storage.files.create_temp_file(file_extension)
        
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(report_content)
            
            success = self.storage.s3.upload_file(
                temp_file,
                report_key,
                metadata={
                    'report_type': 'qaqc_consolidated',
                    'format': output_format,
                    'countries': str(len(pipeline_results.get('country_results', {}))),
                    'generated_at': datetime.now().isoformat()
                }
            )
            
            if success:
                report_path = f"s3://{config.s3_bucket}/{report_key}"
                self.logger.info(f"QA/QC report generated: {report_path}")
                return report_path
            else:
                raise Exception("Failed to upload QA/QC report")
                
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def _analyze_pipeline_results(self, pipeline_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze pipeline results and extract quality metrics"""
        
        country_results = pipeline_results.get('country_results', {})
        pipeline_state = pipeline_results.get('pipeline_state', {})
        final_report = pipeline_results.get('final_report', {})
        
        analysis = {
            'executive_summary': self._generate_executive_summary(pipeline_state, final_report),
            'country_analysis': self._analyze_countries(country_results),
            'processor_analysis': self._analyze_processors(country_results),
            'stage_analysis': self._analyze_stages(country_results),
            'data_quality_metrics': self._calculate_quality_metrics(country_results),
            'performance_analysis': self._analyze_performance(country_results),
            'error_analysis': self._analyze_errors(country_results),
            'recommendations': self._generate_recommendations(country_results),
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'total_countries': len(country_results),
                'pipeline_duration': pipeline_state.get('total_processing_time', 0),
                'report_version': '1.0'
            }
        }
        
        return analysis
    
    def _generate_executive_summary(self, pipeline_state: Dict[str, Any],
                                  final_report: Dict[str, Any]) -> Dict[str, Any]:
        """Generate executive summary of pipeline execution"""
        
        summary = {
            'overall_status': pipeline_state.get('status', 'unknown'),
            'success_rate': 0,
            'total_processing_time': pipeline_state.get('total_processing_time', 0),
            'countries_processed': len(pipeline_state.get('countries_processed', [])),
            'countries_failed': len(pipeline_state.get('countries_failed', [])),
            'data_volumes': final_report.get('data_volumes', {}),
            'quality_score': 0,
            'key_achievements': [],
            'critical_issues': []
        }
        
        # Calculate success rate
        total_countries = summary['countries_processed'] + summary['countries_failed']
        if total_countries > 0:
            summary['success_rate'] = (summary['countries_processed'] / total_countries) * 100
        
        # Calculate overall quality score
        quality_metrics = final_report.get('quality_metrics', {})
        pipeline_success_rate = quality_metrics.get('pipeline_success_rate', 0)
        
        if pipeline_success_rate >= self.quality_thresholds['excellent']:
            summary['quality_score'] = 'Excellent'
        elif pipeline_success_rate >= self.quality_thresholds['good']:
            summary['quality_score'] = 'Good'
        elif pipeline_success_rate >= self.quality_thresholds['acceptable']:
            summary['quality_score'] = 'Acceptable'
        else:
            summary['quality_score'] = 'Needs Improvement'
        
        # Key achievements
        if summary['success_rate'] >= 90:
            summary['key_achievements'].append("High pipeline success rate achieved")
        
        if summary['total_processing_time'] < 3600:  # Less than 1 hour
            summary['key_achievements'].append("Efficient processing time")
        
        data_volumes = summary['data_volumes']
        if data_volumes.get('total_records_processed', 0) > 100000:
            summary['key_achievements'].append("Large-scale data processing completed")
        
        # Critical issues
        if summary['success_rate'] < 70:
            summary['critical_issues'].append("Low pipeline success rate requires attention")
        
        if summary['countries_failed'] > 0:
            summary['critical_issues'].append(f"{summary['countries_failed']} countries failed processing")
        
        return summary
    
    def _analyze_countries(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze country-level results"""
        
        analysis = {
            'country_summary': {},
            'success_distribution': {'success': 0, 'partial_success': 0, 'failed': 0},
            'processing_times': {},
            'data_completeness': {},
            'quality_scores': {}
        }
        
        for country, result in country_results.items():
            status = result.get('status', 'unknown')
            processing_time = result.get('total_processing_time', 0)
            
            # Country summary
            analysis['country_summary'][country] = {
                'status': status,
                'processing_time': processing_time,
                'stages_completed': len([s for s in result.get('stages', {}).values() 
                                       if s.get('status') == 'success']),
                'total_stages': len(result.get('stages', {})),
                'data_sources_found': self._count_data_sources(result),
                'quality_issues': self._count_quality_issues(result)
            }
            
            # Success distribution
            if status == 'success':
                analysis['success_distribution']['success'] += 1
            elif status in ['partial_success', 'completed_with_errors']:
                analysis['success_distribution']['partial_success'] += 1
            else:
                analysis['success_distribution']['failed'] += 1
            
            # Processing times
            analysis['processing_times'][country] = processing_time
            
            # Data completeness (percentage of processors that found data)
            stages = result.get('stages', {})
            total_processors = sum(len(stage.get('processor_results', {})) for stage in stages.values())
            successful_processors = sum(
                len([p for p in stage.get('processor_results', {}).values() 
                    if p.get('status') == 'success'])
                for stage in stages.values()
            )
            
            completeness = (successful_processors / total_processors * 100) if total_processors > 0 else 0
            analysis['data_completeness'][country] = completeness
            
            # Quality score based on completeness and issues
            quality_issues = analysis['country_summary'][country]['quality_issues']
            quality_score = max(0, completeness - (quality_issues * 5))  # Penalize for issues
            analysis['quality_scores'][country] = min(100, quality_score)
        
        return analysis
    
    def _analyze_processors(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze processor-level performance"""
        
        analysis = {
            'processor_summary': {},
            'reliability_scores': {},
            'performance_metrics': {},
            'common_issues': {}
        }
        
        # Collect all processor results
        all_processor_results = {}
        
        for country, result in country_results.items():
            for stage_result in result.get('stages', {}).values():
                for processor, proc_result in stage_result.get('processor_results', {}).items():
                    if processor not in all_processor_results:
                        all_processor_results[processor] = []
                    all_processor_results[processor].append({
                        'country': country,
                        'result': proc_result
                    })
        
        # Analyze each processor
        for processor, results in all_processor_results.items():
            total_runs = len(results)
            successful_runs = len([r for r in results if r['result'].get('status') == 'success'])
            failed_runs = len([r for r in results if r['result'].get('status') == 'failed'])
            no_data_runs = len([r for r in results if r['result'].get('status') == 'no_sources'])
            
            # Processor summary
            analysis['processor_summary'][processor] = {
                'total_runs': total_runs,
                'successful_runs': successful_runs,
                'failed_runs': failed_runs,
                'no_data_runs': no_data_runs,
                'success_rate': (successful_runs / total_runs * 100) if total_runs > 0 else 0
            }
            
            # Reliability score
            reliability = (successful_runs / max(total_runs - no_data_runs, 1)) * 100
            analysis['reliability_scores'][processor] = reliability
            
            # Performance metrics
            processing_times = [r['result'].get('processing_time', 0) for r in results 
                              if r['result'].get('status') == 'success']
            
            if processing_times:
                analysis['performance_metrics'][processor] = {
                    'avg_processing_time': np.mean(processing_times),
                    'min_processing_time': np.min(processing_times),
                    'max_processing_time': np.max(processing_times),
                    'std_processing_time': np.std(processing_times)
                }
            
            # Common issues
            errors = [r['result'].get('error', '') for r in results 
                     if r['result'].get('status') == 'failed' and r['result'].get('error')]
            
            if errors:
                # Simple error categorization
                error_categories = {}
                for error in errors:
                    if 'no sources' in error.lower() or 'not found' in error.lower():
                        error_categories['data_availability'] = error_categories.get('data_availability', 0) + 1
                    elif 'validation' in error.lower() or 'invalid' in error.lower():
                        error_categories['data_quality'] = error_categories.get('data_quality', 0) + 1
                    elif 'permission' in error.lower() or 'access' in error.lower():
                        error_categories['access_issues'] = error_categories.get('access_issues', 0) + 1
                    else:
                        error_categories['processing_errors'] = error_categories.get('processing_errors', 0) + 1
                
                analysis['common_issues'][processor] = error_categories
        
        return analysis
    
    def _analyze_stages(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze stage-level performance"""
        
        analysis = {
            'stage_summary': {},
            'stage_dependencies': {},
            'bottlenecks': []
        }
        
        # Collect stage results
        all_stage_results = {}
        
        for country, result in country_results.items():
            for stage_name, stage_result in result.get('stages', {}).items():
                if stage_name not in all_stage_results:
                    all_stage_results[stage_name] = []
                all_stage_results[stage_name].append({
                    'country': country,
                    'result': stage_result
                })
        
        # Analyze each stage
        for stage_name, results in all_stage_results.items():
            total_runs = len(results)
            successful_runs = len([r for r in results if r['result'].get('status') == 'success'])
            failed_runs = len([r for r in results if r['result'].get('status') == 'failed'])
            partial_runs = len([r for r in results if r['result'].get('status') == 'partial_success'])
            
            processing_times = [r['result'].get('processing_time', 0) for r in results]
            avg_processing_time = np.mean(processing_times) if processing_times else 0
            
            analysis['stage_summary'][stage_name] = {
                'total_runs': total_runs,
                'successful_runs': successful_runs,
                'failed_runs': failed_runs,
                'partial_runs': partial_runs,
                'success_rate': (successful_runs / total_runs * 100) if total_runs > 0 else 0,
                'avg_processing_time': avg_processing_time
            }
            
            # Identify bottlenecks (stages that take significantly longer)
            if avg_processing_time > 300:  # More than 5 minutes
                analysis['bottlenecks'].append({
                    'stage': stage_name,
                    'avg_time': avg_processing_time,
                    'reason': 'Long processing time'
                })
        
        return analysis  
  
    def _calculate_quality_metrics(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate comprehensive data quality metrics"""
        
        metrics = {
            'overall_quality_score': 0,
            'data_completeness_score': 0,
            'data_accuracy_score': 0,
            'processing_reliability_score': 0,
            'quality_by_data_type': {},
            'quality_trends': {},
            'quality_issues_summary': {
                'critical': 0,
                'major': 0,
                'minor': 0,
                'warnings': 0
            }
        }
        
        total_quality_points = 0
        total_possible_points = 0
        
        # Analyze quality by data type
        data_types = ['geology', 'geophysics', 'dem', 'satellite', 'geochem', 'drillhole', 'esg', 'feature_store']
        
        for data_type in data_types:
            type_metrics = {
                'countries_with_data': 0,
                'total_countries': len(country_results),
                'avg_validity_rate': 0,
                'total_records': 0,
                'quality_issues': 0
            }
            
            validity_rates = []
            total_records = 0
            quality_issues = 0
            
            for country, result in country_results.items():
                # Find processor results for this data type
                processor_result = self._find_processor_result(result, data_type)
                
                if processor_result and processor_result.get('status') == 'success':
                    type_metrics['countries_with_data'] += 1
                    
                    # Extract quality metrics based on data type
                    if data_type == 'geology':
                        validation = processor_result.get('validation_summary', {})
                        if validation.get('total_final_records', 0) > 0:
                            validity_rate = (validation.get('total_final_records', 0) / 
                                           validation.get('total_original_records', 1)) * 100
                            validity_rates.append(validity_rate)
                            total_records += validation.get('total_final_records', 0)
                            quality_issues += validation.get('total_invalid_geometries', 0)
                    
                    elif data_type == 'geochem':
                        validation = processor_result.get('validation_summary', {})
                        if validation.get('total_final_samples', 0) > 0:
                            validity_rate = (validation.get('total_final_samples', 0) / 
                                           validation.get('total_original_samples', 1)) * 100
                            validity_rates.append(validity_rate)
                            total_records += validation.get('total_final_samples', 0)
                            quality_issues += validation.get('total_duplicates', 0)
                            quality_issues += validation.get('total_coord_issues', 0)
                    
                    elif data_type == 'drillhole':
                        validation = processor_result.get('validation_summary', {})
                        if validation.get('total_final_records', 0) > 0:
                            validity_rate = (validation.get('total_final_records', 0) / 
                                           validation.get('total_original_records', 1)) * 100
                            validity_rates.append(validity_rate)
                            total_records += validation.get('total_final_records', 0)
                            quality_issues += validation.get('total_issues', 0)
                    
                    elif data_type == 'feature_store':
                        grid_cells = processor_result.get('grid_cells', 0)
                        total_features = processor_result.get('total_features', 0)
                        if grid_cells > 0 and total_features > 0:
                            # Feature completeness as quality metric
                            validity_rate = min(100, (total_features / (grid_cells * 0.1)) * 100)  # Expect ~10% feature density
                            validity_rates.append(validity_rate)
                            total_records += grid_cells
                    
                    else:
                        # Generic quality assessment
                        if 'total_records' in processor_result:
                            total_records += processor_result['total_records']
                            validity_rates.append(90)  # Assume good quality if no specific metrics
                        elif 'sources_processed' in processor_result:
                            sources_found = processor_result.get('sources_found', 0)
                            sources_processed = processor_result.get('sources_processed', 0)
                            if sources_found > 0:
                                validity_rate = (sources_processed / sources_found) * 100
                                validity_rates.append(validity_rate)
            
            # Calculate averages
            if validity_rates:
                type_metrics['avg_validity_rate'] = np.mean(validity_rates)
            type_metrics['total_records'] = total_records
            type_metrics['quality_issues'] = quality_issues
            
            # Data availability score
            availability_score = (type_metrics['countries_with_data'] / type_metrics['total_countries']) * 100
            
            # Overall type quality score
            quality_score = (type_metrics['avg_validity_rate'] * 0.7 + availability_score * 0.3)
            type_metrics['quality_score'] = quality_score
            
            metrics['quality_by_data_type'][data_type] = type_metrics
            
            # Contribute to overall quality
            total_quality_points += quality_score
            total_possible_points += 100
        
        # Calculate overall scores
        if total_possible_points > 0:
            metrics['overall_quality_score'] = total_quality_points / total_possible_points
        
        # Data completeness score (how many data types have data)
        data_types_with_data = len([dt for dt, metrics_dt in metrics['quality_by_data_type'].items() 
                                   if metrics_dt['countries_with_data'] > 0])
        metrics['data_completeness_score'] = (data_types_with_data / len(data_types)) * 100
        
        # Processing reliability score (based on success rates)
        success_rates = []
        for country, result in country_results.items():
            if result.get('status') == 'success':
                success_rates.append(100)
            elif result.get('status') in ['partial_success', 'completed_with_errors']:
                success_rates.append(75)
            else:
                success_rates.append(0)
        
        if success_rates:
            metrics['processing_reliability_score'] = np.mean(success_rates)
        
        # Categorize quality issues
        for data_type, type_metrics in metrics['quality_by_data_type'].items():
            quality_issues = type_metrics['quality_issues']
            
            if quality_issues > 1000:
                metrics['quality_issues_summary']['critical'] += 1
            elif quality_issues > 100:
                metrics['quality_issues_summary']['major'] += 1
            elif quality_issues > 10:
                metrics['quality_issues_summary']['minor'] += 1
            elif quality_issues > 0:
                metrics['quality_issues_summary']['warnings'] += 1
        
        return metrics
    
    def _analyze_performance(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze performance metrics"""
        
        analysis = {
            'processing_times': {
                'total_time': 0,
                'avg_time_per_country': 0,
                'fastest_country': {'country': '', 'time': float('inf')},
                'slowest_country': {'country': '', 'time': 0}
            },
            'throughput_metrics': {
                'records_per_second': 0,
                'files_per_minute': 0,
                'countries_per_hour': 0
            },
            'resource_utilization': {
                'peak_memory_usage': 'N/A',
                'avg_cpu_usage': 'N/A',
                'storage_efficiency': 'N/A'
            },
            'bottleneck_analysis': []
        }
        
        total_time = 0
        total_records = 0
        total_files = 0
        processing_times = []
        
        for country, result in country_results.items():
            country_time = result.get('total_processing_time', 0)
            processing_times.append(country_time)
            total_time += country_time
            
            # Track fastest and slowest
            if country_time < analysis['processing_times']['fastest_country']['time']:
                analysis['processing_times']['fastest_country'] = {'country': country, 'time': country_time}
            
            if country_time > analysis['processing_times']['slowest_country']['time']:
                analysis['processing_times']['slowest_country'] = {'country': country, 'time': country_time}
            
            # Count records and files
            for stage_result in result.get('stages', {}).values():
                for proc_result in stage_result.get('processor_results', {}).values():
                    if proc_result.get('status') == 'success':
                        # Count records
                        if 'total_records' in proc_result:
                            total_records += proc_result['total_records']
                        elif 'total_samples' in proc_result:
                            total_records += proc_result['total_samples']
                        elif 'grid_cells' in proc_result:
                            total_records += proc_result['grid_cells']
                        
                        # Count files
                        if 'sources_processed' in proc_result:
                            total_files += proc_result['sources_processed']
        
        # Calculate metrics
        analysis['processing_times']['total_time'] = total_time
        if len(country_results) > 0:
            analysis['processing_times']['avg_time_per_country'] = total_time / len(country_results)
        
        # Throughput metrics
        if total_time > 0:
            analysis['throughput_metrics']['records_per_second'] = total_records / total_time
            analysis['throughput_metrics']['files_per_minute'] = (total_files / total_time) * 60
            analysis['throughput_metrics']['countries_per_hour'] = (len(country_results) / total_time) * 3600
        
        # Identify bottlenecks
        if processing_times:
            avg_time = np.mean(processing_times)
            std_time = np.std(processing_times)
            
            for country, result in country_results.items():
                country_time = result.get('total_processing_time', 0)
                if country_time > avg_time + (2 * std_time):  # Outlier detection
                    analysis['bottleneck_analysis'].append({
                        'country': country,
                        'processing_time': country_time,
                        'deviation_from_avg': country_time - avg_time,
                        'potential_cause': 'Large dataset or processing complexity'
                    })
        
        return analysis
    
    def _analyze_errors(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze errors and issues across the pipeline"""
        
        analysis = {
            'error_summary': {
                'total_errors': 0,
                'critical_errors': 0,
                'recoverable_errors': 0,
                'warnings': 0
            },
            'error_categories': {},
            'error_patterns': [],
            'most_problematic_areas': [],
            'error_trends': {}
        }
        
        all_errors = []
        
        # Collect all errors
        for country, result in country_results.items():
            if result.get('status') in ['failed', 'critical_failure']:
                if 'error' in result:
                    all_errors.append({
                        'country': country,
                        'level': 'critical',
                        'source': 'pipeline',
                        'message': result['error']
                    })
            
            # Collect processor-level errors
            for stage_name, stage_result in result.get('stages', {}).items():
                for processor, proc_result in stage_result.get('processor_results', {}).items():
                    if proc_result.get('status') == 'failed':
                        error_level = 'critical' if stage_name == 'foundation' else 'recoverable'
                        all_errors.append({
                            'country': country,
                            'level': error_level,
                            'source': f'{stage_name}.{processor}',
                            'message': proc_result.get('error', 'Unknown error')
                        })
                    
                    # Collect validation warnings
                    if 'validation_summary' in proc_result:
                        validation = proc_result['validation_summary']
                        if validation.get('total_issues', 0) > 0:
                            all_errors.append({
                                'country': country,
                                'level': 'warning',
                                'source': f'{stage_name}.{processor}',
                                'message': f"Data quality issues: {validation.get('total_issues', 0)}"
                            })
        
        # Categorize errors
        analysis['error_summary']['total_errors'] = len(all_errors)
        
        for error in all_errors:
            level = error['level']
            if level == 'critical':
                analysis['error_summary']['critical_errors'] += 1
            elif level == 'recoverable':
                analysis['error_summary']['recoverable_errors'] += 1
            else:
                analysis['error_summary']['warnings'] += 1
            
            # Categorize by message content
            message = error['message'].lower()
            category = 'other'
            
            if 'no sources' in message or 'not found' in message:
                category = 'data_availability'
            elif 'validation' in message or 'invalid' in message:
                category = 'data_quality'
            elif 'permission' in message or 'access' in message:
                category = 'access_issues'
            elif 'timeout' in message or 'connection' in message:
                category = 'connectivity'
            elif 'memory' in message or 'disk' in message:
                category = 'resource_limits'
            
            if category not in analysis['error_categories']:
                analysis['error_categories'][category] = 0
            analysis['error_categories'][category] += 1
        
        # Identify patterns
        error_sources = {}
        for error in all_errors:
            source = error['source']
            if source not in error_sources:
                error_sources[source] = 0
            error_sources[source] += 1
        
        # Most problematic areas
        analysis['most_problematic_areas'] = sorted(
            error_sources.items(), key=lambda x: x[1], reverse=True
        )[:5]
        
        return analysis
    
    def _generate_recommendations(self, country_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate actionable recommendations based on analysis"""
        
        recommendations = []
        
        # Analyze success rates by processor
        processor_success_rates = {}
        for country, result in country_results.items():
            for stage_result in result.get('stages', {}).values():
                for processor, proc_result in stage_result.get('processor_results', {}).items():
                    if processor not in processor_success_rates:
                        processor_success_rates[processor] = {'success': 0, 'total': 0}
                    
                    processor_success_rates[processor]['total'] += 1
                    if proc_result.get('status') == 'success':
                        processor_success_rates[processor]['success'] += 1
        
        # Generate processor-specific recommendations
        for processor, stats in processor_success_rates.items():
            success_rate = (stats['success'] / stats['total']) * 100 if stats['total'] > 0 else 0
            
            if success_rate < 70:
                recommendations.append({
                    'priority': 'high',
                    'category': 'reliability',
                    'title': f'Improve {processor} processor reliability',
                    'description': f'{processor} processor has low success rate ({success_rate:.1f}%)',
                    'action_items': [
                        f'Review {processor} processor error logs',
                        'Implement additional data validation',
                        'Add retry mechanisms for transient failures',
                        'Improve error handling and recovery'
                    ]
                })
        
        # Data availability recommendations
        data_availability = {}
        for country, result in country_results.items():
            for stage_result in result.get('stages', {}).values():
                for processor, proc_result in stage_result.get('processor_results', {}).items():
                    if processor not in data_availability:
                        data_availability[processor] = {'countries_with_data': 0, 'total_countries': 0}
                    
                    data_availability[processor]['total_countries'] += 1
                    if proc_result.get('status') == 'success':
                        data_availability[processor]['countries_with_data'] += 1
        
        for processor, stats in data_availability.items():
            availability_rate = (stats['countries_with_data'] / stats['total_countries']) * 100
            
            if availability_rate < 50:
                recommendations.append({
                    'priority': 'medium',
                    'category': 'data_coverage',
                    'title': f'Improve data coverage for {processor}',
                    'description': f'{processor} has data for only {availability_rate:.1f}% of countries',
                    'action_items': [
                        f'Identify additional data sources for {processor}',
                        'Review data discovery patterns',
                        'Consider alternative data formats',
                        'Engage with data providers for missing regions'
                    ]
                })
        
        # Performance recommendations
        processing_times = [result.get('total_processing_time', 0) for result in country_results.values()]
        if processing_times:
            avg_time = np.mean(processing_times)
            if avg_time > 1800:  # More than 30 minutes per country
                recommendations.append({
                    'priority': 'medium',
                    'category': 'performance',
                    'title': 'Optimize processing performance',
                    'description': f'Average processing time per country is {avg_time/60:.1f} minutes',
                    'action_items': [
                        'Profile processor performance to identify bottlenecks',
                        'Implement parallel processing where possible',
                        'Optimize database queries and spatial operations',
                        'Consider caching frequently accessed data'
                    ]
                })
        
        # Quality recommendations
        total_countries = len(country_results)
        successful_countries = len([r for r in country_results.values() if r.get('status') == 'success'])
        success_rate = (successful_countries / total_countries) * 100 if total_countries > 0 else 0
        
        if success_rate < 80:
            recommendations.append({
                'priority': 'high',
                'category': 'quality',
                'title': 'Improve overall pipeline success rate',
                'description': f'Pipeline success rate is {success_rate:.1f}%, below target of 80%',
                'action_items': [
                    'Implement comprehensive input data validation',
                    'Add data quality checks before processing',
                    'Improve error handling and recovery mechanisms',
                    'Create data quality monitoring dashboards'
                ]
            })
        
        return recommendations   
 
    def _generate_charts(self, report_data: Dict[str, Any]) -> Dict[str, str]:
        """Generate interactive charts for the report"""
        
        charts = {}
        
        # 1. Pipeline Success Rate Chart
        country_analysis = report_data['country_analysis']
        success_dist = country_analysis['success_distribution']
        
        fig_success = go.Figure(data=[
            go.Pie(
                labels=['Success', 'Partial Success', 'Failed'],
                values=[success_dist['success'], success_dist['partial_success'], success_dist['failed']],
                hole=0.3,
                marker_colors=['#2E8B57', '#FFD700', '#DC143C']
            )
        ])
        fig_success.update_layout(
            title="Pipeline Success Rate by Country",
            font=dict(size=12)
        )
        charts['success_rate'] = pio.to_html(fig_success, include_plotlyjs='cdn', div_id="success_rate_chart")
        
        # 2. Processing Time by Country
        processing_times = country_analysis['processing_times']
        countries = list(processing_times.keys())
        times = [processing_times[country]/60 for country in countries]  # Convert to minutes
        
        fig_times = go.Figure(data=[
            go.Bar(x=countries, y=times, marker_color='#4682B4')
        ])
        fig_times.update_layout(
            title="Processing Time by Country (Minutes)",
            xaxis_title="Country",
            yaxis_title="Processing Time (Minutes)",
            font=dict(size=12)
        )
        charts['processing_times'] = pio.to_html(fig_times, include_plotlyjs='cdn', div_id="processing_times_chart")
        
        # 3. Data Quality by Type
        quality_metrics = report_data['data_quality_metrics']
        quality_by_type = quality_metrics['quality_by_data_type']
        
        data_types = list(quality_by_type.keys())
        quality_scores = [quality_by_type[dt]['quality_score'] for dt in data_types]
        
        fig_quality = go.Figure(data=[
            go.Bar(x=data_types, y=quality_scores, marker_color='#32CD32')
        ])
        fig_quality.update_layout(
            title="Data Quality Score by Data Type",
            xaxis_title="Data Type",
            yaxis_title="Quality Score (%)",
            font=dict(size=12)
        )
        charts['data_quality'] = pio.to_html(fig_quality, include_plotlyjs='cdn', div_id="data_quality_chart")
        
        # 4. Processor Reliability
        processor_analysis = report_data['processor_analysis']
        reliability_scores = processor_analysis['reliability_scores']
        
        processors = list(reliability_scores.keys())
        reliability = list(reliability_scores.values())
        
        fig_reliability = go.Figure(data=[
            go.Bar(x=processors, y=reliability, marker_color='#FF6347')
        ])
        fig_reliability.update_layout(
            title="Processor Reliability Scores",
            xaxis_title="Processor",
            yaxis_title="Reliability Score (%)",
            font=dict(size=12)
        )
        charts['processor_reliability'] = pio.to_html(fig_reliability, include_plotlyjs='cdn', div_id="processor_reliability_chart")
        
        # 5. Error Categories
        error_analysis = report_data['error_analysis']
        error_categories = error_analysis['error_categories']
        
        if error_categories:
            categories = list(error_categories.keys())
            counts = list(error_categories.values())
            
            fig_errors = go.Figure(data=[
                go.Pie(labels=categories, values=counts, hole=0.3)
            ])
            fig_errors.update_layout(
                title="Error Distribution by Category",
                font=dict(size=12)
            )
            charts['error_categories'] = pio.to_html(fig_errors, include_plotlyjs='cdn', div_id="error_categories_chart")
        
        return charts
    
    def _generate_html_report(self, report_data: Dict[str, Any], charts: Dict[str, str]) -> str:
        """Generate HTML report from analysis data and charts"""
        
        template = Template(self.html_template)
        
        return template.render(
            report_data=report_data,
            charts=charts,
            generated_at=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            quality_thresholds=self.quality_thresholds
        )
    
    def _get_html_template(self) -> str:
        """Get HTML template for the QA/QC report"""
        
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GeoVision AI Miner - QA/QC Report</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #2E8B57;
        }
        .header h1 {
            color: #2E8B57;
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            color: #666;
            margin: 10px 0 0 0;
            font-size: 1.1em;
        }
        .executive-summary {
            background: linear-gradient(135deg, #2E8B57, #32CD32);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .executive-summary h2 {
            margin-top: 0;
            font-size: 1.8em;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .summary-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 2em;
        }
        .summary-card p {
            margin: 0;
            font-size: 0.9em;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #2E8B57;
            border-bottom: 2px solid #2E8B57;
            padding-bottom: 10px;
            font-size: 1.6em;
        }
        .section h3 {
            color: #4682B4;
            font-size: 1.3em;
            margin-top: 25px;
        }
        .chart-container {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #fafafa;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2E8B57;
        }
        .metric-card h4 {
            margin: 0 0 10px 0;
            color: #2E8B57;
        }
        .metric-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #333;
        }
        .recommendations {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .recommendation {
            margin-bottom: 20px;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #ff6b6b;
        }
        .recommendation.high { border-left-color: #ff6b6b; }
        .recommendation.medium { border-left-color: #ffa726; }
        .recommendation.low { border-left-color: #66bb6a; }
        .recommendation h4 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .recommendation ul {
            margin: 10px 0 0 20px;
        }
        .quality-score {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
        }
        .quality-excellent { background-color: #2E8B57; }
        .quality-good { background-color: #32CD32; }
        .quality-acceptable { background-color: #FFD700; color: #333; }
        .quality-poor { background-color: #DC143C; }
        .country-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .country-table th,
        .country-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        .country-table th {
            background-color: #2E8B57;
            color: white;
        }
        .country-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .status-success { color: #2E8B57; font-weight: bold; }
        .status-partial { color: #FF8C00; font-weight: bold; }
        .status-failed { color: #DC143C; font-weight: bold; }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌍 GeoVision AI Miner</h1>
            <h2>Quality Assurance & Quality Control Report</h2>
            <p>Generated on {{ generated_at }}</p>
        </div>

        <div class="executive-summary">
            <h2>📊 Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>{{ report_data.executive_summary.success_rate|round(1) }}%</h3>
                    <p>Pipeline Success Rate</p>
                </div>
                <div class="summary-card">
                    <h3>{{ report_data.executive_summary.countries_processed }}</h3>
                    <p>Countries Processed</p>
                </div>
                <div class="summary-card">
                    <h3>{{ (report_data.executive_summary.total_processing_time/60)|round(1) }}</h3>
                    <p>Total Time (Minutes)</p>
                </div>
                <div class="summary-card">
                    <h3>{{ report_data.executive_summary.data_volumes.total_records_processed|default(0) }}</h3>
                    <p>Records Processed</p>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <p><strong>Overall Quality:</strong> 
                    <span class="quality-score quality-{{ report_data.executive_summary.quality_score.lower().replace(' ', '-') }}">
                        {{ report_data.executive_summary.quality_score }}
                    </span>
                </p>
            </div>
        </div>

        <div class="section">
            <h2>📈 Pipeline Performance</h2>
            
            <div class="chart-container">
                {{ charts.success_rate|safe }}
            </div>
            
            <div class="chart-container">
                {{ charts.processing_times|safe }}
            </div>
        </div>

        <div class="section">
            <h2>🔍 Data Quality Analysis</h2>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>Overall Quality Score</h4>
                    <div class="metric-value">{{ report_data.data_quality_metrics.overall_quality_score|round(1) }}%</div>
                </div>
                <div class="metric-card">
                    <h4>Data Completeness</h4>
                    <div class="metric-value">{{ report_data.data_quality_metrics.data_completeness_score|round(1) }}%</div>
                </div>
                <div class="metric-card">
                    <h4>Processing Reliability</h4>
                    <div class="metric-value">{{ report_data.data_quality_metrics.processing_reliability_score|round(1) }}%</div>
                </div>
            </div>
            
            <div class="chart-container">
                {{ charts.data_quality|safe }}
            </div>
        </div>

        <div class="section">
            <h2>⚙️ Processor Analysis</h2>
            
            <div class="chart-container">
                {{ charts.processor_reliability|safe }}
            </div>
            
            <h3>Processor Performance Summary</h3>
            <table class="country-table">
                <thead>
                    <tr>
                        <th>Processor</th>
                        <th>Success Rate</th>
                        <th>Total Runs</th>
                        <th>Failed Runs</th>
                        <th>No Data Runs</th>
                    </tr>
                </thead>
                <tbody>
                    {% for processor, stats in report_data.processor_analysis.processor_summary.items() %}
                    <tr>
                        <td>{{ processor|title }}</td>
                        <td>{{ stats.success_rate|round(1) }}%</td>
                        <td>{{ stats.total_runs }}</td>
                        <td>{{ stats.failed_runs }}</td>
                        <td>{{ stats.no_data_runs }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🌍 Country Analysis</h2>
            
            <table class="country-table">
                <thead>
                    <tr>
                        <th>Country</th>
                        <th>Status</th>
                        <th>Processing Time</th>
                        <th>Stages Completed</th>
                        <th>Quality Score</th>
                    </tr>
                </thead>
                <tbody>
                    {% for country, details in report_data.country_analysis.country_summary.items() %}
                    <tr>
                        <td>{{ country }}</td>
                        <td class="status-{{ details.status.replace('_', '-') }}">{{ details.status|title }}</td>
                        <td>{{ (details.processing_time/60)|round(1) }} min</td>
                        <td>{{ details.stages_completed }}/{{ details.total_stages }}</td>
                        <td>{{ report_data.country_analysis.quality_scores[country]|round(1) }}%</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        {% if report_data.error_analysis.error_summary.total_errors > 0 %}
        <div class="section">
            <h2>⚠️ Error Analysis</h2>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <h4>Total Errors</h4>
                    <div class="metric-value">{{ report_data.error_analysis.error_summary.total_errors }}</div>
                </div>
                <div class="metric-card">
                    <h4>Critical Errors</h4>
                    <div class="metric-value">{{ report_data.error_analysis.error_summary.critical_errors }}</div>
                </div>
                <div class="metric-card">
                    <h4>Warnings</h4>
                    <div class="metric-value">{{ report_data.error_analysis.error_summary.warnings }}</div>
                </div>
            </div>
            
            {% if charts.error_categories %}
            <div class="chart-container">
                {{ charts.error_categories|safe }}
            </div>
            {% endif %}
        </div>
        {% endif %}

        <div class="section">
            <h2>💡 Recommendations</h2>
            
            <div class="recommendations">
                {% for rec in report_data.recommendations %}
                <div class="recommendation {{ rec.priority }}">
                    <h4>{{ rec.title }}</h4>
                    <p><strong>Priority:</strong> {{ rec.priority|title }} | <strong>Category:</strong> {{ rec.category|title }}</p>
                    <p>{{ rec.description }}</p>
                    <ul>
                        {% for action in rec.action_items %}
                        <li>{{ action }}</li>
                        {% endfor %}
                    </ul>
                </div>
                {% endfor %}
            </div>
        </div>

        <div class="footer">
            <p>Generated by GeoVision AI Miner QA/QC System | Report Version 1.0</p>
            <p>For technical support, contact the GeoVision development team</p>
        </div>
    </div>
</body>
</html>
        """
    
    def _find_processor_result(self, country_result: Dict[str, Any], processor_name: str) -> Optional[Dict[str, Any]]:
        """Find processor result within country result structure"""
        
        for stage_result in country_result.get('stages', {}).values():
            if processor_name in stage_result.get('processor_results', {}):
                return stage_result['processor_results'][processor_name]
        
        return None
    
    def _count_data_sources(self, country_result: Dict[str, Any]) -> int:
        """Count total data sources found for a country"""
        
        total_sources = 0
        
        for stage_result in country_result.get('stages', {}).values():
            for proc_result in stage_result.get('processor_results', {}).values():
                if 'sources_found' in proc_result:
                    total_sources += proc_result['sources_found']
        
        return total_sources
    
    def _count_quality_issues(self, country_result: Dict[str, Any]) -> int:
        """Count total quality issues for a country"""
        
        total_issues = 0
        
        for stage_result in country_result.get('stages', {}).values():
            for proc_result in stage_result.get('processor_results', {}).values():
                validation = proc_result.get('validation_summary', {})
                
                # Count various types of issues
                total_issues += validation.get('total_invalid_geometries', 0)
                total_issues += validation.get('total_duplicates', 0)
                total_issues += validation.get('total_coord_issues', 0)
                total_issues += validation.get('total_issues', 0)
        
        return total_issues

# Convenience function for generating QA/QC reports
def generate_qaqc_report(pipeline_results: Dict[str, Any],
                        s3_bucket: str = None,
                        postgres_dsn: str = None,
                        output_format: str = 'html') -> str:
    """Generate QA/QC report from pipeline results"""
    
    if s3_bucket is None:
        s3_bucket = config.s3_bucket
    if postgres_dsn is None:
        postgres_dsn = config.postgres_dsn
    
    storage = StorageManager(s3_bucket, postgres_dsn)
    generator = QAQCReportGenerator(storage)
    
    try:
        return generator.generate_consolidated_report(pipeline_results, output_format)
    finally:
        if hasattr(storage, 'close'):
            storage.close()