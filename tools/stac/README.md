# GeoVision AI Miner - STAC Tools

This directory contains tools for generating STAC (SpatioTemporal Asset Catalog) metadata for geological datasets.

## 📋 Available Tools

### 1. **Comprehensive STAC Builder** (`build_geological_stac.py`)

**Use when:**
- Building production STAC catalogs with full geological metadata
- Need specialized geological extensions and metadata
- Working with multiple data types and sensors
- Require detailed mineral targeting and exploration metadata
- Need scientific citations and DOI references

**Features:**
- Full geological metadata support
- Mineral-specific keywords and classifications
- Multi-sensor support (Landsat, Hyperion, airborne surveys)
- Scientific extension with DOI and citations
- Detailed band information for spectral data
- Automatic data type detection and optimization
- S3 integration with metadata discovery
- Comprehensive validation

**Usage:**
```bash
python tools/stac/build_geological_stac.py \
  --bucket s3://geovision-ai-miner-data \
  --prefix country/ZMB/baseline/satellite \
  --country ZMB \
  --data-type spectral \
  --sensor landsat8 \
  --target-mineral copper \
  --spatial-resolution 30 \
  --spectral-bands 11
```

### 2. **Simple STAC Builder** (`build_simple_stac.py`)

**Use when:**
- Quick STAC catalog generation for testing
- Minimal metadata requirements
- Processing small datasets
- Prototyping and development
- Simple COG-to-STAC conversion

**Features:**
- Lightweight and fast processing
- Basic geological metadata
- Automatic data type detection from filenames
- Support for both S3 and local files
- Simple collection structure
- Quick validation

**Usage:**
```bash
python tools/stac/build_simple_stac.py \
  --bucket s3://geovision-ai-miner-data \
  --prefix country/ZMB/baseline/satellite \
  --country ZMB \
  --collection-id geovision-zmb-baseline \
  --output ./stac-catalog
```

## 🔄 Makefile Integration

Both tools are integrated into the main processing pipeline:

```bash
# Comprehensive STAC catalog (production)
make stac

# Simple STAC catalog (development/testing)
make stac-simple
```

## 📊 Comparison

| Feature | Comprehensive Builder | Simple Builder |
|---------|----------------------|----------------|
| **Processing Speed** | Slower (full metadata) | Faster (minimal metadata) |
| **Metadata Richness** | Full geological extensions | Basic properties |
| **File Discovery** | Advanced S3 discovery | Simple file listing |
| **Validation** | Comprehensive validation | Basic validation |
| **Geological Extensions** | Yes (custom extensions) | No (standard only) |
| **Multi-Sensor Support** | Yes (detailed) | Yes (basic) |
| **Scientific Citations** | Yes (DOI, references) | No |
| **Band Information** | Detailed spectral info | Basic band count |
| **Use Case** | Production catalogs | Development/testing |

## 🗂️ Output Structure

### Comprehensive Builder Output:
```
stac_catalog/
├── catalog.json                    # Root catalog
├── spectral-landsat8-zmb/         # Collection directory
│   ├── collection.json            # Collection metadata
│   ├── spectral-landsat8-20240101/ # Item directory
│   │   └── spectral-landsat8-20240101.json
│   └── spectral-landsat8-20240115/
│       └── spectral-landsat8-20240115.json
└── hyperspectral-hyperion-zmb/    # Another collection
    ├── collection.json
    └── ...
```

### Simple Builder Output:
```
stac-catalog/
├── collection.json                # Single collection
├── 20240101_landsat_cog/         # Item directory
│   └── 20240101_landsat_cog.json
└── 20240115_landsat_cog/
    └── 20240115_landsat_cog.json
```

## 🔧 Configuration

### Environment Variables
```bash
# AWS Configuration
export AWS_REGION=us-west-2
export AWS_PROFILE=geovision

# GDAL Configuration (for rasterio)
export GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
export CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif,.tiff
```

### Python Dependencies
```bash
pip install -r requirements.txt
```

## 📝 Metadata Examples

### Comprehensive Builder Metadata:
```json
{
  "type": "Feature",
  "stac_version": "1.0.0",
  "id": "spectral-landsat8-20240101",
  "properties": {
    "datetime": "2024-01-01T10:30:00Z",
    "geological:data_type": "spectral",
    "geological:sensor": "landsat8",
    "geological:target_mineral": "copper",
    "geological:processing_level": "L2A",
    "geological:coordinate_system": "EPSG:32735",
    "eo:bands": [
      {
        "name": "coastal",
        "common_name": "coastal",
        "center_wavelength": 0.44
      }
    ],
    "proj:epsg": 32735,
    "proj:shape": [7801, 7651],
    "scientific:doi": "10.5194/geovision-spectral-landsat8-zmb",
    "scientific:citation": "GeoVision AI Miner spectral dataset for ZMB geological exploration"
  }
}
```

### Simple Builder Metadata:
```json
{
  "type": "Feature",
  "stac_version": "1.0.0",
  "id": "20240101_landsat_cog",
  "properties": {
    "datetime": "2024-01-01T10:30:00Z",
    "geovision:source": "COG",
    "geovision:data_type": "spectral",
    "geovision:processing_level": "L2A",
    "proj:epsg": 32735,
    "proj:shape": [7801, 7651]
  }
}
```

## 🎯 Best Practices

### For Production Use:
1. **Use Comprehensive Builder** for production STAC catalogs
2. **Validate all catalogs** before deployment
3. **Include proper citations** and DOI references
4. **Use consistent naming conventions** for collections and items
5. **Implement proper error handling** for large datasets

### For Development:
1. **Use Simple Builder** for quick testing and prototyping
2. **Test with small datasets** before processing large collections
3. **Validate S3 permissions** before running batch operations
4. **Use local files** for initial development and testing

### For Both:
1. **Check file paths** and S3 permissions before processing
2. **Monitor processing logs** for errors and warnings
3. **Validate output catalogs** using STAC validation tools
4. **Backup important catalogs** before making changes

## 🔍 Troubleshooting

### Common Issues:

**S3 Access Denied:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Check bucket permissions
aws s3 ls s3://geovision-ai-miner-data/
```

**GDAL/Rasterio Errors:**
```bash
# Check GDAL installation
gdalinfo --version

# Test file access
gdalinfo s3://bucket/file.tif
```

**STAC Validation Errors:**
```python
import pystac.validation
# Validate individual items
pystac.validation.validate_dict(item_dict, pystac.STACObjectType.ITEM)
```

**Missing Dependencies:**
```bash
# Reinstall requirements
pip install -r requirements.txt --upgrade
```

## 📚 References

- **STAC Specification**: https://stacspec.org/
- **PySTAC Documentation**: https://pystac.readthedocs.io/
- **STAC Extensions**: https://stac-extensions.github.io/
- **COG Specification**: https://www.cogeo.org/
- **Rasterio Documentation**: https://rasterio.readthedocs.io/

Both tools provide flexible options for STAC catalog generation, allowing you to choose the right level of complexity for your specific use case.