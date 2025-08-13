"""
Drillhole Data Processor
Handles drillhole collar, survey, interval, and assay data for 3D geological modeling
"""

import os
import time
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, LineString
import numpy as np
from scipy.spatial.transform import Rotation
import tempfile

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, dataset_config, quality_config

class DrillholeProcessor:
    """Processes drillhole data for ingestion pipeline"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('drillhole_processor')
        self.processed_files = []
        self.validation_results = {}
        
        # Required table schemas
        self.required_schemas = {
            'collars': {
                'required_columns': ['hole_id', 'easting', 'northing', 'elevation', 'crs', 'start_date'],
                'optional_columns': ['end_date', 'total_depth', 'azimuth', 'dip', 'project', 'drill_type', 'contractor']
            },
            'surveys': {
                'required_columns': ['hole_id', 'depth', 'azimuth', 'dip'],
                'optional_columns': ['method', 'survey_date', 'quality_code']
            },
            'intervals': {
                'required_columns': ['hole_id', 'from_m', 'to_m', 'lith_code'],
                'optional_columns': ['description', 'alteration', 'mineralization', 'recovery', 'rqd']
            },
            'assays': {
                'required_columns': ['hole_id', 'from_m', 'to_m', 'element', 'value', 'units'],
                'optional_columns': ['method', 'lab', 'batch', 'detection_limit', 'quality_code']
            }
        }
        
        # Common unit conversions
        self.unit_conversions = {
            'percent': 10000,  # to ppm
            '%': 10000,
            'ppm': 1,
            'ppb': 0.001,
            'g/t': 1,
            'oz/t': 34.2857,
            'mg/kg': 1
        }
        
        # Lithology code standardization
        self.lithology_mapping = {
            'granite': 'GR', 'granodiorite': 'GD', 'diorite': 'DI', 'gabbro': 'GB',
            'basalt': 'BA', 'andesite': 'AN', 'rhyolite': 'RH', 'dacite': 'DA',
            'sandstone': 'SS', 'shale': 'SH', 'limestone': 'LS', 'dolomite': 'DO',
            'quartzite': 'QZ', 'schist': 'SC', 'gneiss': 'GN', 'slate': 'SL',
            'ore': 'ORE', 'vein': 'VN', 'breccia': 'BR', 'fault': 'FT'
        }
    
    def discover_sources(self, country_code: str) -> List[Dict[str, Any]]:
        """Discover drillhole data sources for a country"""
        sources = []
        
        # Local sources
        local_pattern = dataset_config.drill_sources['local'].format(
            LOCAL_DIR=os.getenv('LOCAL_DIR', './data'),
            country=country_code.lower()
        )
        
        for ext in dataset_config.drill_extensions:
            pattern = f"{local_pattern}{ext}"
            local_files = self.storage.files.find_files(pattern)
            
            for file_path in local_files:
                # Determine table type from filename
                table_type = self._determine_table_type(str(file_path))
                
                sources.append({
                    'type': 'local',
                    'path': str(file_path),
                    'country': country_code,
                    'table_type': table_type,
                    'format': ext.replace('.', ''),
                    'size_mb': self.storage.files.get_file_size_mb(file_path)
                })
        
        # S3 sources
        s3_prefix = dataset_config.drill_sources['s3'].format(
            S3_BUCKET=config.s3_bucket,
            country=country_code.lower()
        ).replace(f"{config.s3_bucket}/", "")
        
        s3_objects = self.storage.s3.list_objects(s3_prefix)
        
        for obj_key in s3_objects:
            if any(obj_key.endswith(ext) for ext in dataset_config.drill_extensions):
                table_type = self._determine_table_type(obj_key)
                
                sources.append({
                    'type': 's3',
                    'path': f"s3://{config.s3_bucket}/{obj_key}",
                    'country': country_code,
                    'table_type': table_type,
                    'format': Path(obj_key).suffix.replace('.', ''),
                    'size_mb': 0
                })
        
        self.logger.info(f"Discovered {len(sources)} drillhole sources for {country_code}")
        return sources
    
    def _determine_table_type(self, file_path: str) -> str:
        """Determine drillhole table type from filename"""
        filename_lower = file_path.lower()
        
        if any(keyword in filename_lower for keyword in ['collar', 'hole']):
            return 'collars'
        elif any(keyword in filename_lower for keyword in ['survey', 'deviation']):
            return 'surveys'
        elif any(keyword in filename_lower for keyword in ['interval', 'lithology', 'geology', 'lith']):
            return 'intervals'
        elif any(keyword in filename_lower for keyword in ['assay', 'sample', 'geochemistry', 'analysis']):
            return 'assays'
        else:
            return 'unknown'
    
    def load_drillhole_data(self, file_path: str, file_format: str) -> pd.DataFrame:
        """Load drillhole data from various formats"""
        try:
            if file_format == 'csv':
                # Try different encodings and separators
                for encoding in ['utf-8', 'latin-1', 'cp1252']:
                    for sep in [',', ';', '\t']:
                        try:
                            df = pd.read_csv(file_path, encoding=encoding, sep=sep)
                            if len(df.columns) > 1:
                                return df
                        except:
                            continue
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
    
    def validate_drillhole_data(self, df: pd.DataFrame, table_type: str, 
                               source_info: Dict[str, Any]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Validate drillhole data based on table type"""
        validation_report = {
            'source': source_info['path'],
            'table_type': table_type,
            'original_count': len(df),
            'missing_required_columns': [],
            'data_quality_issues': [],
            'warnings': [],
            'errors': []
        }
        
        if table_type not in self.required_schemas:
            validation_report['errors'].append(f"Unknown table type: {table_type}")
            if config.halt_on_critical:
                raise ValueError(f"Unknown table type: {table_type}")
            return df, validation_report
        
        schema = self.required_schemas[table_type]
        
        # Check for required columns
        df_cols_lower = [col.lower() for col in df.columns]
        missing_cols = []
        column_mapping = {}
        
        for req_col in schema['required_columns']:
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
                raise ValueError(f"Missing required columns: {missing_cols}")
        
        # Standardize column names
        df_clean = df.copy()
        for req_col, actual_col in column_mapping.items():
            if actual_col != req_col:
                df_clean = df_clean.rename(columns={actual_col: req_col})
        
        # Table-specific validation
        if table_type == 'collars':
            df_clean, collar_issues = self._validate_collars(df_clean)
            validation_report['data_quality_issues'].extend(collar_issues)
            
        elif table_type == 'surveys':
            df_clean, survey_issues = self._validate_surveys(df_clean)
            validation_report['data_quality_issues'].extend(survey_issues)
            
        elif table_type == 'intervals':
            df_clean, interval_issues = self._validate_intervals(df_clean)
            validation_report['data_quality_issues'].extend(interval_issues)
            
        elif table_type == 'assays':
            df_clean, assay_issues = self._validate_assays(df_clean)
            validation_report['data_quality_issues'].extend(assay_issues)
        
        validation_report['final_count'] = len(df_clean)
        validation_report['validity_rate'] = (validation_report['final_count'] / validation_report['original_count']) * 100
        
        return df_clean, validation_report
    
    def _validate_collars(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate collar data"""
        issues = []
        
        # Check for null coordinates
        null_coords = df[['easting', 'northing', 'elevation']].isnull().any(axis=1)
        if null_coords.sum() > 0:
            issues.append(f"Found {null_coords.sum()} collars with null coordinates")
        
        # Check for duplicate hole IDs
        duplicates = df['hole_id'].duplicated()
        if duplicates.sum() > 0:
            issues.append(f"Found {duplicates.sum()} duplicate hole IDs")
            df['is_duplicate'] = duplicates
        
        # Validate coordinate ranges (basic check)
        if 'easting' in df.columns and 'northing' in df.columns:
            invalid_coords = (
                (df['easting'] < -180) | (df['easting'] > 180) |
                (df['northing'] < -90) | (df['northing'] > 90)
            )
            if invalid_coords.sum() > 0:
                issues.append(f"Found {invalid_coords.sum()} collars with invalid coordinates")
        
        # Validate elevation (reasonable range check)
        if 'elevation' in df.columns:
            extreme_elevations = (df['elevation'] < -500) | (df['elevation'] > 9000)
            if extreme_elevations.sum() > 0:
                issues.append(f"Found {extreme_elevations.sum()} collars with extreme elevations")
        
        # Validate dates
        if 'start_date' in df.columns:
            df['start_date'] = pd.to_datetime(df['start_date'], errors='coerce')
            invalid_dates = df['start_date'].isnull()
            if invalid_dates.sum() > 0:
                issues.append(f"Found {invalid_dates.sum()} collars with invalid start dates")
        
        return df, issues
    
    def _validate_surveys(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate survey data"""
        issues = []
        
        # Check depth sequence
        if 'depth' in df.columns:
            negative_depths = df['depth'] < 0
            if negative_depths.sum() > 0:
                issues.append(f"Found {negative_depths.sum()} survey records with negative depths")
        
        # Validate azimuth range (0-360)
        if 'azimuth' in df.columns:
            invalid_azimuth = (df['azimuth'] < 0) | (df['azimuth'] > 360)
            if invalid_azimuth.sum() > 0:
                issues.append(f"Found {invalid_azimuth.sum()} survey records with invalid azimuth")
                # Normalize azimuth to 0-360 range
                df.loc[df['azimuth'] < 0, 'azimuth'] += 360
                df.loc[df['azimuth'] > 360, 'azimuth'] %= 360
        
        # Validate dip range (-90 to +90)
        if 'dip' in df.columns:
            invalid_dip = (df['dip'] < -90) | (df['dip'] > 90)
            if invalid_dip.sum() > 0:
                issues.append(f"Found {invalid_dip.sum()} survey records with invalid dip")
        
        # Check for survey continuity per hole
        if 'hole_id' in df.columns and 'depth' in df.columns:
            for hole_id in df['hole_id'].unique():
                hole_surveys = df[df['hole_id'] == hole_id].sort_values('depth')
                
                # Check for depth gaps > 50m
                depth_diffs = hole_surveys['depth'].diff()
                large_gaps = depth_diffs > 50
                if large_gaps.sum() > 0:
                    issues.append(f"Hole {hole_id}: Found {large_gaps.sum()} large survey gaps (>50m)")
        
        return df, issues
    
    def _validate_intervals(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate interval data"""
        issues = []
        
        # Check depth logic (from < to)
        if 'from_m' in df.columns and 'to_m' in df.columns:
            invalid_depths = df['from_m'] >= df['to_m']
            if invalid_depths.sum() > 0:
                issues.append(f"Found {invalid_depths.sum()} intervals where from_m >= to_m")
        
        # Check for overlapping intervals per hole
        if all(col in df.columns for col in ['hole_id', 'from_m', 'to_m']):
            for hole_id in df['hole_id'].unique():
                hole_intervals = df[df['hole_id'] == hole_id].sort_values('from_m')
                
                # Check for overlaps
                overlaps = 0
                for i in range(len(hole_intervals) - 1):
                    current_to = hole_intervals.iloc[i]['to_m']
                    next_from = hole_intervals.iloc[i + 1]['from_m']
                    
                    if current_to > next_from:
                        overlaps += 1
                
                if overlaps > 0:
                    issues.append(f"Hole {hole_id}: Found {overlaps} overlapping intervals")
        
        # Standardize lithology codes
        if 'lith_code' in df.columns:
            df['lith_code_original'] = df['lith_code']
            df['lith_code'] = df['lith_code'].apply(self._standardize_lithology)
        
        return df, issues
    
    def _validate_assays(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate assay data"""
        issues = []
        
        # Check depth logic
        if 'from_m' in df.columns and 'to_m' in df.columns:
            invalid_depths = df['from_m'] >= df['to_m']
            if invalid_depths.sum() > 0:
                issues.append(f"Found {invalid_depths.sum()} assay intervals where from_m >= to_m")
        
        # Validate numeric values
        if 'value' in df.columns:
            non_numeric = pd.to_numeric(df['value'], errors='coerce').isnull()
            if non_numeric.sum() > 0:
                issues.append(f"Found {non_numeric.sum()} non-numeric assay values")
            
            # Check for negative values (might be valid for some elements)
            numeric_values = pd.to_numeric(df['value'], errors='coerce')
            negative_values = numeric_values < 0
            if negative_values.sum() > 0:
                issues.append(f"Found {negative_values.sum()} negative assay values")
        
        # Standardize element names
        if 'element' in df.columns:
            df['element_original'] = df['element']
            df['element'] = df['element'].apply(self._standardize_element_name)
        
        # Standardize units
        if 'units' in df.columns:
            df['units_original'] = df['units']
            df['units'] = df['units'].apply(self._standardize_units)
        
        # Check for detection limits
        if 'value' in df.columns and 'detection_limit' in df.columns:
            below_detection = pd.to_numeric(df['value'], errors='coerce') < pd.to_numeric(df['detection_limit'], errors='coerce')
            if below_detection.sum() > 0:
                issues.append(f"Found {below_detection.sum()} values below detection limit")
        
        return df, issues
    
    def _standardize_lithology(self, lith_code: str) -> str:
        """Standardize lithology codes"""
        if pd.isna(lith_code):
            return lith_code
        
        lith_lower = str(lith_code).lower().strip()
        
        for full_name, code in self.lithology_mapping.items():
            if full_name in lith_lower:
                return code
        
        # Return original if no mapping found
        return str(lith_code).upper()
    
    def _standardize_element_name(self, element: str) -> str:
        """Standardize element names"""
        if pd.isna(element):
            return element
        
        element_clean = str(element).strip().upper()
        
        # Common element mappings
        element_mapping = {
            'GOLD': 'Au', 'COPPER': 'Cu', 'SILVER': 'Ag', 'LEAD': 'Pb',
            'ZINC': 'Zn', 'IRON': 'Fe', 'ARSENIC': 'As', 'NICKEL': 'Ni',
            'COBALT': 'Co', 'CHROMIUM': 'Cr', 'MOLYBDENUM': 'Mo',
            'TUNGSTEN': 'W', 'TIN': 'Sn', 'URANIUM': 'U', 'THORIUM': 'Th'
        }
        
        return element_mapping.get(element_clean, element_clean)
    
    def _standardize_units(self, units: str) -> str:
        """Standardize measurement units"""
        if pd.isna(units):
            return units
        
        units_clean = str(units).lower().strip()
        
        # Common unit mappings
        unit_mapping = {
            'percent': '%', 'pct': '%', 'pc': '%',
            'parts per million': 'ppm', 'parts_per_million': 'ppm',
            'parts per billion': 'ppb', 'parts_per_billion': 'ppb',
            'grams per tonne': 'g/t', 'grams_per_tonne': 'g/t', 'gt': 'g/t',
            'ounces per ton': 'oz/t', 'ounces_per_ton': 'oz/t',
            'milligrams per kilogram': 'mg/kg', 'mg_per_kg': 'mg/kg'
        }
        
        return unit_mapping.get(units_clean, units_clean)
    
    def enrich_drillhole_data(self, df: pd.DataFrame, table_type: str, 
                             country_code: str, source_info: Dict[str, Any]) -> pd.DataFrame:
        """Enrich drillhole data with additional fields"""
        df_enriched = df.copy()
        
        # Add standard metadata
        df_enriched['country_code'] = country_code
        df_enriched['data_source'] = source_info['path']
        df_enriched['ingested_at'] = datetime.now()
        
        # Table-specific enrichment
        if table_type == 'collars':
            df_enriched = self._enrich_collars(df_enriched, country_code)
        elif table_type == 'surveys':
            df_enriched = self._enrich_surveys(df_enriched)
        elif table_type == 'intervals':
            df_enriched = self._enrich_intervals(df_enriched)
        elif table_type == 'assays':
            df_enriched = self._enrich_assays(df_enriched)
        
        return df_enriched
    
    def _enrich_collars(self, df: pd.DataFrame, country_code: str) -> pd.DataFrame:
        """Enrich collar data"""
        # Create geometry from coordinates
        if all(col in df.columns for col in ['easting', 'northing']):
            # Handle CRS
            crs = 'EPSG:4326'
            if 'crs' in df.columns:
                crs_values = df['crs'].dropna().unique()
                if len(crs_values) > 0:
                    crs = str(crs_values[0])
                    if not crs.startswith('EPSG:'):
                        crs = f'EPSG:{crs}'
            
            # Create points
            valid_coords = (
                df['easting'].notna() & df['northing'].notna() &
                (df['easting'] != 0) & (df['northing'] != 0)
            )
            
            df['geometry'] = None
            df.loc[valid_coords, 'geometry'] = [
                Point(x, y, z) for x, y, z in zip(
                    df.loc[valid_coords, 'easting'],
                    df.loc[valid_coords, 'northing'],
                    df.loc[valid_coords, 'elevation'].fillna(0)
                )
            ]
            
            df['original_crs'] = crs
        
        # Calculate drilling statistics
        if 'total_depth' in df.columns:
            df['depth_category'] = pd.cut(
                df['total_depth'],
                bins=[0, 100, 300, 500, 1000, float('inf')],
                labels=['Shallow', 'Medium', 'Deep', 'Very Deep', 'Ultra Deep']
            )
        
        # Add drilling year
        if 'start_date' in df.columns:
            df['drill_year'] = pd.to_datetime(df['start_date'], errors='coerce').dt.year
        
        return df
    
    def _enrich_surveys(self, df: pd.DataFrame) -> pd.DataFrame:
        """Enrich survey data"""
        # Calculate survey quality metrics
        if all(col in df.columns for col in ['hole_id', 'depth', 'azimuth', 'dip']):
            # Calculate survey intervals
            df = df.sort_values(['hole_id', 'depth'])
            df['survey_interval'] = df.groupby('hole_id')['depth'].diff()
            
            # Calculate deviation rates
            df['azimuth_change'] = df.groupby('hole_id')['azimuth'].diff()
            df['dip_change'] = df.groupby('hole_id')['dip'].diff()
            
            # Flag high deviation rates
            df['high_deviation'] = (
                (abs(df['azimuth_change']) > 10) |  # >10 degrees per interval
                (abs(df['dip_change']) > 5)         # >5 degrees per interval
            )
        
        return df
    
    def _enrich_intervals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Enrich interval data"""
        # Calculate interval lengths
        if 'from_m' in df.columns and 'to_m' in df.columns:
            df['interval_length'] = df['to_m'] - df['from_m']
        
        # Add lithology groups
        if 'lith_code' in df.columns:
            df['lith_group'] = df['lith_code'].apply(self._get_lithology_group)
        
        # Calculate recovery statistics
        if 'recovery' in df.columns:
            df['recovery_category'] = pd.cut(
                df['recovery'],
                bins=[0, 50, 80, 95, 100],
                labels=['Poor', 'Fair', 'Good', 'Excellent']
            )
        
        return df
    
    def _enrich_assays(self, df: pd.DataFrame) -> pd.DataFrame:
        """Enrich assay data"""
        # Calculate interval lengths
        if 'from_m' in df.columns and 'to_m' in df.columns:
            df['sample_length'] = df['to_m'] - df['from_m']
        
        # Convert values to standard units (ppm)
        if all(col in df.columns for col in ['value', 'units', 'element']):
            df['value_ppm'] = df.apply(self._convert_to_ppm, axis=1)
        
        # Add grade categories
        if 'value_ppm' in df.columns and 'element' in df.columns:
            df['grade_category'] = df.apply(self._categorize_grade, axis=1)
        
        # Calculate composite grades (length-weighted averages would be done later)
        if 'value_ppm' in df.columns and 'sample_length' in df.columns:
            df['grade_x_length'] = df['value_ppm'] * df['sample_length']
        
        return df
    
    def _get_lithology_group(self, lith_code: str) -> str:
        """Get lithology group from code"""
        if pd.isna(lith_code):
            return 'Unknown'
        
        code = str(lith_code).upper()
        
        igneous = ['GR', 'GD', 'DI', 'GB', 'BA', 'AN', 'RH', 'DA']
        sedimentary = ['SS', 'SH', 'LS', 'DO']
        metamorphic = ['QZ', 'SC', 'GN', 'SL']
        ore_related = ['ORE', 'VN', 'BR']
        
        if code in igneous:
            return 'Igneous'
        elif code in sedimentary:
            return 'Sedimentary'
        elif code in metamorphic:
            return 'Metamorphic'
        elif code in ore_related:
            return 'Ore/Alteration'
        else:
            return 'Other'
    
    def _convert_to_ppm(self, row) -> float:
        """Convert assay value to ppm"""
        try:
            value = float(row['value'])
            units = str(row['units']).lower()
            
            conversion_factor = self.unit_conversions.get(units, 1)
            return value * conversion_factor
            
        except (ValueError, TypeError):
            return np.nan
    
    def _categorize_grade(self, row) -> str:
        """Categorize grade based on element and value"""
        try:
            element = str(row['element']).upper()
            value_ppm = float(row['value_ppm'])
            
            # Element-specific grade categories
            if element == 'AU':  # Gold
                if value_ppm < 0.1:
                    return 'Background'
                elif value_ppm < 1:
                    return 'Low Grade'
                elif value_ppm < 5:
                    return 'Medium Grade'
                else:
                    return 'High Grade'
            
            elif element == 'CU':  # Copper
                if value_ppm < 1000:
                    return 'Background'
                elif value_ppm < 5000:
                    return 'Low Grade'
                elif value_ppm < 20000:
                    return 'Medium Grade'
                else:
                    return 'High Grade'
            
            else:
                return 'Unknown'
                
        except (ValueError, TypeError):
            return 'Invalid'
    
    def write_to_parquet(self, df: pd.DataFrame, table_type: str, country_code: str) -> str:
        """Write drillhole data to Parquet format in S3"""
        timestamp = datetime.now().strftime('%Y%m')
        s3_key = f"country/{country_code}/drill/{timestamp}/{table_type}.parquet"
        
        # Create temporary file
        temp_file = self.storage.files.create_temp_file('.parquet')
        
        try:
            # Write to temporary Parquet file
            df.to_parquet(temp_file, index=False)
            
            # Upload to S3
            success = self.storage.s3.upload_file(
                temp_file,
                s3_key,
                metadata={
                    'country': country_code,
                    'data_type': 'drillhole',
                    'table_type': table_type,
                    'format': 'parquet',
                    'record_count': str(len(df))
                }
            )
            
            if success:
                self.logger.info(f"Wrote {table_type} data to s3://{config.s3_bucket}/{s3_key}")
                return f"s3://{config.s3_bucket}/{s3_key}"
            else:
                raise Exception("Failed to upload to S3")
                
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def write_to_postgis(self, tables_data: Dict[str, pd.DataFrame], country_code: str) -> Dict[str, bool]:
        """Write drillhole data to PostGIS tables"""
        results = {}
        
        for table_type, df in tables_data.items():
            table_name = f"drill_{table_type}_{country_code.lower()}"
            
            # Convert to GeoDataFrame if geometry exists
            if 'geometry' in df.columns:
                gdf = gpd.GeoDataFrame(df, crs=config.crs_target)
                
                # Reproject if needed
                if gdf.crs != config.crs_target:
                    gdf = gdf.to_crs(config.crs_target)
            else:
                gdf = gpd.GeoDataFrame(df)
            
            # Write to PostGIS
            success = self.storage.postgis.create_table_from_gdf(
                gdf,
                table_name,
                add_rls_columns=True,
                org_id=config.org_id,
                project_id=config.project_id
            )
            
            if success:
                # Create appropriate indexes
                if table_type == 'collars' and 'geometry' in df.columns:
                    self.storage.postgis.create_spatial_index(table_name)
                
                # Create attribute indexes
                if 'hole_id' in df.columns:
                    self.storage.postgis.create_attribute_index(table_name, ['hole_id'])
                
                if table_type in ['intervals', 'assays'] and all(col in df.columns for col in ['from_m', 'to_m']):
                    self.storage.postgis.create_attribute_index(table_name, ['from_m', 'to_m'])
                
                if table_type == 'assays' and 'element' in df.columns:
                    self.storage.postgis.create_attribute_index(table_name, ['element'])
                
                # Enable RLS
                self.storage.postgis.enable_rls(table_name)
                
                # Analyze table
                self.storage.postgis.analyze_table(table_name)
                
                self.logger.info(f"Successfully wrote {table_type} data to PostGIS table: {table_name}")
            
            results[table_type] = success
        
        return results
    
    def generate_3d_metadata(self, tables_data: Dict[str, pd.DataFrame], country_code: str) -> Dict[str, Any]:
        """Generate metadata for 3D geological modeling"""
        metadata = {
            'country': country_code,
            'generated_at': datetime.now().isoformat(),
            'tables': {},
            '3d_ready': False
        }
        
        # Check if we have minimum required data for 3D modeling
        required_tables = ['collars', 'surveys', 'intervals']
        has_required = all(table in tables_data for table in required_tables)
        
        if has_required:
            metadata['3d_ready'] = True
            
            # Collar statistics
            if 'collars' in tables_data:
                collars_df = tables_data['collars']
                metadata['tables']['collars'] = {
                    'count': len(collars_df),
                    'depth_range': {
                        'min': float(collars_df['total_depth'].min()) if 'total_depth' in collars_df.columns else None,
                        'max': float(collars_df['total_depth'].max()) if 'total_depth' in collars_df.columns else None
                    },
                    'spatial_extent': {
                        'min_easting': float(collars_df['easting'].min()) if 'easting' in collars_df.columns else None,
                        'max_easting': float(collars_df['easting'].max()) if 'easting' in collars_df.columns else None,
                        'min_northing': float(collars_df['northing'].min()) if 'northing' in collars_df.columns else None,
                        'max_northing': float(collars_df['northing'].max()) if 'northing' in collars_df.columns else None,
                        'min_elevation': float(collars_df['elevation'].min()) if 'elevation' in collars_df.columns else None,
                        'max_elevation': float(collars_df['elevation'].max()) if 'elevation' in collars_df.columns else None
                    }
                }
            
            # Survey statistics
            if 'surveys' in tables_data:
                surveys_df = tables_data['surveys']
                metadata['tables']['surveys'] = {
                    'count': len(surveys_df),
                    'holes_surveyed': surveys_df['hole_id'].nunique() if 'hole_id' in surveys_df.columns else 0,
                    'max_depth': float(surveys_df['depth'].max()) if 'depth' in surveys_df.columns else None
                }
            
            # Interval statistics
            if 'intervals' in tables_data:
                intervals_df = tables_data['intervals']
                metadata['tables']['intervals'] = {
                    'count': len(intervals_df),
                    'holes_logged': intervals_df['hole_id'].nunique() if 'hole_id' in intervals_df.columns else 0,
                    'lithologies': intervals_df['lith_code'].nunique() if 'lith_code' in intervals_df.columns else 0,
                    'total_meters': float(intervals_df['interval_length'].sum()) if 'interval_length' in intervals_df.columns else None
                }
            
            # Assay statistics
            if 'assays' in tables_data:
                assays_df = tables_data['assays']
                metadata['tables']['assays'] = {
                    'count': len(assays_df),
                    'holes_assayed': assays_df['hole_id'].nunique() if 'hole_id' in assays_df.columns else 0,
                    'elements': assays_df['element'].unique().tolist() if 'element' in assays_df.columns else [],
                    'total_samples': len(assays_df)
                }
        
        return metadata
    
    def create_stac_items(self, tables_data: Dict[str, pd.DataFrame], 
                         parquet_paths: Dict[str, str], country_code: str) -> Dict[str, Any]:
        """Create STAC collection and items for drillhole data"""
        
        # Calculate spatial extent from collars
        bounds = [-180, -90, 180, 90]  # Default global bounds
        
        if 'collars' in tables_data:
            collars_df = tables_data['collars']
            if all(col in collars_df.columns for col in ['easting', 'northing']):
                bounds = [
                    float(collars_df['easting'].min()),
                    float(collars_df['northing'].min()),
                    float(collars_df['easting'].max()),
                    float(collars_df['northing'].max())
                ]
        
        # Create collection
        collection = {
            "type": "Collection",
            "stac_version": "1.0.0",
            "id": f"drillhole_{country_code.lower()}",
            "title": f"Drillhole Data - {config.country_codes.get(country_code, country_code)}",
            "description": f"Drillhole collar, survey, interval, and assay data for {config.country_codes.get(country_code, country_code)}",
            "keywords": ["drillhole", "drilling", "geology", "assays", "3d-modeling"] + [country_code.lower()],
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
                "data_type": ["drillhole"],
                "tables": list(tables_data.keys()),
                "total_holes": tables_data['collars']['hole_id'].nunique() if 'collars' in tables_data else 0
            }
        }
        
        # Create items for each table
        items = []
        
        for table_type, df in tables_data.items():
            if table_type not in parquet_paths:
                continue
            
            item = {
                "type": "Feature",
                "stac_version": "1.0.0",
                "id": f"drillhole_{table_type}_{country_code.lower()}_{datetime.now().strftime('%Y%m%d')}",
                "collection": f"drillhole_{country_code.lower()}",
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
                    "data_type": "drillhole",
                    "table_type": table_type,
                    "record_count": len(df),
                    "crs": config.crs_target
                },
                "assets": {
                    "data": {
                        "href": parquet_paths[table_type],
                        "type": "application/x-parquet",
                        "roles": ["data"],
                        "title": f"Drillhole {table_type.title()} Data"
                    }
                }
            }
            
            # Add table-specific properties
            if table_type == 'collars':
                item["properties"]["holes_count"] = df['hole_id'].nunique() if 'hole_id' in df.columns else 0
            elif table_type == 'assays':
                item["properties"]["elements"] = df['element'].unique().tolist() if 'element' in df.columns else []
            
            items.append(item)
        
        # Write STAC files to S3
        collection_key = f"stac/{country_code.lower()}/drillhole/collection.json"
        self.storage.s3.upload_json(collection, collection_key)
        
        item_paths = []
        for item in items:
            item_key = f"stac/{country_code.lower()}/drillhole/items/{item['id']}.json"
            self.storage.s3.upload_json(item, item_key)
            item_paths.append(f"s3://{config.s3_bucket}/{item_key}")
        
        return {
            "collection": collection,
            "items": items,
            "collection_path": f"s3://{config.s3_bucket}/{collection_key}",
            "item_paths": item_paths
        }
    
    def generate_qa_report(self, validation_results: List[Dict[str, Any]], 
                          country_code: str) -> str:
        """Generate QA/QC HTML report for drillhole data"""
        
        # Group results by table type
        results_by_table = {}
        for result in validation_results:
            table_type = result['table_type']
            if table_type not in results_by_table:
                results_by_table[table_type] = []
            results_by_table[table_type].append(result)
        
        # Generate HTML report
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Drillhole QA/QC Report - {country_code}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f0f0f0; padding: 20px; border-radius: 5px; }}
                .summary {{ display: flex; justify-content: space-around; margin: 20px 0; }}
                .metric {{ text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }}
                .metric h3 {{ margin: 0; color: #333; }}
                .metric p {{ margin: 5px 0; font-size: 24px; font-weight: bold; }}
                .table-section {{ margin: 20px 0; }}
                .issues {{ margin: 10px 0; }}
                .issue {{ margin: 5px 0; padding: 8px; border-left: 4px solid #ff6b6b; background-color: #fff5f5; }}
                .warning {{ border-left-color: #ffa726; background-color: #fff8e1; }}
           
             .success {{ border-left-color: #66bb6a; background-color: #f1f8e9; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Drillhole Data QA/QC Report</h1>
                <p><strong>Country:</strong> {config.country_codes.get(country_code, country_code)} ({country_code})</p>
                <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            
            <div class="summary">
                <div class="metric">
                    <h3>Sources Processed</h3>
                    <p>{len(validation_results)}</p>
                </div>
                <div class="metric">
                    <h3>Total Records</h3>
                    <p>{sum(r['original_count'] for r in validation_results):,}</p>
                </div>
                <div class="metric">
                    <h3>Valid Records</h3>
                    <p>{sum(r['final_count'] for r in validation_results):,}</p>
                </div>
                <div class="metric">
                    <h3>Success Rate</h3>
                    <p>{(sum(r['final_count'] for r in validation_results)/sum(r['original_count'] for r in validation_results)*100):.1f}%</p>
                </div>
            </div>
        """
        
        # Add sections for each table type
        for table_type, table_results in results_by_table.items():
            html_content += f"""
            <div class="table-section">
                <h2>{table_type.title()} Data</h2>
                <div class="issues">
            """
            
            total_issues = 0
            for result in table_results:
                issues = result.get('data_quality_issues', [])
                total_issues += len(issues)
                
                for issue in issues:
                    html_content += f'<div class="issue warning">{issue}</div>'
            
            if total_issues == 0:
                html_content += '<div class="issue success">No data quality issues detected</div>'
            
            html_content += """
                </div>
                <table>
                    <tr>
                        <th>Source</th>
                        <th>Original Count</th>
                        <th>Final Count</th>
                        <th>Success Rate</th>
                        <th>Issues</th>
                    </tr>
            """
            
            for result in table_results:
                success_rate = (result['final_count'] / result['original_count'] * 100) if result['original_count'] > 0 else 0
                issues_count = len(result.get('data_quality_issues', []))
                
                html_content += f"""
                    <tr>
                        <td>{Path(result['source']).name}</td>
                        <td>{result['original_count']:,}</td>
                        <td>{result['final_count']:,}</td>
                        <td>{success_rate:.1f}%</td>
                        <td>{issues_count} issues</td>
                    </tr>
                """
            
            html_content += "</table></div>"
        
        html_content += """
        </body>
        </html>
        """
        
        # Write report to S3
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        s3_key = f"reports/qaqc/drill/{country_code}/{timestamp}.html"
        
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
                    'data_type': 'drillhole'
                }
            )
            
            if success:
                return f"s3://{config.s3_bucket}/{s3_key}"
            else:
                raise Exception("Failed to upload QA report")
                
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Process all drillhole data for a country"""
        start_time = time.time()
        
        # Discover sources
        sources = self.discover_sources(country_code)
        
        if not sources:
            self.logger.warning(f"No drillhole sources found for {country_code}")
            return {
                'country': country_code,
                'status': 'no_sources',
                'sources_found': 0,
                'processing_time': time.time() - start_time
            }
        
        self.logger.log_dataset_start('drillhole', country_code, len(sources))
        
        # Group sources by table type
        sources_by_table = {}
        for source in sources:
            table_type = source['table_type']
            if table_type == 'unknown':
                self.logger.warning(f"Skipping unknown table type: {source['path']}")
                continue
            
            if table_type not in sources_by_table:
                sources_by_table[table_type] = []
            sources_by_table[table_type].append(source)
        
        # Process each table type
        tables_data = {}
        all_validations = []
        
        for table_type, table_sources in sources_by_table.items():
            try:
                # Process all sources for this table type
                table_dfs = []
                
                for source in table_sources:
                    try:
                        # Load data
                        if source['type'] == 'local':
                            df = self.load_drillhole_data(source['path'], source['format'])
                        else:  # S3
                            temp_file = self.storage.files.create_temp_file(f".{source['format']}")
                            s3_key = source['path'].replace(f"s3://{config.s3_bucket}/", "")
                            
                            if self.storage.s3.download_file(s3_key, temp_file):
                                df = self.load_drillhole_data(temp_file, source['format'])
                                self.storage.files.cleanup_temp_file(temp_file)
                            else:
                                continue
                        
                        # Validate data
                        df_clean, validation = self.validate_drillhole_data(df, table_type, source)
                        all_validations.append(validation)
                        
                        # Enrich data
                        df_enriched = self.enrich_drillhole_data(df_clean, table_type, country_code, source)
                        
                        table_dfs.append(df_enriched)
                        
                    except Exception as e:
                        self.logger.error(f"Failed to process source {source['path']}", error=str(e))
                        continue
                
                if table_dfs:
                    # Combine all data for this table type
                    combined_df = pd.concat(table_dfs, ignore_index=True)
                    tables_data[table_type] = combined_df
                    
                    self.logger.info(f"Processed {len(table_dfs)} sources for {table_type}, total records: {len(combined_df)}")
                
            except Exception as e:
                self.logger.error(f"Failed to process {table_type} data for {country_code}", error=str(e))
                continue
        
        if not tables_data:
            return {
                'country': country_code,
                'status': 'processing_failed',
                'sources_found': len(sources),
                'processing_time': time.time() - start_time
            }
        
        # Write outputs
        try:
            # Write normalized Parquet files to S3
            parquet_paths = {}
            for table_type, df in tables_data.items():
                parquet_path = self.write_to_parquet(df, table_type, country_code)
                parquet_paths[table_type] = parquet_path
            
            # Write to PostGIS
            postgis_results = self.write_to_postgis(tables_data, country_code)
            
            # Generate 3D modeling metadata
            metadata_3d = self.generate_3d_metadata(tables_data, country_code)
            
            # Upload 3D metadata to S3
            metadata_s3_key = f"country/{country_code}/drill/{datetime.now().strftime('%Y%m')}/3d_metadata.json"
            self.storage.s3.upload_json(metadata_3d, metadata_s3_key)
            
            # Create STAC items
            stac_info = self.create_stac_items(tables_data, parquet_paths, country_code)
            
            # Generate QA/QC report
            qa_report_path = self.generate_qa_report(all_validations, country_code)
            
            processing_time = time.time() - start_time
            
            # Calculate total records
            total_records = sum(len(df) for df in tables_data.values())
            
            self.logger.log_dataset_complete('drillhole', country_code, total_records, processing_time)
            
            return {
                'country': country_code,
                'status': 'success',
                'sources_found': len(sources),
                'tables_processed': list(tables_data.keys()),
                'total_records': total_records,
                'processing_time': processing_time,
                'outputs': {
                    'parquet_files': parquet_paths,
                    'postgis_tables': {f"drill_{table}_{country_code.lower()}": success 
                                     for table, success in postgis_results.items()},
                    '3d_metadata': f"s3://{config.s3_bucket}/{metadata_s3_key}",
                    '3d_ready': metadata_3d['3d_ready'],
                    'stac_collection': stac_info['collection_path'],
                    'stac_items': stac_info['item_paths'],
                    'qa_report': qa_report_path
                },
                'validation_summary': {
                    'total_sources': len(all_validations),
                    'total_original_records': sum(v['original_count'] for v in all_validations),
                    'total_final_records': sum(v['final_count'] for v in all_validations),
                    'tables_with_data': list(tables_data.keys()),
                    'total_issues': sum(len(v.get('data_quality_issues', [])) for v in all_validations)
                },
                'drilling_statistics': {
                    'total_holes': tables_data['collars']['hole_id'].nunique() if 'collars' in tables_data else 0,
                    'total_meters_drilled': float(tables_data['collars']['total_depth'].sum()) if 'collars' in tables_data and 'total_depth' in tables_data['collars'].columns else 0,
                    'holes_with_surveys': tables_data['surveys']['hole_id'].nunique() if 'surveys' in tables_data else 0,
                    'holes_with_geology': tables_data['intervals']['hole_id'].nunique() if 'intervals' in tables_data else 0,
                    'holes_with_assays': tables_data['assays']['hole_id'].nunique() if 'assays' in tables_data else 0,
                    'elements_analyzed': tables_data['assays']['element'].nunique() if 'assays' in tables_data else 0
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