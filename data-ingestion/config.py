"""
GeoVision AI Miner - Data Ingestion Configuration
Multi-source geoscience data pipeline for Southern Africa
"""

import os
from dataclasses import dataclass
from typing import List, Dict, Any
from pathlib import Path

@dataclass
class GlobalConfig:
    """Global configuration for data ingestion pipeline"""
    
    # Organization & Project
    org_id: str = os.getenv('ORG_ID', 'geovision-default')
    project_id: str = os.getenv('PROJECT_ID', 'southern-africa-baseline')
    
    # Storage Configuration
    s3_bucket: str = os.getenv('S3_BUCKET', 's3://geovision-ai-miner-data')
    postgres_dsn: str = os.getenv('POSTGRES_DSN', 'postgres://user:pass@localhost:5432/geovision')
    
    # Spatial Configuration
    crs_target: str = 'EPSG:4326'
    tile_resampling: str = 'AVERAGE'
    
    # Performance Configuration
    max_cpu_percent: int = 80
    max_workers: int = 8
    resume: bool = True
    idempotent: bool = True
    
    # Logging Configuration
    log_level: str = 'INFO'
    log_to_console: bool = True
    log_to_s3: bool = True
    
    # Validation Configuration
    halt_on_critical: bool = True
    continue_on_noncritical: bool = True
    pii_check: bool = False
    
    # Target Countries
    countries: List[str] = None
    
    def __post_init__(self):
        if self.countries is None:
            self.countries = ['ZA', 'NA', 'MZ', 'ZW', 'ZM', 'CD', 'MW']
    
    @property
    def log_path(self) -> str:
        """S3 path for logs"""
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return f"{self.s3_bucket}/logs/ingest/{timestamp}/"
    
    @property
    def country_codes(self) -> Dict[str, str]:
        """Country code to name mapping"""
        return {
            'ZA': 'South Africa',
            'NA': 'Namibia', 
            'MZ': 'Mozambique',
            'ZW': 'Zimbabwe',
            'ZM': 'Zambia',
            'CD': 'DR Congo',
            'MW': 'Malawi'
        }

@dataclass
class DatasetConfig:
    """Configuration for specific dataset types"""
    
    # Geology & Structures
    geology_sources: Dict[str, str] = None
    geology_extensions: List[str] = None
    
    # Geophysics
    geophysics_sources: Dict[str, str] = None
    geophysics_extensions: List[str] = None
    geophysics_types: List[str] = None
    
    # DEM & Morphometry
    dem_sources: Dict[str, str] = None
    dem_resolution: str = '30m'
    
    # Satellite & Spectral
    satellite_sources: Dict[str, str] = None
    spectral_indices: List[str] = None
    
    # Geochemical Samples
    geochem_sources: Dict[str, str] = None
    geochem_extensions: List[str] = None
    geochem_required_columns: List[str] = None
    
    # Drillholes
    drill_sources: Dict[str, str] = None
    drill_extensions: List[str] = None
    drill_required_tables: List[str] = None
    
    # ESG / Environmental
    esg_sources: Dict[str, str] = None
    
    def __post_init__(self):
        if self.geology_sources is None:
            self.geology_sources = {
                'local': '{LOCAL_DIR}/geology/{country}/**/*',
                's3': '{S3_BUCKET}/staging/geology/{country}/**/*'
            }
        
        if self.geology_extensions is None:
            self.geology_extensions = ['.shp', '.gpkg', '.geojson']
        
        if self.geophysics_sources is None:
            self.geophysics_sources = {
                'local': '{LOCAL_DIR}/geophysics/{country}/**/*',
                's3': '{S3_BUCKET}/staging/geophysics/{country}/**/*'
            }
        
        if self.geophysics_extensions is None:
            self.geophysics_extensions = ['.tif', '.vrt', '.grd', '.xyz']
        
        if self.geophysics_types is None:
            self.geophysics_types = ['magnetics', 'gravity', 'radiometrics']
        
        if self.dem_sources is None:
            self.dem_sources = {
                'local': '{LOCAL_DIR}/dem/{country}/**/*.tif',
                's3': '{S3_BUCKET}/staging/dem/{country}/**/*.tif'
            }
        
        if self.satellite_sources is None:
            self.satellite_sources = {
                'local': '{LOCAL_DIR}/satellite/{country}/**/*.tif',
                's3': '{S3_BUCKET}/staging/satellite/{country}/**/*.tif'
            }
        
        if self.spectral_indices is None:
            self.spectral_indices = ['NDVI', 'NDWI', 'NBR', 'ferric', 'ferrous']
        
        if self.geochem_sources is None:
            self.geochem_sources = {
                'local': '{LOCAL_DIR}/geochem/{country}/**/*',
                's3': '{S3_BUCKET}/staging/geochem/{country}/**/*'
            }
        
        if self.geochem_extensions is None:
            self.geochem_extensions = ['.csv', '.xlsx', '.parquet']
        
        if self.geochem_required_columns is None:
            self.geochem_required_columns = [
                'sample_id', 'easting', 'northing', 'crs', 'collected_at'
            ]
        
        if self.drill_sources is None:
            self.drill_sources = {
                'local': '{LOCAL_DIR}/drill/{country}/**/*',
                's3': '{S3_BUCKET}/staging/drill/{country}/**/*'
            }
        
        if self.drill_extensions is None:
            self.drill_extensions = ['.csv', '.xlsx', '.parquet']
        
        if self.drill_required_tables is None:
            self.drill_required_tables = ['collars', 'surveys', 'intervals', 'assays']
        
        if self.esg_sources is None:
            self.esg_sources = {
                'local': '{LOCAL_DIR}/esg/{country}/**/*',
                's3': '{S3_BUCKET}/staging/esg/{country}/**/*'
            }

@dataclass
class FeatureStoreConfig:
    """Configuration for feature store generation"""
    
    grid_resolution: str = '250m'
    scales: List[int] = None
    distance_features: List[str] = None
    statistical_features: List[str] = None
    morphometry_features: List[str] = None
    
    def __post_init__(self):
        if self.scales is None:
            self.scales = [1, 3, 5]
        
        if self.distance_features is None:
            self.distance_features = [
                'faults', 'contacts', 'rivers', 'roads', 'known_occurrences'
            ]
        
        if self.statistical_features is None:
            self.statistical_features = ['mean', 'std', 'entropy']
        
        if self.morphometry_features is None:
            self.morphometry_features = ['slope', 'curvature']

@dataclass
class TilingConfig:
    """Configuration for tile generation"""
    
    # Vector tiles (MVT)
    mvt_minzoom: int = 3
    mvt_maxzoom: int = 12
    mvt_drop_densest: bool = True
    mvt_no_tile_size_limit: bool = True
    
    # Raster tiles (COG)
    cog_compress: str = 'DEFLATE'
    cog_blocksize: int = 512
    cog_overview_levels: List[int] = None
    
    def __post_init__(self):
        if self.cog_overview_levels is None:
            self.cog_overview_levels = [2, 4, 8, 16, 32]

@dataclass
class QualityConfig:
    """Configuration for QA/QC processes"""
    
    # Geometry validation
    fix_invalid_geometries: bool = True
    geometry_tolerance: float = 1e-6
    
    # Statistical validation
    outlier_z_threshold: float = 6.0
    duplicate_tolerance: float = 1e-3
    
    # Data validation
    required_field_coverage: float = 0.95
    coordinate_bounds_check: bool = True
    
    # Performance validation
    statement_timeout: str = '60s'
    max_retry_attempts: int = 3
    retry_backoff_factor: float = 2.0

# Global configuration instance
config = GlobalConfig()
dataset_config = DatasetConfig()
feature_store_config = FeatureStoreConfig()
tiling_config = TilingConfig()
quality_config = QualityConfig()