-- Enhanced AI and Machine Learning Features
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- AI Models and Training Data
CREATE TABLE ai_model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES ai_models(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'mineral_detection', 'grade_estimation', 'geological_classification'
    training_data_size INTEGER,
    accuracy_metrics JSONB,
    model_parameters JSONB,
    training_completed_at TIMESTAMPTZ,
    deployment_status VARCHAR(20) DEFAULT 'training', -- 'training', 'testing', 'deployed', 'deprecated'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hyperspectral and Multi-spectral Data
CREATE TABLE spectral_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
    data_type VARCHAR(30) NOT NULL, -- 'hyperspectral', 'multispectral', 'lidar'
    wavelength_range NUMRANGE,
    spectral_bands INTEGER,
    spatial_resolution DECIMAL(10,2), -- meters per pixel
    acquisition_date TIMESTAMPTZ,
    sensor_type VARCHAR(100),
    raw_data_url TEXT,
    processed_data_url TEXT,
    metadata JSONB,
    processing_status VARCHAR(20) DEFAULT 'raw', -- 'raw', 'processing', 'processed', 'analyzed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Computer Vision Analysis Results
CREATE TABLE cv_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spectral_data_id UUID REFERENCES spectral_data(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- 'mineral_detection', 'rock_classification', 'structural_analysis'
    detected_features JSONB, -- Array of detected features with confidence scores
    confidence_map_url TEXT, -- URL to confidence heatmap
    feature_vectors vector(512), -- Embedding vectors for similarity search
    processing_time_seconds INTEGER,
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core Sample Analysis
CREATE TABLE core_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
    drill_hole_id VARCHAR(100),
    depth_from DECIMAL(10,2),
    depth_to DECIMAL(10,2),
    sample_length DECIMAL(10,2),
    recovery_percentage DECIMAL(5,2),
    rqd_percentage DECIMAL(5,2), -- Rock Quality Designation
    lithology VARCHAR(100),
    alteration VARCHAR(100),
    mineralization VARCHAR(200),
    photo_urls TEXT[],
    geochemistry_results JSONB,
    collected_at TIMESTAMPTZ,
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automated Core Analysis
CREATE TABLE core_cv_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    core_sample_id UUID REFERENCES core_samples(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    detected_minerals JSONB, -- Array of minerals with confidence scores
    rock_type_classification JSONB,
    texture_analysis JSONB,
    fracture_analysis JSONB,
    color_analysis JSONB,
    confidence_score DECIMAL(5,4),
    processing_model VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3D Geological Models
CREATE TABLE geological_models_3d (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    model_name VARCHAR(200) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'ore_body', 'structural', 'lithological', 'grade_shell'
    model_data_url TEXT, -- URL to 3D model file
    model_format VARCHAR(20), -- 'obj', 'gltf', 'ply', 'stl'
    bounding_box JSONB, -- 3D bounding box coordinates
    resolution DECIMAL(10,2), -- Model resolution in meters
    interpolation_method VARCHAR(50), -- 'kriging', 'idw', 'nearest_neighbor'
    confidence_level DECIMAL(5,2),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geostatistical Analysis
CREATE TABLE geostatistical_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- 'variogram', 'kriging', 'simulation'
    target_variable VARCHAR(100), -- 'grade', 'thickness', 'density'
    input_data_points INTEGER,
    variogram_model JSONB,
    kriging_parameters JSONB,
    estimation_variance DECIMAL(10,6),
    cross_validation_results JSONB,
    results_url TEXT, -- URL to analysis results
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE ai_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spectral_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_cv_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE geological_models_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE geostatistical_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view AI model versions for their projects" ON ai_model_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ai_models am
            JOIN predictions p ON p.model_id = am.id
            JOIN exploration_sites es ON es.id = p.site_id
            JOIN projects pr ON pr.id = es.project_id
            WHERE am.id = ai_model_versions.model_id
            AND pr.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view spectral data for their sites" ON spectral_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exploration_sites es
            JOIN projects p ON p.id = es.project_id
            WHERE es.id = spectral_data.site_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage core samples for their sites" ON core_samples
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exploration_sites es
            JOIN projects p ON p.id = es.project_id
            WHERE es.id = core_samples.site_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view 3D models for their projects" ON geological_models_3d
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = geological_models_3d.project_id
            AND p.created_by = auth.uid()
        )
    );

-- Indexes for performance
CREATE INDEX idx_spectral_data_site_type ON spectral_data(site_id, data_type);
CREATE INDEX idx_cv_analysis_spectral_data ON cv_analysis_results(spectral_data_id);
CREATE INDEX idx_core_samples_site_depth ON core_samples(site_id, depth_from, depth_to);
CREATE INDEX idx_geological_models_project ON geological_models_3d(project_id, model_type);
CREATE INDEX idx_geostatistical_project ON geostatistical_analysis(project_id, analysis_type);

-- Vector similarity search index
CREATE INDEX idx_cv_features_vector ON cv_analysis_results USING ivfflat (feature_vectors vector_cosine_ops);