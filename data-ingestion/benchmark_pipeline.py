#!/usr/bin/env python3
"""
GeoVision AI Miner - Pipeline Performance Benchmark
Tests pipeline performance with various data volumes and configurations
"""

import os
import sys
import json
import time
import asyncio
import tempfile
import statistics
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add the data-ingestion directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from config import Config
from pipeline_orchestrator import PipelineOrchestrator
from core.logger import Logger

class PipelineBenchmark:
    """Performance benchmark suite for the data ingestion pipeline"""
    
    def __init__(self, test_dir: str):
        self.test_dir = Path(test_dir)
        self.logger = Logger("benchmark")
        self.results = []
        
    def generate_test_datasets(self, dataset_count: int, complexity: str = "medium") -> List[str]:
        """Generate test datasets of varying complexity"""
        
        print(f"📊 Generating {dataset_count} test datasets (complexity: {complexity})...")
        
        datasets = []
        
        # Define complexity parameters
        complexity_params = {
            "simple": {
                "features_per_dataset": 10,
                "properties_per_feature": 5,
                "nested_levels": 1
            },
            "medium": {
                "features_per_dataset": 100,
                "properties_per_feature": 15,
                "nested_levels": 2
            },
            "complex": {
                "features_per_dataset": 1000,
                "properties_per_feature": 30,
                "nested_levels": 3
            }
        }
        
        params = complexity_params.get(complexity, complexity_params["medium"])
        
        for i in range(dataset_count):
            # Rotate through different data types
            data_types = ['geology', 'satellite', 'geophysics', 'geochemistry', 'drillholes']
            data_type = data_types[i % len(data_types)]
            
            # Rotate through countries
            countries = ['ZMB', 'BWA', 'ZAF']
            country = countries[i % len(countries)]
            
            dataset = self._create_dataset(
                data_type, country, i, 
                params["features_per_dataset"],
                params["properties_per_feature"],
                params["nested_levels"]
            )
            
            # Save dataset
            file_path = self.test_dir / data_type / country / f"dataset_{i:04d}.json"
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(file_path, 'w') as f:
                json.dump(dataset, f)
            
            datasets.append(str(file_path))
        
        print(f"   ✅ Generated {len(datasets)} datasets")
        return datasets
    
    def _create_dataset(self, data_type: str, country: str, index: int, 
                       feature_count: int, property_count: int, nesting_level: int) -> Dict[str, Any]:
        """Create a single test dataset"""
        
        base_dataset = {
            'id': f"{data_type}_{country}_{index:04d}",
            'type': data_type,
            'country': country,
            'created': datetime.now(timezone.utc).isoformat(),
            'confidence': 0.7 + (index % 30) / 100,  # Vary confidence 0.7-0.99
            'features': []
        }
        
        # Add type-specific properties
        if data_type == 'geology':
            base_dataset.update({
                'geological:data_type': 'geological_units',
                'geological:target_mineral': ['copper', 'gold', 'diamond'][index % 3],
                'rock_type': 'sedimentary',
                'formation': f'Formation_{index}'
            })
        elif data_type == 'satellite':
            base_dataset.update({
                'platform': ['landsat-8', 'sentinel-2', 'aviris'][index % 3],
                'sensor': 'oli',
                'acquisition_date': '2024-01-01T00:00:00Z',
                'cloud_cover': (index % 50) + 5
            })
        elif data_type == 'geophysics':
            base_dataset.update({
                'survey_type': ['aeromagnetic', 'gravity', 'radiometric'][index % 3],
                'survey_altitude': 150 + (index % 200),
                'line_spacing': 50 + (index % 100)
            })
        
        # Generate features
        for f in range(feature_count):
            feature = {
                'id': f"feature_{f:04d}",
                'geometry': {
                    'type': 'Point',
                    'coordinates': [20 + (index % 20), -30 + (index % 15)]
                }
            }
            
            # Add properties
            properties = {}
            for p in range(property_count):
                prop_name = f"property_{p:02d}"
                prop_value = f"value_{p}_{f}_{index}"
                
                # Add some nested properties based on nesting level
                if nesting_level > 1 and p % 3 == 0:
                    properties[prop_name] = {
                        'nested_value': prop_value,
                        'nested_number': p * f * index
                    }
                    
                    if nesting_level > 2 and p % 5 == 0:
                        properties[prop_name]['deep_nested'] = {
                            'level_3_value': f"deep_{prop_value}",
                            'level_3_array': [i for i in range(p % 5)]
                        }
                else:
                    properties[prop_name] = prop_value
            
            feature['properties'] = properties
            base_dataset['features'].append(feature)
        
        return base_dataset
    
    def setup_benchmark_config(self, parallel_workers: int = 2) -> Config:
        """Setup configuration for benchmarking"""
        
        config = Config()
        config.DATA_SOURCES = {
            'geology': {
                'path': str(self.test_dir / 'geology'),
                'enabled': True,
                'file_patterns': ['*.json']
            },
            'satellite': {
                'path': str(self.test_dir / 'satellite'),
                'enabled': True,
                'file_patterns': ['*.json']
            },
            'geophysics': {
                'path': str(self.test_dir / 'geophysics'),
                'enabled': True,
                'file_patterns': ['*.json']
            },
            'geochemistry': {
                'path': str(self.test_dir / 'geochemistry'),
                'enabled': True,
                'file_patterns': ['*.json']
            },
            'drillholes': {
                'path': str(self.test_dir / 'drillholes'),
                'enabled': True,
                'file_patterns': ['*.json']
            }
        }
        
        config.OUTPUT_DIR = str(self.test_dir / 'output')
        config.STAC_CATALOG_ROOT = str(self.test_dir / 'stac_catalogs')
        config.S3_BUCKET = 'benchmark-test-bucket'
        config.COUNTRIES = ['ZMB', 'BWA', 'ZAF']
        config.PARALLEL_WORKERS = parallel_workers
        
        # Create directories
        Path(config.OUTPUT_DIR).mkdir(exist_ok=True)
        Path(config.STAC_CATALOG_ROOT).mkdir(exist_ok=True)
        
        return config
    
    async def run_benchmark(self, dataset_count: int, complexity: str, 
                          parallel_workers: int) -> Dict[str, Any]:
        """Run a single benchmark test"""
        
        print(f"\n🏃 Running benchmark: {dataset_count} datasets, {complexity} complexity, {parallel_workers} workers")
        
        # Generate test data
        start_time = time.time()
        datasets = self.generate_test_datasets(dataset_count, complexity)
        data_generation_time = time.time() - start_time
        
        # Setup configuration
        config = self.setup_benchmark_config(parallel_workers)
        
        # Run pipeline
        pipeline_start = time.time()
        try:
            orchestrator = PipelineOrchestrator(config)
            results = await orchestrator.run_pipeline()
            pipeline_end = time.time()
            
            pipeline_time = pipeline_end - pipeline_start
            total_time = pipeline_end - start_time
            
            # Calculate metrics
            files_processed = results.get('total_files_processed', 0)
            files_per_second = files_processed / pipeline_time if pipeline_time > 0 else 0
            
            benchmark_result = {
                'dataset_count': dataset_count,
                'complexity': complexity,
                'parallel_workers': parallel_workers,
                'data_generation_time': data_generation_time,
                'pipeline_execution_time': pipeline_time,
                'total_time': total_time,
                'files_processed': files_processed,
                'files_per_second': files_per_second,
                'errors': results.get('total_errors', 0),
                'success_rate': (files_processed - results.get('total_errors', 0)) / files_processed if files_processed > 0 else 0,
                'stage_results': results.get('stage_results', {}),
                'memory_usage': self._estimate_memory_usage(),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            print(f"   ✅ Completed in {pipeline_time:.2f}s ({files_per_second:.1f} files/sec)")
            print(f"      Files processed: {files_processed}, Errors: {results.get('total_errors', 0)}")
            
            return benchmark_result
            
        except Exception as e:
            print(f"   ❌ Benchmark failed: {str(e)}")
            return {
                'dataset_count': dataset_count,
                'complexity': complexity,
                'parallel_workers': parallel_workers,
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
    
    def _estimate_memory_usage(self) -> Dict[str, float]:
        """Estimate memory usage (simplified)"""
        try:
            import psutil
            process = psutil.Process()
            memory_info = process.memory_info()
            
            return {
                'rss_mb': memory_info.rss / 1024 / 1024,
                'vms_mb': memory_info.vms / 1024 / 1024,
                'percent': process.memory_percent()
            }
        except ImportError:
            return {'note': 'psutil not available for memory monitoring'}
    
    async def run_scalability_test(self) -> List[Dict[str, Any]]:
        """Test pipeline scalability with increasing data volumes"""
        
        print("📈 Running scalability test...")
        
        test_configurations = [
            # (dataset_count, complexity, workers)
            (10, "simple", 1),
            (10, "simple", 2),
            (10, "simple", 4),
            (50, "simple", 2),
            (100, "simple", 2),
            (10, "medium", 2),
            (50, "medium", 2),
            (10, "complex", 2),
        ]
        
        scalability_results = []
        
        for dataset_count, complexity, workers in test_configurations:
            result = await self.run_benchmark(dataset_count, complexity, workers)
            scalability_results.append(result)
            
            # Clean up between tests
            self._cleanup_test_data()
        
        return scalability_results
    
    async def run_concurrency_test(self) -> List[Dict[str, Any]]:
        """Test pipeline performance with different worker counts"""
        
        print("⚡ Running concurrency test...")
        
        worker_counts = [1, 2, 4, 8]
        dataset_count = 50
        complexity = "medium"
        
        concurrency_results = []
        
        for workers in worker_counts:
            result = await self.run_benchmark(dataset_count, complexity, workers)
            concurrency_results.append(result)
            
            # Clean up between tests
            self._cleanup_test_data()
        
        return concurrency_results
    
    def _cleanup_test_data(self):
        """Clean up test data between benchmark runs"""
        import shutil
        
        for subdir in ['geology', 'satellite', 'geophysics', 'geochemistry', 'drillholes', 'output', 'stac_catalogs']:
            dir_path = self.test_dir / subdir
            if dir_path.exists():
                shutil.rmtree(dir_path)
    
    def generate_performance_report(self, results: List[Dict[str, Any]]) -> str:
        """Generate a comprehensive performance report"""
        
        report_lines = [
            "# GeoVision AI Miner - Pipeline Performance Report",
            f"Generated: {datetime.now(timezone.utc).isoformat()}",
            "",
            "## Executive Summary",
            ""
        ]
        
        # Calculate summary statistics
        successful_runs = [r for r in results if 'error' not in r]
        
        if successful_runs:
            avg_throughput = statistics.mean([r['files_per_second'] for r in successful_runs])
            max_throughput = max([r['files_per_second'] for r in successful_runs])
            avg_success_rate = statistics.mean([r['success_rate'] for r in successful_runs])
            
            report_lines.extend([
                f"- **Total benchmark runs**: {len(results)}",
                f"- **Successful runs**: {len(successful_runs)}",
                f"- **Average throughput**: {avg_throughput:.1f} files/second",
                f"- **Peak throughput**: {max_throughput:.1f} files/second",
                f"- **Average success rate**: {avg_success_rate:.1%}",
                ""
            ])
        
        # Detailed results
        report_lines.extend([
            "## Detailed Results",
            "",
            "| Datasets | Complexity | Workers | Time (s) | Files/sec | Success Rate | Errors |",
            "|----------|------------|---------|----------|-----------|--------------|--------|"
        ])
        
        for result in successful_runs:
            report_lines.append(
                f"| {result['dataset_count']} | {result['complexity']} | "
                f"{result['parallel_workers']} | {result['pipeline_execution_time']:.1f} | "
                f"{result['files_per_second']:.1f} | {result['success_rate']:.1%} | "
                f"{result['errors']} |"
            )
        
        # Performance insights
        report_lines.extend([
            "",
            "## Performance Insights",
            ""
        ])
        
        if len(successful_runs) > 1:
            # Analyze scalability
            simple_runs = [r for r in successful_runs if r['complexity'] == 'simple']
            if len(simple_runs) > 1:
                throughputs = [r['files_per_second'] for r in simple_runs]
                if max(throughputs) > min(throughputs) * 1.5:
                    report_lines.append("- ✅ Good scalability observed with increased parallelization")
                else:
                    report_lines.append("- ⚠️  Limited scalability benefits from increased parallelization")
            
            # Analyze complexity impact
            complexities = set(r['complexity'] for r in successful_runs)
            if len(complexities) > 1:
                complexity_performance = {}
                for complexity in complexities:
                    complexity_runs = [r for r in successful_runs if r['complexity'] == complexity]
                    if complexity_runs:
                        complexity_performance[complexity] = statistics.mean([r['files_per_second'] for r in complexity_runs])
                
                report_lines.append("- **Performance by complexity**:")
                for complexity, perf in sorted(complexity_performance.items(), key=lambda x: x[1], reverse=True):
                    report_lines.append(f"  - {complexity}: {perf:.1f} files/sec")
        
        # Recommendations
        report_lines.extend([
            "",
            "## Recommendations",
            ""
        ])
        
        if successful_runs:
            best_run = max(successful_runs, key=lambda x: x['files_per_second'])
            report_lines.extend([
                f"- **Optimal configuration**: {best_run['dataset_count']} datasets, "
                f"{best_run['complexity']} complexity, {best_run['parallel_workers']} workers",
                f"- **Peak performance**: {best_run['files_per_second']:.1f} files/second",
                ""
            ])
            
            if avg_success_rate < 0.95:
                report_lines.append("- ⚠️  Consider investigating error sources to improve success rate")
            
            if max_throughput < 10:
                report_lines.append("- 💡 Consider optimizing processors for better throughput")
        
        # Error analysis
        failed_runs = [r for r in results if 'error' in r]
        if failed_runs:
            report_lines.extend([
                "## Error Analysis",
                "",
                f"**Failed runs**: {len(failed_runs)}",
                ""
            ])
            
            for i, failed_run in enumerate(failed_runs, 1):
                report_lines.extend([
                    f"### Error {i}",
                    f"- **Configuration**: {failed_run['dataset_count']} datasets, "
                    f"{failed_run['complexity']} complexity, {failed_run['parallel_workers']} workers",
                    f"- **Error**: {failed_run['error']}",
                    ""
                ])
        
        return "\n".join(report_lines)
    
    async def run_comprehensive_benchmark(self) -> str:
        """Run comprehensive benchmark suite"""
        
        print("🚀 GeoVision AI Miner - Comprehensive Pipeline Benchmark")
        print("=" * 60)
        
        all_results = []
        
        # Run scalability tests
        scalability_results = await self.run_scalability_test()
        all_results.extend(scalability_results)
        
        # Run concurrency tests
        concurrency_results = await self.run_concurrency_test()
        all_results.extend(concurrency_results)
        
        # Generate report
        report = self.generate_performance_report(all_results)
        
        # Save report
        report_path = self.test_dir / "performance_report.md"
        with open(report_path, 'w') as f:
            f.write(report)
        
        # Save raw results
        results_path = self.test_dir / "benchmark_results.json"
        with open(results_path, 'w') as f:
            json.dump(all_results, f, indent=2)
        
        print(f"\n📊 Benchmark completed!")
        print(f"   Report: {report_path}")
        print(f"   Raw data: {results_path}")
        
        return str(report_path)

async def main():
    """Main benchmark function"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"📁 Benchmark environment: {temp_dir}")
        
        benchmark = PipelineBenchmark(temp_dir)
        report_path = await benchmark.run_comprehensive_benchmark()
        
        # Display summary
        print("\n" + "=" * 60)
        print("📋 BENCHMARK SUMMARY")
        print("=" * 60)
        
        with open(report_path, 'r') as f:
            report_content = f.read()
            
        # Extract and display key metrics
        lines = report_content.split('\n')
        in_summary = False
        
        for line in lines:
            if "## Executive Summary" in line:
                in_summary = True
                continue
            elif line.startswith("## ") and in_summary:
                break
            elif in_summary and line.strip():
                print(line)
        
        print(f"\n📄 Full report available at: {report_path}")
        return 0

if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))