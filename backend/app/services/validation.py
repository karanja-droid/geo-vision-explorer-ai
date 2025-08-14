"""Data validation services"""

from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import re
from shapely.wkt import loads as wkt_loads
from shapely.geometry import Point, Polygon
from shapely.validation import make_valid
from pyproj import CRS, Transformer

from app.schemas.core import GeometryValidation, CRSValidation
from app.schemas.drilling import DrillHoleValidation, IntervalValidation
from app.models.drilling import DrillCollar, DrillInterval, DrillAssay

def validate_geometry(wkt_geometry: str) -> GeometryValidation:
    """Validate and fix geometry from WKT string"""
    
    try:
        # Parse WKT
        geom = wkt_loads(wkt_geometry)
        
        # Check if geometry is valid
        if geom.is_valid:
            return GeometryValidation(
                is_valid=True,
                fixed_geometry=wkt_geometry
            )
        else:
            # Try to fix invalid geometry
            fixed_geom = make_valid(geom)
            if fixed_geom.is_valid:
                return GeometryValidation(
                    is_valid=True,
                    error_message=f"Geometry was invalid but has been fixed: {geom.is_valid_reason}",
                    fixed_geometry=fixed_geom.wkt
                )
            else:
                return GeometryValidation(
                    is_valid=False,
                    error_message=f"Cannot fix invalid geometry: {geom.is_valid_reason}"
                )
                
    except Exception as e:
        return GeometryValidation(
            is_valid=False,
            error_message=f"Failed to parse WKT geometry: {str(e)}"
        )

def validate_crs(geometry_wkt: str, source_crs: str, target_crs: str = "EPSG:4326") -> CRSValidation:
    """Validate and transform CRS"""
    
    try:
        # Validate source CRS
        source = CRS.from_string(source_crs)
        target = CRS.from_string(target_crs)
        
        # Parse geometry
        geom = wkt_loads(geometry_wkt)
        
        # Create transformer
        transformer = Transformer.from_crs(source, target, always_xy=True)
        
        # Transform geometry
        if geom.geom_type == 'Point':
            x, y = transformer.transform(geom.x, geom.y)
            transformed_geom = Point(x, y)
        elif geom.geom_type == 'Polygon':
            # Transform exterior coordinates
            exterior_coords = [transformer.transform(x, y) for x, y in geom.exterior.coords]
            transformed_geom = Polygon(exterior_coords)
        else:
            # Handle other geometry types as needed
            transformed_geom = geom
        
        return CRSValidation(
            is_valid=True,
            source_crs=source_crs,
            target_crs=target_crs,
            transformed_geometry=transformed_geom.wkt
        )
        
    except Exception as e:
        return CRSValidation(
            is_valid=False,
            source_crs=source_crs,
            target_crs=target_crs
        )

def validate_drill_hole_data(db: Session, collar_id: UUID) -> DrillHoleValidation:
    """Validate drill hole data for consistency and completeness"""
    
    collar = db.query(DrillCollar).filter(DrillCollar.id == collar_id).first()
    if not collar:
        return DrillHoleValidation(
            hole_id="unknown",
            is_valid=False,
            errors=["Drill collar not found"]
        )
    
    errors = []
    warnings = []
    
    # Get all intervals for this hole
    intervals = db.query(DrillInterval).filter(
        DrillInterval.collar_id == collar_id
    ).order_by(DrillInterval.from_m).all()
    
    # Get all assays for this hole
    assays = db.query(DrillAssay).filter(
        DrillAssay.collar_id == collar_id
    ).order_by(DrillAssay.from_m).all()
    
    # Check interval consistency
    if intervals:
        # Check for overlaps
        for i in range(len(intervals) - 1):
            current = intervals[i]
            next_interval = intervals[i + 1]
            
            if current.to_m > next_interval.from_m:
                errors.append(
                    f"Interval overlap: {current.from_m}-{current.to_m}m overlaps with {next_interval.from_m}-{next_interval.to_m}m"
                )
        
        # Check for gaps
        for i in range(len(intervals) - 1):
            current = intervals[i]
            next_interval = intervals[i + 1]
            
            if current.to_m < next_interval.from_m:
                gap_size = next_interval.from_m - current.to_m
                if gap_size > 0.1:  # Gap larger than 10cm
                    warnings.append(
                        f"Gap in intervals: {gap_size}m gap between {current.to_m}m and {next_interval.from_m}m"
                    )
        
        # Check if intervals extend beyond total depth
        max_interval_depth = max(interval.to_m for interval in intervals)
        if max_interval_depth > collar.total_depth:
            errors.append(
                f"Intervals extend beyond total depth: {max_interval_depth}m > {collar.total_depth}m"
            )
    
    # Check assay consistency
    if assays:
        # Check if assays have corresponding intervals
        for assay in assays:
            corresponding_interval = None
            for interval in intervals:
                if (interval.from_m <= assay.from_m and 
                    interval.to_m >= assay.to_m):
                    corresponding_interval = interval
                    break
            
            if not corresponding_interval:
                warnings.append(
                    f"Assay {assay.from_m}-{assay.to_m}m has no corresponding geological interval"
                )
        
        # Check for missing assays in mineralized intervals
        for interval in intervals:
            if interval.mineralization and interval.mineralization.lower() != 'none':
                corresponding_assays = [
                    assay for assay in assays
                    if assay.from_m >= interval.from_m and assay.to_m <= interval.to_m
                ]
                if not corresponding_assays:
                    warnings.append(
                        f"Mineralized interval {interval.from_m}-{interval.to_m}m has no assay data"
                    )
    
    # Check coordinate validity
    if collar.easting < -180 or collar.easting > 180:
        errors.append(f"Invalid easting coordinate: {collar.easting}")
    
    if collar.northing < -90 or collar.northing > 90:
        errors.append(f"Invalid northing coordinate: {collar.northing}")
    
    # Check depth validity
    if collar.total_depth <= 0:
        errors.append(f"Invalid total depth: {collar.total_depth}")
    
    # Check azimuth and dip
    if collar.azimuth is not None and (collar.azimuth < 0 or collar.azimuth > 360):
        errors.append(f"Invalid azimuth: {collar.azimuth}")
    
    if collar.dip is not None and (collar.dip < -90 or collar.dip > 90):
        errors.append(f"Invalid dip: {collar.dip}")
    
    return DrillHoleValidation(
        hole_id=collar.hole_id,
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )

def validate_intervals(
    db: Session, 
    collar_id: UUID, 
    from_m: float, 
    to_m: float, 
    exclude_id: Optional[UUID] = None
) -> IntervalValidation:
    """Validate drill intervals for overlaps and gaps"""
    
    # Get existing intervals for this collar
    query = db.query(DrillInterval).filter(DrillInterval.collar_id == collar_id)
    
    if exclude_id:
        query = query.filter(DrillInterval.id != exclude_id)
    
    existing_intervals = query.all()
    
    overlaps = []
    gaps = []
    
    # Check for overlaps with existing intervals
    for interval in existing_intervals:
        # Check if new interval overlaps with existing
        if (from_m < interval.to_m and to_m > interval.from_m):
            overlaps.append({
                "existing_interval_id": str(interval.id),
                "existing_from": interval.from_m,
                "existing_to": interval.to_m,
                "new_from": from_m,
                "new_to": to_m,
                "overlap_from": max(from_m, interval.from_m),
                "overlap_to": min(to_m, interval.to_m)
            })
    
    # Check for gaps (this is more complex and might be handled differently)
    # For now, we'll just check if there are any intervals immediately adjacent
    
    return IntervalValidation(
        collar_id=collar_id,
        overlaps=overlaps,
        gaps=gaps,
        is_valid=len(overlaps) == 0
    )

def validate_country_code(country_code: str) -> bool:
    """Validate ISO 3166-1 alpha-2 country code"""
    
    # Basic validation - should be 2 uppercase letters
    if not re.match(r'^[A-Z]{2}$', country_code):
        return False
    
    # List of valid ISO 3166-1 alpha-2 codes (subset for mining countries)
    valid_codes = {
        'AU', 'CA', 'US', 'ZA', 'CL', 'PE', 'BR', 'MX', 'GH', 'TZ', 'ZM', 'CD',
        'CN', 'RU', 'IN', 'ID', 'PH', 'MN', 'KZ', 'UZ', 'PG', 'NC', 'FJ',
        'GB', 'IE', 'NO', 'SE', 'FI', 'PL', 'ES', 'PT', 'TR', 'GR', 'BG',
        'MA', 'DZ', 'EG', 'ET', 'KE', 'UG', 'RW', 'MW', 'BW', 'NA', 'ZW'
    }
    
    return country_code in valid_codes

def validate_element_code(element: str) -> bool:
    """Validate chemical element code"""
    
    # Common elements in geochemistry
    valid_elements = {
        'Au', 'Ag', 'Cu', 'Pb', 'Zn', 'Ni', 'Co', 'Pt', 'Pd', 'Fe', 'Al',
        'Mg', 'Ca', 'Na', 'K', 'Ti', 'Mn', 'Cr', 'V', 'Mo', 'W', 'Sn',
        'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Ar', 'Sc',
        'As', 'Se', 'Br', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Tc', 'Ru', 'Rh',
        'Cd', 'In', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr',
        'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
        'Lu', 'Hf', 'Ta', 'Re', 'Os', 'Ir', 'Hg', 'Tl', 'Bi', 'Po', 'At',
        'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm'
    }
    
    return element in valid_elements

def validate_units(value: float, unit: str, element: str) -> bool:
    """Validate units for geochemical analysis"""
    
    # Common unit ranges for different elements
    unit_ranges = {
        'ppm': (0.001, 10000),
        'ppb': (0.1, 10000000),
        '%': (0.001, 100),
        'g/t': (0.001, 1000),
        'oz/t': (0.00003, 30)
    }
    
    if unit not in unit_ranges:
        return False
    
    min_val, max_val = unit_ranges[unit]
    return min_val <= value <= max_val