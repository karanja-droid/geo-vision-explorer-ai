-- Create sample data with proper geometry types and user references
DO $$
DECLARE
    sample_user_id uuid;
    project1_id uuid;
    project2_id uuid;
    site1_id uuid;
    site2_id uuid;
    model1_id uuid;
    model2_id uuid;
BEGIN
    -- Use a static UUID for sample data
    sample_user_id := '00000000-0000-0000-0000-000000000000';

    -- Insert sample AI models with created_by
    INSERT INTO public.ai_models (name, version, model_type, training_data_info, performance_metrics, is_active, created_by) VALUES
    ('GeoSight Mineral Classifier', '2.1', 'neural_network', 
     '{"training_samples": 50000, "geological_regions": ["Nevada", "Chile", "Australia"], "mineral_types": ["gold", "copper", "lithium"], "data_sources": ["satellite", "geochemical", "magnetic"]}',
     '{"accuracy": 92.5, "precision": 90.2, "recall": 94.1, "f1_score": 92.1, "last_validated": "2024-01-15"}',
     true, sample_user_id),
     
    ('LithiumFinder AI', '3.0', 'random_forest',
     '{"training_samples": 30000, "geological_formations": ["brine", "pegmatite", "sedimentary"], "mineral_types": ["lithium"], "data_sources": ["geochemical", "satellite", "drilling"]}',
     '{"accuracy": 95.2, "precision": 93.8, "recall": 96.5, "f1_score": 95.1, "last_validated": "2024-01-20"}',
     true, sample_user_id)
    RETURNING id INTO model1_id, model2_id;

    -- Get the first two model IDs
    SELECT id INTO model1_id FROM public.ai_models WHERE name = 'GeoSight Mineral Classifier' LIMIT 1;
    SELECT id INTO model2_id FROM public.ai_models WHERE name = 'LithiumFinder AI' LIMIT 1;

    -- Insert sample projects with owner_id and polygon coordinates
    INSERT INTO public.projects (name, description, country, province, geology_type, target_minerals, status, budget, start_date, end_date, coordinates, owner_id) VALUES
    ('Nevada Gold Rush Revival', 'Large-scale gold exploration in Nevada''s Carlin Trend using advanced AI prediction models', 'USA', 'Nevada', 'Sediment-hosted gold', ARRAY['Gold'], 'active', 15000000, '2024-01-01', '2025-12-31', ST_Buffer(ST_Point(-116.0, 40.5)::geography, 5000)::geometry, sample_user_id),
    ('Chilean Copper Expansion', 'Expansion of copper mining operations in the Atacama Desert with lithium co-production potential', 'Chile', 'Atacama', 'Porphyry copper', ARRAY['Copper', 'Lithium'], 'active', 25000000, '2023-06-01', '2026-05-31', ST_Buffer(ST_Point(-69.0, -24.0)::geography, 8000)::geometry, sample_user_id)
    RETURNING id INTO project1_id, project2_id;

    -- Get the project IDs
    SELECT id INTO project1_id FROM public.projects WHERE name = 'Nevada Gold Rush Revival' LIMIT 1;
    SELECT id INTO project2_id FROM public.projects WHERE name = 'Chilean Copper Expansion' LIMIT 1;

    -- Insert sample exploration sites
    INSERT INTO public.exploration_sites (project_id, name, site_type, location, elevation, area, access_notes, created_by) VALUES
    (project1_id, 'Carlin Trend North', 'drilling', ST_Point(-116.1, 40.6), 1650, ST_Buffer(ST_Point(-116.1, 40.6)::geography, 1000)::geometry, 'Access via Highway 278, requires 4WD for final approach', sample_user_id),
    (project2_id, 'Escondida Extension', 'drilling', ST_Point(-69.1, -24.1), 3200, ST_Buffer(ST_Point(-69.1, -24.1)::geography, 1500)::geometry, 'High altitude, specialized equipment required', sample_user_id)
    RETURNING id INTO site1_id, site2_id;

    -- Get the site IDs  
    SELECT id INTO site1_id FROM public.exploration_sites WHERE name = 'Carlin Trend North' LIMIT 1;
    SELECT id INTO site2_id FROM public.exploration_sites WHERE name = 'Escondida Extension' LIMIT 1;

    -- Insert sample mineral deposits
    INSERT INTO public.mineral_deposits (site_id, mineral_type, confidence_level, grade_estimate, tonnage_estimate, discovery_date, notes, geochemistry_data, created_by) VALUES
    (site1_id, 'Gold', 85.5, 2.3, 150000, '2024-01-15', 'High-grade quartz vein system with visible gold', '{"Au_ppm": 2.3, "Ag_ppm": 15.2, "As_ppm": 120, "Sb_ppm": 45, "pathfinder_elements": ["As", "Sb", "Hg"]}', sample_user_id),
    (site2_id, 'Copper', 92.1, 0.8, 2500000, '2023-12-08', 'Large porphyry system with molybdenum credits', '{"Cu_percent": 0.8, "Mo_ppm": 180, "Au_ppm": 0.15, "S_percent": 2.1, "alteration": "phyllic"}', sample_user_id);

    -- Insert sample predictions
    INSERT INTO public.predictions (model_id, site_id, prediction_data, confidence_score, status, created_by) VALUES
    (model1_id, site1_id, '{"mineral_type": "Gold", "expected_yield": "High", "risk_level": "Medium", "recommendation": "Proceed with detailed drilling program", "target_depth": "50-150m", "estimated_resources": "2.5M oz", "development_timeline": "18 months"}', 88.5, 'completed', sample_user_id),
    (model2_id, site2_id, '{"mineral_type": "Copper", "expected_yield": "Very High", "risk_level": "Low", "recommendation": "Fast-track to feasibility study", "target_depth": "200-800m", "estimated_resources": "15M tonnes", "development_timeline": "36 months"}', 94.2, 'completed', sample_user_id);

END $$;