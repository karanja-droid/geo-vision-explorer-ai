# 🧪 GeoVision AI Miner - Pipeline Testing Guide

Complete guide for testing and validating the data ingestion pipeline.

## 🚀 Quick Start

### Run Basic Tests
```bash
# Quick component test (recommended first)
python3 quick_test.py

# Comprehensive test suite
python3 run_all_tests.py

# Integration test with STAC API
python3 validate_pipeline_integration.py

# Performance benchmarks
python3 benchmark_pipeline.py
```

## 📋 Test Categories

### 1. Component Tests (`quick_test.py`)
**Purpose**: Verify individual pipeline components work correctly
**Duration**: ~30 seconds
**Requirements**: None (uses mock data)

Tests:
- ✅ Import validation for all modules
- ✅ Logger functionality
- ✅ Storage manager operations
- ✅ STAC validator with sample data
- ✅ QA/QC report generation
- ✅ Pipeline orchestrator initialization

```bash
python3 quick_test.py
```

### 2. Integration Tests (`validate_pipeline_integration.py`)
**Purpose**: Test complete data flow from ingestion to STAC API
**Duration**: ~2-5 minutes
**Requirements**: STAC API running on localhost:8000

Tests:
- 📊 Creates realistic test datasets
- 🔄 Runs complete pipeline
- 📋 Validates STAC catalog generation
- 🌐 Tests API integration
- 📈 Validates data quality metrics

```bash
# Start STAC API first
cd ../api && ./start_dev_server.sh

# In another terminal, run integration tests
python3 validate_pipeline_integration.py
```

### 3. Performance Tests (`benchmark_pipeline.py`)
**Purpose**: Measure pipeline performance and scalability
**Duration**: ~5-15 minutes
**Requirements**: None (generates test data)

Tests:
- 📈 Scalability with increasing data volumes
- ⚡ Concurrency performance with different worker counts
- 🔍 Memory usage analysis
- 📊 Throughput measurements

```bash
python3 benchmark_pipeline.py
```

### 4. Comprehensive Suite (`run_all_tests.py`)
**Purpose**: Run all tests in sequence with detailed reporting
**Duration**: ~10-20 minutes
**Requirements**: STAC API for integration tests

```bash
python3 run_all_tests.py
```

## 🔧 Test Configuration

### Environment Variables
```bash
# Optional: Override data paths for testing
export GEOLOGY_DATA_PATH="/path/to/test/geology"
export SATELLITE_DATA_PATH="/path/to/test/satellite"
export GEOPHYSICS_DATA_PATH="/path/to/test/geophysics"

# Optional: Configure S3 for testing
export S3_BUCKET="test-bucket-name"
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
```

### Test Data Structure
Tests automatically create sample data in this structure:
```
test_data/
├── geology/
│   ├── ZMB/
│   ├── BWA/
│   └── ZAF/
├── satellite/
│   ├── ZMB/
│   ├── BWA/
│   └── ZAF/
├── geophysics/
│   ├── ZMB/
│   ├── BWA/
│   └── ZAF/
└── output/
    ├── stac_catalogs/
    └── reports/
```

## 📊 Understanding Test Results

### Success Indicators
- ✅ **All imports successful**: All pipeline components load correctly
- ✅ **STAC validation passes**: Generated catalogs are STAC-compliant
- ✅ **API integration works**: STAC API serves generated catalogs
- ✅ **High success rate**: >90% of test files processed successfully
- ✅ **Good performance**: >5 files/second throughput

### Warning Signs
- ⚠️  **Import failures**: Missing dependencies or code issues
- ⚠️  **STAC validation errors**: Generated catalogs don't meet standards
- ⚠️  **API connectivity issues**: STAC API not running or accessible
- ⚠️  **Low success rate**: <80% of files processed successfully
- ⚠️  **Poor performance**: <1 file/second throughput

### Common Issues & Solutions

#### Import Errors
```bash
# Install missing dependencies
pip install pystac boto3 pandas numpy asyncio

# Check Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

#### STAC API Not Running
```bash
# Start the STAC API
cd ../api
./start_dev_server.sh

# Verify it's running
curl http://localhost:8000/health
```

#### Permission Errors
```bash
# Make scripts executable
chmod +x *.py

# Check file permissions
ls -la *.py
```

#### Memory Issues
```bash
# Monitor memory usage during tests
pip install psutil

# Reduce test data size
# Edit benchmark_pipeline.py and reduce dataset_count
```

## 🎯 Test Scenarios

### Development Testing
```bash
# Quick validation during development
python3 quick_test.py

# Test specific component changes
python3 test_pipeline.py::TestPipelineComponents::test_geology_processor
```

### Pre-Deployment Testing
```bash
# Full integration test
python3 validate_pipeline_integration.py

# Performance validation
python3 benchmark_pipeline.py
```

### Production Readiness
```bash
# Complete test suite
python3 run_all_tests.py

# Verify all tests pass with >95% success rate
```

## 📈 Performance Benchmarks

### Expected Performance (Reference Hardware)
- **Throughput**: 10-50 files/second (depending on complexity)
- **Memory Usage**: <2GB for 1000 files
- **Success Rate**: >95% for well-formed data
- **Scalability**: Linear improvement up to 4-8 workers

### Benchmark Configurations
```python
# Light testing (quick validation)
dataset_count=20, complexity="simple", workers=2

# Medium testing (realistic workload)
dataset_count=100, complexity="medium", workers=4

# Heavy testing (stress test)
dataset_count=500, complexity="complex", workers=8
```

## 🔍 Debugging Failed Tests

### Enable Debug Logging
```bash
export LOG_LEVEL=DEBUG
python3 quick_test.py
```

### Check Individual Components
```python
# Test specific processor
from processors.geology_processor import GeologyProcessor
from config import GlobalConfig

config = GlobalConfig()
processor = GeologyProcessor(config)
# Test processor methods...
```

### Validate STAC Items Manually
```python
from stac_validator import STACValidator

validator = STACValidator()
is_valid, errors = validator.validate_item(your_item)
print(f"Valid: {is_valid}, Errors: {errors}")
```

## 📚 Test Reports

### Generated Reports
- **QA/QC Report**: `output/qaqc_report_YYYYMMDD_HHMMSS.html`
- **Performance Report**: `output/performance_report.md`
- **Benchmark Results**: `output/benchmark_results.json`

### Report Contents
- 📊 Processing statistics
- 📈 Performance metrics
- ❌ Error analysis
- 💡 Recommendations
- 📋 Data quality assessment

## 🤝 Contributing Tests

### Adding New Tests
1. Create test in appropriate file (`test_pipeline.py`, etc.)
2. Follow naming convention: `test_component_functionality`
3. Include both positive and negative test cases
4. Add documentation for test purpose

### Test Best Practices
- ✅ Use temporary directories for test data
- ✅ Clean up resources after tests
- ✅ Test both success and failure scenarios
- ✅ Include performance assertions
- ✅ Mock external dependencies when possible

## 🚨 Troubleshooting

### Test Environment Issues
```bash
# Reset test environment
rm -rf /tmp/geovision_test_*

# Clear Python cache
find . -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete
```

### Dependency Issues
```bash
# Check Python version (requires 3.8+)
python3 --version

# Install all dependencies
pip install -r requirements.txt

# Check for conflicting packages
pip check
```

### Resource Issues
```bash
# Check available disk space
df -h

# Check memory usage
free -h

# Monitor during tests
top -p $(pgrep -f python3)
```

The testing suite provides comprehensive validation of the data ingestion pipeline, ensuring reliability and performance before production deployment.

**🧪 Ready to test your geological data pipeline! ⛏️✨**