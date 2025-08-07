-- Insert sample AI models
INSERT INTO public.ai_models (name, version, model_type, training_data_info, performance_metrics, is_active) VALUES
('GeoSight Mineral Classifier', '2.1', 'neural_network', 
 '{"training_samples": 50000, "geological_regions": ["Nevada", "Chile", "Australia"], "mineral_types": ["gold", "copper", "lithium"], "data_sources": ["satellite", "geochemical", "magnetic"]}',
 '{"accuracy": 92.5, "precision": 90.2, "recall": 94.1, "f1_score": 92.1, "last_validated": "2024-01-15"}',
 true),
 
('DeepGround Explorer', '1.8', 'convolutional_neural_network',
 '{"training_samples": 75000, "depth_range": "0-500m", "mineral_types": ["iron", "zinc", "nickel"], "data_sources": ["ground_penetrating_radar", "magnetic", "gravity"]}',
 '{"accuracy": 88.7, "precision": 87.3, "recall": 89.9, "f1_score": 88.6, "last_validated": "2024-01-10"}',
 true),
 
('LithiumFinder AI', '3.0', 'random_forest',
 '{"training_samples": 30000, "geological_formations": ["brine", "pegmatite", "sedimentary"], "mineral_types": ["lithium"], "data_sources": ["geochemical", "satellite", "drilling"]}',
 '{"accuracy": 95.2, "precision": 93.8, "recall": 96.5, "f1_score": 95.1, "last_validated": "2024-01-20"}',
 true),
 
('CopperScope Pro', '2.5', 'gradient_boosting',
 '{"training_samples": 40000, "ore_types": ["porphyry", "skarn", "sediment_hosted"], "mineral_types": ["copper"], "data_sources": ["hyperspectral", "magnetic", "geochemical"]}',
 '{"accuracy": 89.3, "precision": 88.1, "recall": 90.7, "f1_score": 89.4, "last_validated": "2024-01-12"}',
 true),
 
('PreciousMetals Detector', '1.2', 'ensemble',
 '{"training_samples": 25000, "deposit_types": ["placer", "lode", "epithermal"], "mineral_types": ["gold", "silver"], "data_sources": ["satellite", "geochemical", "structural"]}',
 '{"accuracy": 91.8, "precision": 90.5, "recall": 93.2, "f1_score": 91.8, "last_validated": "2024-01-18"}',
 true);

-- Insert sample projects
INSERT INTO public.projects (name, description, country, province, geology_type, target_minerals, status, budget, start_date, end_date, coordinates) VALUES
('Nevada Gold Rush Revival', 'Large-scale gold exploration in Nevada''s Carlin Trend using advanced AI prediction models', 'USA', 'Nevada', 'Sediment-hosted gold', ARRAY['Gold'], 'active', 15000000, '2024-01-01', '2025-12-31', ST_Point(-116.0, 40.5)),

('Chilean Copper Expansion', 'Expansion of copper mining operations in the Atacama Desert with lithium co-production potential', 'Chile', 'Atacama', 'Porphyry copper', ARRAY['Copper', 'Lithium'], 'active', 25000000, '2023-06-01', '2026-05-31', ST_Point(-69.0, -24.0)),

('Australian Lithium Venture', 'Pegmatite-hosted lithium exploration in Western Australia''s lithium corridor', 'Australia', 'Western Australia', 'Pegmatite', ARRAY['Lithium', 'Tantalum'], 'planning', 8000000, '2024-03-01', '2025-08-31', ST_Point(121.0, -30.5)),

('Canadian Nickel Discovery', 'Nickel-copper sulfide exploration in the Sudbury Basin using machine learning', 'Canada', 'Ontario', 'Mafic-ultramafic', ARRAY['Nickel', 'Copper'], 'active', 12000000, '2023-09-01', '2025-08-31', ST_Point(-81.0, 46.5)),

('Peruvian Silver Heritage', 'Historic silver mine modernization with AI-driven ore body modeling', 'Peru', 'Cerro de Pasco', 'Epithermal', ARRAY['Silver', 'Lead', 'Zinc'], 'planning', 6000000, '2024-05-01', '2025-12-31', ST_Point(-76.2, -10.7));

-- Insert sample exploration sites
INSERT INTO public.exploration_sites (project_id, name, site_type, location, elevation, area, access_notes) 
SELECT 
  p.id,
  site_data.name,
  site_data.site_type::site_type,
  site_data.location,
  site_data.elevation,
  site_data.area,
  site_data.access_notes
FROM projects p
CROSS JOIN (
  VALUES 
    ('Carlin Trend North', 'drilling', ST_Point(-116.1, 40.6), 1650, ST_Buffer(ST_Point(-116.1, 40.6)::geography, 1000)::geometry, 'Access via Highway 278, requires 4WD for final approach'),
    ('Carlin Trend South', 'sampling', ST_Point(-116.05, 40.4), 1580, ST_Buffer(ST_Point(-116.05, 40.4)::geography, 800)::geometry, 'Accessible by standard vehicle, private road permission required'),
    ('Escondida Extension', 'drilling', ST_Point(-69.1, -24.1), 3200, ST_Buffer(ST_Point(-69.1, -24.1)::geography, 1500)::geometry, 'High altitude, specialized equipment required'),
    ('Salar Prospect', 'sampling', ST_Point(-68.9, -23.9), 2300, ST_Buffer(ST_Point(-68.9, -23.9)::geography, 2000)::geometry, 'Salt flat access, environmental permits in place'),
    ('Pilbara Central', 'exploration', ST_Point(121.1, -30.4), 400, ST_Buffer(ST_Point(121.1, -30.4)::geography, 1200)::geometry, 'Remote location, helicopter access preferred'),
    ('Greenbushes South', 'drilling', ST_Point(116.0, -33.8), 280, ST_Buffer(ST_Point(116.0, -33.8)::geography, 900)::geometry, 'Existing road access, near operational mine'),
    ('Sudbury North', 'exploration', ST_Point(-81.1, 46.6), 350, ST_Buffer(ST_Point(-81.1, 46.6)::geography, 1100)::geometry, 'Boreal forest, seasonal access limitations'),
    ('Onaping Depth', 'drilling', ST_Point(-80.9, 46.4), 280, ST_Buffer(ST_Point(-80.9, 46.4)::geography, 800)::geometry, 'Deep drilling target, infrastructure in place'),
    ('Cerro Rico East', 'sampling', ST_Point(-76.1, -10.6), 4100, ST_Point(-76.1, -10.6), 'Historic mining area, safety protocols required'),
    ('Morococha Extension', 'exploration', ST_Point(-76.3, -10.8), 3800, ST_Buffer(ST_Point(-76.3, -10.8)::geography, 700)::geometry, 'Mountainous terrain, weather dependent access')
) AS site_data(name, site_type, location, elevation, area, access_notes)
WHERE (
  (p.name = 'Nevada Gold Rush Revival' AND site_data.name LIKE 'Carlin%') OR
  (p.name = 'Chilean Copper Expansion' AND site_data.name IN ('Escondida Extension', 'Salar Prospect')) OR
  (p.name = 'Australian Lithium Venture' AND site_data.name IN ('Pilbara Central', 'Greenbushes South')) OR
  (p.name = 'Canadian Nickel Discovery' AND site_data.name IN ('Sudbury North', 'Onaping Depth')) OR
  (p.name = 'Peruvian Silver Heritage' AND site_data.name IN ('Cerro Rico East', 'Morococha Extension'))
);

-- Insert sample mineral deposits
INSERT INTO public.mineral_deposits (site_id, mineral_type, confidence_level, grade_estimate, tonnage_estimate, discovery_date, notes, geochemistry_data)
SELECT 
  es.id,
  deposit_data.mineral_type,
  deposit_data.confidence_level,
  deposit_data.grade_estimate,
  deposit_data.tonnage_estimate,
  deposit_data.discovery_date,
  deposit_data.notes,
  deposit_data.geochemistry_data
FROM exploration_sites es
CROSS JOIN (
  VALUES 
    ('Gold', 85.5, 2.3, 150000, '2024-01-15', 'High-grade quartz vein system with visible gold', '{"Au_ppm": 2.3, "Ag_ppm": 15.2, "As_ppm": 120, "Sb_ppm": 45, "pathfinder_elements": ["As", "Sb", "Hg"]}'),
    ('Copper', 92.1, 0.8, 2500000, '2023-12-08', 'Large porphyry system with molybdenum credits', '{"Cu_percent": 0.8, "Mo_ppm": 180, "Au_ppm": 0.15, "S_percent": 2.1, "alteration": "phyllic"}'),
    ('Lithium', 88.7, 1200, 50000, '2024-02-01', 'Pegmatite-hosted spodumene with excellent metallurgy', '{"Li2O_percent": 1.2, "Ta2O5_ppm": 120, "Nb2O5_ppm": 85, "Cs_ppm": 450, "mineral_assemblage": ["spodumene", "quartz", "feldspar"]}'),
    ('Nickel', 79.3, 1.2, 800000, '2023-11-20', 'Massive sulfide lens with copper credits', '{"Ni_percent": 1.2, "Cu_percent": 0.9, "Co_ppm": 800, "Pt_ppm": 0.5, "Pd_ppm": 1.2, "S_percent": 15.8}'),
    ('Silver', 91.2, 450, 25000, '2024-01-28', 'Epithermal vein system with high-grade silver shoots', '{"Ag_ppm": 450, "Pb_percent": 2.8, "Zn_percent": 3.5, "Au_ppm": 0.8, "gangue": "quartz-adularia"]}')
) AS deposit_data(mineral_type, confidence_level, grade_estimate, tonnage_estimate, discovery_date, notes, geochemistry_data)
WHERE (
  (es.name LIKE 'Carlin%' AND deposit_data.mineral_type = 'Gold') OR
  (es.name = 'Escondida Extension' AND deposit_data.mineral_type = 'Copper') OR
  (es.name = 'Salar Prospect' AND deposit_data.mineral_type = 'Lithium') OR
  (es.name LIKE '%Pilbara%' AND deposit_data.mineral_type = 'Lithium') OR
  (es.name LIKE 'Sudbury%' AND deposit_data.mineral_type = 'Nickel') OR
  (es.name LIKE 'Cerro%' AND deposit_data.mineral_type = 'Silver')
);

-- Insert sample predictions
INSERT INTO public.predictions (model_id, site_id, prediction_data, confidence_score, status)
SELECT 
  ai.id,
  es.id,
  pred_data.prediction_data,
  pred_data.confidence_score,
  pred_data.status::prediction_status
FROM ai_models ai
CROSS JOIN exploration_sites es
CROSS JOIN (
  VALUES 
    ('{"mineral_type": "Gold", "expected_yield": "High", "risk_level": "Medium", "recommendation": "Proceed with detailed drilling program", "target_depth": "50-150m", "estimated_resources": "2.5M oz", "development_timeline": "18 months"}', 88.5, 'completed'),
    ('{"mineral_type": "Copper", "expected_yield": "Very High", "risk_level": "Low", "recommendation": "Fast-track to feasibility study", "target_depth": "200-800m", "estimated_resources": "15M tonnes", "development_timeline": "36 months"}', 94.2, 'completed'),
    ('{"mineral_type": "Lithium", "expected_yield": "High", "risk_level": "Medium", "recommendation": "Continue exploration with focus on resource definition", "target_depth": "100-300m", "estimated_resources": "45M tonnes LCE", "development_timeline": "24 months"}', 91.7, 'completed'),
    ('{"mineral_type": "Nickel", "expected_yield": "Medium", "risk_level": "High", "recommendation": "Additional geophysical surveys needed", "target_depth": "300-1000m", "estimated_resources": "180K tonnes Ni", "development_timeline": "30 months"}', 76.3, 'processing'),
    ('{"mineral_type": "Silver", "expected_yield": "Very High", "risk_level": "Low", "recommendation": "Immediate resource expansion drilling", "target_depth": "50-250m", "estimated_resources": "125M oz Ag", "development_timeline": "12 months"}', 93.8, 'completed')
) AS pred_data(prediction_data, confidence_score, status)
WHERE (
  (ai.name = 'PreciousMetals Detector' AND es.name LIKE 'Carlin%' AND pred_data.prediction_data LIKE '%Gold%') OR
  (ai.name = 'CopperScope Pro' AND es.name = 'Escondida Extension' AND pred_data.prediction_data LIKE '%Copper%') OR
  (ai.name = 'LithiumFinder AI' AND es.name IN ('Salar Prospect', 'Pilbara Central') AND pred_data.prediction_data LIKE '%Lithium%') OR
  (ai.name = 'DeepGround Explorer' AND es.name LIKE 'Sudbury%' AND pred_data.prediction_data LIKE '%Nickel%') OR
  (ai.name = 'PreciousMetals Detector' AND es.name LIKE 'Cerro%' AND pred_data.prediction_data LIKE '%Silver%')
)
LIMIT 15;