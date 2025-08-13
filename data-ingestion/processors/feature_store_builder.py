"""
Feature Store Builder
Generates ML features from processed geological, geophysical, and environmental data
"""

import os
import time
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon
import numpy as np
from scipy import stats, ndimage
from scipy.spatial.distance import cdist
from sklearn.preprocessing import StandardScaler, MinMaxScaler
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
import tempfile

from ..core.logger import get_logger
from ..core.storage import StorageManager
from ..config import config, feature_store_config

class FeatureStoreBuilder:
    """Builds ML feature store from processed geoscience data"""
    
    def __init__(self, storage_manager: StorageManager):
        self.storage = storage_manager
        self.logger = get_logger('feature_store_builder')
        
        # Feature configuration
        self.grid_resolution = self._parse_resolution(feature_store_config.grid_resolution)
        self.scales = feature_store_config.scales
        self.distance_features = feature_store_config.distance_features
        self.statistical_features = feature_store_config.statistical_features
        self.morphometry_features = feature_store_config.morphometry_features
        
        # Feature categories and their sources
        self.feature_categories = {
            'distance_features': {
                'faults': 'geology',
                'contacts': 'geology', 
                'rivers': 'esg',
                'roads': 'esg',
                'known_occurrences': 'geochem'
            },
            'statistical_features': {
                'magnetics': 'geophysics',
                'gravity': 'geophysics',
                'radiometrics': 'geophysics',
                'spectral_indices': 'satellite'
            },
            'morphometry_features': {
                'slope': 'dem',
                'curvature': 'dem',
                'elevation': 'dem'
            },
            'geological_features': {
                'lithology': 'geology',
                'age_group': 'geology',
                'structure_density': 'geology'
            },
            'geochemical_features': {
                'element_concentrations': 'geochem',
                'pathfinder_elements': 'geochem',
                'deposit_scores': 'geochem'
            },
            'environmental_features': {
                'esg_risk_score': 'esg',
                'protected_area_distance': 'esg',
                'water_body_distance': 'esg'
            }
        }
    
    def _parse_resolution(self, resolution_str: str) -> float:
        """Parse resolution string to meters"""
        if resolution_str.endswith('m'):
            return float(resolution_str[:-1])
        elif resolution_str.endswith('km'):
            return float(resolution_str[:-2]) * 1000
        else:
            return float(resolution_str)
    
    def discover_processed_data(self, country_code: str) -> Dict[str, List[str]]:
        """Discover processed data sources for feature generation"""
        data_sources = {}
        
        # Define S3 prefixes for each data type
        prefixes = {
            'geology': f"country/{country_code}/baseline/geology/",
            'geophysics': f"country/{country_code}/baseline/geophysics/",
            'dem': f"country/{country_code}/baseline/dem/",
            'satellite': f"country/{country_code}/baseline/satellite/",
            'geochem': f"country/{country_code}/geochem/",
            'drillhole': f"country/{country_code}/drill/",
            'esg': f"country/{country_code}/baseline/esg/"
        }
        
        for data_type, prefix in prefixes.items():
            objects = self.storage.s3.list_objects(prefix)
            data_sources[data_type] = [
                f"s3://{config.s3_bucket}/{obj}" for obj in objects
                if obj.endswith(('.gpkg', '.tif', '.parquet'))
            ]
        
        self.logger.info(f"Discovered processed data sources for {country_code}: {sum(len(sources) for sources in data_sources.values())} files")
        return data_sources
    
    def create_feature_grid(self, country_bounds: Tuple[float, float, float, float]) -> gpd.GeoDataFrame:
        """Create regular grid for feature extraction"""
        min_x, min_y, max_x, max_y = country_bounds
        
        # Calculate grid dimensions
        width = max_x - min_x
        height = max_y - min_y
        
        cols = int(np.ceil(width / self.grid_resolution))
        rows = int(np.ceil(height / self.grid_resolution))
        
        self.logger.info(f"Creating feature grid: {cols}x{rows} cells ({cols*rows:,} total)")
        
        # Create grid cells
        grid_cells = []
        cell_ids = []
        
        for i in range(rows):
            for j in range(cols):
                # Calculate cell bounds
                cell_min_x = min_x + j * self.grid_resolution
                cell_max_x = min_x + (j + 1) * self.grid_resolution
                cell_min_y = min_y + i * self.grid_resolution
                cell_max_y = min_y + (i + 1) * self.grid_resolution
                
                # Create cell polygon
                cell = Polygon([
                    (cell_min_x, cell_min_y),
                    (cell_max_x, cell_min_y),
                    (cell_max_x, cell_max_y),
                    (cell_min_x, cell_max_y),
                    (cell_min_x, cell_min_y)
                ])
                
                grid_cells.append(cell)
                cell_ids.append(f"cell_{i:06d}_{j:06d}")
        
        # Create GeoDataFrame
        grid_gdf = gpd.GeoDataFrame({
            'cell_id': cell_ids,
            'row': [i for i in range(rows) for j in range(cols)],
            'col': [j for i in range(rows) for j in range(cols)],
            'geometry': grid_cells
        }, crs=config.crs_target)
        
        # Add cell center coordinates
        grid_gdf['center_x'] = grid_gdf.geometry.centroid.x
        grid_gdf['center_y'] = grid_gdf.geometry.centroid.y
        
        return grid_gdf
    
    def extract_distance_features(self, grid_gdf: gpd.GeoDataFrame, 
                                 data_sources: Dict[str, List[str]], 
                                 country_code: str) -> pd.DataFrame:
        """Extract distance-based features"""
        distance_features = pd.DataFrame(index=grid_gdf.index)
        
        for feature_name in self.distance_features:
            try:
                # Load relevant data based on feature type
                if feature_name in ['faults', 'contacts']:
                    # Load geology data
                    geology_sources = [s for s in data_sources.get('geology', []) if s.endswith('.gpkg')]
                    if geology_sources:
                        geology_gdf = self._load_vector_data(geology_sources[0])
                        
                        if feature_name == 'faults':
                            # Filter for fault features
                            fault_features = geology_gdf[
                                geology_gdf.get('feature_type', '').str.contains('fault|fracture', case=False, na=False) |
                                geology_gdf.get('structure_type', '').str.contains('fault|fracture', case=False, na=False)
                            ]
                            distances = self._calculate_distances(grid_gdf, fault_features)
                        
                        elif feature_name == 'contacts':
                            # Filter for geological contacts
                            contact_features = geology_gdf[
                                geology_gdf.get('feature_type', '').str.contains('contact|boundary', case=False, na=False)
                            ]
                            distances = self._calculate_distances(grid_gdf, contact_features)
                
                elif feature_name in ['rivers', 'roads']:
                    # Load ESG data
                    esg_sources = [s for s in data_sources.get('esg', []) if s.endswith('.gpkg')]
                    if esg_sources:
                        # Try to find specific ESG category
                        category_source = None
                        for source in esg_sources:
                            if feature_name in source.lower() or ('water' in source.lower() and feature_name == 'rivers'):
                                category_source = source
                                break
                        
                        if category_source:
                            esg_gdf = self._load_vector_data(category_source)
                            distances = self._calculate_distances(grid_gdf, esg_gdf)
                        else:
                            distances = np.full(len(grid_gdf), np.nan)
                    else:
                        distances = np.full(len(grid_gdf), np.nan)
                
                elif feature_name == 'known_occurrences':
                    # Load geochemical data
                    geochem_sources = [s for s in data_sources.get('geochem', []) if s.endswith('.gpkg')]
                    if geochem_sources:
                        geochem_gdf = self._load_vector_data(geochem_sources[0])
                        
                        # Filter for high-grade samples (simplified)
                        if 'au_ppm' in geochem_gdf.columns:
                            high_grade = geochem_gdf[geochem_gdf['au_ppm'] > 1.0]  # >1 ppm Au
                        elif 'cu_ppm' in geochem_gdf.columns:
                            high_grade = geochem_gdf[geochem_gdf['cu_ppm'] > 5000]  # >0.5% Cu
                        else:
                            high_grade = geochem_gdf
                        
                        distances = self._calculate_distances(grid_gdf, high_grade)
                    else:
                        distances = np.full(len(grid_gdf), np.nan)
                
                else:
                    distances = np.full(len(grid_gdf), np.nan)
                
                distance_features[f'dist_to_{feature_name}'] = distances
                
            except Exception as e:
                self.logger.warning(f"Failed to extract distance feature {feature_name}", error=str(e))
                distance_features[f'dist_to_{feature_name}'] = np.full(len(grid_gdf), np.nan)
        
        return distance_features
    
    def extract_statistical_features(self, grid_gdf: gpd.GeoDataFrame,
                                   data_sources: Dict[str, List[str]],
                                   country_code: str) -> pd.DataFrame:
        """Extract statistical features from raster data"""
        statistical_features = pd.DataFrame(index=grid_gdf.index)
        
        # Process geophysical data
        geophysics_sources = [s for s in data_sources.get('geophysics', []) if s.endswith('.tif')]
        
        for source in geophysics_sources:
            try:
                # Determine geophysics type from filename
                source_name = Path(source).stem.lower()
                
                if 'mag' in source_name:
                    data_type = 'magnetics'
                elif 'grav' in source_name:
                    data_type = 'gravity'
                elif 'rad' in source_name:
                    data_type = 'radiometrics'
                else:
                    data_type = 'geophysics'
                
                # Extract statistics for each scale
                for scale in self.scales:
                    stats_dict = self._extract_raster_statistics(grid_gdf, source, scale)
                    
                    for stat_name, values in stats_dict.items():
                        feature_name = f'{data_type}_{stat_name}_scale{scale}'
                        statistical_features[feature_name] = values
                        
            except Exception as e:
                self.logger.warning(f"Failed to process geophysics source {source}", error=str(e))
                continue
        
        # Process satellite spectral indices
        satellite_sources = [s for s in data_sources.get('satellite', []) if s.endswith('.tif')]
        
        for source in satellite_sources:
            try:
                source_name = Path(source).stem.lower()
                
                # Identify spectral index type
                if 'ndvi' in source_name:
                    data_type = 'ndvi'
                elif 'ndwi' in source_name:
                    data_type = 'ndwi'
                elif 'nbr' in source_name:
                    data_type = 'nbr'
                elif 'ferric' in source_name:
                    data_type = 'ferric'
                elif 'ferrous' in source_name:
                    data_type = 'ferrous'
                else:
                    continue
                
                # Extract statistics
                for scale in self.scales:
                    stats_dict = self._extract_raster_statistics(grid_gdf, source, scale)
                    
                    for stat_name, values in stats_dict.items():
                        feature_name = f'{data_type}_{stat_name}_scale{scale}'
                        statistical_features[feature_name] = values
                        
            except Exception as e:
                self.logger.warning(f"Failed to process satellite source {source}", error=str(e))
                continue
        
        return statistical_features    

    def extract_morphometry_features(self, grid_gdf: gpd.GeoDataFrame,
                                   data_sources: Dict[str, List[str]],
                                   country_code: str) -> pd.DataFrame:
        """Extract morphometry features from DEM data"""
        morphometry_features = pd.DataFrame(index=grid_gdf.index)
        
        # Process DEM-derived products
        dem_sources = [s for s in data_sources.get('dem', []) if s.endswith('.tif')]
        
        for source in dem_sources:
            try:
                source_name = Path(source).stem.lower()
                
                # Identify DEM product type
                if 'slope' in source_name:
                    data_type = 'slope'
                elif 'curvature' in source_name:
                    data_type = 'curvature'
                elif 'hillshade' in source_name:
                    data_type = 'hillshade'
                elif 'dem' in source_name or 'elevation' in source_name:
                    data_type = 'elevation'
                else:
                    continue
                
                # Extract statistics for each scale
                for scale in self.scales:
                    stats_dict = self._extract_raster_statistics(grid_gdf, source, scale)
                    
                    for stat_name, values in stats_dict.items():
                        feature_name = f'{data_type}_{stat_name}_scale{scale}'
                        morphometry_features[feature_name] = values
                        
            except Exception as e:
                self.logger.warning(f"Failed to process DEM source {source}", error=str(e))
                continue
        
        return morphometry_features
    
    def extract_geological_features(self, grid_gdf: gpd.GeoDataFrame,
                                  data_sources: Dict[str, List[str]],
                                  country_code: str) -> pd.DataFrame:
        """Extract geological features"""
        geological_features = pd.DataFrame(index=grid_gdf.index)
        
        # Load geology data
        geology_sources = [s for s in data_sources.get('geology', []) if s.endswith('.gpkg')]
        
        if not geology_sources:
            self.logger.warning("No geology sources found for geological features")
            return geological_features
        
        try:
            geology_gdf = self._load_vector_data(geology_sources[0])
            
            # Extract lithology features (one-hot encoding)
            if 'unit' in geology_gdf.columns or 'lithology' in geology_gdf.columns:
                lithology_col = 'unit' if 'unit' in geology_gdf.columns else 'lithology'
                lithology_features = self._extract_categorical_features(
                    grid_gdf, geology_gdf, lithology_col, 'lithology'
                )
                geological_features = pd.concat([geological_features, lithology_features], axis=1)
            
            # Extract age group features
            if 'age_group' in geology_gdf.columns:
                age_features = self._extract_categorical_features(
                    grid_gdf, geology_gdf, 'age_group', 'age'
                )
                geological_features = pd.concat([geological_features, age_features], axis=1)
            
            # Calculate structure density
            structure_density = self._calculate_structure_density(grid_gdf, geology_gdf)
            geological_features['structure_density'] = structure_density
            
        except Exception as e:
            self.logger.error(f"Failed to extract geological features", error=str(e))
        
        return geological_features
    
    def extract_geochemical_features(self, grid_gdf: gpd.GeoDataFrame,
                                   data_sources: Dict[str, List[str]],
                                   country_code: str) -> pd.DataFrame:
        """Extract geochemical features"""
        geochemical_features = pd.DataFrame(index=grid_gdf.index)
        
        # Load geochemical data
        geochem_sources = [s for s in data_sources.get('geochem', []) if s.endswith('.gpkg')]
        
        if not geochem_sources:
            self.logger.warning("No geochemical sources found")
            return geochemical_features
        
        try:
            geochem_gdf = self._load_vector_data(geochem_sources[0])
            
            # Extract element concentration features
            element_columns = [col for col in geochem_gdf.columns 
                             if any(element in col.lower() for element in ['au', 'cu', 'ag', 'pb', 'zn', 'fe', 'as'])]
            
            for element_col in element_columns:
                if pd.api.types.is_numeric_dtype(geochem_gdf[element_col]):
                    # Interpolate element concentrations to grid
                    interpolated_values = self._interpolate_point_data(
                        grid_gdf, geochem_gdf, element_col
                    )
                    geochemical_features[f'{element_col}_interpolated'] = interpolated_values
            
            # Extract deposit scores if available
            score_columns = [col for col in geochem_gdf.columns 
                           if 'score' in col.lower() and pd.api.types.is_numeric_dtype(geochem_gdf[col])]
            
            for score_col in score_columns:
                interpolated_scores = self._interpolate_point_data(
                    grid_gdf, geochem_gdf, score_col
                )
                geochemical_features[f'{score_col}_interpolated'] = interpolated_scores
            
        except Exception as e:
            self.logger.error(f"Failed to extract geochemical features", error=str(e))
        
        return geochemical_features
    
    def extract_environmental_features(self, grid_gdf: gpd.GeoDataFrame,
                                     data_sources: Dict[str, List[str]],
                                     country_code: str) -> pd.DataFrame:
        """Extract environmental/ESG features"""
        environmental_features = pd.DataFrame(index=grid_gdf.index)
        
        # Load ESG data
        esg_sources = [s for s in data_sources.get('esg', []) if s.endswith('.gpkg')]
        
        if not esg_sources:
            self.logger.warning("No ESG sources found")
            return environmental_features
        
        try:
            # Process each ESG category
            esg_categories = ['protected_areas', 'water_bodies', 'settlements', 'infrastructure']
            
            for category in esg_categories:
                # Find source for this category
                category_source = None
                for source in esg_sources:
                    if category in source.lower():
                        category_source = source
                        break
                
                if category_source:
                    esg_gdf = self._load_vector_data(category_source)
                    
                    # Calculate distances
                    distances = self._calculate_distances(grid_gdf, esg_gdf)
                    environmental_features[f'dist_to_{category}'] = distances
                    
                    # Calculate risk scores if available
                    if 'risk_score' in esg_gdf.columns:
                        risk_scores = self._interpolate_polygon_data(
                            grid_gdf, esg_gdf, 'risk_score'
                        )
                        environmental_features[f'{category}_risk_score'] = risk_scores
            
            # Calculate composite ESG risk score
            risk_columns = [col for col in environmental_features.columns if 'risk_score' in col]
            if risk_columns:
                environmental_features['composite_esg_risk'] = environmental_features[risk_columns].mean(axis=1)
            
        except Exception as e:
            self.logger.error(f"Failed to extract environmental features", error=str(e))
        
        return environmental_features
    
    def _load_vector_data(self, s3_path: str) -> gpd.GeoDataFrame:
        """Load vector data from S3"""
        temp_file = self.storage.files.create_temp_file('.gpkg')
        s3_key = s3_path.replace(f"s3://{config.s3_bucket}/", "")
        
        try:
            if self.storage.s3.download_file(s3_key, temp_file):
                gdf = gpd.read_file(temp_file)
                return gdf
            else:
                raise Exception(f"Failed to download {s3_path}")
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def _calculate_distances(self, grid_gdf: gpd.GeoDataFrame, 
                           feature_gdf: gpd.GeoDataFrame) -> np.ndarray:
        """Calculate minimum distances from grid cells to features"""
        if len(feature_gdf) == 0:
            return np.full(len(grid_gdf), np.nan)
        
        # Get grid cell centroids
        grid_points = np.array([[geom.centroid.x, geom.centroid.y] for geom in grid_gdf.geometry])
        
        # Get feature coordinates (centroids for polygons, coordinates for points)
        feature_coords = []
        for geom in feature_gdf.geometry:
            if geom.geom_type == 'Point':
                feature_coords.append([geom.x, geom.y])
            else:
                centroid = geom.centroid
                feature_coords.append([centroid.x, centroid.y])
        
        feature_points = np.array(feature_coords)
        
        # Calculate distances
        distances = cdist(grid_points, feature_points)
        min_distances = np.min(distances, axis=1)
        
        return min_distances   
 
    def _extract_raster_statistics(self, grid_gdf: gpd.GeoDataFrame, 
                                  raster_s3_path: str, scale: int) -> Dict[str, np.ndarray]:
        """Extract statistical features from raster data"""
        temp_file = self.storage.files.create_temp_file('.tif')
        s3_key = raster_s3_path.replace(f"s3://{config.s3_bucket}/", "")
        
        try:
            if not self.storage.s3.download_file(s3_key, temp_file):
                raise Exception(f"Failed to download {raster_s3_path}")
            
            with rasterio.open(temp_file) as src:
                stats_dict = {}
                
                # Calculate buffer size based on scale
                buffer_size = scale * self.grid_resolution / 2
                
                for stat_name in self.statistical_features:
                    values = []
                    
                    for _, cell in grid_gdf.iterrows():
                        # Create buffered geometry for sampling
                        buffered_geom = cell.geometry.buffer(buffer_size)
                        
                        try:
                            # Sample raster within buffered geometry
                            from rasterio.mask import mask
                            masked_data, _ = mask(src, [buffered_geom], crop=True, nodata=src.nodata)
                            
                            if masked_data.size > 0:
                                valid_data = masked_data[masked_data != src.nodata]
                                
                                if len(valid_data) > 0:
                                    if stat_name == 'mean':
                                        value = np.mean(valid_data)
                                    elif stat_name == 'std':
                                        value = np.std(valid_data)
                                    elif stat_name == 'entropy':
                                        # Calculate entropy of histogram
                                        hist, _ = np.histogram(valid_data, bins=10)
                                        hist = hist / np.sum(hist)  # Normalize
                                        hist = hist[hist > 0]  # Remove zeros
                                        value = -np.sum(hist * np.log2(hist))
                                    else:
                                        value = np.nan
                                else:
                                    value = np.nan
                            else:
                                value = np.nan
                                
                        except Exception:
                            value = np.nan
                        
                        values.append(value)
                    
                    stats_dict[stat_name] = np.array(values)
                
                return stats_dict
                
        finally:
            self.storage.files.cleanup_temp_file(temp_file)
    
    def _extract_categorical_features(self, grid_gdf: gpd.GeoDataFrame,
                                    feature_gdf: gpd.GeoDataFrame,
                                    category_column: str,
                                    feature_prefix: str) -> pd.DataFrame:
        """Extract one-hot encoded categorical features"""
        categorical_features = pd.DataFrame(index=grid_gdf.index)
        
        # Get unique categories
        unique_categories = feature_gdf[category_column].dropna().unique()
        
        # Limit to most common categories to avoid feature explosion
        if len(unique_categories) > 20:
            category_counts = feature_gdf[category_column].value_counts()
            unique_categories = category_counts.head(20).index.tolist()
        
        # Create one-hot features
        for category in unique_categories:
            category_features = feature_gdf[feature_gdf[category_column] == category]
            
            # Calculate overlap with grid cells
            overlaps = []
            for _, cell in grid_gdf.iterrows():
                # Check if cell intersects with any features of this category
                intersects = any(cell.geometry.intersects(geom) for geom in category_features.geometry)
                overlaps.append(1 if intersects else 0)
            
            # Clean category name for column name
            clean_category = str(category).replace(' ', '_').replace('-', '_').lower()
            categorical_features[f'{feature_prefix}_{clean_category}'] = overlaps
        
        return categorical_features
    
    def _calculate_structure_density(self, grid_gdf: gpd.GeoDataFrame,
                                   geology_gdf: gpd.GeoDataFrame) -> np.ndarray:
        """Calculate structural feature density"""
        densities = []
        
        # Filter for structural features
        structure_features = geology_gdf[
            geology_gdf.get('feature_type', '').str.contains(
                'fault|fracture|lineament|structure', case=False, na=False
            )
        ]
        
        if len(structure_features) == 0:
            return np.zeros(len(grid_gdf))
        
        for _, cell in grid_gdf.iterrows():
            # Count structures intersecting with cell
            intersecting_structures = structure_features[
                structure_features.geometry.intersects(cell.geometry)
            ]
            
            # Calculate density (structures per km²)
            cell_area_km2 = cell.geometry.area / 1e6
            density = len(intersecting_structures) / cell_area_km2 if cell_area_km2 > 0 else 0
            densities.append(density)
        
        return np.array(densities)
    
    def _interpolate_point_data(self, grid_gdf: gpd.GeoDataFrame,
                              point_gdf: gpd.GeoDataFrame,
                              value_column: str) -> np.ndarray:
        """Interpolate point data to grid using inverse distance weighting"""
        if len(point_gdf) == 0 or value_column not in point_gdf.columns:
            return np.full(len(grid_gdf), np.nan)
        
        # Filter valid data
        valid_data = point_gdf[point_gdf[value_column].notna()]
        
        if len(valid_data) == 0:
            return np.full(len(grid_gdf), np.nan)
        
        # Get coordinates
        grid_coords = np.array([[geom.centroid.x, geom.centroid.y] for geom in grid_gdf.geometry])
        point_coords = np.array([[geom.x, geom.y] for geom in valid_data.geometry])
        values = valid_data[value_column].values
        
        # Calculate distances
        distances = cdist(grid_coords, point_coords)
        
        # Inverse distance weighting
        interpolated_values = []
        
        for i in range(len(grid_coords)):
            dist_row = distances[i]
            
            # Handle case where grid point coincides with sample point
            if np.min(dist_row) < 1e-10:
                closest_idx = np.argmin(dist_row)
                interpolated_values.append(values[closest_idx])
            else:
                # IDW with power=2
                weights = 1 / (dist_row ** 2)
                weighted_sum = np.sum(weights * values)
                weight_sum = np.sum(weights)
                interpolated_values.append(weighted_sum / weight_sum)
        
        return np.array(interpolated_values)
    
    def _interpolate_polygon_data(self, grid_gdf: gpd.GeoDataFrame,
                                polygon_gdf: gpd.GeoDataFrame,
                                value_column: str) -> np.ndarray:
        """Interpolate polygon data to grid"""
        if len(polygon_gdf) == 0 or value_column not in polygon_gdf.columns:
            return np.full(len(grid_gdf), np.nan)
        
        interpolated_values = []
        
        for _, cell in grid_gdf.iterrows():
            # Find polygons that intersect with cell
            intersecting_polygons = polygon_gdf[
                polygon_gdf.geometry.intersects(cell.geometry)
            ]
            
            if len(intersecting_polygons) == 0:
                interpolated_values.append(np.nan)
            else:
                # Calculate area-weighted average
                total_area = 0
                weighted_sum = 0
                
                for _, poly in intersecting_polygons.iterrows():
                    intersection = cell.geometry.intersection(poly.geometry)
                    area = intersection.area
                    
                    if area > 0 and pd.notna(poly[value_column]):
                        weighted_sum += area * poly[value_column]
                        total_area += area
                
                if total_area > 0:
                    interpolated_values.append(weighted_sum / total_area)
                else:
                    interpolated_values.append(np.nan)
        
        return np.array(interpolated_values)
    
    def normalize_features(self, features_df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """Normalize features and return normalization parameters"""
        normalized_df = features_df.copy()
        normalization_params = {}
        
        for column in features_df.columns:
            if pd.api.types.is_numeric_dtype(features_df[column]):
                # Remove infinite values
                finite_mask = np.isfinite(features_df[column])
                
                if finite_mask.sum() > 0:
                    # Use robust scaling (median and IQR)
                    finite_values = features_df[column][finite_mask]
                    
                    q25 = np.percentile(finite_values, 25)
                    q75 = np.percentile(finite_values, 75)
                    median = np.median(finite_values)
                    iqr = q75 - q25
                    
                    if iqr > 0:
                        normalized_df[column] = (features_df[column] - median) / iqr
                        normalization_params[column] = {
                            'method': 'robust',
                            'median': median,
                            'iqr': iqr
                        }
                    else:
                        # Fallback to min-max scaling
                        min_val = finite_values.min()
                        max_val = finite_values.max()
                        
                        if max_val > min_val:
                            normalized_df[column] = (features_df[column] - min_val) / (max_val - min_val)
                            normalization_params[column] = {
                                'method': 'minmax',
                                'min': min_val,
                                'max': max_val
                            }
                        else:
                            normalized_df[column] = 0
                            normalization_params[column] = {
                                'method': 'constant',
                                'value': min_val
                            }
        
        return normalized_df, normalization_params 
   
    def write_feature_store(self, grid_gdf: gpd.GeoDataFrame, 
                           features_df: pd.DataFrame,
                           normalization_params: Dict[str, Any],
                           country_code: str) -> Dict[str, str]:
        """Write feature store to PostGIS and S3"""
        
        # Combine grid and features
        feature_store_gdf = grid_gdf.copy()
        
        # Add all features to the grid
        for column in features_df.columns:
            feature_store_gdf[column] = features_df[column]
        
        # Add metadata
        feature_store_gdf['country_code'] = country_code
        feature_store_gdf['created_at'] = datetime.now()
        feature_store_gdf['grid_resolution'] = self.grid_resolution
        
        # Write to PostGIS
        cells_table = f"fs_cells_{country_code.lower()}"
        features_table = f"fs_features_{country_code.lower()}"
        
        # Write cells table (geometry + basic info)
        cells_gdf = feature_store_gdf[['cell_id', 'row', 'col', 'center_x', 'center_y', 
                                     'country_code', 'created_at', 'grid_resolution', 'geometry']].copy()
        
        cells_success = self.storage.postgis.create_table_from_gdf(
            cells_gdf,
            cells_table,
            add_rls_columns=True,
            org_id=config.org_id,
            project_id=config.project_id
        )
        
        if cells_success:
            # Create spatial index
            self.storage.postgis.create_spatial_index(cells_table)
            
            # Create attribute indexes
            self.storage.postgis.create_attribute_index(cells_table, ['cell_id'])
            self.storage.postgis.create_attribute_index(cells_table, ['row', 'col'])
            
            # Enable RLS
            self.storage.postgis.enable_rls(cells_table)
            
            # Analyze table
            self.storage.postgis.analyze_table(cells_table)
        
        # Write features table (normalized features)
        features_only_df = features_df.copy()
        features_only_df['cell_id'] = feature_store_gdf['cell_id']
        features_only_df['country_code'] = country_code
        features_only_df['created_at'] = datetime.now()
        
        # Convert to GeoDataFrame for PostGIS compatibility
        features_gdf = gpd.GeoDataFrame(features_only_df)
        
        features_success = self.storage.postgis.create_table_from_gdf(
            features_gdf,
            features_table,
            add_rls_columns=True,
            org_id=config.org_id,
            project_id=config.project_id
        )
        
        if features_success:
            # Create indexes
            self.storage.postgis.create_attribute_index(features_table, ['cell_id'])
            
            # Enable RLS
            self.storage.postgis.enable_rls(features_table)
            
            # Analyze table
            self.storage.postgis.analyze_table(features_table)
        
        # Write to S3 as Parquet
        timestamp = datetime.now().strftime('%Y%m')
        
        # Write feature store data
        feature_store_s3_key = f"features/{country_code}/{timestamp}/feature_store.parquet"
        temp_parquet = self.storage.files.create_temp_file('.parquet')
        
        try:
            # Prepare data for Parquet (remove geometry for features table)
            parquet_df = feature_store_gdf.drop(columns=['geometry'])
            parquet_df.to_parquet(temp_parquet, index=False)
            
            feature_store_success = self.storage.s3.upload_file(
                temp_parquet,
                feature_store_s3_key,
                metadata={
                    'country': country_code,
                    'data_type': 'feature_store',
                    'format': 'parquet',
                    'feature_count': str(len(features_df.columns)),
                    'cell_count': str(len(feature_store_gdf))
                }
            )
            
        finally:
            self.storage.files.cleanup_temp_file(temp_parquet)
        
        # Write normalization parameters
        normalization_s3_key = f"features/{country_code}/{timestamp}/normalization_params.json"
        normalization_success = self.storage.s3.upload_json(normalization_params, normalization_s3_key)
        
        # Write feature metadata
        feature_metadata = {
            'country_code': country_code,
            'created_at': datetime.now().isoformat(),
            'grid_resolution': self.grid_resolution,
            'grid_dimensions': {
                'rows': int(feature_store_gdf['row'].max() + 1),
                'cols': int(feature_store_gdf['col'].max() + 1),
                'total_cells': len(feature_store_gdf)
            },
            'feature_categories': {
                'distance_features': [col for col in features_df.columns if col.startswith('dist_to_')],
                'statistical_features': [col for col in features_df.columns if any(stat in col for stat in ['mean', 'std', 'entropy'])],
                'morphometry_features': [col for col in features_df.columns if any(morph in col for morph in ['slope', 'curvature', 'elevation'])],
                'geological_features': [col for col in features_df.columns if any(geo in col for geo in ['lithology', 'age', 'structure'])],
                'geochemical_features': [col for col in features_df.columns if 'interpolated' in col],
                'environmental_features': [col for col in features_df.columns if any(env in col for env in ['esg', 'protected', 'water'])]
            },
            'total_features': len(features_df.columns),
            'normalization_method': 'robust_scaling',
            'data_sources': {
                'geology': True,
                'geophysics': True,
                'dem': True,
                'satellite': True,
                'geochem': True,
                'esg': True
            }
        }
        
        metadata_s3_key = f"features/{country_code}/{timestamp}/feature_metadata.json"
        metadata_success = self.storage.s3.upload_json(feature_metadata, metadata_s3_key)
        
        return {
            'cells_table': cells_table if cells_success else None,
            'features_table': features_table if features_success else None,
            'feature_store_path': f"s3://{config.s3_bucket}/{feature_store_s3_key}" if feature_store_success else None,
            'normalization_params_path': f"s3://{config.s3_bucket}/{normalization_s3_key}" if normalization_success else None,
            'metadata_path': f"s3://{config.s3_bucket}/{metadata_s3_key}" if metadata_success else None
        }
    
    def process_country(self, country_code: str) -> Dict[str, Any]:
        """Build feature store for a country"""
        start_time = time.time()
        
        self.logger.log_dataset_start('feature_store', country_code, 0)
        
        try:
            # Discover processed data sources
            data_sources = self.discover_processed_data(country_code)
            
            # Check if we have sufficient data
            required_sources = ['geology', 'geophysics', 'dem']
            missing_sources = [source for source in required_sources if not data_sources.get(source)]
            
            if missing_sources:
                self.logger.warning(f"Missing required data sources for {country_code}: {missing_sources}")
                return {
                    'country': country_code,
                    'status': 'insufficient_data',
                    'missing_sources': missing_sources,
                    'processing_time': time.time() - start_time
                }
            
            # Determine country bounds from geology data
            geology_sources = [s for s in data_sources.get('geology', []) if s.endswith('.gpkg')]
            if not geology_sources:
                raise Exception("No geology data found for determining bounds")
            
            geology_gdf = self._load_vector_data(geology_sources[0])
            country_bounds = geology_gdf.total_bounds
            
            self.logger.info(f"Country bounds for {country_code}: {country_bounds}")
            
            # Create feature grid
            grid_gdf = self.create_feature_grid(country_bounds)
            
            self.logger.info(f"Created feature grid with {len(grid_gdf):,} cells")
            
            # Extract features
            all_features = pd.DataFrame(index=grid_gdf.index)
            
            # Distance features
            self.logger.info("Extracting distance features...")
            distance_features = self.extract_distance_features(grid_gdf, data_sources, country_code)
            all_features = pd.concat([all_features, distance_features], axis=1)
            
            # Statistical features
            self.logger.info("Extracting statistical features...")
            statistical_features = self.extract_statistical_features(grid_gdf, data_sources, country_code)
            all_features = pd.concat([all_features, statistical_features], axis=1)
            
            # Morphometry features
            self.logger.info("Extracting morphometry features...")
            morphometry_features = self.extract_morphometry_features(grid_gdf, data_sources, country_code)
            all_features = pd.concat([all_features, morphometry_features], axis=1)
            
            # Geological features
            self.logger.info("Extracting geological features...")
            geological_features = self.extract_geological_features(grid_gdf, data_sources, country_code)
            all_features = pd.concat([all_features, geological_features], axis=1)
            
            # Geochemical features (if available)
            if data_sources.get('geochem'):
                self.logger.info("Extracting geochemical features...")
                geochemical_features = self.extract_geochemical_features(grid_gdf, data_sources, country_code)
                all_features = pd.concat([all_features, geochemical_features], axis=1)
            
            # Environmental features (if available)
            if data_sources.get('esg'):
                self.logger.info("Extracting environmental features...")
                environmental_features = self.extract_environmental_features(grid_gdf, data_sources, country_code)
                all_features = pd.concat([all_features, environmental_features], axis=1)
            
            self.logger.info(f"Extracted {len(all_features.columns)} features total")
            
            # Normalize features
            self.logger.info("Normalizing features...")
            normalized_features, normalization_params = self.normalize_features(all_features)
            
            # Write feature store
            self.logger.info("Writing feature store...")
            output_paths = self.write_feature_store(grid_gdf, normalized_features, normalization_params, country_code)
            
            processing_time = time.time() - start_time
            
            self.logger.log_dataset_complete('feature_store', country_code, len(grid_gdf), processing_time)
            
            return {
                'country': country_code,
                'status': 'success',
                'grid_cells': len(grid_gdf),
                'total_features': len(all_features.columns),
                'processing_time': processing_time,
                'outputs': output_paths,
                'feature_summary': {
                    'distance_features': len([col for col in all_features.columns if col.startswith('dist_to_')]),
                    'statistical_features': len([col for col in all_features.columns if any(stat in col for stat in ['mean', 'std', 'entropy'])]),
                    'morphometry_features': len([col for col in all_features.columns if any(morph in col for morph in ['slope', 'curvature', 'elevation'])]),
                    'geological_features': len([col for col in all_features.columns if any(geo in col for geo in ['lithology', 'age', 'structure'])]),
                    'geochemical_features': len([col for col in all_features.columns if 'interpolated' in col]),
                    'environmental_features': len([col for col in all_features.columns if any(env in col for env in ['esg', 'protected', 'water'])])
                },
                'data_sources_used': {k: len(v) for k, v in data_sources.items() if v},
                'grid_resolution': self.grid_resolution,
                'normalization_method': 'robust_scaling'
            }
            
        except Exception as e:
            self.logger.error(f"Failed to build feature store for {country_code}", error=str(e))
            return {
                'country': country_code,
                'status': 'failed',
                'processing_time': time.time() - start_time,
                'error': str(e)
            }