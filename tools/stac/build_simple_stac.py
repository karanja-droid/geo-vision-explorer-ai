#!/usr/bin/env python3
"""
GeoVision AI Miner - Simple STAC Catalog Builder
Lightweight version for quick STAC catalog generation from COG files
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
import boto3
import rasterio
import pystac
from pystac.extensions.eo import EOExtension
from pystac.extensions.projection import ProjectionExtension


def build_item(asset_href: str, collection_id: str, data_type: str = "spectral") -> pystac.Item:
    """Build a STAC item from a COG file"""
    
    try:
        # Handle both local and S3 paths
        if asset_href.startswith('s3://'):
            # For S3 paths, we'll use rasterio's S3 support
            with rasterio.Env(AWS_NO_SIGN_REQUEST='YES'):
                with rasterio.open(asset_href) as src:
                    bbox = list(src.bounds)
                    transform = src.transform
                    crs = src.crs
                    width = src.width
                    height = src.height
                    count = src.count
        else:
            # Local file
            with rasterio.open(asset_href) as src:
                bbox = list(src.bounds)
                transform = src.transform
                crs = src.crs
                width = src.width
                height = src.height
                count = src.count
        
        # Create footprint geometry
        footprint = [
            [bbox[0], bbox[1]],  # bottom-left
            [bbox[0], bbox[3]],  # top-left
            [bbox[2], bbox[3]],  # top-right
            [bbox[2], bbox[1]],  # bottom-right
            [bbox[0], bbox[1]]   # close polygon
        ]
        
        geometry = {
            "type": "Polygon", 
            "coordinates": [footprint]
        }
        
        # Extract date from filename if possible
        filename = os.path.basename(asset_href)
        item_id = filename.replace(".tif", "").replace("_cog", "")
        
        # Try to extract date from filename (format: YYYYMMDD_*)
        try:
            date_part = item_id.split('_')[0]
            if len(date_part) == 8 and date_part.isdigit():
                item_datetime = datetime.strptime(date_part, '%Y%m%d').replace(tzinfo=timezone.utc)
            else:
                item_datetime = datetime.now(timezone.utc)
        except:
            item_datetime = datetime.now(timezone.utc)
        
        # Create STAC item
        item = pystac.Item(
            id=item_id,
            geometry=geometry,
            bbox=bbox,
            datetime=item_datetime,
            properties={
                "geovision:source": "COG",
                "geovision:data_type": data_type,
                "geovision:processing_level": "L2A",
                "proj:epsg": crs.to_epsg() if crs else None,
                "proj:shape": [height, width],
                "proj:transform": list(transform)[:6] if transform else None
            }
        )
        
        # Add COG asset
        item.add_asset(
            "cog", 
            pystac.Asset(
                href=asset_href, 
                media_type=pystac.MediaType.COG, 
                roles=["data"],
                title=f"{data_type.title()} data (COG format)"
            )
        )
        
        # Add EO extension for spectral data
        if data_type in ['spectral', 'hyperspectral'] and count > 1:
            eo_ext = EOExtension.add_to(item)
            # Simple band info - could be enhanced based on data type
            bands = []
            for i in range(min(count, 11)):  # Limit to reasonable number
                bands.append({
                    "name": f"band_{i+1}",
                    "description": f"Band {i+1}"
                })
            eo_ext.bands = bands
        
        # Add projection extension
        if crs:
            proj_ext = ProjectionExtension.add_to(item)
            proj_ext.epsg = crs.to_epsg()
            if transform:
                proj_ext.transform = list(transform)[:6]
            proj_ext.shape = [height, width]
        
        return item
        
    except Exception as e:
        print(f"Error processing {asset_href}: {e}")
        return None


def discover_cogs(bucket: str, prefix: str) -> List[str]:
    """Discover COG files in S3 bucket"""
    
    cog_files = []
    
    try:
        s3_client = boto3.client('s3')
        bucket_name = bucket.replace('s3://', '')
        
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket_name, Prefix=prefix)
        
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    if key.endswith('_cog.tif') or key.endswith('.cog.tif'):
                        cog_files.append(f"s3://{bucket_name}/{key}")
        
        print(f"Found {len(cog_files)} COG files in {bucket}/{prefix}")
        
    except Exception as e:
        print(f"Error listing S3 objects: {e}")
        # Fallback: try local directory if bucket looks like a path
        if not bucket.startswith('s3://'):
            try:
                local_path = Path(bucket) / prefix
                if local_path.exists():
                    cog_files = [str(f) for f in local_path.glob('**/*_cog.tif')]
                    cog_files.extend([str(f) for f in local_path.glob('**/*.cog.tif')])
            except Exception as local_e:
                print(f"Error listing local files: {local_e}")
    
    return cog_files


def determine_data_type(filename: str) -> str:
    """Determine data type from filename"""
    filename_lower = filename.lower()
    
    if 'hyperspectral' in filename_lower or 'hyperion' in filename_lower:
        return 'hyperspectral'
    elif 'magnetic' in filename_lower or 'mag' in filename_lower:
        return 'magnetic'
    elif 'gravity' in filename_lower or 'grav' in filename_lower:
        return 'gravity'
    elif 'core' in filename_lower or 'drill' in filename_lower:
        return 'core-imagery'
    else:
        return 'spectral'


def main():
    parser = argparse.ArgumentParser(
        description="Build simple STAC catalog from COG files"
    )
    parser.add_argument("--bucket", required=True, 
                       help="S3 bucket (s3://bucket-name) or local directory")
    parser.add_argument("--prefix", required=True, 
                       help="S3 prefix or subdirectory path")
    parser.add_argument("--output", default="./stac-catalog", 
                       help="Output directory for STAC catalog")
    parser.add_argument("--collection-id", default="geovision-baseline",
                       help="Collection ID")
    parser.add_argument("--collection-title", default="GeoVision Baseline Data",
                       help="Collection title")
    parser.add_argument("--country", default="GLOBAL",
                       help="Country code for spatial extent")
    
    args = parser.parse_args()
    
    print(f"🌍 Building simple STAC catalog from {args.bucket}/{args.prefix}")
    
    # Create collection
    # Default to global extent - could be refined based on actual data
    spatial_extents = {
        'GLOBAL': [[-180, -90, 180, 90]],
        'ZMB': [[21.999, -18.079, 33.701, -8.224]],  # Zambia
        'USA': [[-179.148, 18.910, -66.946, 71.365]],  # USA
        'AUS': [[112.921, -54.777, 159.109, -9.221]]   # Australia
    }
    
    spatial_extent = spatial_extents.get(args.country, spatial_extents['GLOBAL'])
    
    collection = pystac.Collection(
        id=args.collection_id,
        description=f"{args.collection_title} - Cloud-optimized geological rasters",
        extent=pystac.Extent(
            spatial=pystac.SpatialExtent(spatial_extent),
            temporal=pystac.TemporalExtent([[datetime(2020, 1, 1, tzinfo=timezone.utc), None]])
        ),
        title=args.collection_title,
        keywords=["geology", "geophysics", "mineral exploration", "remote sensing", "COG"],
        providers=[
            pystac.Provider(
                name="GeoVision AI Miner",
                roles=["processor", "host"],
                url="https://geovision.ai"
            )
        ],
        license="proprietary"
    )
    
    # Add collection-level properties
    collection.extra_fields.update({
        "geovision:processing_level": "L2A",
        "geovision:format": "COG",
        "geovision:country": args.country
    })
    
    # Discover COG files
    cog_files = discover_cogs(args.bucket, args.prefix)
    
    if not cog_files:
        print("⚠️  No COG files found. Please check bucket/prefix path.")
        sys.exit(1)
    
    # Process each COG file
    items_added = 0
    for cog_href in cog_files:
        print(f"Processing: {os.path.basename(cog_href)}")
        
        # Determine data type from filename
        data_type = determine_data_type(cog_href)
        
        # Build STAC item
        item = build_item(cog_href, args.collection_id, data_type)
        
        if item:
            collection.add_item(item)
            items_added += 1
        else:
            print(f"⚠️  Failed to process {cog_href}")
    
    if items_added == 0:
        print("❌ No items were successfully added to the collection.")
        sys.exit(1)
    
    # Create output directory
    os.makedirs(args.output, exist_ok=True)
    
    # Save catalog
    try:
        collection.normalize_hrefs(args.output)
        collection.save(catalog_type=pystac.CatalogType.SELF_CONTAINED)
        
        # Validate catalog
        collection_dict = collection.to_dict()
        pystac.validation.validate_dict(collection_dict, pystac.STACObjectType.COLLECTION)
        
        print(f"✅ STAC catalog written to {args.output}")
        print(f"📊 Collection: {args.collection_id}")
        print(f"📄 Items added: {items_added}")
        print(f"🔗 Catalog root: {args.output}/collection.json")
        
        # Print summary
        data_types = {}
        for item in collection.get_items():
            dt = item.properties.get('geovision:data_type', 'unknown')
            data_types[dt] = data_types.get(dt, 0) + 1
        
        print(f"📈 Data types: {dict(data_types)}")
        
    except Exception as e:
        print(f"❌ Error saving catalog: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()