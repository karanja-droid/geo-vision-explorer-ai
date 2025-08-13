-- Sample Data Migration for GeoVision AI Miner
-- This migration adds comprehensive sample data for development and testing

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Insert sample user profiles
INSERT INTO profiles (id, email, full_name, avatar_url, role, department, phone, location, bio, skills, certifications, experience_years, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'sarah.johnson@geovision.com', 'Sarah Johnson', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150', 'administrator', 'Administration', '+1-555-0101', 'Denver, CO', 'Experienced mining administrator with 15 years in the industry.', '["Project Management", "Team Leadership", "Strategic Planning"]', '["PMP", "Mining Safety Certification"]', 15, NOW() - INTERVAL '6 months', NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'mike.rodriguez@geovision.com', 'Mike Rodriguez', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', 'geologist', 'Geology', '+1-555-0102', 'Phoenix, AZ', 'Senior geologist specializing in precious metal exploration.', '["Geological Mapping", "Core Logging", "Mineral Identification"]', '["Professional Geologist (PG)", "AIPG Certification"]', 12, NOW() - INTERVAL '5 months', NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'emily.chen@geovision.com', 'Emily Chen', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', 'geophysicist', 'Geophysics', '+1-555-0103', 'Salt Lake City, UT', 'Geophysicist with expertise in magnetic and gravity surveys.', '["Geophysical Surveys", "Data Analysis", "Remote Sensing"]', '["SEG Certification", "Geophysics Professional"]', 8, NOW() - INTERVAL '4 months', NOW()),
('550e8400-e29b-41d4-a716-446655440004', 'david.thompson@geovision.com', 'David Thompson', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'drilling_manager', 'Operations', '+1-555-0104', 'Reno, NV', 'Drilling operations manager with extensive field experience.', '["Drilling Operations", "Safety Management", "Equipment Maintenance"]', '["Mine Safety Professional", "Drilling Supervisor License"]', 18, NOW() - INTERVAL '7 months', NOW()),
('550e8400-e29b-41d4-a716-446655440005', 'lisa.martinez@geovision.com', 'Lisa Martinez', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150', 'environmental_officer', 'Environmental', '+1-555-0105', 'Boulder, CO', 'Environmental compliance specialist focused on sustainable mining.', '["Environmental Assessment", "Regulatory Compliance", "Sustainability"]', '["ISO 14001 Lead Auditor", "Environmental Professional"]', 10, NOW() - INTERVAL '3 months', NOW());

-- Insert sample projects
INSERT INTO projects (id, name, description, location, status, budget, start_date, end_date, coordinates, created_at, updated_at, user_id) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Nevada Gold Fields Exploration', 'Large-scale gold exploration project in the Carlin Trend, Nevada. This project aims to identify new gold deposits using advanced AI-driven geological analysis and modern exploration techniques.', 'Elko County, Nevada', 'active', 15000000.00, '2024-01-15', '2025-12-31', ST_GeomFromText('POINT(-116.5 40.5)'), NOW() - INTERVAL '3 months', NOW(), '550e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440002', 'Colorado Silver Mountain Survey', 'Comprehensive silver and lead exploration in the historic mining district of Colorado. Focus on identifying high-grade silver veins using geophysical methods.', 'Clear Creek County, Colorado', 'active', 8500000.00, '2024-03-01', '2025-08-30', ST_GeomFromText('POINT(-105.5 39.7)'), NOW() - INTERVAL '2 months', NOW(), '550e8400-e29b-41d4-a716-446655440003'),
('660e8400-e29b-41d4-a716-446655440003', 'Arizona Copper Belt Development', 'Expansion of existing copper operations in Arizona with focus on porphyry copper deposits. Integration of IoT sensors for real-time monitoring.', 'Pinal County, Arizona', 'planning', 25000000.00, '2024-06-01', '2026-05-31', ST_GeomFromText('POINT(-111.0 33.0)'), NOW() - INTERVAL '1 month', NOW(), '550e8400-e29b-41d4-a716-446655440002'),
('660e8400-e29b-41d4-a716-446655440004', 'Montana Platinum Group Metals', 'Exploration for platinum group metals in the Stillwater Complex. Advanced spectral analysis and AI prediction models.', 'Stillwater County, Montana', 'active', 12000000.00, '2024-02-15', '2025-11-30', ST_GeomFromText('POINT(-109.5 45.5)'), NOW() - INTERVAL '4 months', NOW(), '550e8400-e29b-41d4-a716-446655440004'),
('660e8400-e29b-41d4-a716-446655440005', 'Utah Rare Earth Elements Study', 'Investigation of rare earth element deposits in Utah. Focus on critical minerals for renewable energy technologies.', 'Beaver County, Utah', 'completed', 6000000.00, '2023-05-01', '2024-04-30', ST_GeomFromText('POINT(-112.5 38.5)'), NOW() - INTERVAL '8 months', NOW(), '550e8400-e29b-41d4-a716-446655440005');

-- Insert sample exploration sites
INSERT INTO exploration_sites (id, project_id, name, description, coordinates, elevation, site_type, access_notes, created_at, updated_at) VALUES
-- Nevada Gold Fields sites
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Carlin North Outcrop', 'Primary gold-bearing outcrop with visible quartz veining and sulfide mineralization.', ST_GeomFromText('POINT(-116.48 40.52)'), 1850.5, 'outcrop', 'Accessible via dirt road, 4WD recommended during wet conditions.', NOW() - INTERVAL '2 months', NOW()),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Carlin Drill Site Alpha', 'Primary drilling location for deep core sampling.', ST_GeomFromText('POINT(-116.52 40.48)'), 1820.0, 'drill_site', 'Helicopter access required, established landing pad available.', NOW() - INTERVAL '2 months', NOW()),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'Carlin Sample Point Beta', 'Surface sampling location with anomalous gold values.', ST_GeomFromText('POINT(-116.45 40.55)'), 1890.2, 'sample_location', 'Walking access from main camp, approximately 2km hike.', NOW() - INTERVAL '1 month', NOW()),

-- Colorado Silver sites
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 'Silver Creek Vein System', 'Historic silver vein with potential for expansion.', ST_GeomFromText('POINT(-105.48 39.72)'), 2850.0, 'outcrop', 'Accessible via mountain road, chains required in winter.', NOW() - INTERVAL '1 month', NOW()),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', 'Georgetown Drill Platform', 'Established drilling platform for vein intersection.', ST_GeomFromText('POINT(-105.52 39.68)'), 2920.5, 'drill_site', 'Road access available, power line connection established.', NOW() - INTERVAL '3 weeks', NOW()),

-- Arizona Copper sites
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440003', 'Porphyry Hill Survey Point', 'Central survey point for copper porphyry mapping.', ST_GeomFromText('POINT(-110.98 33.02)'), 1250.0, 'survey_point', 'Desert access, water supply required for extended operations.', NOW() - INTERVAL '2 weeks', NOW()),
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440003', 'Copper Canyon Outcrop', 'Exposed copper mineralization in canyon wall.', ST_GeomFromText('POINT(-111.02 32.98)'), 1180.5, 'outcrop', 'Steep terrain, safety equipment required for sampling.', NOW() - INTERVAL '1 week', NOW()),

-- Montana Platinum sites
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440004', 'Stillwater Complex East', 'Eastern section of the Stillwater layered intrusion.', ST_GeomFromText('POINT(-109.48 45.52)'), 1650.0, 'outcrop', 'Forest service road access, seasonal restrictions apply.', NOW() - INTERVAL '3 months', NOW()),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440004', 'Platinum Drill Site One', 'Primary drilling location for PGM exploration.', ST_GeomFromText('POINT(-109.52 45.48)'), 1720.5, 'drill_site', 'Established access road, environmental permits in place.', NOW() - INTERVAL '2 months', NOW()),

-- Utah Rare Earth sites
('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440005', 'Beaver Creek REE Occurrence', 'Rare earth element bearing carbonatite exposure.', ST_GeomFromText('POINT(-112.48 38.52)'), 2100.0, 'outcrop', 'BLM land, access permit required for sampling activities.', NOW() - INTERVAL '6 months', NOW());

-- Insert sample mineral deposits
INSERT INTO mineral_deposits (id, site_id, mineral_type, grade, tonnage, confidence_level, discovery_date, coordinates, depth, notes, created_at, updated_at) VALUES
-- Gold deposits
('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Gold', 8.5, 125000, 85, '2024-01-20', ST_GeomFromText('POINT(-116.48 40.52)'), 15.5, 'High-grade gold mineralization associated with quartz-sulfide veining. Excellent continuity observed in outcrop.', NOW() - INTERVAL '1 month', NOW()),
('880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 'Gold', 12.3, 85000, 92, '2024-02-15', ST_GeomFromText('POINT(-116.52 40.48)'), 45.0, 'Exceptional gold grades encountered in drill core. Mineralization extends to depth with consistent values.', NOW() - INTERVAL '3 weeks', NOW()),
('880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003', 'Gold', 6.2, 200000, 78, '2024-03-10', ST_GeomFromText('POINT(-116.45 40.55)'), 8.2, 'Surface gold anomaly with potential for bulk tonnage operation. Further drilling recommended.', NOW() - INTERVAL '2 weeks', NOW()),

-- Silver deposits
('880e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440004', 'Silver', 285.0, 45000, 88, '2024-02-28', ST_GeomFromText('POINT(-105.48 39.72)'), 25.0, 'Historic silver vein showing excellent grade continuity. Potential for underground mining operation.', NOW() - INTERVAL '2 weeks', NOW()),
('880e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440005', 'Silver', 320.5, 35000, 91, '2024-03-15', ST_GeomFromText('POINT(-105.52 39.68)'), 35.5, 'High-grade silver shoot identified through drilling. Excellent metallurgical characteristics observed.', NOW() - INTERVAL '1 week', NOW()),
('880e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440004', 'Lead', 4.8, 75000, 82, '2024-03-01', ST_GeomFromText('POINT(-105.48 39.72)'), 20.0, 'Lead mineralization associated with silver veins. Good potential for polymetallic operation.', NOW() - INTERVAL '10 days', NOW()),

-- Copper deposits
('880e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440006', 'Copper', 1.85, 2500000, 89, '2024-03-20', ST_GeomFromText('POINT(-110.98 33.02)'), 125.0, 'Large tonnage, moderate grade copper porphyry deposit. Excellent potential for open pit mining.', NOW() - INTERVAL '5 days', NOW()),
('880e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440007', 'Copper', 2.15, 1800000, 86, '2024-03-25', ST_GeomFromText('POINT(-111.02 32.98)'), 95.5, 'Higher grade copper zone within the porphyry system. Molybdenum credits enhance project economics.', NOW() - INTERVAL '3 days', NOW()),
('880e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440007', 'Molybdenum', 0.08, 1800000, 75, '2024-03-25', ST_GeomFromText('POINT(-111.02 32.98)'), 110.0, 'Molybdenum mineralization associated with copper porphyry. Significant byproduct potential.', NOW() - INTERVAL '3 days', NOW()),

-- Platinum Group Metals
('880e8400-e29b-41d4-a716-446655440010', '770e8400-e29b-41d4-a716-446655440008', 'Platinum', 3.2, 25000, 87, '2024-01-10', ST_GeomFromText('POINT(-109.48 45.52)'), 55.0, 'Platinum mineralization in layered mafic intrusion. Excellent grades with palladium credits.', NOW() - INTERVAL '2 months', NOW()),
('880e8400-e29b-41d4-a716-446655440011', '770e8400-e29b-41d4-a716-446655440008', 'Palladium', 4.1, 25000, 84, '2024-01-10', ST_GeomFromText('POINT(-109.48 45.52)'), 55.0, 'Palladium-rich zone within the PGM reef horizon. Strong correlation with platinum values.', NOW() - INTERVAL '2 months', NOW()),
('880e8400-e29b-41d4-a716-446655440012', '770e8400-e29b-41d4-a716-446655440009', 'Platinum', 2.8, 35000, 90, '2024-02-05', ST_GeomFromText('POINT(-109.52 45.48)'), 75.5, 'Drill-confirmed platinum mineralization with excellent continuity. High confidence resource estimate.', NOW() - INTERVAL '1 month', NOW()),

-- Rare Earth Elements
('880e8400-e29b-41d4-a716-446655440013', '770e8400-e29b-41d4-a716-446655440010', 'Rare Earth Elements', 2.5, 150000, 79, '2023-08-15', ST_GeomFromText('POINT(-112.48 38.52)'), 12.0, 'Light rare earth element enrichment in carbonatite. Strategic mineral potential for clean energy applications.', NOW() - INTERVAL '4 months', NOW()),
('880e8400-e29b-41d4-a716-446655440014', '770e8400-e29b-41d4-a716-446655440010', 'Lithium', 0.85, 180000, 73, '2023-09-20', ST_GeomFromText('POINT(-112.48 38.52)'), 18.5, 'Lithium mineralization in pegmatite dikes. Growing demand for battery applications makes this highly strategic.', NOW() - INTERVAL '3 months', NOW());

-- Insert sample AI predictions
INSERT INTO predictions (id, deposit_id, model_name, confidence_score, predicted_grade, predicted_tonnage, status, metadata, features_used, created_at, updated_at) VALUES
-- Gold predictions
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 'DeepMine-v2.1', 0.89, 8.2, 130000, 'completed', '{"algorithm": "CNN", "training_data_size": 15000, "processing_time_ms": 2500, "model_version": "2.1.3", "accuracy_score": 0.91, "cross_validation_score": 0.87}', '["geological_formation", "rock_type", "alteration_zones", "geochemical_signatures", "structural_features", "elevation", "magnetic_intensity"]', NOW() - INTERVAL '1 week', NOW()),
('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002', 'GeoNet-Pro', 0.94, 11.8, 88000, 'completed', '{"algorithm": "Neural Network", "training_data_size": 25000, "processing_time_ms": 3200, "model_version": "3.2.1", "accuracy_score": 0.93, "cross_validation_score": 0.91}', '["drill_core_data", "assay_results", "geological_formation", "structural_features", "alteration_zones", "geophysical_anomalies"]', NOW() - INTERVAL '5 days', NOW()),
('990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440003', 'MineralAI-Advanced', 0.82, 6.8, 195000, 'completed', '{"algorithm": "Random Forest", "training_data_size": 18000, "processing_time_ms": 1800, "model_version": "1.8.2", "accuracy_score": 0.85, "cross_validation_score": 0.81}', '["spectral_analysis", "geochemical_signatures", "elevation", "slope", "aspect", "proximity_to_faults"]', NOW() - INTERVAL '3 days', NOW()),

-- Silver predictions
('990e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440004', 'GeoPredictive-3.0', 0.91, 295.0, 42000, 'completed', '{"algorithm": "Gradient Boosting", "training_data_size": 12000, "processing_time_ms": 2100, "model_version": "3.0.5", "accuracy_score": 0.89, "cross_validation_score": 0.86}', '["geological_formation", "structural_features", "alteration_zones", "geochemical_signatures", "historical_production"]', NOW() - INTERVAL '2 days', NOW()),
('990e8400-e29b-41d4-a716-446655440005', '880e8400-e29b-41d4-a716-446655440005', 'TerraVision-ML', 0.88, 315.0, 38000, 'completed', '{"algorithm": "SVM", "training_data_size": 8500, "processing_time_ms": 1500, "model_version": "2.5.1", "accuracy_score": 0.87, "cross_validation_score": 0.84}', '["vein_orientation", "host_rock_type", "alteration_intensity", "structural_controls", "geochemical_pathfinders"]', NOW() - INTERVAL '1 day', NOW()),

-- Copper predictions
('990e8400-e29b-41d4-a716-446655440006', '880e8400-e29b-41d4-a716-446655440007', 'RockSense-AI', 0.92, 1.78, 2650000, 'completed', '{"algorithm": "CNN", "training_data_size": 35000, "processing_time_ms": 4500, "model_version": "4.1.2", "accuracy_score": 0.90, "cross_validation_score": 0.88}', '["porphyry_characteristics", "alteration_zoning", "geophysical_anomalies", "geochemical_signatures", "structural_features", "drill_core_data"]', NOW() - INTERVAL '6 hours', NOW()),
('990e8400-e29b-41d4-a716-446655440007', '880e8400-e29b-41d4-a716-446655440008', 'GeologicalGPT', 0.86, 2.05, 1950000, 'completed', '{"algorithm": "Transformer", "training_data_size": 45000, "processing_time_ms": 5200, "model_version": "1.2.0", "accuracy_score": 0.84, "cross_validation_score": 0.82}', '["multi_element_geochemistry", "alteration_mineralogy", "structural_geology", "geophysical_signatures", "deposit_model"]', NOW() - INTERVAL '4 hours', NOW()),

-- Platinum predictions
('990e8400-e29b-41d4-a716-446655440008', '880e8400-e29b-41d4-a716-446655440010', 'MineralClassifier-v4', 0.85, 3.0, 28000, 'completed', '{"algorithm": "Neural Network", "training_data_size": 5500, "processing_time_ms": 1200, "model_version": "4.0.1", "accuracy_score": 0.83, "cross_validation_score": 0.80}', '["layered_intrusion_position", "reef_horizon_characteristics", "pgm_mineralogy", "structural_controls"]', NOW() - INTERVAL '2 hours', NOW()),
('990e8400-e29b-41d4-a716-446655440009', '880e8400-e29b-41d4-a716-446655440012', 'DeepGeology-Transformer', 0.93, 2.9, 36000, 'completed', '{"algorithm": "Transformer", "training_data_size": 7200, "processing_time_ms": 1800, "model_version": "2.3.1", "accuracy_score": 0.91, "cross_validation_score": 0.89}', '["stratigraphic_position", "reef_continuity", "pgm_grade_distribution", "structural_integrity"]', NOW() - INTERVAL '1 hour', NOW()),

-- REE predictions
('990e8400-e29b-41d4-a716-446655440010', '880e8400-e29b-41d4-a716-446655440013', 'GeoAnalytics-Neural', 0.78, 2.8, 165000, 'completed', '{"algorithm": "Neural Network", "training_data_size": 3200, "processing_time_ms": 900, "model_version": "1.5.2", "accuracy_score": 0.76, "cross_validation_score": 0.74}', '["carbonatite_composition", "ree_distribution_pattern", "alteration_characteristics", "structural_controls"]', NOW() - INTERVAL '30 minutes', NOW());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_coordinates ON projects USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_sites_coordinates ON exploration_sites USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_deposits_coordinates ON mineral_deposits USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_deposits_mineral_type ON mineral_deposits (mineral_type);
CREATE INDEX IF NOT EXISTS idx_predictions_confidence ON predictions (confidence_score);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_sites_type ON exploration_sites (site_type);

-- Add some helpful views for common queries
CREATE OR REPLACE VIEW project_summary AS
SELECT 
    p.id,
    p.name,
    p.location,
    p.status,
    p.budget,
    COUNT(DISTINCT s.id) as site_count,
    COUNT(DISTINCT d.id) as deposit_count,
    COUNT(DISTINCT pr.id) as prediction_count,
    AVG(d.confidence_level) as avg_confidence,
    SUM(d.tonnage) as total_tonnage
FROM projects p
LEFT JOIN exploration_sites s ON p.id = s.project_id
LEFT JOIN mineral_deposits d ON s.id = d.site_id
LEFT JOIN predictions pr ON d.id = pr.deposit_id
GROUP BY p.id, p.name, p.location, p.status, p.budget;

CREATE OR REPLACE VIEW mineral_summary AS
SELECT 
    mineral_type,
    COUNT(*) as deposit_count,
    AVG(grade) as avg_grade,
    MIN(grade) as min_grade,
    MAX(grade) as max_grade,
    SUM(tonnage) as total_tonnage,
    AVG(confidence_level) as avg_confidence
FROM mineral_deposits
GROUP BY mineral_type
ORDER BY total_tonnage DESC;

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'User profiles with roles and expertise information';
COMMENT ON TABLE projects IS 'Mining exploration projects with location and budget data';
COMMENT ON TABLE exploration_sites IS 'Individual exploration sites within projects';
COMMENT ON TABLE mineral_deposits IS 'Discovered mineral deposits with grade and tonnage estimates';
COMMENT ON TABLE predictions IS 'AI model predictions for mineral deposits';

COMMENT ON VIEW project_summary IS 'Summary statistics for each project including counts and averages';
COMMENT ON VIEW mineral_summary IS 'Summary statistics grouped by mineral type';

-- Insert completion message
DO $$
BEGIN
    RAISE NOTICE 'Sample data migration completed successfully!';
    RAISE NOTICE 'Inserted: 5 profiles, 5 projects, 10 sites, 14 deposits, 10 predictions';
    RAISE NOTICE 'Total records: 44';
END $$;