-- First get a user ID to use for sample data
DO $$
DECLARE
    sample_user_id uuid;
BEGIN
    -- Try to get the first user from auth.users, or create a placeholder
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    
    -- If no users exist, we'll use a static UUID for sample data
    IF sample_user_id IS NULL THEN
        sample_user_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- Insert sample AI models with created_by
    INSERT INTO public.ai_models (name, version, model_type, training_data_info, performance_metrics, is_active, created_by) VALUES
    ('GeoSight Mineral Classifier', '2.1', 'neural_network', 
     '{"training_samples": 50000, "geological_regions": ["Nevada", "Chile", "Australia"], "mineral_types": ["gold", "copper", "lithium"], "data_sources": ["satellite", "geochemical", "magnetic"]}',
     '{"accuracy": 92.5, "precision": 90.2, "recall": 94.1, "f1_score": 92.1, "last_validated": "2024-01-15"}',
     true, sample_user_id),
     
    ('DeepGround Explorer', '1.8', 'convolutional_neural_network',
     '{"training_samples": 75000, "depth_range": "0-500m", "mineral_types": ["iron", "zinc", "nickel"], "data_sources": ["ground_penetrating_radar", "magnetic", "gravity"]}',
     '{"accuracy": 88.7, "precision": 87.3, "recall": 89.9, "f1_score": 88.6, "last_validated": "2024-01-10"}',
     true, sample_user_id),
     
    ('LithiumFinder AI', '3.0', 'random_forest',
     '{"training_samples": 30000, "geological_formations": ["brine", "pegmatite", "sedimentary"], "mineral_types": ["lithium"], "data_sources": ["geochemical", "satellite", "drilling"]}',
     '{"accuracy": 95.2, "precision": 93.8, "recall": 96.5, "f1_score": 95.1, "last_validated": "2024-01-20"}',
     true, sample_user_id),
     
    ('CopperScope Pro', '2.5', 'gradient_boosting',
     '{"training_samples": 40000, "ore_types": ["porphyry", "skarn", "sediment_hosted"], "mineral_types": ["copper"], "data_sources": ["hyperspectral", "magnetic", "geochemical"]}',
     '{"accuracy": 89.3, "precision": 88.1, "recall": 90.7, "f1_score": 89.4, "last_validated": "2024-01-12"}',
     true, sample_user_id),
     
    ('PreciousMetals Detector', '1.2', 'ensemble',
     '{"training_samples": 25000, "deposit_types": ["placer", "lode", "epithermal"], "mineral_types": ["gold", "silver"], "data_sources": ["satellite", "geochemical", "structural"]}',
     '{"accuracy": 91.8, "precision": 90.5, "recall": 93.2, "f1_score": 91.8, "last_validated": "2024-01-18"}',
     true, sample_user_id);

    -- Insert sample projects with owner_id
    INSERT INTO public.projects (name, description, country, province, geology_type, target_minerals, status, budget, start_date, end_date, coordinates, owner_id) VALUES
    ('Nevada Gold Rush Revival', 'Large-scale gold exploration in Nevada''s Carlin Trend using advanced AI prediction models', 'USA', 'Nevada', 'Sediment-hosted gold', ARRAY['Gold'], 'active', 15000000, '2024-01-01', '2025-12-31', ST_Point(-116.0, 40.5), sample_user_id),

    ('Chilean Copper Expansion', 'Expansion of copper mining operations in the Atacama Desert with lithium co-production potential', 'Chile', 'Atacama', 'Porphyry copper', ARRAY['Copper', 'Lithium'], 'active', 25000000, '2023-06-01', '2026-05-31', ST_Point(-69.0, -24.0), sample_user_id),

    ('Australian Lithium Venture', 'Pegmatite-hosted lithium exploration in Western Australia''s lithium corridor', 'Australia', 'Western Australia', 'Pegmatite', ARRAY['Lithium', 'Tantalum'], 'planning', 8000000, '2024-03-01', '2025-08-31', ST_Point(121.0, -30.5), sample_user_id),

    ('Canadian Nickel Discovery', 'Nickel-copper sulfide exploration in the Sudbury Basin using machine learning', 'Canada', 'Ontario', 'Mafic-ultramafic', ARRAY['Nickel', 'Copper'], 'active', 12000000, '2023-09-01', '2025-08-31', ST_Point(-81.0, 46.5), sample_user_id),

    ('Peruvian Silver Heritage', 'Historic silver mine modernization with AI-driven ore body modeling', 'Peru', 'Cerro de Pasco', 'Epithermal', ARRAY['Silver', 'Lead', 'Zinc'], 'planning', 6000000, '2024-05-01', '2025-12-31', ST_Point(-76.2, -10.7), sample_user_id);

END $$;