"""
Main Pipeline Orchestrator
Coordinates all data processors and manages the complete ingestion workflow
"""

import os
import time
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import traceback

from .core.logger import get_logger
from .core.storage import StorageManager
from .config import config, quality_config

# Import all processors
from .processors.geology_processor import GeologyProcessor
from .processors.geophysics_processor import GeophysicsProcessor
from .processors.dem_processor import DEMProcessor
from .processors.satellite_processor import SatelliteProcessor
from .processors.geochem_processor import GeochemProcessor
from .processors.drillhole_processor import DrillholeProcessor
from .processors.esg_processor import ESGProcessor
from .processors.feature_store_builder import FeatureStoreBuilder

class PipelineOrchestrator:
    """Main orchestrator for the complete data ingestion pipeline"""
    
    def __init__(self, s3_bucket: str, postgres_dsn: str, local_base_path: Optional[str] = None):
        self.storage = StorageManager(s3_bucket, postgres_dsn, local_base_path)
        self.logger = get_logger('pipeline_orchestrator')
        
        # Initialize all processors
        self.processors = {
            'geology': GeologyProcessor(self.storage),
            'geophysics': GeophysicsProcessor(self.storage),
            'dem': DEMProcessor(self.storage),
            'satellite': SatelliteProcessor(self.storage),
            'geochem': GeochemProcessor(self.storage),
            'drillhole': DrillholeProcessor(self.storage),
            'esg': ESGProcessor(self.storage),
            'feature_store': FeatureStoreBuilder(self.storage)
        }
        
        # Processing order and dependencies
        self.processing_order = [
            {
                'stage': 'foundation',
                'processors': ['geology', 'geophysics', 'dem'],
                'description': 'Core geological and geophysical data',
                'parallel': True
            },
            {
                'stage': 'derived',
                'processors': ['satellite'],
                'description': 'Satellite imagery and spectral indices',
                'parallel': True,
                'depends_on': []
            },
            {
                'stage': 'samples',
                'processors': ['geochem', 'drillhole'],
                'description': 'Sample and drilling data',
                'parallel': True,
                'depends_on': []
            },
            {
                'stage': 'environmental',
                'processors': ['esg'],
                'description': 'Environmental and regulatory data',
                'parallel': True,
                'depends_on': []
            },
            {
                'stage': 'features',
                'processors': ['feature_store'],
                'description': 'ML feature generation',
                'parallel': False,
                'depends_on': ['foundation', 'derived', 'samples', 'environmental']
            }
        ]
        
        # Pipeline state
        self.pipeline_state = {
            'start_time': None,
            'end_time': None,
            'status': 'initialized',
            'countries_processed': [],
            'countries_failed': [],
            'stage_results': {},
            'total_processing_time': 0,
            'errors': []
        }
    
    def process_countries(self, countries: List[str], 
                         resume: bool = True,
                         max_workers: int = None) -> Dict[str, Any]:
        """Process multiple countries through the complete pipeline"""
        
        if max_workers is None:
            max_workers = min(config.max_workers, len(countries))
        
        self.pipeline_state['start_time'] = datetime.now()
        self.pipeline_state['status'] = 'running'
        
        self.logger.info(f"Starting pipeline for {len(countries)} countries: {countries}")
        self.logger.info(f"Using {max_workers} workers, resume={resume}")
        
        # Process countries in parallel
        country_results = {}
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all country processing jobs
            future_to_country = {
                executor.submit(self.process_country, country, resume): country
                for country in countries
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_country):
                country = future_to_country[future]
                
                try:
                    result = future.result()
                    country_results[country] = result
                    
                    if result['status'] == 'success':
                        self.pipeline_state['countries_processed'].append(country)
                        self.logger.info(f"Successfully processed {country}")
                    else:
                        self.pipeline_state['countries_failed'].append(country)
                        self.logger.error(f"Failed to process {country}: {result.get('error', 'Unknown error')}")
                        
                except Exception as e:
                    error_msg = f"Unexpected error processing {country}: {str(e)}"
                    self.logger.error(error_msg)
                    self.pipeline_state['errors'].append(error_msg)
                    self.pipeline_state['countries_failed'].append(country)
                    
                    country_results[country] = {
                        'country': country,
                        'status': 'failed',
                        'error': str(e),
                        'processing_time': 0
                    }
        
        # Finalize pipeline state
        self.pipeline_state['end_time'] = datetime.now()
        self.pipeline_state['total_processing_time'] = (
            self.pipeline_state['end_time'] - self.pipeline_state['start_time']
        ).total_seconds()
        
        if self.pipeline_state['countries_failed']:
            self.pipeline_state['status'] = 'completed_with_errors'
        else:
            self.pipeline_state['status'] = 'completed_successfully'
        
        # Generate final report
        final_report = self.generate_pipeline_report(country_results)
        
        # Write pipeline manifest
        manifest_path = self.write_pipeline_manifest(country_results, final_report)
        
        self.logger.info(f"Pipeline completed: {len(self.pipeline_state['countries_processed'])} successful, "
                        f"{len(self.pipeline_state['countries_failed'])} failed")
        
        return {
            'pipeline_state': self.pipeline_state,
            'country_results': country_results,
            'final_report': final_report,
            'manifest_path': manifest_path
        }
    
    def process_country(self, country_code: str, resume: bool = True) -> Dict[str, Any]:
        """Process a single country through all pipeline stages"""
        
        country_start_time = time.time()
        
        self.logger.info(f"Starting country processing: {country_code}")
        
        # Check if country processing should be resumed
        if resume:
            existing_results = self.check_existing_results(country_code)
            if existing_results:
                self.logger.info(f"Found existing results for {country_code}, resuming from last stage")
        else:
            existing_results = {}
        
        country_results = {
            'country': country_code,
            'start_time': datetime.now().isoformat(),
            'stages': {},
            'status': 'processing',
            'total_processing_time': 0
        }
        
        try:
            # Process each stage in order
            for stage_config in self.processing_order:
                stage_name = stage_config['stage']
                processors = stage_config['processors']
                parallel = stage_config.get('parallel', False)
                depends_on = stage_config.get('depends_on', [])
                
                self.logger.info(f"Processing stage '{stage_name}' for {country_code}")
                
                # Check dependencies
                if depends_on:
                    missing_deps = []
                    for dep_stage in depends_on:
                        if dep_stage not in country_results['stages'] or country_results['stages'][dep_stage]['status'] != 'success':
                            missing_deps.append(dep_stage)
                    
                    if missing_deps:
                        error_msg = f"Missing dependencies for stage {stage_name}: {missing_deps}"
                        self.logger.error(error_msg)
                        country_results['stages'][stage_name] = {
                            'status': 'failed',
                            'error': error_msg,
                            'processing_time': 0
                        }
                        continue
                
                # Process stage
                stage_result = self.process_stage(
                    country_code, stage_name, processors, parallel, existing_results
                )
                
                country_results['stages'][stage_name] = stage_result
                
                # Check if stage failed critically
                if stage_result['status'] == 'failed' and stage_name in ['foundation']:
                    self.logger.error(f"Critical stage {stage_name} failed for {country_code}, stopping pipeline")
                    break
            
            # Determine overall country status
            failed_stages = [stage for stage, result in country_results['stages'].items() 
                           if result['status'] == 'failed']
            
            if not failed_stages:
                country_results['status'] = 'success'
            elif any(stage in failed_stages for stage in ['foundation']):
                country_results['status'] = 'critical_failure'
            else:
                country_results['status'] = 'partial_success'
            
            country_results['total_processing_time'] = time.time() - country_start_time
            country_results['end_time'] = datetime.now().isoformat()
            
            self.logger.info(f"Completed country processing: {country_code} ({country_results['status']})")
            
            return country_results
            
        except Exception as e:
            error_msg = f"Critical error processing {country_code}: {str(e)}"
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            
            country_results['status'] = 'failed'
            country_results['error'] = error_msg
            country_results['total_processing_time'] = time.time() - country_start_time
            country_results['end_time'] = datetime.now().isoformat()
            
            return country_results
    
    def process_stage(self, country_code: str, stage_name: str, 
                     processors: List[str], parallel: bool,
                     existing_results: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single pipeline stage"""
        
        stage_start_time = time.time()
        
        stage_result = {
            'stage': stage_name,
            'processors': processors,
            'processor_results': {},
            'status': 'processing',
            'processing_time': 0
        }
        
        try:
            if parallel and len(processors) > 1:
                # Process processors in parallel
                with ThreadPoolExecutor(max_workers=min(len(processors), config.max_workers)) as executor:
                    future_to_processor = {
                        executor.submit(self.run_processor, processor, country_code, existing_results): processor
                        for processor in processors
                    }
                    
                    for future in as_completed(future_to_processor):
                        processor = future_to_processor[future]
                        
                        try:
                            result = future.result()
                            stage_result['processor_results'][processor] = result
                            
                        except Exception as e:
                            error_msg = f"Processor {processor} failed: {str(e)}"
                            self.logger.error(error_msg)
                            stage_result['processor_results'][processor] = {
                                'status': 'failed',
                                'error': error_msg,
                                'processing_time': 0
                            }
            else:
                # Process processors sequentially
                for processor in processors:
                    try:
                        result = self.run_processor(processor, country_code, existing_results)
                        stage_result['processor_results'][processor] = result
                        
                    except Exception as e:
                        error_msg = f"Processor {processor} failed: {str(e)}"
                        self.logger.error(error_msg)
                        stage_result['processor_results'][processor] = {
                            'status': 'failed',
                            'error': error_msg,
                            'processing_time': 0
                        }
            
            # Determine stage status
            failed_processors = [proc for proc, result in stage_result['processor_results'].items()
                               if result['status'] in ['failed', 'no_sources']]
            
            if not failed_processors:
                stage_result['status'] = 'success'
            elif len(failed_processors) == len(processors):
                stage_result['status'] = 'failed'
            else:
                stage_result['status'] = 'partial_success'
            
            stage_result['processing_time'] = time.time() - stage_start_time
            
            self.logger.info(f"Stage {stage_name} completed for {country_code}: {stage_result['status']}")
            
            return stage_result
            
        except Exception as e:
            error_msg = f"Stage {stage_name} failed: {str(e)}"
            self.logger.error(error_msg)
            
            stage_result['status'] = 'failed'
            stage_result['error'] = error_msg
            stage_result['processing_time'] = time.time() - stage_start_time
            
            return stage_result
    
    def run_processor(self, processor_name: str, country_code: str,
                     existing_results: Dict[str, Any]) -> Dict[str, Any]:
        """Run a specific processor for a country"""
        
        # Check if processor should be skipped (resume functionality)
        if existing_results.get(processor_name, {}).get('status') == 'success':
            self.logger.info(f"Skipping {processor_name} for {country_code} (already completed)")
            return existing_results[processor_name]
        
        processor = self.processors[processor_name]
        
        self.logger.info(f"Running {processor_name} processor for {country_code}")
        
        try:
            result = processor.process_country(country_code)
            
            # Add processor metadata
            result['processor'] = processor_name
            result['timestamp'] = datetime.now().isoformat()
            
            return result
            
        except Exception as e:
            error_msg = f"Processor {processor_name} failed for {country_code}: {str(e)}"
            self.logger.error(error_msg)
            self.logger.error(traceback.format_exc())
            
            return {
                'processor': processor_name,
                'country': country_code,
                'status': 'failed',
                'error': error_msg,
                'timestamp': datetime.now().isoformat(),
                'processing_time': 0
            }  
  
    def check_existing_results(self, country_code: str) -> Dict[str, Any]:
        """Check for existing processing results to enable resume functionality"""
        
        existing_results = {}
        
        # Check S3 for existing outputs
        prefixes_to_check = {
            'geology': f"country/{country_code}/baseline/geology/",
            'geophysics': f"country/{country_code}/baseline/geophysics/",
            'dem': f"country/{country_code}/baseline/dem/",
            'satellite': f"country/{country_code}/baseline/satellite/",
            'geochem': f"country/{country_code}/geochem/",
            'drillhole': f"country/{country_code}/drill/",
            'esg': f"country/{country_code}/baseline/esg/",
            'feature_store': f"features/{country_code}/"
        }
        
        for processor, prefix in prefixes_to_check.items():
            objects = self.storage.s3.list_objects(prefix)
            
            if objects:
                # Found existing data, mark as completed
                existing_results[processor] = {
                    'status': 'success',
                    'note': 'Found existing data, skipping processor',
                    'existing_objects': len(objects)
                }
                self.logger.info(f"Found {len(objects)} existing objects for {processor} in {country_code}")
        
        return existing_results
    
    def generate_pipeline_report(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive pipeline execution report"""
        
        report = {
            'pipeline_summary': {
                'total_countries': len(country_results),
                'successful_countries': len(self.pipeline_state['countries_processed']),
                'failed_countries': len(self.pipeline_state['countries_failed']),
                'total_processing_time': self.pipeline_state['total_processing_time'],
                'start_time': self.pipeline_state['start_time'].isoformat(),
                'end_time': self.pipeline_state['end_time'].isoformat(),
                'status': self.pipeline_state['status']
            },
            'country_details': {},
            'processor_statistics': {},
            'stage_statistics': {},
            'data_volumes': {},
            'quality_metrics': {},
            'errors_and_warnings': []
        }
        
        # Analyze country results
        for country, result in country_results.items():
            report['country_details'][country] = {
                'status': result['status'],
                'processing_time': result.get('total_processing_time', 0),
                'stages_completed': len([s for s in result.get('stages', {}).values() if s['status'] == 'success']),
                'stages_failed': len([s for s in result.get('stages', {}).values() if s['status'] == 'failed'])
            }
            
            # Collect errors
            if result['status'] in ['failed', 'critical_failure']:
                report['errors_and_warnings'].append({
                    'country': country,
                    'type': 'error',
                    'message': result.get('error', 'Unknown error')
                })
        
        # Analyze processor statistics
        all_processors = set()
        for result in country_results.values():
            for stage_result in result.get('stages', {}).values():
                for processor in stage_result.get('processor_results', {}):
                    all_processors.add(processor)
        
        for processor in all_processors:
            processor_stats = {
                'total_runs': 0,
                'successful_runs': 0,
                'failed_runs': 0,
                'no_data_runs': 0,
                'total_processing_time': 0,
                'average_processing_time': 0
            }
            
            processing_times = []
            
            for result in country_results.values():
                for stage_result in result.get('stages', {}).values():
                    if processor in stage_result.get('processor_results', {}):
                        proc_result = stage_result['processor_results'][processor]
                        processor_stats['total_runs'] += 1
                        
                        if proc_result['status'] == 'success':
                            processor_stats['successful_runs'] += 1
                        elif proc_result['status'] == 'no_sources':
                            processor_stats['no_data_runs'] += 1
                        else:
                            processor_stats['failed_runs'] += 1
                        
                        proc_time = proc_result.get('processing_time', 0)
                        processor_stats['total_processing_time'] += proc_time
                        processing_times.append(proc_time)
            
            if processing_times:
                processor_stats['average_processing_time'] = sum(processing_times) / len(processing_times)
            
            report['processor_statistics'][processor] = processor_stats
        
        # Analyze stage statistics
        all_stages = set()
        for result in country_results.values():
            all_stages.update(result.get('stages', {}).keys())
        
        for stage in all_stages:
            stage_stats = {
                'total_runs': 0,
                'successful_runs': 0,
                'failed_runs': 0,
                'partial_success_runs': 0,
                'total_processing_time': 0,
                'average_processing_time': 0
            }
            
            processing_times = []
            
            for result in country_results.values():
                if stage in result.get('stages', {}):
                    stage_result = result['stages'][stage]
                    stage_stats['total_runs'] += 1
                    
                    if stage_result['status'] == 'success':
                        stage_stats['successful_runs'] += 1
                    elif stage_result['status'] == 'partial_success':
                        stage_stats['partial_success_runs'] += 1
                    else:
                        stage_stats['failed_runs'] += 1
                    
                    stage_time = stage_result.get('processing_time', 0)
                    stage_stats['total_processing_time'] += stage_time
                    processing_times.append(stage_time)
            
            if processing_times:
                stage_stats['average_processing_time'] = sum(processing_times) / len(processing_times)
            
            report['stage_statistics'][stage] = stage_stats
        
        # Calculate data volumes (simplified)
        total_records = 0
        total_files = 0
        
        for result in country_results.values():
            for stage_result in result.get('stages', {}).values():
                for proc_result in stage_result.get('processor_results', {}).values():
                    # Extract record counts from various processors
                    if 'total_records' in proc_result:
                        total_records += proc_result['total_records']
                    elif 'total_samples' in proc_result:
                        total_records += proc_result['total_samples']
                    elif 'total_features' in proc_result:
                        total_records += proc_result['total_features']
                    elif 'grid_cells' in proc_result:
                        total_records += proc_result['grid_cells']
                    
                    if 'sources_processed' in proc_result:
                        total_files += proc_result['sources_processed']
        
        report['data_volumes'] = {
            'total_records_processed': total_records,
            'total_files_processed': total_files,
            'countries_with_data': len([c for c in country_results.values() if c['status'] != 'failed'])
        }
        
        # Quality metrics
        report['quality_metrics'] = {
            'pipeline_success_rate': (len(self.pipeline_state['countries_processed']) / 
                                    len(country_results) * 100) if country_results else 0,
            'average_processing_time_per_country': (self.pipeline_state['total_processing_time'] / 
                                                   len(country_results)) if country_results else 0,
            'most_reliable_processor': max(report['processor_statistics'].items(), 
                                         key=lambda x: x[1]['successful_runs'] / max(x[1]['total_runs'], 1))[0] 
                                         if report['processor_statistics'] else None,
            'most_problematic_processor': max(report['processor_statistics'].items(),
                                            key=lambda x: x[1]['failed_runs'] / max(x[1]['total_runs'], 1))[0]
                                            if report['processor_statistics'] else None
        }
        
        return report
    
    def write_pipeline_manifest(self, country_results: Dict[str, Any], 
                               report: Dict[str, Any]) -> str:
        """Write comprehensive pipeline manifest to S3"""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        manifest = {
            'manifest_version': '1.0',
            'generated_at': datetime.now().isoformat(),
            'pipeline_configuration': {
                'org_id': config.org_id,
                'project_id': config.project_id,
                's3_bucket': config.s3_bucket,
                'target_crs': config.crs_target,
                'countries': config.countries,
                'max_workers': config.max_workers,
                'resume_enabled': True
            },
            'execution_summary': report['pipeline_summary'],
            'country_results': country_results,
            'processor_statistics': report['processor_statistics'],
            'stage_statistics': report['stage_statistics'],
            'data_volumes': report['data_volumes'],
            'quality_metrics': report['quality_metrics'],
            'dataset_paths': self.generate_dataset_inventory(country_results),
            'postgis_tables': self.generate_table_inventory(country_results),
            'stac_catalogs': self.generate_stac_inventory(country_results),
            'errors_and_warnings': report['errors_and_warnings']
        }
        
        # Write manifest to S3
        manifest_key = f"manifests/pipeline_execution_{timestamp}.json"
        
        success = self.storage.s3.upload_json(manifest, manifest_key)
        
        if success:
            manifest_path = f"s3://{config.s3_bucket}/{manifest_key}"
            self.logger.info(f"Pipeline manifest written to {manifest_path}")
            return manifest_path
        else:
            self.logger.error("Failed to write pipeline manifest")
            return ""
    
    def generate_dataset_inventory(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate inventory of all datasets created"""
        
        inventory = {
            'by_country': {},
            'by_data_type': {},
            'total_datasets': 0
        }
        
        for country, result in country_results.items():
            country_datasets = []
            
            for stage_result in result.get('stages', {}).values():
                for proc_name, proc_result in stage_result.get('processor_results', {}).items():
                    if proc_result['status'] == 'success' and 'outputs' in proc_result:
                        outputs = proc_result['outputs']
                        
                        # Extract dataset paths from different processor outputs
                        if 'archive_path' in outputs:
                            country_datasets.append({
                                'type': f'{proc_name}_archive',
                                'path': outputs['archive_path'],
                                'format': 'gpkg'
                            })
                        
                        if 'parquet_files' in outputs:
                            for table_type, path in outputs['parquet_files'].items():
                                country_datasets.append({
                                    'type': f'{proc_name}_{table_type}',
                                    'path': path,
                                    'format': 'parquet'
                                })
                        
                        if 'products' in outputs:
                            for product_type, path in outputs['products'].items():
                                country_datasets.append({
                                    'type': f'{proc_name}_{product_type}',
                                    'path': path,
                                    'format': 'cog'
                                })
                        
                        if 'feature_store_path' in outputs:
                            country_datasets.append({
                                'type': 'feature_store',
                                'path': outputs['feature_store_path'],
                                'format': 'parquet'
                            })
            
            inventory['by_country'][country] = country_datasets
            inventory['total_datasets'] += len(country_datasets)
            
            # Group by data type
            for dataset in country_datasets:
                data_type = dataset['type']
                if data_type not in inventory['by_data_type']:
                    inventory['by_data_type'][data_type] = []
                inventory['by_data_type'][data_type].append({
                    'country': country,
                    'path': dataset['path'],
                    'format': dataset['format']
                })
        
        return inventory
    
    def generate_table_inventory(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate inventory of PostGIS tables created"""
        
        inventory = {
            'by_country': {},
            'by_table_type': {},
            'total_tables': 0
        }
        
        for country, result in country_results.items():
            country_tables = []
            
            for stage_result in result.get('stages', {}).values():
                for proc_name, proc_result in stage_result.get('processor_results', {}).items():
                    if proc_result['status'] == 'success' and 'outputs' in proc_result:
                        outputs = proc_result['outputs']
                        
                        # Extract table names from different processor outputs
                        if 'postgis_table' in outputs:
                            country_tables.append({
                                'processor': proc_name,
                                'table_name': outputs['postgis_table'],
                                'success': outputs.get('postgis_success', False)
                            })
                        
                        if 'postgis_tables' in outputs:
                            for table_name, success in outputs['postgis_tables'].items():
                                country_tables.append({
                                    'processor': proc_name,
                                    'table_name': table_name,
                                    'success': success
                                })
                        
                        if 'cells_table' in outputs and 'features_table' in outputs:
                            country_tables.extend([
                                {
                                    'processor': proc_name,
                                    'table_name': outputs['cells_table'],
                                    'success': True
                                },
                                {
                                    'processor': proc_name,
                                    'table_name': outputs['features_table'],
                                    'success': True
                                }
                            ])
            
            inventory['by_country'][country] = country_tables
            inventory['total_tables'] += len(country_tables)
            
            # Group by table type
            for table in country_tables:
                table_type = table['table_name'].split('_')[0] if '_' in table['table_name'] else 'unknown'
                if table_type not in inventory['by_table_type']:
                    inventory['by_table_type'][table_type] = []
                inventory['by_table_type'][table_type].append({
                    'country': country,
                    'table_name': table['table_name'],
                    'processor': table['processor'],
                    'success': table['success']
                })
        
        return inventory
    
    def generate_stac_inventory(self, country_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate inventory of STAC catalogs created"""
        
        inventory = {
            'by_country': {},
            'by_collection_type': {},
            'total_collections': 0,
            'total_items': 0
        }
        
        for country, result in country_results.items():
            country_stac = {
                'collections': [],
                'items': []
            }
            
            for stage_result in result.get('stages', {}).values():
                for proc_name, proc_result in stage_result.get('processor_results', {}).values():
                    if proc_result['status'] == 'success' and 'outputs' in proc_result:
                        outputs = proc_result['outputs']
                        
                        # Extract STAC paths
                        if 'stac_collection' in outputs:
                            country_stac['collections'].append({
                                'processor': proc_name,
                                'collection_path': outputs['stac_collection']
                            })
                        
                        if 'stac_item' in outputs:
                            country_stac['items'].append({
                                'processor': proc_name,
                                'item_path': outputs['stac_item']
                            })
                        
                        if 'stac_items' in outputs:
                            for item_path in outputs['stac_items']:
                                country_stac['items'].append({
                                    'processor': proc_name,
                                    'item_path': item_path
                                })
            
            inventory['by_country'][country] = country_stac
            inventory['total_collections'] += len(country_stac['collections'])
            inventory['total_items'] += len(country_stac['items'])
            
            # Group by collection type
            for collection in country_stac['collections']:
                collection_type = collection['processor']
                if collection_type not in inventory['by_collection_type']:
                    inventory['by_collection_type'][collection_type] = []
                inventory['by_collection_type'][collection_type].append({
                    'country': country,
                    'collection_path': collection['collection_path']
                })
        
        return inventory
    
    def get_pipeline_status(self) -> Dict[str, Any]:
        """Get current pipeline status"""
        return {
            'pipeline_state': self.pipeline_state,
            'processors_available': list(self.processors.keys()),
            'processing_stages': [stage['stage'] for stage in self.processing_order],
            'configuration': {
                'org_id': config.org_id,
                'project_id': config.project_id,
                's3_bucket': config.s3_bucket,
                'target_countries': config.countries,
                'max_workers': config.max_workers
            }
        }
    
    def cleanup_resources(self):
        """Cleanup pipeline resources"""
        try:
            # Close storage connections
            if hasattr(self.storage, 'close'):
                self.storage.close()
            
            # Flush logs
            self.logger.flush_logs()
            
            self.logger.info("Pipeline resources cleaned up successfully")
            
        except Exception as e:
            self.logger.error(f"Error during resource cleanup: {str(e)}")

# Convenience function for running the complete pipeline
def run_pipeline(countries: List[str] = None,
                s3_bucket: str = None,
                postgres_dsn: str = None,
                max_workers: int = None,
                resume: bool = True) -> Dict[str, Any]:
    """Run the complete data ingestion pipeline"""
    
    # Use configuration defaults if not provided
    if countries is None:
        countries = config.countries
    if s3_bucket is None:
        s3_bucket = config.s3_bucket
    if postgres_dsn is None:
        postgres_dsn = config.postgres_dsn
    if max_workers is None:
        max_workers = config.max_workers
    
    # Initialize and run pipeline
    orchestrator = PipelineOrchestrator(s3_bucket, postgres_dsn)
    
    try:
        results = orchestrator.process_countries(countries, resume, max_workers)
        return results
        
    finally:
        orchestrator.cleanup_resources()