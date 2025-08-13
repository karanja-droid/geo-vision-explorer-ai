# GeoVision AI Miner - Geological Data Processing Pipeline
# Handles COG conversion and STAC catalog generation for geological datasets

# Configuration
BUCKET ?= s3://geovision-ai-miner-data
INPUT ?= data/input/input.tif
COUNTRY ?= ZMB
OUTPUT_PREFIX ?= country/$(COUNTRY)/baseline/satellite
GEOLOGICAL_DATA_TYPE ?= spectral
SENSOR_TYPE ?= landsat8
ACQUISITION_DATE ?= $(shell date +%Y%m%d)

# Geological data specific configurations
SPECTRAL_BANDS ?= 11
SPATIAL_RESOLUTION ?= 30
CRS ?= EPSG:4326
MINERAL_TARGET ?= copper

.PHONY: cog stac stac-simple geological-cog hyperspectral-cog magnetic-cog gravity-cog clean validate-all

# Standard COG conversion with geological optimizations
cog:
	@echo "🌍 Creating Cloud-Optimized GeoTIFF for geological data..."
	# Create COG with internal overviews, tiling, compression optimized for geological data
	gdal_translate -of COG \
		-co COMPRESS=DEFLATE \
		-co NUM_THREADS=ALL_CPUS \
		-co BLOCKSIZE=512 \
		-co RESAMPLING=AVERAGE \
		-co OVERVIEW_RESAMPLING=AVERAGE \
		-co OVERVIEW_COUNT=5 \
		-co PREDICTOR=2 \
		-co BIGTIFF=YES \
		$(INPUT) /tmp/output_cog.tif
	
	@echo "✅ Validating COG structure..."
	cog_validate /tmp/output_cog.tif
	
	@echo "☁️  Uploading to S3 with geological metadata..."
	aws s3 cp /tmp/output_cog.tif \
		$(BUCKET)/$(OUTPUT_PREFIX)/$(shell date +%Y%m)/$(shell basename $(INPUT) .tif)_cog.tif \
		--acl bucket-owner-full-control \
		--metadata "data-type=$(GEOLOGICAL_DATA_TYPE),sensor=$(SENSOR_TYPE),bands=$(SPECTRAL_BANDS),resolution=$(SPATIAL_RESOLUTION),target=$(MINERAL_TARGET)"

# Specialized COG for hyperspectral geological data
hyperspectral-cog:
	@echo "🔬 Creating COG for hyperspectral geological data..."
	gdal_translate -of COG \
		-co COMPRESS=LZW \
		-co NUM_THREADS=ALL_CPUS \
		-co BLOCKSIZE=256 \
		-co RESAMPLING=CUBIC \
		-co OVERVIEW_RESAMPLING=CUBIC \
		-co OVERVIEW_COUNT=6 \
		-co PREDICTOR=2 \
		-co BIGTIFF=YES \
		-co INTERLEAVE=BAND \
		$(INPUT) /tmp/hyperspectral_cog.tif
	
	cog_validate /tmp/hyperspectral_cog.tif
	
	aws s3 cp /tmp/hyperspectral_cog.tif \
		$(BUCKET)/$(OUTPUT_PREFIX)/hyperspectral/$(ACQUISITION_DATE)_hyperspectral_cog.tif \
		--acl bucket-owner-full-control \
		--metadata "data-type=hyperspectral,bands=$(SPECTRAL_BANDS),resolution=$(SPATIAL_RESOLUTION),sensor=$(SENSOR_TYPE)"

# COG for magnetic survey data
magnetic-cog:
	@echo "🧲 Creating COG for magnetic survey data..."
	gdal_translate -of COG \
		-co COMPRESS=DEFLATE \
		-co NUM_THREADS=ALL_CPUS \
		-co BLOCKSIZE=512 \
		-co RESAMPLING=BILINEAR \
		-co OVERVIEW_RESAMPLING=BILINEAR \
		-co OVERVIEW_COUNT=4 \
		-co PREDICTOR=3 \
		$(INPUT) /tmp/magnetic_cog.tif
	
	cog_validate /tmp/magnetic_cog.tif
	
	aws s3 cp /tmp/magnetic_cog.tif \
		$(BUCKET)/$(OUTPUT_PREFIX)/geophysics/magnetic/$(ACQUISITION_DATE)_magnetic_cog.tif \
		--acl bucket-owner-full-control \
		--metadata "data-type=magnetic,survey-type=aeromagnetic,units=nT"

# COG for gravity survey data
gravity-cog:
	@echo "⚖️  Creating COG for gravity survey data..."
	gdal_translate -of COG \
		-co COMPRESS=DEFLATE \
		-co NUM_THREADS=ALL_CPUS \
		-co BLOCKSIZE=512 \
		-co RESAMPLING=BILINEAR \
		-co OVERVIEW_RESAMPLING=BILINEAR \
		-co OVERVIEW_COUNT=4 \
		-co PREDICTOR=3 \
		$(INPUT) /tmp/gravity_cog.tif
	
	cog_validate /tmp/gravity_cog.tif
	
	aws s3 cp /tmp/gravity_cog.tif \
		$(BUCKET)/$(OUTPUT_PREFIX)/geophysics/gravity/$(ACQUISITION_DATE)_gravity_cog.tif \
		--acl bucket-owner-full-control \
		--metadata "data-type=gravity,survey-type=ground,units=mGal"

# Generate comprehensive STAC catalog for geological datasets
stac:
	@echo "📋 Building comprehensive STAC catalog for geological datasets..."
	python tools/stac/build_geological_stac.py \
		--bucket $(BUCKET) \
		--prefix $(OUTPUT_PREFIX) \
		--country $(COUNTRY) \
		--data-type $(GEOLOGICAL_DATA_TYPE) \
		--sensor $(SENSOR_TYPE) \
		--target-mineral $(MINERAL_TARGET) \
		--spatial-resolution $(SPATIAL_RESOLUTION) \
		--spectral-bands $(SPECTRAL_BANDS)

# Generate simple STAC catalog (lightweight version)
stac-simple:
	@echo "📋 Building simple STAC catalog..."
	python tools/stac/build_simple_stac.py \
		--bucket $(BUCKET) \
		--prefix $(OUTPUT_PREFIX) \
		--country $(COUNTRY) \
		--collection-id "geovision-$(COUNTRY)-$(GEOLOGICAL_DATA_TYPE)" \
		--collection-title "GeoVision $(COUNTRY) $(GEOLOGICAL_DATA_TYPE) Data"

# Batch process multiple geological datasets
batch-process:
	@echo "🔄 Batch processing geological datasets..."
	@for file in data/input/*.tif; do \
		echo "Processing $$file..."; \
		$(MAKE) cog INPUT=$$file; \
	done
	$(MAKE) stac

# Process drill core imagery
core-imagery:
	@echo "🪨 Processing drill core imagery..."
	gdal_translate -of COG \
		-co COMPRESS=JPEG \
		-co JPEG_QUALITY=85 \
		-co NUM_THREADS=ALL_CPUS \
		-co BLOCKSIZE=512 \
		-co OVERVIEW_COUNT=4 \
		$(INPUT) /tmp/core_imagery_cog.tif
	
	cog_validate /tmp/core_imagery_cog.tif
	
	aws s3 cp /tmp/core_imagery_cog.tif \
		$(BUCKET)/$(OUTPUT_PREFIX)/core-samples/$(ACQUISITION_DATE)_core_imagery_cog.tif \
		--acl bucket-owner-full-control \
		--metadata "data-type=core-imagery,sample-type=drill-core"

# Validate all COGs in the bucket
validate-all:
	@echo "✅ Validating all COGs in bucket..."
	aws s3 ls $(BUCKET)/$(OUTPUT_PREFIX)/ --recursive | grep "\.tif$$" | while read -r line; do \
		file=$$(echo $$line | awk '{print $$4}'); \
		echo "Validating $$file..."; \
		aws s3 cp $(BUCKET)/$$file /tmp/temp_cog.tif; \
		cog_validate /tmp/temp_cog.tif; \
		rm /tmp/temp_cog.tif; \
	done

# Generate vector tiles for geological structures
vector-tiles:
	@echo "🗺️  Generating vector tiles for geological structures..."
	tippecanoe -o /tmp/geology.mbtiles \
		--maximum-zoom=12 \
		--minimum-zoom=0 \
		--layer=faults \
		--layer=veins \
		--layer=contacts \
		--layer=structures \
		data/vector/geology.geojson
	
	aws s3 cp /tmp/geology.mbtiles \
		$(BUCKET)/$(OUTPUT_PREFIX)/vector-tiles/geology.mbtiles \
		--acl bucket-owner-full-control

# Clean temporary files
clean:
	@echo "🧹 Cleaning temporary files..."
	rm -f /tmp/*_cog.tif /tmp/*.mbtiles

# Help target
help:
	@echo "GeoVision AI Miner - Geological Data Processing Pipeline"
	@echo "======================================================"
	@echo ""
	@echo "Available targets:"
	@echo "  cog                 - Create standard COG for geological data"
	@echo "  hyperspectral-cog   - Create COG optimized for hyperspectral data"
	@echo "  magnetic-cog        - Create COG for magnetic survey data"
	@echo "  gravity-cog         - Create COG for gravity survey data"
	@echo "  core-imagery        - Process drill core imagery"
	@echo "  stac                - Generate comprehensive STAC catalog"
	@echo "  stac-simple         - Generate simple STAC catalog (lightweight)"
	@echo "  vector-tiles        - Generate vector tiles for geological structures"
	@echo "  batch-process       - Process multiple files"
	@echo "  validate-all        - Validate all COGs in bucket"
	@echo "  clean               - Clean temporary files"
	@echo ""
	@echo "Configuration variables:"
	@echo "  BUCKET              - S3 bucket (default: s3://geovision-ai-miner-data)"
	@echo "  INPUT               - Input file path (default: data/input/input.tif)"
	@echo "  COUNTRY             - Country code (default: ZMB)"
	@echo "  GEOLOGICAL_DATA_TYPE - Data type (default: spectral)"
	@echo "  SENSOR_TYPE         - Sensor type (default: landsat8)"
	@echo "  MINERAL_TARGET      - Target mineral (default: copper)"
	@echo ""
	@echo "Example usage:"
	@echo "  make cog INPUT=data/landsat.tif COUNTRY=ZMB MINERAL_TARGET=gold"
	@echo "  make hyperspectral-cog INPUT=data/hyperion.tif"
	@echo "  make batch-process"

# Default target
.DEFAULT_GOAL := help