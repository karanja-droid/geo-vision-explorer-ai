#!/usr/bin/env python3
"""
GeoVision AI Miner - Pipeline Integration Validator
Tests the complete flow from data ingestion to STAC API serving
"""

import os
import sys
import json
import tempfile
import shutil
import asyncio
import requests
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any

# Add the data-ingestion directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from config import Config
from pipeline_orchestrator import PipelineOrchestrator
from stac_validator import STACValidator

class PipelineIntegrationValidator:
    """Validates the complete pipeline integration"""
    
    def __init__(self, test_dir: str):
        self.test_dir = Path(test_dir)
        self.stac_api_url = "http://localhost:8000"
        self.validator = STACValidator()
        
    def create_test_datasets(self) -> Dict[str, Any]:
        """Create comprehensive test datasets"""
        
        print("📊 Creating test datasets...")
        
        datasets = {
            # Geological data - Zambia copper belt
            'geology/ZMB/copper_belt_units.json': {
                'type': 'geological_units',
                'country': 'ZMB',
                'region': 'Copperbelt Province',
                'confidence': 0.92,
                'target_minerals': ['copper', 'cobalt'],
                'data_source': 'Geological Survey of Zambia',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[27.5, -13.5], [29.0, -13.5], [29.0, -12.0], [27.5, -12.0], [27.5, -13.5]]]
                },
                'properties': {
                    'rock_type': 'sedimentary',
                    'age': 'Neoproterozoic',
                    'formation': 'Katanga Supergroup'
                }
            },
            
            # Satellite data - Landsat 8 over Zambia
            'satellite/ZMB/LC08_L1TP_174065_20240315.json': {
                'platform': 'landsat-8',
                'sensor': 'oli',
                'country': 'ZMB',
                'acquisition_date': '2024-03-15T10:30:00Z',
                'cloud_cover': 15.2,
                'processing_level': 'L1TP',
                'scene_id': 'LC08_L1TP_174065_20240315_20240317_02_T1',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[27.5, -13.5], [29.0, -13.5], [29.0, -12.0], [27.5, -12.0], [27.5, -13.5]]]
                },
                'bands': ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
                'target_mineral': 'copper'
            },
            
            # Hyperspectral data - Botswana diamonds
            'satellite/BWA/AVIRIS_BWA_20240620.json': {
                'platform': 'aviris',
                'sensor': 'aviris-ng',
                'country': 'BWA',
                'acquisition_date': '2024-06-20T11:45:00Z',
                'cloud_cover': 5.1,
                'processing_level': 'L2A',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[24.0, -22.0], [25.5, -22.0], [25.5, -20.5], [24.0, -20.5], [24.0, -22.0]]]
                },
                'spectral_bands': 224,
                'target_mineral': 'diamond',
                'kimberlite_indicators': ['garnet', 'ilmenite', 'chromite']
            },
            
            # Geophysical data - South Africa magnetic
            'geophysics/ZAF/AERO_MAG_ZAF_20240401.json': {
                'survey_type': 'aeromagnetic',
                'country': 'ZAF',
                'target_mineral': 'platinum',
                'confidence': 0.89,
                'survey_date': '2024-04-01T09:15:00Z',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[26.0, -26.5], [27.5, -26.5], [27.5, -25.0], [26.0, -25.0], [26.0, -26.5]]]
                },
                'survey_altitude': 200,
                'line_spacing': 75,
                'magnetic_intensity_range': [-500, 2000],
                'anomaly_count': 47
            },
            
            # Geochemical data - Stream sediments
            'geochemistry/ZMB/stream_sediment_copper_belt.json': {
                'sample_type': 'stream_sediment',
                'country': 'ZMB',
                'region': 'Copperbelt',
                'elements_analyzed': ['Cu', 'Co', 'Ni', 'Au', 'Ag', 'Pb', 'Zn'],
                'sample_count': 1250,
                'confidence': 0.85,
                'survey_date': '2024-02-15',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[27.0, -14.0], [30.0, -14.0], [30.0, -11.0], [27.0, -11.0], [27.0, -14.0]]]
                },
                'target_minerals': ['copper', 'cobalt']
            },
            
            # Drillhole data
            'drillholes/ZAF/platinum_reef_drilling.json': {
                'project_name': 'Bushveld Platinum Exploration',
                'country': 'ZAF',
                'target_mineral': 'platinum',
                'hole_count': 45,
                'total_meters': 12500,
                'confidence': 0.94,
                'drilling_date': '2024-05-10',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [27.0, -25.5]
                },
                'reef_intersections': 38,
                'average_grade': 4.2
            },
            
            # ESG data
            'esg/BWA/environmental_impact_assessment.json': {
                'assessment_type': 'environmental_impact',
                'country': 'BWA',
                'project_name': 'Orapa Diamond Mine Expansion',
                'assessment_date': '2024-07-01',
                'confidence': 0.88,
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[[25.0, -21.5], [25.5, -21.5], [25.5, -21.0], [25.0, -21.0], [25.0, -21.5]]]
                },
                'environmental_factors': ['water_quality', 'air_quality', 'biodiversity', 'soil_contamination'],
                'compliance_status': 'compliant'
            }
        }
        
        # Create files
        for file_path, content in datasets.items():
            full_path = self.test_dir / file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(full_path, 'w') as f:
                json.dump(content, f, indent=2)
        
        print(f"   ✅ Created {len(datasets)} test datasets")
        return datasets
    
    def setup_test_config(self) -> Config:
        """Setup test configuration"""
        
        print("⚙️  Setting up test configuration...")
        
        # Create mock config
        config = Config()
        config.DATA_SOURCES = {
            'geology': {
                'path': str(self.test_dir / 'geology'),
                'enabled': True,
                'file_patterns': ['*.json', '*.shp', '*.geojson']
            },
            'satellite': {
                'path': str(self.test_dir / 'satellite'),
                'enabled': True,
                'file_patterns': ['*.json', '*.tif', '*.tiff']
            },
            'geophysics': {
                'path': str(self.test_dir / 'geophysics'),
                'enabled': True,
                'file_patterns': ['*.json', '*.grd', '*.xyz']
            },
            'geochemistry': {
                'path': str(self.test_dir / 'geochemistry'),
                'enabled': True,
                'file_patterns': ['*.json', '*.csv', '*.xlsx']
            },
            'drillholes': {
                'path': str(self.test_dir / 'drillholes'),
                'enabled': True,
                'file_patterns': ['*.json', '*.csv', '*.las']
            },
            'esg': {
                'path': str(self.test_dir / 'esg'),
                'enabled': True,
                'file_patterns': ['*.json', '*.pdf', '*.docx']
            }
        }
        
        config.OUTPUT_DIR = str(self.test_dir / 'output')
        config.STAC_CATALOG_ROOT = str(self.test_dir / 'stac_catalogs')
        config.S3_BUCKET = 'geovision-test-bucket'
        config.COUNTRIES = ['ZMB', 'BWA', 'ZAF']
        config.PARALLEL_WORKERS = 2
        
        # Create output directories
        Path(config.OUTPUT_DIR).mkdir(exist_ok=True)
        Path(config.STAC_CATALOG_ROOT).mkdir(exist_ok=True)
        
        print("   ✅ Test configuration ready")
        return config
    
    async def run_pipeline(self, config: Config) -> Dict[str, Any]:
        """Run the data ingestion pipeline"""
        
        print("🚀 Running data ingestion pipeline...")
        
        try:
            orchestrator = PipelineOrchestrator(config)
            results = await orchestrator.run_pipeline()
            
            print(f"   ✅ Pipeline completed successfully")
            print(f"      Files processed: {results.get('total_files_processed', 0)}")
            print(f"      Errors: {results.get('total_errors', 0)}")
            print(f"      Execution time: {results.get('execution_time', 0):.2f}s")
            
            return results
            
        except Exception as e:
            print(f"   ❌ Pipeline execution failed: {str(e)}")
            raise
    
    def validate_stac_catalogs(self, config: Config) -> bool:
        """Validate generated STAC catalogs"""
        
        print("🔍 Validating generated STAC catalogs...")
        
        stac_root = Path(config.STAC_CATALOG_ROOT)
        
        if not stac_root.exists():
            print("   ❌ STAC catalog directory not found")
            return False
        
        # Check for root catalog
        root_catalog = stac_root / 'catalog.json'
        if not root_catalog.exists():
            print("   ❌ Root catalog not found")
            return False
        
        # Validate root catalog
        try:
            with open(root_catalog, 'r') as f:
                catalog_data = json.load(f)
            
            if catalog_data.get('type') != 'Catalog':
                print("   ❌ Invalid root catalog type")
                return False
            
            print("   ✅ Root catalog is valid")
            
        except Exception as e:
            print(f"   ❌ Root catalog validation failed: {e}")
            return False
        
        # Check for collections
        collections_found = 0
        items_found = 0
        
        for collection_dir in stac_root.iterdir():
            if collection_dir.is_dir():
                collection_file = collection_dir / 'collection.json'
                if collection_file.exists():
                    collections_found += 1
                    
                    # Count items in collection
                    for item_file in collection_dir.glob('*_item.json'):
                        items_found += 1
        
        print(f"   📊 Found {collections_found} collections with {items_found} items")
        
        if collections_found == 0:
            print("   ⚠️  No collections found")
            return False
        
        return True
    
    def test_stac_api_integration(self) -> bool:
        """Test integration with STAC API"""
        
        print("🌐 Testing STAC API integration...")
        
        # Test if API is running
        try:
            response = requests.get(f"{self.stac_api_url}/health", timeout=5)
            if response.status_code != 200:
                print(f"   ❌ STAC API health check failed: {response.status_code}")
                return False
            
            print("   ✅ STAC API is running")
            
        except requests.exceptions.RequestException as e:
            print(f"   ❌ STAC API not accessible: {e}")
            print("   💡 Make sure the STAC API is running on localhost:8000")
            return False
        
        # Test API endpoints
        endpoints_to_test = [
            ('/', 'Root catalog'),
            ('/collections', 'Collections list'),
            ('/search?limit=5', 'Search endpoint'),
            ('/geological/minerals/copper?limit=3', 'Geological mineral search'),
            ('/geological/data-types/spectral?limit=3', 'Geological data type search')
        ]
        
        successful_tests = 0
        
        for endpoint, description in endpoints_to_test:
            try:
                response = requests.get(f"{self.stac_api_url}{endpoint}", timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Basic validation
                    if endpoint == '/':
                        if data.get('type') == 'Catalog':
                            print(f"   ✅ {description}")
                            successful_tests += 1
                        else:
                            print(f"   ❌ {description} - Invalid catalog type")
                    
                    elif endpoint == '/collections':
                        if 'collections' in data:
                            print(f"   ✅ {description} - Found {len(data['collections'])} collections")
                            successful_tests += 1
                        else:
                            print(f"   ❌ {description} - No collections field")
                    
                    elif 'search' in endpoint:
                        if data.get('type') == 'FeatureCollection':
                            features_count = len(data.get('features', []))
                            print(f"   ✅ {description} - Found {features_count} features")
                            successful_tests += 1
                        else:
                            print(f"   ❌ {description} - Invalid response type")
                    
                else:
                    print(f"   ❌ {description} - HTTP {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {description} - Error: {e}")
        
        print(f"   📊 API tests: {successful_tests}/{len(endpoints_to_test)} passed")
        return successful_tests == len(endpoints_to_test)
    
    def validate_data_quality(self, pipeline_results: Dict[str, Any]) -> bool:
        """Validate data quality metrics"""
        
        print("📋 Validating data quality...")
        
        # Check processing success rate
        total_processed = pipeline_results.get('total_files_processed', 0)
        total_errors = pipeline_results.get('total_errors', 0)
        
        if total_processed == 0:
            print("   ❌ No files were processed")
            return False
        
        success_rate = (total_processed - total_errors) / total_processed
        print(f"   📊 Processing success rate: {success_rate:.1%}")
        
        if success_rate < 0.8:  # 80% success rate threshold
            print("   ⚠️  Success rate below 80%")
            return False
        
        # Check stage results
        stage_results = pipeline_results.get('stage_results', {})
        
        for stage_name, stage_data in stage_results.items():
            stage_success_rate = 1.0
            if stage_data.get('files_found', 0) > 0:
                stage_success_rate = stage_data.get('files_processed', 0) / stage_data.get('files_found', 1)
            
            print(f"   📊 {stage_name}: {stage_success_rate:.1%} success rate")
        
        print("   ✅ Data quality validation passed")
        return True
    
    async def run_full_validation(self) -> bool:
        """Run complete pipeline validation"""
        
        print("🌍 GeoVision AI Miner - Pipeline Integration Validation")
        print("=" * 60)
        
        try:
            # Step 1: Create test datasets
            datasets = self.create_test_datasets()
            
            # Step 2: Setup configuration
            config = self.setup_test_config()
            
            # Step 3: Run pipeline
            pipeline_results = await self.run_pipeline(config)
            
            # Step 4: Validate STAC catalogs
            stac_valid = self.validate_stac_catalogs(config)
            
            # Step 5: Test API integration
            api_valid = self.test_stac_api_integration()
            
            # Step 6: Validate data quality
            quality_valid = self.validate_data_quality(pipeline_results)
            
            # Summary
            print("\n📊 Validation Summary")
            print("-" * 30)
            print(f"STAC Catalogs:     {'✅ PASS' if stac_valid else '❌ FAIL'}")
            print(f"API Integration:   {'✅ PASS' if api_valid else '❌ FAIL'}")
            print(f"Data Quality:      {'✅ PASS' if quality_valid else '❌ FAIL'}")
            
            overall_success = stac_valid and api_valid and quality_valid
            
            if overall_success:
                print("\n🎉 Pipeline integration validation PASSED!")
                print("   The complete data flow from ingestion to API serving is working correctly.")
            else:
                print("\n⚠️  Pipeline integration validation FAILED!")
                print("   Some components need attention before production deployment.")
            
            return overall_success
            
        except Exception as e:
            print(f"\n❌ Validation failed with error: {str(e)}")
            return False

async def main():
    """Main validation function"""
    
    # Create temporary test environment
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"📁 Test environment: {temp_dir}")
        
        validator = PipelineIntegrationValidator(temp_dir)
        success = await validator.run_full_validation()
        
        if success:
            print(f"\n💡 Test artifacts available in: {temp_dir}")
            print("   (Directory will be cleaned up automatically)")
        
        return 0 if success else 1

if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))