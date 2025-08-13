# 🌍 GeoVision AI Miner - Data Processing Pipeline

## 🎯 Overview

The GeoVision AI Miner platform includes a comprehensive data processing pipeline for handling large-scale geological datasets. This pipeline converts raw geological data into cloud-optimized formats and generates STAC-compliant metadata catalogs for efficient discovery and access.

## 🔧 Pipeline Components

### **1. Makefile-Based Processing**

The `Makefile` provides automated processing workflows for different geological data types:

#### **Standard COG Conversion**
```bash
make cog INPUT=data/landsat.tif COUNTRY=ZMB MINERAL_TARGET=gold
```

#### **Specialized Processing**
```bash
# Hyperspectral data (optimized for mineral mapping)
make hyperspectral-cog INPUT=data/hyperion.tif

# Magnetic survey data
make magnetic-cog INPUT=data/aeromagnetic.tif

# Gravity survey data  
make gravity-cog INPUT=data/gravity.tif

# Drill core imagery
make core-imagery INPUT=data/core_photos.tif
```

#### **Batch Processing**
```bash
# Process all files in data/input/
make batch-process
```

### **2. STAC Catalog Generation**

The Python STAC builder creates standardized metadata catalogs:

```bash
python tools/stac/build_geological_stac.py \
  --bucket s3://geovision-ai-miner-data \
  --prefix country/ZMB/baseline/satellite \
  --country ZMB \
  --data-type spectral \
  --sensor landsat8 \
  --target-mineral copper
```

### **3. Edge Function Integration**

The `geological-data-fabric` Edge Function provides API access to the processing pipeline:

```typescript
const { data } = await supabase.functions.invoke('geological-data-fabric', {
  body: {
    operation: 'convert_to_cog',
    data: {
      inputPath: 's3://bucket/input/landsat.tif',
      outputBucket: 'geovision-ai-miner-data',
      country: 'ZMB'
    }
  }
});
```

## 📊 Data Type Optimizations

### **Hyperspectral Data**
- **Compression**: LZW with predictor=2
- **Block Size**: 256x256 for better spectral access
- **Resampling**: Cubic for spectral fidelity
- **Overviews**: 6 levels for multi-scale analysis
- **Interleave**: Band-sequential for spectral processing

### **Magnetic Survey Data**
- **Compression**: DEFLATE with predictor=3 (floating point)
- **Resampling**: Bilinear for smooth gradients
- **Overviews**: 4 levels for regional to detailed views
- **Data Type**: Float32 for precise measurements

### **Gravity Survey Data**
- **Compression**: DEFLATE with predictor=3
- **Units**: mGal (milligals) with metadata
- **Resampling**: Bilinear for density mapping
- **Coordinate System**: Local grid with transformation

### **Core Imagery**
- **Compression**: JPEG with 85% quality
- **Color Space**: RGB for visual interpretation
- **Overviews**: 4 levels for zoom performance
- **Metadata**: Core depth, sample ID, lithology

## 🗂️ Directory Structure

```
s3://geovision-ai-miner-data/
├── country/
│   └── ZMB/                    # Country code
│       └── baseline/
│           └── satellite/
│               ├── spectral/           # Multispectral data
│               ├── hyperspectral/      # Hyperspectral data
│               ├── geophysics/
│               │   ├── magnetic/       # Magnetic surveys
│               │   └── gravity/        # Gravity surveys
│               ├── core-samples/       # Drill core imagery
│               ├── vector-tiles/       # Geological structures
│               └── stac/              # STAC catalogs
└── processing/
    ├── logs/                   # Processing logs
    └── temp/                   # Temporary files
```

## 📋 STAC Catalog Structure

### **Catalog Hierarchy**
```
geovision-zmb-geological-data/          # Root catalog
├── spectral-landsat8-zmb/              # Collection
│   ├── spectral-landsat8-20240101      # Item
│   ├── spectral-landsat8-20240115      # Item
│   └── ...
├── hyperspectral-hyperion-zmb/         # Collection
└── magnetic-aeromagnetic-zmb/          # Collection
```

### **STAC Extensions Used**
- **EO Extension**: Electro-optical data (bands, wavelengths)
- **Projection Extension**: Coordinate reference systems
- **Scientific Extension**: DOI, citations, methodology
- **Geological Extension**: Custom geological metadata

### **Geological Metadata**
```json
{
  "geological:data_type": "hyperspectral",
  "geological:sensor": "hyperion",
  "geological:target_mineral": "copper",
  "geological:processing_level": "L2A",
  "geological:coordinate_system": "EPSG:32735",
  "geological:pixel_size": 30.0,
  "geological:spectral_range": [400, 2500],
  "geological:bands": 242
}
```

## 🔄 Processing Workflow

### **1. Data Ingestion**
```bash
# Upload raw data to S3
aws s3 cp local_data.tif s3://geovision-ai-miner-data/input/

# Or use the web interface for smaller files
```

### **2. Automated Processing**
```bash
# Trigger processing via Makefile
make cog INPUT=s3://bucket/input/data.tif COUNTRY=ZMB

# Or via Edge Function API
curl -X POST 'https://project.supabase.co/functions/v1/geological-data-fabric' \
  -H 'Authorization: Bearer TOKEN' \
  -d '{"operation": "convert_to_cog", "data": {...}}'
```

### **3. Quality Validation**
```bash
# Validate all COGs in bucket
make validate-all

# Individual validation
cog_validate s3://bucket/output/data_cog.tif
```

### **4. Catalog Generation**
```bash
# Generate STAC catalog
make stac

# Validate STAC catalog
python -c "import pystac; pystac.validation.validate_dict(...)"
```

### **5. Vector Tile Generation**
```bash
# Generate vector tiles for geological structures
make vector-tiles

# Upload to tile server
aws s3 cp geology.mbtiles s3://bucket/vector-tiles/
```

## 🎯 Performance Optimizations

### **COG Optimizations**
- **Internal Tiling**: 512x512 blocks for efficient access
- **Overviews**: Multiple levels for zoom performance
- **Compression**: Data-type specific compression
- **Predictor**: Horizontal/floating point differencing
- **BigTIFF**: Support for files >4GB

### **STAC Optimizations**
- **Spatial Indexing**: Efficient spatial queries
- **Temporal Indexing**: Time-based data discovery
- **Asset Organization**: Logical grouping of related data
- **Metadata Caching**: Fast catalog browsing

### **S3 Optimizations**
- **Multipart Upload**: Large file handling
- **Transfer Acceleration**: Global upload performance
- **Intelligent Tiering**: Cost optimization
- **Cross-Region Replication**: Data redundancy

## 📊 Monitoring and Analytics

### **Processing Metrics**
- **Throughput**: Files processed per hour
- **Success Rate**: Percentage of successful conversions
- **File Sizes**: Original vs. compressed sizes
- **Processing Time**: Average time per data type

### **Usage Analytics**
- **Data Access Patterns**: Most requested datasets
- **Geographic Distribution**: Data usage by region
- **Temporal Patterns**: Seasonal data access
- **User Behavior**: Common query patterns

### **Quality Metrics**
- **COG Validation**: Compliance with COG specification
- **STAC Validation**: Compliance with STAC specification
- **Data Integrity**: Checksum verification
- **Metadata Completeness**: Required fields coverage

## 🔧 Configuration

### **Environment Variables**
```bash
# S3 Configuration
export BUCKET=s3://geovision-ai-miner-data
export AWS_REGION=us-west-2

# Processing Configuration
export GDAL_CACHEMAX=2048
export GDAL_NUM_THREADS=ALL_CPUS
export GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR

# STAC Configuration
export STAC_API_URL=https://stac.geovision.ai
export STAC_COLLECTION_ID=geological-data
```

### **Makefile Variables**
```makefile
BUCKET ?= s3://geovision-ai-miner-data
COUNTRY ?= ZMB
GEOLOGICAL_DATA_TYPE ?= spectral
SENSOR_TYPE ?= landsat8
MINERAL_TARGET ?= copper
SPATIAL_RESOLUTION ?= 30
SPECTRAL_BANDS ?= 11
```

## 🚀 Deployment

### **Prerequisites**
```bash
# Install GDAL
sudo apt-get install gdal-bin

# Install Python dependencies
pip install -r tools/stac/requirements.txt

# Install tippecanoe for vector tiles
sudo apt-get install tippecanoe

# Configure AWS CLI
aws configure
```

### **Setup**
```bash
# Clone repository
git clone https://github.com/geovision/ai-miner.git
cd ai-miner

# Make scripts executable
chmod +x tools/stac/build_geological_stac.py

# Test processing
make help
make cog INPUT=test_data.tif
```

### **Production Deployment**
```bash
# Deploy to production environment
./deploy-enhanced-backend.sh

# Set up automated processing
crontab -e
# Add: 0 2 * * * cd /path/to/geovision && make batch-process
```

## 🎯 Benefits

### **For Geologists**
- **Fast Data Access**: COG format enables rapid visualization
- **Standardized Metadata**: STAC catalogs improve data discovery
- **Multi-Scale Analysis**: Overviews support zoom-based exploration
- **Cross-Platform Compatibility**: Open standards ensure interoperability

### **For Data Managers**
- **Automated Processing**: Reduces manual data preparation
- **Quality Assurance**: Built-in validation and monitoring
- **Cost Optimization**: Efficient storage and transfer
- **Scalable Architecture**: Handles growing data volumes

### **For Developers**
- **API Integration**: Edge Functions provide programmatic access
- **Standard Formats**: COG and STAC are industry standards
- **Cloud Native**: Optimized for cloud-based workflows
- **Extensible**: Easy to add new data types and processing

## 📚 References

- **COG Specification**: https://www.cogeo.org/
- **STAC Specification**: https://stacspec.org/
- **GDAL Documentation**: https://gdal.org/
- **AWS S3 Best Practices**: https://docs.aws.amazon.com/s3/

The data processing pipeline provides enterprise-grade geological data management that scales from individual projects to continental surveys, enabling efficient data discovery, access, and analysis for mining exploration workflows.

**🌍 Ready to process geological data at scale! ⛏️✨**