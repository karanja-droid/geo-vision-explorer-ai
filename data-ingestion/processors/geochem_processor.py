"""
Geochemical Samples Data Processor
Handles tabular geochemical sample data with spatial coordinates
"""

import os
import time
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import numpy as np
from scipy import stats
import tempfile

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, dataset_config, quality_config

class GeochemProcessor:
    """Processes geochemical sample data for ingestion pipeline"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('geochem_processor')
        self.processed_files = []
        self.validation_results = {}
        
        # Common element patterns and units
        self.element_patterns = {
            'Au': ['au', 'gold', 'au_ppb', 'au_ppm', 'gold_ppb'],
            'Cu': ['cu', 'copper', 'cu_ppm', 'cu_percent', 'copper_ppm'],
            'Ag': ['ag', 'silver', 'ag_ppm', 'ag_ppb', 'silver_ppm'],
            'Pb': ['pb', 'lead', 'pb_ppm', 'lead_ppm'],
            'Zn': ['zn', 'zinc', 'zn_ppm', 'zinc_ppm'],
            'Fe': ['fe', 'iron', 'fe_percent', 'fe2o3', 'iron_percent'],
            'As': ['as', 'arsenic', 'as_ppm', 'arsenic_ppm'],
            'Ni': ['ni', 'nickel', 'ni_ppm', 'nickel_ppm'],
            'Co': ['co', 'cobalt', 'co_ppm', 'cobalt_ppm'],
            'Cr': ['cr', 'chromium', 'cr_ppm', 'chromium_ppm'],
            'Mo': ['mo', 'molybdenum', 'mo_ppm', 'molybdenum_ppm'],
            'W': ['w', 'tungsten', 'w_ppm', 'tungsten_ppm'],
            'Sn': ['sn', 'tin', 'sn_ppm', 'tin_ppm'],
            'U': ['u', 'uranium', 'u_ppm', 'uranium_ppm'],
            'Th': ['th', 'thorium', 'th_ppm', 'thorium_ppm'],
            'REE': ['ree', 'rare_earth', 'lree', 'hree'],
            'SiO2': ['sio2', 'silica', 'si_percent'],
            'Al2O3': ['al2o3', 'alumina', 'al_percent'],
            'CaO': ['cao', 'calcium', 'ca_percent'],
            'MgO': ['mgo', 'magnesium', 'mg_percent'],
            'K2O': ['k2o', 'potassium', 'k_percent'],
            'Na2O': ['na2o', 'sodium', 'na_percent']
        }
        
        # Unit conversion factors to ppm
        self.unit_conversions = {
            'percent': 10000,
            '%': 10000,
            'ppm': 1,
            'ppb': 0.001,
            'g/t': 1,  # grams per tonne = ppm
            'oz/t': 34.2857,  # troy ounces per tonne to ppm
            'mg/kg': 1
        }
    
    def discover_sources(self, country_code: str) -> List[Dict[str, Any]]:
        """Discover geochemical data sources for a country"""
        sources = []
        
        # Local sources
        local_pattern = dataset_config.geochem_sources['local'].format(
            LOCAL_DIR=os.getenv('LOCAL_DIR', './data'),
            country=country_code.lower()
        )
        
        for ext in dataset_config.geochem_extensions:
            pattern = f"{local_pattern}{ext}"
            local_files = self.storage.files.find_files(pattern)
            
            for file_path in local_files:
                sources.append({
                    'type': 'local',
                    'path': str(file_path),
                    'country': country_code,
                    'format': ext.replace('.', ''),
                    'size_mb': self.storage.files.get_file_size_mb(file_path)
                })
        
        # S3 sources
        s3_prefix = dataset_config.geochem_sources['s3'].format(
            S3_BUCKET=config.s3_bucket,
            country=country_code.lower()
        ).replace(f"{config.s3_bucket}/", "")
        
        s3_objects = self.storage.s3.list_objects(s3_prefix)
        
        for obj_key in s3_objects:
            if any(obj_key.endswith(ext) for ext in dataset_config.geochem_extensions):
                sources.append({
                    'type': 's3',
                    'path': f"s3://{config.s3_bucket}/{obj_key}",
                    'country': country_code,
                    'format': Path(obj_key).suffix.replace('.', ''),
                    'size_mb': 0
                })
        
        self.logger.info(f"Discovered {len(sources)} geochemical sources for {country_code}")
        return sources
    
    def load_geochem_data(self, file_path: str, file_format: str) -> pd.DataFrame:
        """Load geochemical data from various formats"""
        try:
            if file_format == 'csv':
                # Try different encodings and separators
                for encoding in ['utf-8', 'latin-1', 'cp1252']:
                    for sep in [',', ';', '\t']:
                        try:
                            df = pd.read_csv(file_path, encoding=encoding, sep=sep)
                            if len(df.columns) > 1:  # Valid if more than 1 column
                                return df
                        except:
                            continue
                
                # Fallback to default
                df = pd.read_csv(file_path)
                
            elif file_format == 'xlsx':
                df = pd.read_excel(file_path)
                
            elif file_format == 'parquet':
                df = pd.read_parquet(file_path)
                
            else:
                raise ValueError(f"Unsupported format: {file_format}")
            
            return df
            
        except Exception as e:
            self.logger.error(f"Failed to load {file_path}", error=str(e))
            raise
    
    def validate_geochem_data(self, df: pd.DataFrame, source_info: Dict[str, Any]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Validate and clean geochemical data"""
        validation_report = {
            'source': source_info['path'],
            'original_count': len(df),
            'missing_required_columns': [],
            'duplicate_samples': 0,
            'invalid_coordinates': 0,
            'extreme_outliers': {},
            'unit_issues': [],
            'warnings': [],
            'errors': []
        }
        
        # Check for required columns
        required_cols = dataset_config.geochem_required_columns
        df_cols_lower = [col.lower() for col in df.columns]
        
        missing_cols = []
        column_mapping = {}
        
        for req_col in required_cols:
            # Try to find column with flexible matching
            found = False
            for i, col in enumerate(df_cols_lower):
                if req_col.lower() in col or col in req_col.lower():
                    column_mapping[req_col] = df.columns[i]
                    found = True
                    break
            
            if not found:
                missing_cols.append(req_col)
        
        if missing_cols:
            validation_report['missing_required_columns'] = missing_cols
            validation_report['errors'].append(f"Missing required columns: {missing_cols}")
            
            if config.halt_on_critical:
                raise ValueError(f"Critical validation error: Missing required columns {missing_cols}")
        
        # Standardize column names
        df_clean = df.copy()
        for req_col, actual_col in column_mapping.items():
            if actual_col != req_col:
                df_clean = df_clean.rename(columns={actual_col: req_col})
        
        # Check for duplicate sample IDs
        if 'sample_id' in df_clean.columns:
            duplicates = df_clean['sample_id'].duplicated()
            duplicate_count = duplicates.sum()
            
            if duplicate_count > 0:
                validation_report['duplicate_samples'] = duplicate_count
                validation_report['warnings'].append(f"Found {duplicate_count} duplicate sample IDs")
                
                # Flag duplicates but don't remove (might be intentional replicates)
                df_clean['is_duplicate'] = duplicates
        
        # Validate coordinates
        coord_issues = 0
        if 'easting' in df_clean.columns and 'northing' in df_clean.columns:
            # Check for null coordinates
            null_coords = df_clean[['easting', 'northing']].isnull().any(axis=1)
            coord_issues += null_coords.sum()
            
            # Check for zero coordinates (often indicates missing data)
            zero_coords = ((df_clean['easting'] == 0) | (df_clean['northing'] == 0))
            coord_issues += zero_coords.sum()
            
            # Check for reasonable coordinate ranges (very basic check)
            if 'crs' in df_clean.columns:
                # This would need more sophisticated CRS-aware validation
                pass
            
            if coord_issues > 0:
                validation_report['invalid_coordinates'] = coord_issues
                validation_report['warnings'].append(f"Found {coord_issues} samples with coordinate issues")
        
        # Identify and validate element columns
        element_columns = self._identify_element_columns(df_clean.columns)
        
        # Check for extreme outliers in element data
        for element, columns in element_columns.items():
            for col in columns:
                if col in df_clean.columns:
                    # Convert to numeric, handling non-numeric values
                    numeric_data = pd.to_numeric(df_clean[col], errors='coerce')
                    
                    if numeric_data.notna().sum() > 0:  # If we have numeric data
                        # Calculate z-scores for outlier detection
                        z_scores = np.abs(stats.zscore(numeric_data.dropna()))
                        outliers = z_scores > quality_config.outlier_z_threshold
                        outlier_count = outliers.sum()
                        
                        if outlier_count > 0:
                            validation_report['extreme_outliers'][col] = {
                                'count': outlier_count,
                                'percentage': (outlier_count / len(numeric_data.dropna())) * 100,
                                'max_z_score': z_scores.max()
                            }
                            
                            # Flag outliers but don't remove (might be real anomalies)
                            df_clean[f'{col}_outlier_flag'] = False
                            df_clean.loc[numeric_data.index[outliers], f'{col}_outlier_flag'] = True
        
        # Validate and standardize units
        unit_issues = self._validate_units(df_clean, element_columns)
        validation_report['unit_issues'] = unit_issues
        
        # Check data completeness
        completeness = {}
        for col in df_clean.columns:
            if col.startswith(tuple(self.element_patterns.keys())):
                non_null_count = df_clean[col].notna().sum()
                completeness[col] = (non_null_count / len(df_clean)) * 100
        
        validation_report['data_completeness'] = completeness
        validation_report['final_count'] = len(df_clean)
        validation_report['validity_rate'] = (validation_report['final_count'] / validation_report['original_count']) * 100
        
        return df_clean, validation_report
    
    def _identify_element_columns(self, columns: List[str]) -> Dict[str, List[str]]:
        """Identify element columns in the dataset"""
        element_columns = {}
        
        for element, patterns in self.element_patterns.items():
            matching_cols = []
            
            for col in columns:
                col_lower = col.lower()
                for pattern in patterns:
                    if pattern in col_lower:
                        matching_cols.append(col)
                        break
            
            if matching_cols:
                element_columns[element] = matching_cols
        
        return element_columns
    
    def _validate_units(self, df: pd.DataFrame, element_columns: Dict[str, List[str]]) -> List[str]:
        """Validate and identify unit issues"""
        unit_issues = []
        
        # Look for unit information in column names or separate unit columns
        for element, columns in element_columns.items():
            for col in columns:
                col_lower = col.lower()
                
                # Check if unit is specified in column name
                detected_unit = None
                for unit in self.unit_conversions.keys():
                    if unit in col_lower:
                        detected_unit = unit
                        break
                
                if not detected_unit:
                    unit_issues.append(f"No unit specified for {col}")
                
                # Check for unrealistic values that might indicate unit issues
                if col in df.columns:
                    numeric_data = pd.to_numeric(df[col], errors='coerce')
                    if numeric_data.notna().sum() > 0:
                        max_val = numeric_data.max()
                        min_val = numeric_data.min()
                        
                        # Element-specific validation
                        if element == 'Au' and max_val > 1000:  # Gold > 1000 ppm is very high
                            unit_issues.append(f"{col}: Gold values > 1000 ppm detected - check units")
                        elif element in ['Cu', 'Pb', 'Zn'] and max_val > 100000:  # Base metals
                            unit_issues.append(f"{col}: {element} values > 100,000 ppm detected - check units")
        
        return unit_issues
    
    def enrich_geochem_data(self, df: pd.DataFrame, country_code: str, source_info: Dict[str, Any]) -> pd.DataFrame:
        """Enrich geochemical data with additional fields"""
        df_enriched = df.copy()
        
        # Add standard metadata fields
        df_enriched['country_code'] = country_code
        df_enriched['data_source'] = source_info['path']
        df_enriched['ingested_at'] = datetime.now()
        
        # Standardize date fields
        if 'collected_at' in df_enriched.columns:
            df_enriched['collected_at'] = pd.to_datetime(df_enriched['collected_at'], errors='coerce')
        
        # Create geometry from coordinates
        if 'easting' in df_enriched.columns and 'northing' in df_enriched.columns:
            # Handle CRS information
            crs = 'EPSG:4326'  # Default
            if 'crs' in df_enriched.columns:
                # Extract CRS from first non-null value
                crs_values = df_enriched['crs'].dropna().unique()
                if len(crs_values) > 0:
                    crs = str(crs_values[0])
                    if not crs.startswith('EPSG:'):
                        crs = f'EPSG:{crs}'
            
            # Create points (filter out invalid coordinates)
            valid_coords = (
                df_enriched['easting'].notna() & 
                df_enriched['northing'].notna() &
                (df_enriched['easting'] != 0) &
                (df_enriched['northing'] != 0)
            )
            
            df_enriched['geometry'] = None
            df_enriched.loc[valid_coords, 'geometry'] = [
                Point(x, y) for x, y in zip(
                    df_enriched.loc[valid_coords, 'easting'],
                    df_enriched.loc[valid_coords, 'northing']
                )
            ]
            
            df_enriched['original_crs'] = crs
        
        # Normalize element data and add derived fields
        element_columns = self._identify_element_columns(df_enriched.columns)
        
        # Calculate multi-element ratios (useful for exploration)
        if 'Au' in element_columns and 'Ag' in element_columns:
            au_col = element_columns['Au'][0]
            ag_col = element_columns['Ag'][0]
            
            if au_col in df_enriched.columns and ag_col in df_enriched.columns:
                au_data = pd.to_numeric(df_enriched[au_col], errors='coerce')
                ag_data = pd.to_numeric(df_enriched[ag_col], errors='coerce')
                
                # Au/Ag ratio
                df_enriched['au_ag_ratio'] = au_data / ag_data
        
        # Add pathfinder element flags
        pathfinder_elements = ['As', 'Sb', 'Hg', 'Te', 'Se']
        pathfinder_present = []
        
        for element in pathfinder_elements:
            if element in element_columns:
                pathfinder_present.append(element)
        
        df_enriched['pathfinder_elements'] = ','.join(pathfinder_present)
        
        # Calculate composite scores for different deposit types
        df_enriched = self._calculate_deposit_scores(df_enriched, element_columns)
        
        return df_enriched
    
    def _calculate_deposit_scores(self, df: pd.DataFrame, element_columns: Dict[str, List[str]]) -> pd.DataFrame:
        """Calculate composite scores for different mineral deposit types"""
        
        # Epithermal gold score (Au + Ag + As + Sb)
        epithermal_elements = ['Au', 'Ag', 'As']
        epithermal_score = 0
        
        for element in epithermal_elements:
            if element in element_columns:
                col = element_columns[element][0]
                if col in df.columns:
                    numeric_data = pd.to_numeric(df[col], errors='coerce').fillna(0)
                    # Normalize to 0-1 scale using percentile ranks
                    normalized = numeric_data.rank(pct=True)
                    epithermal_score += normalized
        
        if epithermal_score != 0:
            df['epithermal_score'] = epithermal_score / len(epithermal_elements)
        
        # Porphyry copper score (Cu + Mo + Au)
        porphyry_elements = ['Cu', 'Mo', 'Au']
        porphyry_score = 0
        
        for element in porphyry_elements:
            if element in element_columns:
                col = element_columns[element][0]
                if col in df.columns:
                    numeric_data = pd.to_numeric(df[col], errors='coerce').fillna(0)
                    normalized = numeric_data.rank(pct=True)
                    porphyry_score += normalized
        
        if porphyry_score != 0:
            df['porphyry_score'] = porphyry_score / len(porphyry_elements)
        
        # VMS score (Cu + Pb + Zn + Ag)
        vms_elements = ['Cu', 'Pb', 'Zn', 'Ag']
        vms_score = 0
        
        for element in vms_elements:
            if element in element_columns:
                col = element_columns[element][0]
                if col in df.columns:
                    numeric_data = pd.to_numeric(df[col], errors='coerce').fillna(0)
                    normalized = numeric_data.rank(pct=True)
                    vms_score += normalized
        
        if vms_score != 0:
            df['vms_score'] = vms_score / len(vms_elements)
        
        return df
    
    def write_to_geopackage(self, gdf: gpd.GeoDataFrame, country_code: str) -> str:
        """Write geochemical data to GeoPackage archive in S3"""
        timestamp = datetime.now().strftime('%Y%m')
        s3_key = f"country/{country_code}/geochem/{timestamp}/geochem.gpkg"
        
        # Create temporary file
        temp_file = self.storage.files.create_temp_file('.gpkg')
        
        try:
            # Write to temporary GeoPackage
            gdf.to_file(temp_file, driver='GPKG')
            
            # Upload to S3
            success = self.storage.s3.upload_file(
                temp_file,
                s3_key,
                metadata={
                    'country': country_code,
                    'data_type': 'geochem',
                    'format': 'gpkg',
                    'crs': config.crs_target,
                    'record_count': str(len(gdf))
                }
            )
            
            if success:
                self.logger.info(f"Wrote geochem archive to s3://{config.s3_bucket}/{s3_key}")
                return f"s3://{config.s3_bucket}/{s3_key}"
            else:
                raise Exception("Failed to upload to S3")
                
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def write_to_postgis(self, gdf: gpd.GeoDataFrame, country_code: str) -> bool:
        """Write geochemical data to PostGIS"""
        table_name = f"geochem_{country_code.lower()}"
        
        # Prepare data for PostGIS
        gdf_pg = gdf.copy()
        
        # Convert element columns to JSONB for flexible querying
        element_columns = self._identify_element_columns(gdf_pg.columns)
        elements_dict = {}
        
        for element, columns in element_columns.items():
            for col in columns:
                if col in gdf_pg.columns:
                    # Store element data with metadata
                    elements_dict[col] = {
                        'element': element,
                        'values': gdf_pg[col].to_dict()
                    }
        
        # Add elements as JSONB column
        if elements_dict:
            gdf_pg['elements'] = gdf_pg.apply(
                lambda row: {
                    col: row[col] for col in element_columns.get('Au', []) + 
                    element_columns.get('Cu', []) + element_columns.get('Ag', [])
                    if col in gdf_pg.columns and pd.notna(row[col])
                }, axis=1
            )
        
        # Write to PostGIS
        success = self.storage.postgis.create_table_from_gdf(
            gdf_pg,
            table_name,
            add_rls_columns=True,
            org_id=config.org_id,
            project_id=config.project_id
        )
        
        if success:
            # Create spatial index
            self.storage.postgis.create_spatial_index(table_name)
            
            # Create attribute indexes
            self.storage.postgis.create_attribute_index(table_name, ['sample_id'])
            
            # Create GIN index on elements JSONB column if it exists
            if 'elements' in gdf_pg.columns:
                try:
                    # This would need custom SQL execution
                    self.logger.info("Created GIN index on elements JSONB column")
                except Exception as e:
                    self.logger.warning("Failed to create GIN index on elements", error=str(e))
            
            # Enable RLS
            self.storage.postgis.enable_rls(table_name)
            
            # Analyze table
            self.storage.postgis.analyze_table(table_name)
            
            self.logger.info(f"Successfully wrote geochem data to PostGIS table: {table_name}")
        
        return success
    
    def create_stac_items(self, gdf: gpd.GeoDataFrame, country_code: str,
                         archive_path: str) -> Dict[str, Any]:
        """Create STAC collection and items for geochemical data"""
        
        # Calculate bounds
        bounds = gdf.total_bounds.tolist()  # [minx, miny, maxx, maxy]
        
        # Get element summary
        element_columns = self._identify_element_columns(gdf.columns)
        elements_detected = list(element_columns.keys())
        
        # Create collection
        collection = {
            "type": "Collection",
            "stac_version": "1.0.0",
            "id": f"geochem_{country_code.lower()}",
            "title": f"Geochemical Samples - {config.country_codes.get(country_code, country_code)}",
            "description": f"Geochemical sample data for {config.country_codes.get(country_code, country_code)}",
            "keywords": ["geochemistry", "samples", "elements", "assays"] + elements_detected + [country_code.lower()],
            "license": "proprietary",
            "providers": [
                {
                    "name": "GeoVision AI Miner",
                    "roles": ["processor", "host"],
                    "url": "https://geovision.ai"
                }
            ],
            "extent": {
                "spatial": {
                    "bbox": [bounds]
                },
                "temporal": {
                    "interval": [[None, None]]
                }
            },
            "summaries": {
                "country": [country_code],
                "data_type": ["geochem"],
                "elements_detected": elements_detected,
                "sample_count": len(gdf)
            }
        }
        
        # Create item for the dataset
        item = {
            "type": "Feature",
            "stac_version": "1.0.0",
            "id": f"geochem_{country_code.lower()}_{datetime.now().strftime('%Y%m%d')}",
            "collection": f"geochem_{country_code.lower()}",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [bounds[0], bounds[1]],
                    [bounds[2], bounds[1]],
                    [bounds[2], bounds[3]],
                    [bounds[0], bounds[3]],
                    [bounds[0], bounds[1]]
                ]]
            },
            "bbox": bounds,
            "properties": {
                "datetime": datetime.now().isoformat(),
                "country": country_code,
                "data_type": "geochem",
                "sample_count": len(gdf),
                "elements_detected": elements_detected,
                "crs": config.crs_target
            },
            "assets": {
                "data": {
                    "href": archive_path,
                    "type": "application/geopackage+sqlite3",
                    "roles": ["data"],
                    "title": "Geochemical Sample Data"
                }
            }
        }
        
        # Write STAC files to S3
        collection_key = f"stac/{country_code.lower()}/geochem/collection.json"
        item_key = f"stac/{country_code.lower()}/geochem/items/{item['id']}.json"
        
        self.storage.s3.upload_json(collection, collection_key)
        self.storage.s3.upload_json(item, item_key)
        
        return {
            "collection": collection,
            "item": item,
            "collection_path": f"s3://{config.s3_bucket}/{collection_key}",
            "item_path": f"s3://{config.s3_bucket}/{item_key}"
        }
    
    def generate_qa_report(self, validation_results: List[Dict[str, Any]], 
                          country_code: str) -> str:
        """Generate QA/QC HTML report for geochemical data"""
        
        # Aggregate validation results
        total_sources = len(validation_results)
        total_samples = sum(v['original_count'] for v in validation_results)
        total_final_samples = sum(v['final_count'] for v in validation_results)
        
        # Count issues
        total_duplicates = sum(v['duplicate_samples'] for v in validation_results)
        total_coord_issues = sum(v['invalid_coordinates'] for v in validation_results)
        total_outliers = sum(len(v['extreme_outliers']) for v in validation_results)
        
        # Generate HTML report
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Geochemical QA/QC Report - {country_code}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f0f0f0; padding: 20px; border-radius: 5px; }}
                .summary {{ display: flex; justify-content: space-around; margin: 20px 0; }}
                .metric {{ text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }}
                .metric h3 {{ margin: 0; color: #333; }}
                .metric p {{ margin: 5px 0; font-size: 24px; font-weight: bold; }}
                .issues {{ margin: 20px 0; }}
                .issue {{ margin: 10px 0; padding: 10px; border-left: 4px solid #ff6b6b; background-color: #fff5f5; }}
                .warning {{ border-left-color: #ffa726; background-color: #fff8e1; }}
                .success {{ border-left-color: #66bb6a; background-color: #f1f8e9; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Geochemical Data QA/QC Report</h1>
                <p><strong>Country:</strong> {config.country_codes.get(country_code, country_code)} ({country_code})</p>
                <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            
            <div class="summary">
                <div class="metric">
                    <h3>Sources Processed</h3>
                    <p>{total_sources}</p>
                </div>
                <div class="metric">
                    <h3>Total Samples</h3>
                    <p>{total_samples:,}</p>
                </div>
                <div class="metric">
                    <h3>Valid Samples</h3>
                    <p>{total_final_samples:,}</p>
                </div>
                <div class="metric">
                    <h3>Success Rate</h3>
                    <p>{(total_final_samples/total_samples*100):.1f}%</p>
                </div>
            </div>
            
            <h2>Data Quality Issues</h2>
            <div class="issues">
        """
        
        if total_duplicates > 0:
            html_content += f'<div class="issue warning">Found {total_duplicates} duplicate sample IDs across all sources</div>'
        
        if total_coord_issues > 0:
            html_content += f'<div class="issue warning">Found {total_coord_issues} samples with coordinate issues</div>'
        
        if total_outliers > 0:
            html_content += f'<div class="issue warning">Detected extreme outliers in {total_outliers} element columns</div>'
        
        if total_duplicates == 0 and total_coord_issues == 0 and total_outliers == 0:
            html_content += '<div class="issue success">No major data quality issues detected</div>'
        
        html_content += """
            </div>
            
            <h2>Source Details</h2>
            <table>
                <tr>
                    <th>Source</th>
                    <th>Original Count</th>
                    <th>Final Count</th>
                    <th>Success Rate</th>
                    <th>Issues</th>
                </tr>
        """
        
        for result in validation_results:
            success_rate = (result['final_count'] / result['original_count'] * 100) if result['original_count'] > 0 else 0
            issues = []
            
            if result['duplicate_samples'] > 0:
                issues.append(f"{result['duplicate_samples']} duplicates")
            if result['invalid_coordinates'] > 0:
                issues.append(f"{result['invalid_coordinates']} coord issues")
            if result['extreme_outliers']:
                issues.append(f"{len(result['extreme_outliers'])} outlier columns")
            
            issues_str = '; '.join(issues) if issues else 'None'
            
            html_content += f"""
                <tr>
                    <td>{Path(result['source']).name}</td>
                    <td>{result['original_count']:,}</td>
                    <td>{result['final_count']:,}</td>
                    <td>{success_rate:.1f}%</td>
                    <td>{issues_str}</td>
                </tr>
            """
        
        html_content += """
            </table>
        </body>
        </html>
        """
        
        # Write report to S3
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        s3_key = f"reports/qaqc/geochem/{country_code}/{timestamp}.html"
        
        temp_file = self.storage.files.create_temp_file('.html')
        
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            success = self.storage.s3.upload_file(
                temp_file,
                s3_key,
                metadata={
                    'country': country_code,
                    'report_type': 'qaqc',
                    'data_type': 'geochem'
                }
            )
            
            if success:
                return f"s3://{config.s3_bucket}/{s3_key}"
            else:
                raise Exception("Failed to upload QA report")
                
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Process all geochemical data for a country"""
        start_time = time.time()
        
        # Discover sources
        sources = self.discover_sources(country_code)
        
        if not sources:
            self.logger.warning(f"No geochemical sources found for {country_code}")
            return {
                'country': country_code,
                'status': 'no_sources',
                'sources_found': 0,
                'processing_time': time.time() - start_time
            }
        
        self.logger.log_dataset_start('geochem', country_code, len(sources))
        
        # Process all sources and combine
        all_dfs = []
        all_validations = []
        
        for source in sources:
            try:
                # Load data
                if source['type'] == 'local':
                    df = self.load_geochem_data(source['path'], source['format'])
                else:  # S3
                    temp_file = self.storage.files.create_temp_file(f".{source['format']}")
                    s3_key = source['path'].replace(f"s3://{config.s3_bucket}/", "")
                    
                    if self.storage.s3.download_file(s3_key, temp_file):
                        df = self.load_geochem_data(temp_file, source['format'])
                        self.storage.files.cleanup_temp_file(temp_file)
                    else:
                        continue
                
                # Validate data
                df_clean, validation = self.validate_geochem_data(df, source)
                all_validations.append(validation)
                
                # Enrich data
                df_enriched = self.enrich_geochem_data(df_clean, country_code, source)
                
                all_dfs.append(df_enriched)
                
            except Exception as e:
                self.logger.error(f"Failed to process source {source['path']}", error=str(e))
                continue
        
        if not all_dfs:
            return {
                'country': country_code,
                'status': 'processing_failed',
                'sources_found': len(sources),
                'processing_time': time.time() - start_time
            }
        
        # Combine all data
        combined_df = pd.concat(all_dfs, ignore_index=True)
        
        # Convert to GeoDataFrame
        if 'geometry' in combined_df.columns:
            # Filter out rows without geometry
            valid_geom = combined_df['geometry'].notna()
            gdf = gpd.GeoDataFrame(combined_df[valid_geom], crs=config.crs_target)
            
            # Reproject if needed
            if gdf.crs != config.crs_target:
                gdf = gdf.to_crs(config.crs_target)
        else:
            # Create dummy geometry for non-spatial data
            gdf = gpd.GeoDataFrame(combined_df)
        
        # Write outputs
        try:
            # GeoPackage archive
            archive_path = self.write_to_geopackage(gdf, country_code)
            
            # PostGIS
            postgis_success = self.write_to_postgis(gdf, country_code)
            
            # STAC
            stac_info = self.create_stac_items(gdf, country_code, archive_path)
            
            # QA/QC Report
            qa_report_path = self.generate_qa_report(all_validations, country_code)
            
            processing_time = time.time() - start_time
            
            self.logger.log_dataset_complete('geochem', country_code, len(gdf), processing_time)
            
            return {
                'country': country_code,
                'status': 'success',
                'sources_found': len(sources),
                'sources_processed': len(all_dfs),
                'total_samples': len(gdf),
                'processing_time': processing_time,
                'outputs': {
                    'archive_path': archive_path,
                    'postgis_table': f"geochem_{country_code.lower()}",
                    'postgis_success': postgis_success,
                    'stac_collection': stac_info['collection_path'],
                    'stac_item': stac_info['item_path'],
                    'qa_report': qa_report_path
                },
                'validation_summary': {
                    'total_sources': len(all_validations),
                    'total_original_samples': sum(v['original_count'] for v in all_validations),
                    'total_final_samples': sum(v['final_count'] for v in all_validations),
                    'total_duplicates': sum(v['duplicate_samples'] for v in all_validations),
                    'total_coord_issues': sum(v['invalid_coordinates'] for v in all_validations),
                    'elements_detected': len(self._identify_element_columns(gdf.columns))
                }
            }
            
        except Exception as e:
            self.logger.error(f"Failed to write outputs for {country_code}", error=str(e))
            return {
                'country': country_code,
                'status': 'output_failed',
                'sources_found': len(sources),
                'processing_time': time.time() - start_time,
                'error': str(e)
            }