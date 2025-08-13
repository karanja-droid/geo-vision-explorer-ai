# 🧨 Drill & Blast AI Module - Implementation Plan for GeoVision AI Miner

## 🎯 Executive Summary

The Drill & Blast AI module represents a significant expansion of GeoVision AI Miner into operational mining analytics. This module will provide real-time blast performance analysis, predictive modeling, and optimization recommendations using DataRobot's AutoML platform.

## 🏗️ Architecture Integration

### **Integration with Existing GeoVision Stack**

```
┌─────────────────────────────────────────────────────────────┐
│                    GeoVision AI Miner Platform              │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                             │
│  ├── Drill & Blast Dashboard                               │
│  ├── 3D Blast Visualization                                │
│  └── Performance Analytics                                 │
├─────────────────────────────────────────────────────────────┤
│  Backend Services                                          │
│  ├── Existing: STAC API, Neo4j, Redis, Supabase          │
│  └── NEW: Drill & Blast AI Microservices                  │
│      ├── ingest-svc (Python FastAPI)                      │
│      ├── geom-svc (Python + PDAL/PCL)                     │
│      ├── ai-svc (DataRobot Integration)                   │
│      └── results-svc (Export & Visualization)             │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                               │
│  ├── PostgreSQL + PostGIS (metadata, vectors)            │
│  ├── Redis (caching, job queues)                          │
│  ├── Neo4j (blast relationships, optimization patterns)   │
│  └── S3/Object Storage (point clouds, models, results)    │
├─────────────────────────────────────────────────────────────┤
│  ML/AI Platform                                           │
│  ├── DataRobot AutoML                                     │
│  ├── Portable Prediction Server                           │
│  └── MLOps Pipeline                                       │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Business Impact & Pricing Integration

### **Market Opportunity**
- **Target Market**: Operational mining companies with active blasting operations
- **Market Size**: $2.5B global blast optimization software market
- **Customer Segments**: Open-pit mines, quarries, construction blasting
- **Competitive Advantage**: Only solution combining 3D analysis + AutoML + real-time optimization

### **Pricing Strategy Integration**

#### **Enhanced Tier Structure**
| Tier | Base Price | Drill & Blast Add-on | Total Price |
|------|------------|---------------------|-------------|
| **Professional** | $899 | +$500 | **$1,399** |
| **Enterprise** | $2,499 | +$1,000 | **$3,499** |
| **Global** | $7,999 | +$2,000 | **$9,999** |

#### **Value Proposition**
- **15-25% reduction** in overbreak/underbreak
- **20-30% improvement** in fragmentation consistency
- **10-15% optimization** in powder factor efficiency
- **$50,000-500,000 annual savings** per operation

## 🛠️ Technical Implementation

### **1. Microservices Architecture**

#### **ingest-svc (Data Ingestion Service)**
```python
# services/ingest/main.py
from fastapi import FastAPI, UploadFile, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import asyncio
from redis import Redis
from sqlalchemy.orm import Session

app = FastAPI(title="Drill & Blast Ingest Service", version="1.0.0")

class BlastMetadata(BaseModel):
    blast_id: str
    site: str
    crs: str
    design: dict
    preblast: dict
    postblast: dict
    pattern_csv: Optional[str]
    loading_csv: Optional[str]
    mwd_csv: Optional[str]
    boretrack_csv: Optional[str]
    options: dict = {}

@app.post("/api/v1/blast-analysis/run")
async def submit_blast_analysis(
    metadata: BlastMetadata,
    current_user: dict = Depends(get_current_user)
):
    """Submit blast analysis job"""
    try:
        # Validate inputs
        await validate_blast_data(metadata)
        
        # Create job
        job_id = f"JOB_{uuid.uuid4().hex[:8]}"
        
        # Store metadata
        await store_blast_metadata(metadata, job_id)
        
        # Enqueue processing job
        await enqueue_blast_job(job_id, metadata)
        
        return {
            "job_id": job_id,
            "blast_id": metadata.blast_id,
            "status": "queued"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def validate_blast_data(metadata: BlastMetadata):
    """Validate blast data inputs"""
    # Check file existence and formats
    # Validate CRS
    # Check data consistency
    pass

async def enqueue_blast_job(job_id: str, metadata: BlastMetadata):
    """Add job to Redis queue"""
    redis = Redis.from_url(settings.REDIS_URL)
    job_data = {
        "job_id": job_id,
        "metadata": metadata.dict(),
        "created_at": datetime.utcnow().isoformat()
    }
    await redis.lpush("blast_analysis_queue", json.dumps(job_data))
```

#### **geom-svc (Geometry Processing Service)**
```python
# services/geom/processor.py
import pdal
import numpy as np
from scipy.spatial.distance import cdist
from sklearn.cluster import DBSCAN
import open3d as o3d

class BlastGeometryProcessor:
    def __init__(self):
        self.resolution_cm = 10
        
    async def process_blast_geometry(self, job_data: dict):
        """Main geometry processing pipeline"""
        try:
            # Load point clouds
            pre_cloud = await self.load_point_cloud(job_data['preblast']['uri'])
            post_cloud = await self.load_point_cloud(job_data['postblast']['uri'])
            
            # Registration and alignment
            aligned_post = await self.register_point_clouds(pre_cloud, post_cloud)
            
            # Surface differencing
            diff_results = await self.compute_surface_difference(pre_cloud, aligned_post)
            
            # Volume calculations
            volumes = await self.calculate_volumes(diff_results, job_data['design'])
            
            # Hole analysis
            hole_analysis = await self.analyze_hole_performance(job_data)
            
            # Fragmentation analysis
            fragmentation = await self.analyze_fragmentation(aligned_post, job_data)
            
            return {
                "volumes": volumes,
                "holes": hole_analysis,
                "fragmentation": fragmentation,
                "surfaces": diff_results
            }
            
        except Exception as e:
            logger.error(f"Geometry processing failed: {e}")
            raise

    async def load_point_cloud(self, uri: str):
        """Load point cloud from S3/storage"""
        pipeline = pdal.Pipeline([
            {
                "type": "readers.las",
                "filename": uri
            },
            {
                "type": "filters.crop",
                "bounds": self.get_processing_bounds()
            }
        ])
        pipeline.execute()
        return pipeline.arrays[0]

    async def register_point_clouds(self, pre_cloud, post_cloud):
        """Register pre and post blast point clouds"""
        # Convert to Open3D format
        pre_o3d = self.pdal_to_o3d(pre_cloud)
        post_o3d = self.pdal_to_o3d(post_cloud)
        
        # ICP registration
        threshold = 0.5  # 50cm threshold
        trans_init = np.eye(4)
        
        reg_p2p = o3d.pipelines.registration.registration_icp(
            post_o3d, pre_o3d, threshold, trans_init,
            o3d.pipelines.registration.TransformationEstimationPointToPoint(),
            o3d.pipelines.registration.ICPConvergenceCriteria(max_iteration=2000)
        )
        
        # Apply transformation
        post_o3d.transform(reg_p2p.transformation)
        return self.o3d_to_pdal(post_o3d)

    async def compute_surface_difference(self, pre_cloud, post_cloud):
        """Compute surface differences for overbreak/underbreak"""
        # Create surface meshes
        pre_mesh = await self.create_surface_mesh(pre_cloud)
        post_mesh = await self.create_surface_mesh(post_cloud)
        
        # Compute signed distances
        distances = await self.compute_signed_distances(pre_mesh, post_mesh)
        
        # Classify overbreak/underbreak
        overbreak_mask = distances > 0.1  # 10cm threshold
        underbreak_mask = distances < -0.1
        
        return {
            "distances": distances,
            "overbreak_mask": overbreak_mask,
            "underbreak_mask": underbreak_mask,
            "overbreak_volume": np.sum(distances[overbreak_mask]) * self.cell_volume,
            "underbreak_volume": np.sum(np.abs(distances[underbreak_mask])) * self.cell_volume
        }

    async def analyze_fragmentation(self, post_cloud, job_data):
        """Analyze rock fragmentation from point cloud"""
        if not job_data.get('options', {}).get('do_fragmentation', False):
            return None
            
        # Extract muckpile region
        muckpile_cloud = await self.extract_muckpile(post_cloud)
        
        # Convert to image for CV analysis
        ortho_image = await self.create_orthophoto(muckpile_cloud)
        
        # Particle segmentation
        particles = await self.segment_particles(ortho_image)
        
        # Size distribution
        sizes = await self.calculate_particle_sizes(particles)
        
        return {
            "p80_mm": np.percentile(sizes, 80),
            "p50_mm": np.percentile(sizes, 50),
            "p20_mm": np.percentile(sizes, 20),
            "size_distribution": sizes.tolist()
        }
```

#### **ai-svc (DataRobot AI Service)**
```python
# services/ai/datarobot_client.py
import datarobot as dr
from datarobot.models.deployment import Deployment
import pandas as pd
import numpy as np

class DataRobotBlastAI:
    def __init__(self):
        dr.Client(
            endpoint=settings.DATAROBOT_ENDPOINT,
            token=settings.DATAROBOT_TOKEN
        )
        self.models = self.load_models()
    
    def load_models(self):
        """Load deployed DataRobot models"""
        return {
            'overbreak_model': Deployment.get(settings.OVERBREAK_DEPLOYMENT_ID),
            'underbreak_model': Deployment.get(settings.UNDERBREAK_DEPLOYMENT_ID),
            'fragmentation_model': Deployment.get(settings.FRAGMENTATION_DEPLOYMENT_ID),
            'powder_factor_model': Deployment.get(settings.POWDER_FACTOR_DEPLOYMENT_ID)
        }
    
    async def predict_blast_performance(self, features: dict):
        """Make predictions using DataRobot models"""
        try:
            # Prepare feature dataframe
            feature_df = self.prepare_features(features)
            
            # Make predictions
            predictions = {}
            
            # Overbreak prediction
            overbreak_pred = self.models['overbreak_model'].predict(feature_df)
            predictions['overbreak_pct'] = overbreak_pred.predictions[0]['prediction']
            predictions['overbreak_shap'] = overbreak_pred.predictions[0].get('shap_values', {})
            
            # Underbreak prediction
            underbreak_pred = self.models['underbreak_model'].predict(feature_df)
            predictions['underbreak_pct'] = underbreak_pred.predictions[0]['prediction']
            
            # Fragmentation prediction
            frag_pred = self.models['fragmentation_model'].predict(feature_df)
            predictions['frag_p80_mm'] = frag_pred.predictions[0]['prediction']
            
            # Powder factor optimization
            pf_pred = self.models['powder_factor_model'].predict(feature_df)
            predictions['optimal_pf'] = pf_pred.predictions[0]['prediction']
            
            return predictions
            
        except Exception as e:
            logger.error(f"DataRobot prediction failed: {e}")
            raise
    
    def prepare_features(self, raw_features: dict):
        """Engineer features for DataRobot models"""
        features = {}
        
        # Pattern features
        pattern_data = raw_features.get('pattern', {})
        features['avg_burden_m'] = np.mean([h['burden_m'] for h in pattern_data.get('holes', [])])
        features['avg_spacing_m'] = np.mean([h['spacing_m'] for h in pattern_data.get('holes', [])])
        features['burden_variance'] = np.var([h['burden_m'] for h in pattern_data.get('holes', [])])
        
        # Drilling features
        drilling_data = raw_features.get('drilling', {})
        features['avg_collar_dev_m'] = np.mean([h['collar_dev_m'] for h in drilling_data.get('holes', [])])
        features['avg_toe_dev_m'] = np.mean([h['toe_dev_m'] for h in drilling_data.get('holes', [])])
        
        # Loading features
        loading_data = raw_features.get('loading', {})
        features['total_explosive_kg'] = sum([d['deck_mass_kg'] for d in loading_data.get('decks', [])])
        features['avg_stemming_m'] = np.mean([d['stemming_m'] for d in loading_data.get('decks', [])])
        
        # Geological features
        geo_data = raw_features.get('geology', {})
        features['rock_strength_mpa'] = geo_data.get('ucs_mpa', 100)  # Default UCS
        features['joint_spacing_m'] = geo_data.get('joint_spacing_m', 1.0)
        
        # Geometric features
        geom_data = raw_features.get('geometry', {})
        features['bench_height_m'] = geom_data.get('bench_height_m', 15)
        features['face_angle_deg'] = geom_data.get('face_angle_deg', 70)
        
        return pd.DataFrame([features])
    
    async def retrain_models(self, training_data: pd.DataFrame):
        """Retrain models with new data"""
        try:
            # Upload new training data
            dataset = dr.Dataset.create_from_dataframe(
                training_data,
                dataset_name=f"blast_training_{datetime.now().strftime('%Y%m%d')}"
            )
            
            # Create new projects for each target
            targets = ['overbreak_pct', 'underbreak_pct', 'frag_p80_mm', 'optimal_pf']
            
            for target in targets:
                if target in training_data.columns:
                    project = dr.Project.create(
                        sourcedata=dataset,
                        project_name=f"blast_{target}_{datetime.now().strftime('%Y%m%d')}",
                        target=target
                    )
                    
                    # Start AutoML
                    project.start_autopilot()
                    
                    # Monitor and deploy best model
                    await self.monitor_and_deploy(project, target)
                    
        except Exception as e:
            logger.error(f"Model retraining failed: {e}")
            raise
```

#### **results-svc (Results & Export Service)**
```python
# services/results/exporter.py
import json
import csv
from typing import Dict, List
import geopandas as gpd
from shapely.geometry import Point, Polygon
import ezdxf

class BlastResultsExporter:
    def __init__(self):
        self.export_formats = ['dxf', 'geojson', 'csv', 'json']
    
    async def export_blast_results(self, blast_id: str, results: dict):
        """Export blast results in multiple formats"""
        exports = {}
        
        # DXF export for CAD software
        exports['dxf_bundle'] = await self.export_dxf(blast_id, results)
        
        # GeoJSON for GIS software
        exports['deviation_geojson'] = await self.export_geojson(blast_id, results)
        
        # CSV exports for spreadsheet analysis
        exports['holes_csv'] = await self.export_holes_csv(blast_id, results)
        exports['kpis_csv'] = await self.export_kpis_csv(blast_id, results)
        
        # JSON wireframe for 3D visualization
        exports['wireframe_json'] = await self.export_wireframe(blast_id, results)
        
        return exports
    
    async def export_dxf(self, blast_id: str, results: dict):
        """Export DXF with layered blast analysis"""
        doc = ezdxf.new('R2010')
        msp = doc.modelspace()
        
        # Create layers
        doc.layers.new('DESIGN_WALL', dxfattribs={'color': 1})  # Red
        doc.layers.new('ACTUAL_WALL', dxfattribs={'color': 2})  # Yellow
        doc.layers.new('OVERBREAK', dxfattribs={'color': 3})    # Green
        doc.layers.new('UNDERBREAK', dxfattribs={'color': 4})   # Cyan
        doc.layers.new('HOLES', dxfattribs={'color': 5})        # Blue
        
        # Add design wall
        design_points = results.get('surfaces', {}).get('design_wall', [])
        if design_points:
            msp.add_lwpolyline(design_points, dxfattribs={'layer': 'DESIGN_WALL'})
        
        # Add actual wall
        actual_points = results.get('surfaces', {}).get('actual_wall', [])
        if actual_points:
            msp.add_lwpolyline(actual_points, dxfattribs={'layer': 'ACTUAL_WALL'})
        
        # Add overbreak contours
        overbreak_contours = results.get('surfaces', {}).get('overbreak_contours', [])
        for contour in overbreak_contours:
            msp.add_lwpolyline(contour, dxfattribs={'layer': 'OVERBREAK'})
        
        # Add hole vectors
        holes = results.get('holes', [])
        for hole in holes:
            collar = (hole['collar_x'], hole['collar_y'], hole['collar_z'])
            toe = (hole['toe_x'], hole['toe_y'], hole['toe_z'])
            msp.add_line(collar, toe, dxfattribs={'layer': 'HOLES'})
        
        # Save to S3
        dxf_path = f"s3://geovision-blast-results/{blast_id}/layers.dxf"
        doc.saveas(dxf_path)
        
        return dxf_path
    
    async def export_geojson(self, blast_id: str, results: dict):
        """Export GeoJSON heatmap for deviation analysis"""
        features = []
        
        # Create heatmap grid
        deviation_grid = results.get('surfaces', {}).get('deviation_grid', [])
        
        for cell in deviation_grid:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [cell['boundary']]
                },
                "properties": {
                    "deviation_m": cell['deviation'],
                    "type": "overbreak" if cell['deviation'] > 0 else "underbreak",
                    "severity": self.classify_severity(cell['deviation'])
                }
            }
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {"name": results.get('crs', 'EPSG:4326')}
            },
            "features": features
        }
        
        # Save to S3
        geojson_path = f"s3://geovision-blast-results/{blast_id}/deviation.geojson"
        await self.save_to_s3(geojson_path, json.dumps(geojson))
        
        return geojson_path
    
    async def export_wireframe(self, blast_id: str, results: dict):
        """Export 3D wireframe for web visualization"""
        wireframe = {
            "version": "1.0",
            "blast_id": blast_id,
            "crs": results.get('crs'),
            "meshes": [],
            "markers": [],
            "metadata": {
                "overbreak_volume": results.get('metrics', {}).get('overbreak_m3'),
                "underbreak_volume": results.get('metrics', {}).get('underbreak_m3')
            }
        }
        
        # Add surface meshes
        surfaces = results.get('surfaces', {})
        for surface_name, surface_data in surfaces.items():
            if 'vertices' in surface_data and 'faces' in surface_data:
                mesh = {
                    "name": surface_name,
                    "vertices": surface_data['vertices'],
                    "faces": surface_data['faces'],
                    "colors": surface_data.get('colors', []),
                    "material": self.get_surface_material(surface_name)
                }
                wireframe['meshes'].append(mesh)
        
        # Add hole markers
        holes = results.get('holes', [])
        for hole in holes:
            marker = {
                "id": hole['hole_id'],
                "position": [hole['collar_x'], hole['collar_y'], hole['collar_z']],
                "type": "hole",
                "status": hole.get('status', 'ok'),
                "properties": {
                    "collar_dev": hole.get('collar_dev_m'),
                    "toe_dev": hole.get('toe_dev_m'),
                    "burden": hole.get('burden_m')
                }
            }
            wireframe['markers'].append(marker)
        
        # Save to S3
        wireframe_path = f"s3://geovision-blast-results/{blast_id}/wireframe.json"
        await self.save_to_s3(wireframe_path, json.dumps(wireframe))
        
        return wireframe_path
```

### **2. Database Schema Extensions**

```sql
-- Add blast analysis tables to existing PostgreSQL schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Blast projects table
CREATE TABLE blast_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    crs VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Blast analysis jobs
CREATE TABLE blast_analysis_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(50) UNIQUE NOT NULL,
    blast_project_id UUID REFERENCES blast_projects(id),
    blast_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'queued',
    progress DECIMAL(3,2) DEFAULT 0.00,
    metadata JSONB NOT NULL,
    results JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blast holes table
CREATE TABLE blast_holes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blast_project_id UUID REFERENCES blast_projects(id),
    hole_id VARCHAR(50) NOT NULL,
    collar_location GEOMETRY(POINTZ, 4326),
    toe_location GEOMETRY(POINTZ, 4326),
    planned_depth_m DECIMAL(8,2),
    actual_depth_m DECIMAL(8,2),
    diameter_mm DECIMAL(6,1),
    burden_m DECIMAL(6,2),
    spacing_m DECIMAL(6,2),
    collar_deviation_m DECIMAL(6,3),
    toe_deviation_m DECIMAL(6,3),
    status VARCHAR(50) DEFAULT 'ok',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blast performance metrics
CREATE TABLE blast_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blast_project_id UUID REFERENCES blast_projects(id),
    overbreak_m3 DECIMAL(10,2),
    underbreak_m3 DECIMAL(10,2),
    overbreak_pct DECIMAL(5,2),
    underbreak_pct DECIMAL(5,2),
    swell_factor DECIMAL(4,2),
    powder_factor_kg_per_m3 DECIMAL(6,3),
    fragmentation_p80_mm DECIMAL(6,1),
    fragmentation_p50_mm DECIMAL(6,1),
    total_explosive_kg DECIMAL(10,2),
    broken_volume_m3 DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DataRobot model predictions
CREATE TABLE blast_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blast_project_id UUID REFERENCES blast_projects(id),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    prediction_value DECIMAL(10,4),
    confidence_score DECIMAL(4,3),
    shap_values JSONB,
    features_used JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_blast_jobs_status ON blast_analysis_jobs(status);
CREATE INDEX idx_blast_jobs_blast_id ON blast_analysis_jobs(blast_id);
CREATE INDEX idx_blast_holes_project ON blast_holes(blast_project_id);
CREATE INDEX idx_blast_metrics_project ON blast_metrics(blast_project_id);
CREATE INDEX idx_blast_predictions_project ON blast_predictions(blast_project_id);

-- Spatial indexes
CREATE INDEX idx_blast_holes_collar_location ON blast_holes USING GIST(collar_location);
CREATE INDEX idx_blast_holes_toe_location ON blast_holes USING GIST(toe_location);
```

### **3. Frontend Integration**

```typescript
// src/components/blast/BlastAnalysisDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBlastAnalysis } from '@/hooks/useBlastAnalysis';
import { BlastVisualization3D } from './BlastVisualization3D';
import { BlastMetricsPanel } from './BlastMetricsPanel';
import { HolePerformanceTable } from './HolePerformanceTable';

interface BlastAnalysisDashboardProps {
  projectId: string;
}

export const BlastAnalysisDashboard: React.FC<BlastAnalysisDashboardProps> = ({
  projectId
}) => {
  const [selectedBlast, setSelectedBlast] = useState<string | null>(null);
  const { 
    blasts, 
    currentJob, 
    results, 
    submitAnalysis, 
    isLoading 
  } = useBlastAnalysis(projectId);

  const handleSubmitAnalysis = async (blastData: BlastSubmissionData) => {
    try {
      await submitAnalysis(blastData);
    } catch (error) {
      console.error('Failed to submit blast analysis:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Drill & Blast Analysis</h1>
        <Button onClick={() => setShowSubmissionModal(true)}>
          New Analysis
        </Button>
      </div>

      {/* Current Job Status */}
      {currentJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Processing: {currentJob.blast_id}
              <Badge variant={currentJob.status === 'completed' ? 'default' : 'secondary'}>
                {currentJob.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={currentJob.progress * 100} className="mb-2" />
            <p className="text-sm text-gray-600">
              {Math.round(currentJob.progress * 100)}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results Dashboard */}
      {results && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 3D Visualization */}
          <div className="lg:col-span-2">
            <BlastVisualization3D 
              blastId={selectedBlast}
              wireframeData={results.wireframe}
              onHoleSelect={(holeId) => setSelectedHole(holeId)}
            />
          </div>

          {/* Metrics Panel */}
          <div>
            <BlastMetricsPanel 
              metrics={results.metrics}
              predictions={results.predictions}
            />
          </div>
        </div>
      )}

      {/* Hole Performance Table */}
      {results?.holes && (
        <HolePerformanceTable 
          holes={results.holes}
          onHoleSelect={setSelectedHole}
        />
      )}
    </div>
  );
};
```

### **4. Kubernetes Deployment**

```yaml
# k8s/blast-analysis-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: blast-analysis
  labels:
    name: blast-analysis

---
# k8s/blast-ingest-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blast-ingest-service
  namespace: blast-analysis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blast-ingest
  template:
    metadata:
      labels:
        app: blast-ingest
    spec:
      containers:
      - name: blast-ingest
        image: geovision/blast-ingest:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: blast-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: blast-secrets
              key: redis-url
        - name: S3_BUCKET
          value: "geovision-blast-data"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"

---
# k8s/blast-geom-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blast-geom-service
  namespace: blast-analysis
spec:
  replicas: 2
  selector:
    matchLabels:
      app: blast-geom
  template:
    metadata:
      labels:
        app: blast-geom
    spec:
      containers:
      - name: blast-geom
        image: geovision/blast-geom:latest
        ports:
        - containerPort: 8001
        env:
        - name: PROCESSING_WORKERS
          value: "4"
        - name: POINT_CLOUD_MEMORY_LIMIT
          value: "8Gi"
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        volumeMounts:
        - name: temp-storage
          mountPath: /tmp/processing
      volumes:
      - name: temp-storage
        emptyDir:
          sizeLimit: 20Gi

---
# k8s/datarobot-pps-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: datarobot-prediction-server
  namespace: blast-analysis
spec:
  replicas: 2
  selector:
    matchLabels:
      app: datarobot-pps
  template:
    metadata:
      labels:
        app: datarobot-pps
    spec:
      containers:
      - name: prediction-server
        image: datarobot/portable-prediction-server:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATAROBOT_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: blast-secrets
              key: datarobot-token
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
```

## 📊 Business Integration

### **Revenue Impact**
- **Additional Revenue**: $1.5M annually from Drill & Blast add-on
- **Market Expansion**: Access to operational mining segment
- **Customer Retention**: Increased stickiness with operational workflows
- **Upsell Opportunities**: Professional services and custom models

### **Customer Success Metrics**
- **Overbreak Reduction**: Target 15-25% improvement
- **Fragmentation Consistency**: Target 20-30% improvement  
- **Powder Factor Optimization**: Target 10-15% efficiency gain
- **ROI**: $50K-500K annual savings per operation

### **Competitive Positioning**
- **First-to-Market**: Only solution combining 3D analysis + AutoML
- **Technology Moat**: Proprietary algorithms + DataRobot integration
- **Operational Focus**: Bridges exploration and production workflows

## 🚀 Implementation Timeline

### **Phase 1: Foundation (8 weeks)**
- Microservices architecture setup
- Basic geometry processing pipeline
- DataRobot integration and model training
- Core APIs and database schema

### **Phase 2: Advanced Features (6 weeks)**
- 3D visualization and wireframe export
- Advanced fragmentation analysis
- MLOps pipeline and model management
- Integration with existing GeoVision platform

### **Phase 3: Production Ready (4 weeks)**
- Performance optimization and scaling
- Security hardening and compliance
- Comprehensive testing and validation
- Documentation and training materials

### **Phase 4: Market Launch (2 weeks)**
- Customer pilot programs
- Sales enablement and marketing
- Support team training
- Go-to-market execution

## 🎯 Success Criteria

### **Technical Metrics**
- ✅ Surface difference accuracy within ±5cm tolerance
- ✅ Volume calculations within ±3% error
- ✅ API response times <15 minutes for standard datasets
- ✅ 99.9% uptime SLA
- ✅ DataRobot model accuracy >85% for key predictions

### **Business Metrics**
- ✅ 50+ pilot customers in first 6 months
- ✅ $1.5M additional annual revenue by end of Year 1
- ✅ 90%+ customer satisfaction scores
- ✅ 25%+ improvement in operational KPIs
- ✅ 3+ major mining companies as reference customers

This Drill & Blast AI module represents a significant expansion of GeoVision AI Miner into operational mining analytics, providing a comprehensive solution that bridges exploration and production workflows while delivering substantial ROI to mining operations.