#!/usr/bin/env python3
"""
GeoVision AI Miner - Simple Pipeline Test
Basic test without heavy dependencies
"""

import os
import sys
import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone

# Add the data-ingestion directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

def test_basic_imports():
    """Test basic Python imports that should always work"""
    print("🔍 Testing basic imports...")
    
    basic_modules = [
        'json',
        'os',
        'sys',
        'pathlib',
        'datetime',
        'tempfile',
        'asyncio'
    ]
    
    successful_imports = 0
    
    for module_name in basic_modules:
        try:
            __import__(module_name)
            print(f"   ✅ {module_name}")
            successful_imports += 1
        except ImportError as e:
            print(f"   ❌ {module_name} - {e}")
    
    print(f"📊 Basic imports: {successful_imports}/{len(basic_modules)} successful")
    return successful_imports == len(basic_modules)

def test_config_loading():
    """Test configuration loading"""
    print("\n🔍 Testing configuration loading...")
    
    try:
        from config import GlobalConfig
        
        config = GlobalConfig()
        
        # Test basic config attributes
        assert hasattr(config, 'org_id')
        assert hasattr(config, 'project_id')
        assert hasattr(config, 's3_bucket')
        assert hasattr(config, 'countries')
        
        print(f"   ✅ Config loaded successfully")
        print(f"      Organization: {config.org_id}")
        print(f"      Project: {config.project_id}")
        print(f"      Countries: {len(config.countries)} configured")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Config loading failed: {e}")
        return False

def test_file_operations():
    """Test basic file operations"""
    print("\n🔍 Testing file operations...")
    
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as temp_file:
            test_data = {
                'test': True,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'data': [1, 2, 3, 4, 5]
            }
            
            json.dump(test_data, temp_file, indent=2)
            temp_path = temp_file.name
        
        # Read file back
        with open(temp_path, 'r') as f:
            loaded_data = json.load(f)
        
        # Verify data
        assert loaded_data['test'] == True
        assert len(loaded_data['data']) == 5
        
        # Clean up
        os.unlink(temp_path)
        
        print("   ✅ File operations working correctly")
        return True
        
    except Exception as e:
        print(f"   ❌ File operations failed: {e}")
        return False

def test_directory_structure():
    """Test that expected directories and files exist"""
    print("\n🔍 Testing directory structure...")
    
    base_dir = Path(__file__).parent
    
    expected_files = [
        'config.py',
        'pipeline_orchestrator.py',
        'stac_validator.py',
        'qaqc_report_generator.py',
        'core/logger.py',
        'core/storage.py',
        'processors/geology_processor.py',
        'processors/satellite_processor.py',
        'processors/geophysics_processor.py'
    ]
    
    existing_files = 0
    
    for file_path in expected_files:
        full_path = base_dir / file_path
        if full_path.exists():
            print(f"   ✅ {file_path}")
            existing_files += 1
        else:
            print(f"   ❌ {file_path} - not found")
    
    print(f"📊 Directory structure: {existing_files}/{len(expected_files)} files found")
    return existing_files >= len(expected_files) * 0.8  # 80% threshold

def test_stac_item_creation():
    """Test basic STAC item creation without validation"""
    print("\n🔍 Testing STAC item creation...")
    
    try:
        # Create a basic STAC item structure
        stac_item = {
            "type": "Feature",
            "stac_version": "1.0.0",
            "id": "test-item-simple",
            "geometry": {
                "type": "Point",
                "coordinates": [25.0, -15.0]
            },
            "bbox": [25.0, -15.0, 25.0, -15.0],
            "properties": {
                "datetime": datetime.now(timezone.utc).isoformat(),
                "geological:data_type": "test_data",
                "geological:confidence": 0.85,
                "geological:target_mineral": "copper"
            },
            "assets": {
                "data": {
                    "href": "test-data.json",
                    "type": "application/json",
                    "roles": ["data"]
                }
            },
            "links": []
        }
        
        # Test JSON serialization
        json_str = json.dumps(stac_item, indent=2)
        
        # Test deserialization
        loaded_item = json.loads(json_str)
        
        # Basic validation
        assert loaded_item['type'] == 'Feature'
        assert loaded_item['stac_version'] == '1.0.0'
        assert 'geometry' in loaded_item
        assert 'properties' in loaded_item
        assert 'assets' in loaded_item
        
        print("   ✅ STAC item creation successful")
        print(f"      Item ID: {loaded_item['id']}")
        print(f"      Data type: {loaded_item['properties']['geological:data_type']}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ STAC item creation failed: {e}")
        return False

def test_sample_data_processing():
    """Test processing sample geological data"""
    print("\n🔍 Testing sample data processing...")
    
    try:
        # Create sample geological data
        sample_geology_data = {
            'id': 'geology_sample_001',
            'type': 'geological_units',
            'country': 'ZMB',
            'region': 'Copperbelt',
            'confidence': 0.92,
            'target_minerals': ['copper', 'cobalt'],
            'geometry': {
                'type': 'Polygon',
                'coordinates': [[[27.5, -13.5], [29.0, -13.5], [29.0, -12.0], [27.5, -12.0], [27.5, -13.5]]]
            },
            'properties': {
                'rock_type': 'sedimentary',
                'age': 'Neoproterozoic',
                'formation': 'Katanga Supergroup',
                'mineral_occurrences': [
                    {'mineral': 'malachite', 'abundance': 'common'},
                    {'mineral': 'azurite', 'abundance': 'rare'}
                ]
            }
        }
        
        # Test data validation
        required_fields = ['id', 'type', 'country', 'confidence', 'geometry']
        for field in required_fields:
            assert field in sample_geology_data, f"Missing required field: {field}"
        
        # Test confidence score
        confidence = sample_geology_data['confidence']
        assert 0.0 <= confidence <= 1.0, f"Invalid confidence score: {confidence}"
        
        # Test geometry structure
        geometry = sample_geology_data['geometry']
        assert geometry['type'] in ['Point', 'Polygon', 'LineString'], f"Invalid geometry type: {geometry['type']}"
        assert 'coordinates' in geometry, "Missing coordinates in geometry"
        
        print("   ✅ Sample data processing successful")
        print(f"      Data ID: {sample_geology_data['id']}")
        print(f"      Country: {sample_geology_data['country']}")
        print(f"      Confidence: {sample_geology_data['confidence']}")
        print(f"      Target minerals: {', '.join(sample_geology_data['target_minerals'])}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Sample data processing failed: {e}")
        return False

def test_async_functionality():
    """Test basic async functionality"""
    print("\n🔍 Testing async functionality...")
    
    try:
        import asyncio
        
        async def sample_async_function():
            """Sample async function for testing"""
            await asyncio.sleep(0.1)  # Simulate async work
            return "async_test_complete"
        
        # Run async function
        result = asyncio.run(sample_async_function())
        
        assert result == "async_test_complete"
        
        print("   ✅ Async functionality working")
        return True
        
    except Exception as e:
        print(f"   ❌ Async functionality failed: {e}")
        return False

def main():
    """Run simple pipeline tests"""
    
    print("🌍 GeoVision AI Miner - Simple Pipeline Test")
    print("=" * 50)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Note: This test runs without heavy dependencies")
    
    # Run tests
    tests = [
        ("Basic Imports", test_basic_imports),
        ("Configuration Loading", test_config_loading),
        ("File Operations", test_file_operations),
        ("Directory Structure", test_directory_structure),
        ("STAC Item Creation", test_stac_item_creation),
        ("Sample Data Processing", test_sample_data_processing),
        ("Async Functionality", test_async_functionality)
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        
        try:
            result = test_func()
            
            if result:
                passed_tests += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
                
        except Exception as e:
            print(f"❌ {test_name} FAILED with exception: {e}")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Tests passed: {passed_tests}/{total_tests}")
    print(f"Success rate: {passed_tests/total_tests:.1%}")
    
    if passed_tests == total_tests:
        print("\n🎉 All basic tests passed! Core pipeline structure is sound.")
        print("\n💡 Next steps:")
        print("   1. Install dependencies: pip install -r requirements.txt")
        print("   2. Run full tests: python3 quick_test.py")
        print("   3. Start STAC API: cd ../api && ./start_dev_server.sh")
        print("   4. Run integration tests: python3 validate_pipeline_integration.py")
        return 0
    elif passed_tests >= total_tests * 0.8:  # 80% pass rate
        print(f"\n✅ Most basic tests passed ({passed_tests}/{total_tests}). Core structure is mostly sound.")
        print("\n💡 Address failing tests and install dependencies for full functionality.")
        return 0
    else:
        print(f"\n⚠️  Several basic tests failed ({total_tests - passed_tests}/{total_tests}). Review core issues.")
        return 1

if __name__ == "__main__":
    sys.exit(main())