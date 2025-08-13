#!/usr/bin/env python3
"""
GeoVision AI Miner - STAC Catalog Builder for Geological Data
Builds STAC-compliant catalogs for geological and geophysical datasets
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import boto3
import rasterio
from pystac import (
    Catalog, Collection, Item, Asset, Extent, SpatialExtent, 
    TemporalExtent, Provider, Link, MediaType
)
from pystac.extensions.eo import EOExtension
from pystac.extensions.projection import ProjectionExtension
from pystac.extensions.scientific import ScientificExtension
import pystac.validation


class GeologicalSTACBuilder:
    """Builds STAC catalogs for geological datasets"""
    
    def __init__(self, bucket: str, prefix: str, country: str):
        self.bucket = bucket
        self.prefix = prefix
        self.country = country
        self.s3_client = boto3.client('s3')
        
        # Geological data type mappings
        self.data_type_mapping = {
            'spectral': 'Multi-spectral satellite imagery for mineral exploration',
            'hyperspectral': 'Hyperspectral imagery for detailed mineral identification',
            'magnetic': 'Aeromagnetic survey data for geological structure mapping',
            'gravity': 'Gravity survey data for subsurface density mapping',
            'radiometric': 'Radiometric survey data for geological mapping',
            'lidar': 'LiDAR elevation data for topographic analysis',
            'core-imagery': 'Drill core photography for geological logging'
        }
        
        # Mineral target keywords
        self.mineral_keywords = {
            'gold': ['gold', 'au', 'precious-metals', 'orogenic'],
            'copper': ['copper', 'cu', 'porphyry', 'base-metals'],
            'iron': ['iron', 'fe', 'bif', 'magnetite', 'hematite'],
            'lithium': ['lithium', 'li', 'pegmatite', 'spodumene'],
            'uranium': ['uranium', 'u', 'sandstone', 'unconformity'],
            'diamond': ['diamond', 'kimberlite', 'lamproite'],
            'coal': ['coal', 'thermal', 'coking', 'lignite']
        }

    def build_catalog(self, data_type: str, sensor: str, target_mineral: str, 
                     spatial_resolution: float, spectral_bands: int) -> Catalog:
        """Build the main STAC catalog"""
        
        catalog_id = f"geovision-{self.country.lower()}-geological-data"
        
        catalog = Catalog(
            id=catalog_id,
            description=f"GeoVision AI Miner geological datasets for {self.country}",
            title=f"Geological Survey Data - {self.country}",
            stac_extensions=[
                "https://stac-extensions.github.io/eo/v1.0.0/schema.json",
                "https://stac-extensions.github.io/projection/v1.0.0/schema.json",
                "https://stac-extensions.github.io/scientific/v1.0.0/schema.json"
            ]
        )
        
        # Add catalog-level metadata
        catalog.extra_fields.update({
            "geological:country": self.country,
            "geological:primary_target": target_mineral,
            "geological:data_types": [data_type],
            "geological:processing_level": "L2A",
            "geological:coordinate_system": "EPSG:4326"
        })
        
        return catalog

    def create_collection(self, data_type: str, sensor: str, target_mineral: str,
                         spatial_resolution: float, spectral_bands: int) -> Collection:
        """Create a STAC collection for geological data"""
        
        collection_id = f"{data_type}-{sensor}-{self.country.lower()}"
        
        # Calculate spatial extent (would be dynamic in production)
        spatial_extent = SpatialExtent([[-180, -90, 180, 90]])  # Global for now
        
        # Calculate temporal extent
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
        end_date = datetime.now(timezone.utc)
        temporal_extent = TemporalExtent([[start_date, end_date]])
        
        extent = Extent(spatial_extent, temporal_extent)
        
        collection = Collection(
            id=collection_id,
            description=self.data_type_mapping.get(data_type, f"{data_type} geological data"),
            extent=extent,
            title=f"{data_type.title()} Data Collection - {self.country}",
            keywords=self._get_keywords(data_type, target_mineral),
            providers=[
                Provider(
                    name="GeoVision AI Miner",
                    roles=["processor", "host"],
                    url="https://geovision.ai"
                )
            ],
            license="proprietary"
        )
        
        # Add collection-level summaries
        collection.summaries.add("geological:data_type", [data_type])
        collection.summaries.add("geological:sensor", [sensor])
        collection.summaries.add("geological:target_mineral", [target_mineral])
        collection.summaries.add("gsd", [spatial_resolution])
        
        if spectral_bands > 0:
            collection.summaries.add("eo:bands", list(range(1, spectral_bands + 1)))
        
        # Add scientific extension
        scientific_ext = ScientificExtension.ext(collection, add_if_missing=True)
        scientific_ext.doi = f"10.5194/geovision-{collection_id}"
        scientific_ext.citation = f"GeoVision AI Miner {data_type} dataset for {self.country} geological exploration"
        
        return collection

    def create_item_from_cog(self, cog_path: str, data_type: str, sensor: str,
                           acquisition_date: datetime) -> Item:
        """Create a STAC item from a COG file"""
        
        # Extract metadata from COG
        with rasterio.open(cog_path) as dataset:
            bounds = dataset.bounds
            crs = dataset.crs
            transform = dataset.transform
            width = dataset.width
            height = dataset.height
            count = dataset.count
            dtype = dataset.dtypes[0]
        
        # Create item ID
        item_id = f"{data_type}-{sensor}-{acquisition_date.strftime('%Y%m%d')}"
        
        # Create geometry from bounds
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [bounds.left, bounds.bottom],
                [bounds.right, bounds.bottom],
                [bounds.right, bounds.top],
                [bounds.left, bounds.top],
                [bounds.left, bounds.bottom]
            ]]
        }
        
        bbox = [bounds.left, bounds.bottom, bounds.right, bounds.top]
        
        # Create STAC item
        item = Item(
            id=item_id,
            geometry=geometry,
            bbox=bbox,
            datetime=acquisition_date,
            properties={
                "geological:data_type": data_type,
                "geological:sensor": sensor,
                "geological:processing_level": "L2A",
                "geological:pixel_size": abs(transform.a),
                "geological:coordinate_system": str(crs)
            }
        )
        
        # Add EO extension for spectral data
        if data_type in ['spectral', 'hyperspectral']:
            eo_ext = EOExtension.ext(item, add_if_missing=True)
            eo_ext.bands = self._create_band_info(data_type, count)
        
        # Add projection extension
        proj_ext = ProjectionExtension.ext(item, add_if_missing=True)
        proj_ext.epsg = crs.to_epsg()
        proj_ext.wkt2 = crs.to_wkt()
        proj_ext.transform = list(transform)[:6]
        proj_ext.shape = [height, width]
        
        # Add assets
        item.add_asset(
            "data",
            Asset(
                href=cog_path,
                media_type=MediaType.COG,
                roles=["data"],
                title=f"{data_type} data",
                extra_fields={
                    "geological:data_type": data_type,
                    "raster:bands": [{"data_type": dtype, "nodata": None}] * count
                }
            )
        )
        
        # Add thumbnail if available
        thumbnail_path = cog_path.replace('.tif', '_thumbnail.png')
        if self._file_exists_s3(thumbnail_path):
            item.add_asset(
                "thumbnail",
                Asset(
                    href=thumbnail_path,
                    media_type=MediaType.PNG,
                    roles=["thumbnail"],
                    title="Thumbnail"
                )
            )
        
        return item

    def _get_keywords(self, data_type: str, target_mineral: str) -> List[str]:
        """Generate keywords for the collection"""
        keywords = ["geology", "geophysics", "mineral exploration", "remote sensing"]
        
        # Add data type specific keywords
        if data_type == "spectral":
            keywords.extend(["multispectral", "satellite", "landsat", "sentinel"])
        elif data_type == "hyperspectral":
            keywords.extend(["hyperspectral", "mineral mapping", "spectroscopy"])
        elif data_type == "magnetic":
            keywords.extend(["aeromagnetic", "magnetic anomaly", "geological structure"])
        elif data_type == "gravity":
            keywords.extend(["gravity", "bouguer anomaly", "density mapping"])
        
        # Add mineral-specific keywords
        if target_mineral in self.mineral_keywords:
            keywords.extend(self.mineral_keywords[target_mineral])
        
        return keywords

    def _create_band_info(self, data_type: str, band_count: int) -> List[Dict]:
        """Create band information for EO extension"""
        bands = []
        
        if data_type == "spectral" and band_count >= 7:
            # Landsat-like bands
            band_info = [
                {"name": "coastal", "common_name": "coastal", "center_wavelength": 0.44},
                {"name": "blue", "common_name": "blue", "center_wavelength": 0.48},
                {"name": "green", "common_name": "green", "center_wavelength": 0.56},
                {"name": "red", "common_name": "red", "center_wavelength": 0.65},
                {"name": "nir", "common_name": "nir", "center_wavelength": 0.86},
                {"name": "swir16", "common_name": "swir16", "center_wavelength": 1.61},
                {"name": "swir22", "common_name": "swir22", "center_wavelength": 2.20}
            ]
            bands = band_info[:min(band_count, len(band_info))]
        else:
            # Generic bands
            for i in range(band_count):
                bands.append({
                    "name": f"band_{i+1}",
                    "description": f"Band {i+1}"
                })
        
        return bands

    def _file_exists_s3(self, s3_path: str) -> bool:
        """Check if file exists in S3"""
        try:
            bucket = s3_path.split('/')[2]
            key = '/'.join(s3_path.split('/')[3:])
            self.s3_client.head_object(Bucket=bucket, Key=key)
            return True
        except:
            return False

    def list_cog_files(self) -> List[str]:
        """List all COG files in the S3 bucket/prefix"""
        cog_files = []
        
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(
                Bucket=self.bucket.replace('s3://', ''),
                Prefix=self.prefix
            )
            
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        if obj['Key'].endswith('_cog.tif'):
                            cog_files.append(f"s3://{self.bucket.replace('s3://', '')}/{obj['Key']}")
        
        except Exception as e:
            print(f"Error listing S3 objects: {e}")
        
        return cog_files

    def build_full_catalog(self, data_type: str, sensor: str, target_mineral: str,
                          spatial_resolution: float, spectral_bands: int) -> Catalog:
        """Build complete STAC catalog with collections and items"""
        
        # Create main catalog
        catalog = self.build_catalog(data_type, sensor, target_mineral, 
                                   spatial_resolution, spectral_bands)
        
        # Create collection
        collection = self.create_collection(data_type, sensor, target_mineral,
                                          spatial_resolution, spectral_bands)
        
        # Add collection to catalog
        catalog.add_child(collection)
        
        # List COG files and create items
        cog_files = self.list_cog_files()
        
        for cog_path in cog_files:
            try:
                # Extract acquisition date from filename (simplified)
                filename = os.path.basename(cog_path)
                # Assume format: YYYYMMDD_*_cog.tif
                date_str = filename.split('_')[0]
                if len(date_str) == 8 and date_str.isdigit():
                    acquisition_date = datetime.strptime(date_str, '%Y%m%d').replace(tzinfo=timezone.utc)
                else:
                    acquisition_date = datetime.now(timezone.utc)
                
                # Create STAC item
                item = self.create_item_from_cog(cog_path, data_type, sensor, acquisition_date)
                collection.add_item(item)
                
                print(f"Added item: {item.id}")
                
            except Exception as e:
                print(f"Error processing {cog_path}: {e}")
                continue
        
        return catalog

    def save_catalog(self, catalog: Catalog, output_dir: str):
        """Save STAC catalog to local directory and S3"""
        
        # Save locally
        catalog.normalize_hrefs(output_dir)
        catalog.save(catalog_type=pystac.CatalogType.SELF_CONTAINED)
        
        # Validate catalog
        try:
            pystac.validation.validate_dict(catalog.to_dict(), pystac.STACObjectType.CATALOG)
            print("✅ STAC catalog validation passed")
        except Exception as e:
            print(f"⚠️  STAC catalog validation failed: {e}")
        
        # Upload to S3
        self._upload_directory_to_s3(output_dir, f"{self.prefix}/stac/")
        
        print(f"📋 STAC catalog saved to {output_dir} and uploaded to S3")

    def _upload_directory_to_s3(self, local_dir: str, s3_prefix: str):
        """Upload directory to S3"""
        bucket_name = self.bucket.replace('s3://', '')
        
        for root, dirs, files in os.walk(local_dir):
            for file in files:
                local_path = os.path.join(root, file)
                relative_path = os.path.relpath(local_path, local_dir)
                s3_key = f"{s3_prefix}{relative_path}".replace('\\', '/')
                
                try:
                    self.s3_client.upload_file(
                        local_path, 
                        bucket_name, 
                        s3_key,
                        ExtraArgs={'ACL': 'bucket-owner-full-control'}
                    )
                except Exception as e:
                    print(f"Error uploading {local_path}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Build STAC catalog for geological data")
    parser.add_argument("--bucket", required=True, help="S3 bucket name")
    parser.add_argument("--prefix", required=True, help="S3 prefix")
    parser.add_argument("--country", required=True, help="Country code")
    parser.add_argument("--data-type", default="spectral", help="Data type")
    parser.add_argument("--sensor", default="landsat8", help="Sensor type")
    parser.add_argument("--target-mineral", default="copper", help="Target mineral")
    parser.add_argument("--spatial-resolution", type=float, default=30.0, help="Spatial resolution")
    parser.add_argument("--spectral-bands", type=int, default=11, help="Number of spectral bands")
    parser.add_argument("--output-dir", default="./stac_catalog", help="Output directory")
    
    args = parser.parse_args()
    
    # Create STAC builder
    builder = GeologicalSTACBuilder(args.bucket, args.prefix, args.country)
    
    # Build catalog
    print(f"🌍 Building STAC catalog for {args.data_type} data in {args.country}...")
    catalog = builder.build_full_catalog(
        args.data_type,
        args.sensor,
        args.target_mineral,
        args.spatial_resolution,
        args.spectral_bands
    )
    
    # Save catalog
    os.makedirs(args.output_dir, exist_ok=True)
    builder.save_catalog(catalog, args.output_dir)
    
    print(f"✅ STAC catalog build complete!")
    print(f"📊 Catalog contains {len(list(catalog.get_all_collections()))} collections")
    print(f"📄 Total items: {len(list(catalog.get_all_items()))}")


if __name__ == "__main__":
    main()