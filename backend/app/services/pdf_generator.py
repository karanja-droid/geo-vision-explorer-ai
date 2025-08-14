"""PDF report generation services"""

from sqlalchemy.orm import Session
from typing import Dict, Any, List
from uuid import UUID
from io import BytesIO
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_pdf import PdfPages
import pandas as pd
import numpy as np
from datetime import datetime

from app.models.core import Project, Organization
from app.models.drilling import DrillCollar, DrillInterval, DrillAssay
from app.models.geology import RasterAsset, RemoteSensing

async def generate_drilling_report(db: Session, project_id: UUID) -> BytesIO:
    """Generate comprehensive drilling report PDF"""
    
    # Get project and organization info
    project = db.query(Project).filter(Project.id == project_id).first()
    organization = db.query(Organization).filter(Organization.id == project.org_id).first()
    
    # Get drilling data
    collars = db.query(DrillCollar).filter(DrillCollar.project_id == project_id).all()
    
    # Create PDF buffer
    pdf_buffer = BytesIO()
    
    with PdfPages(pdf_buffer) as pdf:
        # Title page
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.axis('off')
        
        # Title
        ax.text(0.5, 0.8, 'DRILLING REPORT', 
                horizontalalignment='center', fontsize=24, fontweight='bold')
        
        # Project info
        ax.text(0.5, 0.7, f'Project: {project.name}', 
                horizontalalignment='center', fontsize=16)
        ax.text(0.5, 0.65, f'Organization: {organization.name}', 
                horizontalalignment='center', fontsize=14)
        ax.text(0.5, 0.6, f'Countries: {", ".join(project.countries)}', 
                horizontalalignment='center', fontsize=12)
        
        # Report info
        ax.text(0.5, 0.4, f'Report Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}', 
                horizontalalignment='center', fontsize=12)
        ax.text(0.5, 0.35, f'Total Drill Holes: {len(collars)}', 
                horizontalalignment='center', fontsize=12)
        
        if collars:
            total_meters = sum(collar.total_depth for collar in collars)
            ax.text(0.5, 0.3, f'Total Meters Drilled: {total_meters:,.1f}m', 
                    horizontalalignment='center', fontsize=12)
        
        pdf.savefig(fig, bbox_inches='tight')
        plt.close(fig)
        
        if not collars:
            # No data page
            fig, ax = plt.subplots(figsize=(8.5, 11))
            ax.axis('off')
            ax.text(0.5, 0.5, 'No drilling data available for this project', 
                    horizontalalignment='center', fontsize=16)
            pdf.savefig(fig, bbox_inches='tight')
            plt.close(fig)
        else:
            # Summary statistics page
            await generate_drilling_summary_page(pdf, collars)
            
            # Collar location map
            await generate_collar_location_map(pdf, collars)
            
            # Drilling progress chart
            await generate_drilling_progress_chart(pdf, collars)
            
            # Individual hole summaries
            for collar in collars[:10]:  # Limit to first 10 holes
                await generate_hole_summary_page(pdf, db, collar)
    
    pdf_buffer.seek(0)
    return pdf_buffer

async def generate_drilling_summary_page(pdf: PdfPages, collars: List[DrillCollar]):
    """Generate drilling summary statistics page"""
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(11, 8.5))
    fig.suptitle('Drilling Summary Statistics', fontsize=16, fontweight='bold')
    
    # Depth distribution histogram
    depths = [collar.total_depth for collar in collars]
    ax1.hist(depths, bins=20, alpha=0.7, color='skyblue', edgecolor='black')
    ax1.set_xlabel('Total Depth (m)')
    ax1.set_ylabel('Number of Holes')
    ax1.set_title('Depth Distribution')
    ax1.grid(True, alpha=0.3)
    
    # Drill type pie chart
    drill_types = {}
    for collar in collars:
        drill_type = collar.drill_type or 'Unknown'
        drill_types[drill_type] = drill_types.get(drill_type, 0) + 1
    
    if drill_types:
        ax2.pie(drill_types.values(), labels=drill_types.keys(), autopct='%1.1f%%')
        ax2.set_title('Drill Types')
    
    # Status distribution
    statuses = {}
    for collar in collars:
        status = collar.status or 'Unknown'
        statuses[status] = statuses.get(status, 0) + 1
    
    if statuses:
        ax3.bar(statuses.keys(), statuses.values(), color='lightgreen', alpha=0.7)
        ax3.set_xlabel('Status')
        ax3.set_ylabel('Number of Holes')
        ax3.set_title('Drilling Status')
        ax3.tick_params(axis='x', rotation=45)
    
    # Cumulative depth chart
    sorted_collars = sorted(collars, key=lambda x: x.drill_date or datetime.min.date())
    cumulative_depth = np.cumsum([collar.total_depth for collar in sorted_collars])
    dates = [collar.drill_date or datetime.min.date() for collar in sorted_collars]
    
    ax4.plot(dates, cumulative_depth, marker='o', linewidth=2, markersize=4)
    ax4.set_xlabel('Date')
    ax4.set_ylabel('Cumulative Depth (m)')
    ax4.set_title('Drilling Progress')
    ax4.tick_params(axis='x', rotation=45)
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

async def generate_collar_location_map(pdf: PdfPages, collars: List[DrillCollar]):
    """Generate collar location map"""
    
    fig, ax = plt.subplots(figsize=(11, 8.5))
    
    # Extract coordinates
    eastings = [collar.easting for collar in collars]
    northings = [collar.northing for collar in collars]
    depths = [collar.total_depth for collar in collars]
    
    # Create scatter plot with depth as color
    scatter = ax.scatter(eastings, northings, c=depths, s=50, alpha=0.7, 
                        cmap='viridis', edgecolors='black', linewidth=0.5)
    
    # Add colorbar
    cbar = plt.colorbar(scatter, ax=ax)
    cbar.set_label('Total Depth (m)')
    
    # Add hole IDs as labels
    for collar in collars:
        ax.annotate(collar.hole_id, (collar.easting, collar.northing), 
                   xytext=(5, 5), textcoords='offset points', fontsize=8)
    
    ax.set_xlabel('Easting')
    ax.set_ylabel('Northing')
    ax.set_title('Drill Collar Locations')
    ax.grid(True, alpha=0.3)
    ax.set_aspect('equal', adjustable='box')
    
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

async def generate_drilling_progress_chart(pdf: PdfPages, collars: List[DrillCollar]):
    """Generate drilling progress timeline chart"""
    
    fig, ax = plt.subplots(figsize=(11, 8.5))
    
    # Group by month
    monthly_data = {}
    for collar in collars:
        if collar.drill_date:
            month_key = collar.drill_date.strftime('%Y-%m')
            if month_key not in monthly_data:
                monthly_data[month_key] = {'holes': 0, 'meters': 0}
            monthly_data[month_key]['holes'] += 1
            monthly_data[month_key]['meters'] += collar.total_depth
    
    if monthly_data:
        months = sorted(monthly_data.keys())
        holes_per_month = [monthly_data[month]['holes'] for month in months]
        meters_per_month = [monthly_data[month]['meters'] for month in months]
        
        # Create dual y-axis chart
        ax2 = ax.twinx()
        
        bars1 = ax.bar(months, holes_per_month, alpha=0.7, color='skyblue', label='Holes Drilled')
        line1 = ax2.plot(months, meters_per_month, color='red', marker='o', linewidth=2, label='Meters Drilled')
        
        ax.set_xlabel('Month')
        ax.set_ylabel('Number of Holes', color='blue')
        ax2.set_ylabel('Meters Drilled', color='red')
        ax.set_title('Monthly Drilling Progress')
        
        # Rotate x-axis labels
        plt.setp(ax.get_xticklabels(), rotation=45, ha='right')
        
        # Add legends
        ax.legend(loc='upper left')
        ax2.legend(loc='upper right')
        
        ax.grid(True, alpha=0.3)
    
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

async def generate_hole_summary_page(pdf: PdfPages, db: Session, collar: DrillCollar):
    """Generate individual hole summary page"""
    
    fig = plt.figure(figsize=(8.5, 11))
    
    # Title
    fig.suptitle(f'Drill Hole Summary: {collar.hole_id}', fontsize=16, fontweight='bold')
    
    # Hole information table
    ax1 = plt.subplot(3, 1, 1)
    ax1.axis('off')
    
    hole_info = [
        ['Hole ID', collar.hole_id],
        ['Easting', f'{collar.easting:.2f}'],
        ['Northing', f'{collar.northing:.2f}'],
        ['Elevation', f'{collar.elevation:.2f}m'],
        ['Total Depth', f'{collar.total_depth:.2f}m'],
        ['Azimuth', f'{collar.azimuth:.1f}°' if collar.azimuth else 'N/A'],
        ['Dip', f'{collar.dip:.1f}°' if collar.dip else 'N/A'],
        ['Drill Type', collar.drill_type or 'N/A'],
        ['Status', collar.status or 'N/A'],
        ['Drill Date', collar.drill_date.strftime('%Y-%m-%d') if collar.drill_date else 'N/A']
    ]
    
    table = ax1.table(cellText=hole_info, cellLoc='left', loc='center',
                     colWidths=[0.3, 0.7])
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2)
    
    # Get intervals for this hole
    intervals = db.query(DrillInterval).filter(
        DrillInterval.collar_id == collar.id
    ).order_by(DrillInterval.from_m).all()
    
    if intervals:
        # Lithology log
        ax2 = plt.subplot(3, 1, 2)
        
        # Create lithology colors
        lithologies = list(set(interval.lithology for interval in intervals if interval.lithology))
        colors = plt.cm.Set3(np.linspace(0, 1, len(lithologies)))
        lith_colors = dict(zip(lithologies, colors))
        
        for interval in intervals:
            if interval.lithology:
                color = lith_colors.get(interval.lithology, 'gray')
                ax2.barh(0, interval.to_m - interval.from_m, left=interval.from_m, 
                        height=0.8, color=color, alpha=0.7, edgecolor='black')
                
                # Add text label
                mid_point = (interval.from_m + interval.to_m) / 2
                ax2.text(mid_point, 0, interval.lithology, ha='center', va='center', 
                        fontsize=8, rotation=90)
        
        ax2.set_xlabel('Depth (m)')
        ax2.set_ylabel('Lithology')
        ax2.set_title('Lithology Log')
        ax2.set_ylim(-0.5, 0.5)
        ax2.set_xlim(0, collar.total_depth)
        ax2.grid(True, alpha=0.3)
    
    # Get assays for this hole
    assays = db.query(DrillAssay).filter(
        DrillAssay.collar_id == collar.id
    ).order_by(DrillAssay.from_m).all()
    
    if assays:
        # Assay chart (example for Au)
        ax3 = plt.subplot(3, 1, 3)
        
        au_values = []
        depths = []
        
        for assay in assays:
            if 'Au' in assay.elements:
                au_result = assay.elements['Au']
                if au_result.get('value') is not None:
                    au_values.append(au_result['value'])
                    depths.append((assay.from_m + assay.to_m) / 2)
        
        if au_values:
            ax3.plot(au_values, depths, marker='o', linewidth=2, markersize=4)
            ax3.set_xlabel('Au (g/t)')
            ax3.set_ylabel('Depth (m)')
            ax3.set_title('Gold Assay Profile')
            ax3.invert_yaxis()  # Depth increases downward
            ax3.grid(True, alpha=0.3)
    
    plt.tight_layout()
    pdf.savefig(fig, bbox_inches='tight')
    plt.close(fig)

async def generate_project_summary(db: Session, project_id: UUID) -> BytesIO:
    """Generate project summary PDF"""
    
    # Get project and organization info
    project = db.query(Project).filter(Project.id == project_id).first()
    organization = db.query(Organization).filter(Organization.id == project.org_id).first()
    
    # Create PDF buffer
    pdf_buffer = BytesIO()
    
    with PdfPages(pdf_buffer) as pdf:
        # Title page
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.axis('off')
        
        # Title
        ax.text(0.5, 0.8, 'PROJECT SUMMARY', 
                horizontalalignment='center', fontsize=24, fontweight='bold')
        
        # Project info
        ax.text(0.5, 0.7, f'Project: {project.name}', 
                horizontalalignment='center', fontsize=18, fontweight='bold')
        ax.text(0.5, 0.65, f'Organization: {organization.name}', 
                horizontalalignment='center', fontsize=14)
        ax.text(0.5, 0.6, f'Countries: {", ".join(project.countries)}', 
                horizontalalignment='center', fontsize=12)
        ax.text(0.5, 0.55, f'Classification: {project.data_classification}', 
                horizontalalignment='center', fontsize=12)
        
        # Report info
        ax.text(0.5, 0.4, f'Report Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}', 
                horizontalalignment='center', fontsize=12)
        
        # Data summary
        collar_count = db.query(DrillCollar).filter(DrillCollar.project_id == project_id).count()
        raster_count = db.query(RasterAsset).filter(RasterAsset.project_id == project_id).count()
        rs_count = db.query(RemoteSensing).filter(RemoteSensing.project_id == project_id).count()
        
        ax.text(0.5, 0.3, 'DATA SUMMARY', 
                horizontalalignment='center', fontsize=14, fontweight='bold')
        ax.text(0.5, 0.25, f'Drill Holes: {collar_count}', 
                horizontalalignment='center', fontsize=12)
        ax.text(0.5, 0.22, f'Raster Assets: {raster_count}', 
                horizontalalignment='center', fontsize=12)
        ax.text(0.5, 0.19, f'Remote Sensing Scenes: {rs_count}', 
                horizontalalignment='center', fontsize=12)
        
        pdf.savefig(fig, bbox_inches='tight')
        plt.close(fig)
    
    pdf_buffer.seek(0)
    return pdf_buffer