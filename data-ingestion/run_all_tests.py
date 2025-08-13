#!/usr/bin/env python3
"""
GeoVision AI Miner - Complete Test Suite Runner
Runs all pipeline tests, validations, and benchmarks
"""

import os
import sys
import asyncio
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime

# Add the data-ingestion directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def print_header(title: str):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"🧪 {title}")
    print("=" * 60)

def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n📋 {title}")
    print("-" * 40)

async def run_unit_tests():
    """Run unit tests for pipeline components"""
    print_section("Unit Tests")
    
    try:
        from test_pipeline import run_pipeline_tests
        print("Running pipeline component tests...")
        run_pipeline_tests()
        return True
    except Exception as e:
        print(f"❌ Unit tests failed: {e}")
        return False

async def run_integration_tests():
    """Run integration tests"""
    print_section("Integration Tests")
    
    try:
        from validate_pipeline_integration import PipelineIntegrationValidator
        
        with tempfile.TemporaryDirectory() as temp_dir:
            validator = PipelineIntegrationValidator(temp_dir)
            success = await validator.run_full_validation()
            return success
    except Exception as e:
        print(f"❌ Integration tests failed: {e}")
        return False

async def run_performance_tests():
    """Run performance benchmarks"""
    print_section("Performance Benchmarks")
    
    try:
        from benchmark_pipeline import PipelineBenchmark
        
        with tempfile.TemporaryDirectory() as temp_dir:
            benchmark = PipelineBenchmark(temp_dir)
            
            # Run a quick performance test
            print("Running quick performance benchmark...")
            result = await benchmark.run_benchmark(
                dataset_count=20,
                complexity="medium", 
                parallel_workers=2
            )
            
            if 'error' not in result:
                print(f"✅ Performance test completed:")
                print(f"   Throughput: {result['files_per_second']:.1f} files/sec")
                print(f"   Success rate: {result['success_rate']:.1%}")
                return True
            else:
                print(f"❌ Performance test failed: {result['error']}")
                return False
                
    except Exception as e:
        print(f"❌ Performance tests failed: {e}")
        return False

def run_stac_validation_tests():
    """Run STAC validation tests"""
    print_section("STAC Validation Tests")
    
    try:
        from stac_validator import STACValidator
        
        validator = STACValidator()
        
        # Test sample STAC items
        test_items = [
            {
                "type": "Feature",
                "stac_version": "1.0.0",
                "id": "test-geology",
                "geometry": {"type": "Point", "coordinates": [25.0, -15.0]},
                "bbox": [25.0, -15.0, 25.0, -15.0],
                "properties": {
                    "datetime": "2024-01-01T00:00:00Z",
                    "geological:data_type": "geological_units",
                    "geological:confidence": 0.85,
                    "geological:target_mineral": "copper"
                },
                "assets": {"data": {"href": "test.shp", "type": "application/x-shapefile"}},
                "links": []
            },
            {
                "type": "Feature", 
                "stac_version": "1.0.0",
                "id": "test-satellite",
                "geometry": {"type": "Polygon", "coordinates": [[[0,0],[1,0],[1,1],[0,1],[0,0]]]},
                "bbox": [0, 0, 1, 1],
                "properties": {
                    "datetime": "2024-01-01T00:00:00Z",
                    "platform": "landsat-8",
                    "instruments": ["oli"],
                    "geological:data_type": "spectral",
                    "geological:confidence": 0.90
                },
                "assets": {"B1": {"href": "test.tif", "type": "image/tiff"}},
                "links": []
            }
        ]
        
        passed_tests = 0
        total_tests = len(test_items)
        
        for i, item in enumerate(test_items, 1):
            print(f"Testing STAC item {i}...")
            is_valid, errors = validator.validate_item(item)
            
            if is_valid:
                print(f"   ✅ Item {i} validation passed")
                passed_tests += 1
            else:
                print(f"   ❌ Item {i} validation failed: {errors}")
        
        # Test geological extensions
        print("Testing geological extensions...")
        geo_passed = 0
        
        for i, item in enumerate(test_items, 1):
            is_valid, errors = validator.validate_geological_extensions(item)
            if is_valid:
                geo_passed += 1
        
        print(f"📊 STAC Validation Results:")
        print(f"   Core STAC: {passed_tests}/{total_tests} passed")
        print(f"   Geological Extensions: {geo_passed}/{total_tests} passed")
        
        return passed_tests == total_tests and geo_passed == total_tests
        
    except Exception as e:
        print(f"❌ STAC validation tests failed: {e}")
        return False

def test_api_connectivity():
    """Test if STAC API is running and accessible"""
    print_section("API Connectivity Test")
    
    try:
        import requests
        
        api_url = "http://localhost:8000"
        
        # Test health endpoint
        response = requests.get(f"{api_url}/health", timeout=5)
        
        if response.status_code == 200:
            print("✅ STAC API is running and accessible")
            
            # Test a few more endpoints
            endpoints = [
                "/",
                "/collections", 
                "/search?limit=1"
            ]
            
            working_endpoints = 0
            
            for endpoint in endpoints:
                try:
                    resp = requests.get(f"{api_url}{endpoint}", timeout=5)
                    if resp.status_code == 200:
                        working_endpoints += 1
                        print(f"   ✅ {endpoint}")
                    else:
                        print(f"   ❌ {endpoint} - HTTP {resp.status_code}")
                except Exception as e:
                    print(f"   ❌ {endpoint} - {e}")
            
            print(f"📊 API endpoints: {working_endpoints}/{len(endpoints)} working")
            return working_endpoints == len(endpoints)
            
        else:
            print(f"❌ STAC API health check failed: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException:
        print("⚠️  STAC API not running on localhost:8000")
        print("   💡 Start the API with: cd ../api && ./start_dev_server.sh")
        return False
    except Exception as e:
        print(f"❌ API connectivity test failed: {e}")
        return False

def run_processor_tests():
    """Test individual processors"""
    print_section("Processor Tests")
    
    processors_to_test = [
        'geology_processor',
        'satellite_processor', 
        'geophysics_processor',
        'geochem_processor',
        'drillhole_processor',
        'esg_processor',
        'dem_processor',
        'feature_store_builder'
    ]
    
    working_processors = 0
    
    for processor_name in processors_to_test:
        try:
            module = __import__(f'processors.{processor_name}', fromlist=[processor_name])
            
            # Get the processor class (assume it's the CamelCase version of the module name)
            class_name = ''.join(word.capitalize() for word in processor_name.split('_'))
            processor_class = getattr(module, class_name)
            
            # Try to instantiate (with mock config)
            from unittest.mock import Mock
            mock_config = Mock()
            mock_config.OUTPUT_DIR = "/tmp"
            mock_config.S3_BUCKET = "test-bucket"
            
            processor = processor_class(mock_config)
            print(f"   ✅ {processor_name}")
            working_processors += 1
            
        except Exception as e:
            print(f"   ❌ {processor_name} - {e}")
    
    print(f"📊 Processors: {working_processors}/{len(processors_to_test)} working")
    return working_processors == len(processors_to_test)

def check_dependencies():
    """Check if all required dependencies are available"""
    print_section("Dependency Check")
    
    required_packages = [
        'pystac',
        'boto3',
        'pandas',
        'numpy',
        'asyncio',
        'pathlib',
        'json',
        'datetime'
    ]
    
    optional_packages = [
        'requests',
        'psutil',
        'pytest'
    ]
    
    missing_required = []
    missing_optional = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"   ✅ {package}")
        except ImportError:
            print(f"   ❌ {package} (required)")
            missing_required.append(package)
    
    for package in optional_packages:
        try:
            __import__(package)
            print(f"   ✅ {package} (optional)")
        except ImportError:
            print(f"   ⚠️  {package} (optional)")
            missing_optional.append(package)
    
    if missing_required:
        print(f"\n❌ Missing required packages: {', '.join(missing_required)}")
        print("   Install with: pip install " + " ".join(missing_required))
        return False
    
    if missing_optional:
        print(f"\n💡 Optional packages not found: {', '.join(missing_optional)}")
        print("   Install with: pip install " + " ".join(missing_optional))
    
    return True

async def main():
    """Run complete test suite"""
    
    print_header("GeoVision AI Miner - Complete Test Suite")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Track test results
    test_results = {}
    
    # 1. Check dependencies
    test_results['dependencies'] = check_dependencies()
    
    # 2. Test processors
    test_results['processors'] = run_processor_tests()
    
    # 3. Test STAC validation
    test_results['stac_validation'] = run_stac_validation_tests()
    
    # 4. Test API connectivity
    test_results['api_connectivity'] = test_api_connectivity()
    
    # 5. Run unit tests
    test_results['unit_tests'] = await run_unit_tests()
    
    # 6. Run integration tests (only if API is available)
    if test_results['api_connectivity']:
        test_results['integration_tests'] = await run_integration_tests()
    else:
        print("\n⚠️  Skipping integration tests (API not available)")
        test_results['integration_tests'] = None
    
    # 7. Run performance tests
    test_results['performance_tests'] = await run_performance_tests()
    
    # Generate summary
    print_header("Test Results Summary")
    
    passed_tests = 0
    total_tests = 0
    
    for test_name, result in test_results.items():
        if result is not None:
            total_tests += 1
            if result:
                passed_tests += 1
                status = "✅ PASS"
            else:
                status = "❌ FAIL"
        else:
            status = "⏭️  SKIP"
        
        print(f"{test_name.replace('_', ' ').title():.<30} {status}")
    
    print(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("\n🎉 All tests passed! Pipeline is ready for production.")
        return 0
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) failed. Review issues before deployment.")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))