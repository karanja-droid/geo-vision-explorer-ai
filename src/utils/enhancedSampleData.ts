import { supabase } from '@/integrations/supabase/client';

// Real geological data from major mining regions
const AFRICAN_MINING_REGIONS = [
  // South Africa - Witwatersrand Basin
  {
    name: 'Witwatersrand Gold Complex',
    country: 'South Africa',
    province: 'Gauteng',
    geology_type: 'Archean conglomerate-hosted gold',
    coordinates: [-26.1043, 27.8936], // Johannesburg area
    elevation: 1753,
    target_minerals: ['Gold', 'Uranium'],
    budget_range: [50000000, 200000000]
  },
  // Ghana - Ashanti Belt
  {
    name: 'Ashanti Gold Belt Project',
    country: 'Ghana',
    province: 'Ashanti Region',
    geology_type: 'Archaean greenstone belt',
    coordinates: [6.7249, -1.6208], // Obuasi area
    elevation: 200,
    target_minerals: ['Gold'],
    budget_range: [25000000, 75000000]
  },
  // Tanzania - Lake Victoria Goldfield
  {
    name: 'Lake Victoria Goldfield',
    country: 'Tanzania',
    province: 'Mwanza',
    geology_type: 'Archaean greenstone belt',
    coordinates: [-2.5164, 32.9175], // Geita area
    elevation: 1134,
    target_minerals: ['Gold'],
    budget_range: [30000000, 80000000]
  },
  // DRC - Copperbelt
  {
    name: 'Katanga Copper Complex',
    country: 'Democratic Republic of Congo',
    province: 'Katanga',
    geology_type: 'Sediment-hosted copper-cobalt',
    coordinates: [-11.6792, 27.4728], // Kolwezi area
    elevation: 1500,
    target_minerals: ['Copper', 'Cobalt'],
    budget_range: [100000000, 300000000]
  },
  // Mali - Birimian Belt
  {
    name: 'Birimian Gold Project',
    country: 'Mali',
    province: 'Kayes',
    geology_type: 'Paleoproterozoic greenstone',
    coordinates: [13.4203, -9.4739], // Sadiola area
    elevation: 350,
    target_minerals: ['Gold'],
    budget_range: [20000000, 60000000]
  },
  // Ghana - Tarkwa
  {
    name: 'Tarkwa Gold District',
    country: 'Ghana',
    province: 'Western Region',
    geology_type: 'Paleoproterozoic Tarkwaian',
    coordinates: [5.2982, -2.0025], // Tarkwa area
    elevation: 75,
    target_minerals: ['Gold'],
    budget_range: [40000000, 120000000]
  }
];

const AMERICAN_MINING_REGIONS = [
  // Nevada - Carlin Trend
  {
    name: 'Carlin Trend Gold District',
    country: 'USA',
    province: 'Nevada',
    geology_type: 'Sediment-hosted gold (Carlin-type)',
    coordinates: [40.7608, -116.1319], // Carlin area
    elevation: 1372,
    target_minerals: ['Gold', 'Silver'],
    budget_range: [80000000, 250000000]
  },
  // Chile - Atacama Desert
  {
    name: 'Atacama Copper-Lithium Complex',
    country: 'Chile',
    province: 'Atacama',
    geology_type: 'Porphyry copper and salar brines',
    coordinates: [-24.5964, -69.2963], // Calama area
    elevation: 2250,
    target_minerals: ['Copper', 'Lithium', 'Molybdenum'],
    budget_range: [150000000, 500000000]
  },
  // Peru - Andes
  {
    name: 'Central Andes Polymetallic',
    country: 'Peru',
    province: 'Junín',
    geology_type: 'Andean porphyry and epithermal',
    coordinates: [-11.1573, -75.9936], // Cerro de Pasco area
    elevation: 4330,
    target_minerals: ['Copper', 'Lead', 'Zinc', 'Silver'],
    budget_range: [60000000, 180000000]
  },
  // Canada - Abitibi Belt
  {
    name: 'Abitibi Greenstone Belt',
    country: 'Canada',
    province: 'Ontario',
    geology_type: 'Archean greenstone belt',
    coordinates: [48.2619, -81.0150], // Timmins area
    elevation: 295,
    target_minerals: ['Gold', 'Copper', 'Zinc'],
    budget_range: [40000000, 150000000]
  },
  // Brazil - Iron Quadrangle
  {
    name: 'Iron Quadrangle Complex',
    country: 'Brazil',
    province: 'Minas Gerais',
    geology_type: 'Archean iron formation',
    coordinates: [-20.3155, -43.8775], // Belo Horizonte area
    elevation: 852,
    target_minerals: ['Iron', 'Gold'],
    budget_range: [200000000, 800000000]
  },
  // Mexico - Sierra Madre
  {
    name: 'Sierra Madre Occidental',
    country: 'Mexico',
    province: 'Chihuahua',
    geology_type: 'Epithermal precious metals',
    coordinates: [28.6353, -106.0889], // Chihuahua area
    elevation: 1440,
    target_minerals: ['Silver', 'Gold', 'Lead', 'Zinc'],
    budget_range: [30000000, 90000000]
  }
];

// Realistic mineral deposit data based on geological surveys
const MINERAL_DEPOSIT_TEMPLATES = {
  'Gold': {
    grade_ranges: { min: 0.5, max: 15.0 }, // g/t Au
    tonnage_ranges: { min: 50000, max: 5000000 }, // tonnes
    confidence_ranges: { min: 65, max: 95 },
    typical_depths: [50, 150, 300, 500, 800],
    geochemistry_elements: ['Au', 'Ag', 'As', 'Sb', 'Te', 'Cu', 'Pb', 'Zn']
  },
  'Copper': {
    grade_ranges: { min: 0.3, max: 3.5 }, // % Cu
    tonnage_ranges: { min: 100000, max: 500000000 }, // tonnes
    confidence_ranges: { min: 70, max: 92 },
    typical_depths: [100, 200, 400, 600, 1000],
    geochemistry_elements: ['Cu', 'Mo', 'Au', 'Ag', 'Fe', 'S', 'Re', 'Pb', 'Zn']
  },
  'Lithium': {
    grade_ranges: { min: 200, max: 1500 }, // mg/L Li (for brines)
    tonnage_ranges: { min: 10000, max: 10000000 }, // tonnes LCE
    confidence_ranges: { min: 60, max: 88 },
    typical_depths: [10, 50, 100, 200, 400],
    geochemistry_elements: ['Li', 'K', 'Mg', 'Na', 'B', 'Cs', 'Rb', 'Ca']
  },
  'Iron': {
    grade_ranges: { min: 35, max: 68 }, // % Fe
    tonnage_ranges: { min: 10000000, max: 1000000000 }, // tonnes
    confidence_ranges: { min: 80, max: 95 },
    typical_depths: [20, 100, 200, 400, 600],
    geochemistry_elements: ['Fe', 'SiO2', 'Al2O3', 'P', 'S', 'TiO2', 'Mn', 'CaO']
  },
  'Silver': {
    grade_ranges: { min: 20, max: 800 }, // g/t Ag
    tonnage_ranges: { min: 25000, max: 2000000 }, // tonnes
    confidence_ranges: { min: 65, max: 90 },
    typical_depths: [30, 100, 250, 400, 700],
    geochemistry_elements: ['Ag', 'Pb', 'Zn', 'Cu', 'Au', 'As', 'Sb', 'Bi']
  }
};

const SITE_TYPES = [
  'drilling', 'surface_sampling', 'geophysics', 'geochemistry', 'remote_sensing'
];

const AI_MODEL_TEMPLATES = [
  {
    name: 'AfriGold Neural Predictor',
    version: '3.2',
    model_type: 'deep_neural_network',
    regions: ['South Africa', 'Ghana', 'Mali', 'Tanzania'],
    minerals: ['Gold'],
    accuracy: 94.2,
    training_samples: 75000
  },
  {
    name: 'CopperSight Ensemble',
    version: '2.8',
    model_type: 'gradient_boosting',
    regions: ['Chile', 'Peru', 'DRC'],
    minerals: ['Copper', 'Molybdenum'],
    accuracy: 91.8,
    training_samples: 60000
  },
  {
    name: 'LithiumLens AI',
    version: '4.1',
    model_type: 'random_forest',
    regions: ['Chile', 'Argentina', 'Bolivia'],
    minerals: ['Lithium'],
    accuracy: 89.5,
    training_samples: 35000
  },
  {
    name: 'Greenstone Belt Classifier',
    version: '2.5',
    model_type: 'support_vector_machine',
    regions: ['Canada', 'Australia', 'Ghana'],
    minerals: ['Gold', 'Copper', 'Zinc'],
    accuracy: 87.3,
    training_samples: 45000
  },
  {
    name: 'Epithermal Metals AI',
    version: '3.0',
    model_type: 'neural_network',
    regions: ['Mexico', 'Peru', 'Philippines'],
    minerals: ['Silver', 'Gold'],
    accuracy: 92.1,
    training_samples: 55000
  }
];

// Utility functions
const getRandomInRange = (min: number, max: number, decimals = 2): number => {
  return Math.round((Math.random() * (max - min) + min) * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const generateCoordinatesNear = (center: [number, number], radiusKm = 50): [number, number] => {
  const kmToDegree = 1 / 111; // approximate conversion
  const radius = radiusKm * kmToDegree;
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radius;
  
  return [
    center[0] + distance * Math.cos(angle),
    center[1] + distance * Math.sin(angle)
  ];
};

const generateGeochemistryData = (elements: string[], baseValues: Record<string, number> = {}): Record<string, number> => {
  const data: Record<string, number> = {};
  
  elements.forEach(element => {
    const baseValue = baseValues[element] || 1;
    const variation = 0.1 + Math.random() * 2; // 0.1x to 2.1x variation
    data[element] = Math.round(baseValue * variation * 100) / 100;
  });
  
  return data;
};

export const createEnhancedSampleData = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated to create sample data');
    }

    console.log('Creating enhanced sample data with 1000+ records...');

    // 1. Create Advanced AI Models (5 models)
    const aiModels = AI_MODEL_TEMPLATES.map(template => ({
      name: template.name,
      version: template.version,
      model_type: template.model_type,
      training_data_info: {
        training_samples: template.training_samples,
        geological_regions: template.regions,
        mineral_types: template.minerals,
        data_sources: ['satellite', 'geochemical', 'magnetic', 'gravity', 'radiometric'],
        validation_method: 'k_fold_cross_validation',
        feature_count: 150 + Math.floor(Math.random() * 100)
      },
      performance_metrics: {
        accuracy: template.accuracy,
        precision: template.accuracy - 1 + Math.random() * 2,
        recall: template.accuracy - 2 + Math.random() * 3,
        f1_score: template.accuracy - 1.5 + Math.random() * 2.5,
        auc_score: template.accuracy + 2 + Math.random() * 3,
        last_validated: '2024-12-01',
        confusion_matrix: [
          [850, 45], [32, 873]
        ]
      },
      is_active: true,
      created_by: user.id
    }));

    const { data: createdModels, error: modelsError } = await supabase
      .from('ai_models')
      .insert(aiModels)
      .select();

    if (modelsError) throw modelsError;

    // 2. Create Projects (20 projects from major mining regions)
    const allRegions = [...AFRICAN_MINING_REGIONS, ...AMERICAN_MINING_REGIONS];
    const projects = [];

    // Add some additional projects for variety
    const additionalProjects = [
      {
        name: 'Kalgoorlie Super Pit Extension',
        country: 'Australia',
        province: 'Western Australia',
        geology_type: 'Archean greenstone belt',
        coordinates: [-30.7733, 121.4955],
        target_minerals: ['Gold'],
        budget_range: [120000000, 300000000]
      },
      {
        name: 'Sudbury Basin Exploration',
        country: 'Canada',
        province: 'Ontario',
        geology_type: 'Impact-related Ni-Cu-PGE',
        coordinates: [46.4917, -80.9930],
        target_minerals: ['Nickel', 'Copper', 'Platinum'],
        budget_range: [80000000, 200000000]
      }
    ];

    [...allRegions, ...additionalProjects].forEach((region, index) => {
      const budget = getRandomInRange(region.budget_range[0], region.budget_range[1], 0);
      const startYear = 2022 + Math.floor(Math.random() * 3);
      const duration = 2 + Math.floor(Math.random() * 4); // 2-5 years
      
      projects.push({
        name: region.name,
        description: `Advanced mineral exploration project in ${region.province}, ${region.country}. Target: ${region.target_minerals.join(', ')}. Geological setting: ${region.geology_type}.`,
        country: region.country,
        province: region.province,
        geology_type: region.geology_type,
        target_minerals: region.target_minerals,
        status: getRandomElement(['planning', 'active', 'completed']),
        budget: budget,
        start_date: `${startYear}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-01`,
        end_date: `${startYear + duration}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-31`,
        coordinates: `POINT(${region.coordinates[1]} ${region.coordinates[0]})`,
        owner_id: user.id
      });
    });

    const { data: createdProjects, error: projectsError } = await supabase
      .from('projects')
      .insert(projects.slice(0, 20)) // Limit to 20 projects
      .select();

    if (projectsError) throw projectsError;

    // 3. Create Exploration Sites (200+ sites)
    const sites = [];
    createdProjects.forEach(project => {
      const projectRegion = allRegions.find(r => r.name === project.name);
      if (!projectRegion) return;

      const sitesPerProject = 8 + Math.floor(Math.random() * 12); // 8-19 sites per project
      
      for (let i = 0; i < sitesPerProject; i++) {
        const coordinates = generateCoordinatesNear(projectRegion.coordinates as [number, number]);
        const elevationVariation = getRandomInRange(-200, 200, 0);
        
        sites.push({
          name: `${project.name.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 20)} Site ${String.fromCharCode(65 + i)}${Math.floor(Math.random() * 100)}`,
          project_id: project.id,
          site_type: getRandomElement(SITE_TYPES),
          location: `POINT(${coordinates[1]} ${coordinates[0]})`,
          area: `POLYGON((${coordinates[1] - 0.01} ${coordinates[0] - 0.01}, ${coordinates[1] + 0.01} ${coordinates[0] - 0.01}, ${coordinates[1] + 0.01} ${coordinates[0] + 0.01}, ${coordinates[1] - 0.01} ${coordinates[0] + 0.01}, ${coordinates[1] - 0.01} ${coordinates[0] - 0.01}))`,
          elevation: projectRegion.elevation + elevationVariation,
          access_notes: getRandomElement([
            'Road access available, 4WD recommended',
            'Helicopter access only during dry season',
            'Good road access, year-round operations',
            'Remote location, requires camp setup',
            'Seasonal access restrictions due to weather'
          ]),
          created_by: user.id
        });
      }
    });

    const { data: createdSites, error: sitesError } = await supabase
      .from('exploration_sites')
      .insert(sites)
      .select();

    if (sitesError) throw sitesError;

    // 4. Create Mineral Deposits (500+ deposits)
    const deposits = [];
    createdSites.forEach(site => {
      const project = createdProjects.find(p => p.id === site.project_id);
      if (!project) return;

      const depositsPerSite = 1 + Math.floor(Math.random() * 4); // 1-4 deposits per site
      
      for (let i = 0; i < depositsPerSite; i++) {
        const mineralType = getRandomElement(project.target_minerals);
        const template = MINERAL_DEPOSIT_TEMPLATES[mineralType];
        if (!template) continue;

        const grade = getRandomInRange(template.grade_ranges.min, template.grade_ranges.max);
        const tonnage = getRandomInRange(template.tonnage_ranges.min, template.tonnage_ranges.max, 0);
        const confidence = getRandomInRange(template.confidence_ranges.min, template.confidence_ranges.max);
        
        const baseGeochemKey = mineralType === 'Gold' ? 'Au' : mineralType === 'Copper' ? 'Cu' : mineralType === 'Lithium' ? 'Li' : mineralType === 'Iron' ? 'Fe' : 'Ag';
        const geochemData = generateGeochemistryData(template.geochemistry_elements, {
          [baseGeochemKey]: grade
        });

        const discoveryYear = 2018 + Math.floor(Math.random() * 7);
        const depth1 = getRandomElement(template.typical_depths);
        const depth2 = getRandomElement(template.typical_depths);
        
        deposits.push({
          site_id: site.id,
          mineral_type: mineralType,
          grade_estimate: grade,
          tonnage_estimate: tonnage,
          confidence_level: confidence,
          discovery_date: `${discoveryYear}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
          geochemistry_data: {
            elements: geochemData,
            sampling_method: getRandomElement(['drill_core', 'chip_sampling', 'grab_sampling', 'channel_sampling']),
            depth_interval: `${Math.min(depth1 as number, depth2 as number)}-${Math.max(depth1 as number, depth2 as number) + 10}m`,
            qaqc_passed: Math.random() > 0.1
          },
          notes: `${mineralType} mineralization in ${project.geology_type}. Grade: ${grade}${mineralType === 'Gold' || mineralType === 'Silver' ? ' g/t' : mineralType === 'Lithium' ? ' mg/L' : '%'}. Estimated resources: ${tonnage.toLocaleString()} tonnes.`,
          created_by: user.id
        });
      }
    });

    const { data: createdDeposits, error: depositsError } = await supabase
      .from('mineral_deposits')
      .insert(deposits)
      .select();

    if (depositsError) throw depositsError;

    // 5. Create AI Predictions (300+ predictions)
    const predictions = [];
    const validSites = createdSites.slice(0, 150); // Use subset of sites for predictions
    
    validSites.forEach(site => {
      const project = createdProjects.find(p => p.id === site.project_id);
      if (!project || !createdModels.length) return;

      const predictionsPerSite = 1 + Math.floor(Math.random() * 3); // 1-3 predictions per site
      
      for (let i = 0; i < predictionsPerSite; i++) {
        const model = getRandomElement(createdModels);
        const targetMineral = getRandomElement(project.target_minerals);
        const confidence = getRandomInRange(45, 98);
        const expectedYield = getRandomInRange(100, 10000, 0);
        
        predictions.push({
          site_id: site.id,
          model_id: model.id,
          confidence_score: confidence,
          status: getRandomElement(['pending', 'completed', 'failed']),
          prediction_data: {
            mineral_type: targetMineral,
            confidence_score: confidence,
            expected_yield: expectedYield,
            risk_level: confidence > 80 ? 'low' : confidence > 60 ? 'medium' : 'high',
            recommendation: confidence > 75 ? 'proceed_with_drilling' : confidence > 50 ? 'additional_sampling' : 'area_not_promising',
            target_depth: getRandomElement([50, 100, 200, 300, 500]),
            estimated_resources: `${Math.floor(expectedYield * (1 + Math.random()))} tonnes`,
            geological_confidence: getRandomElement(['high', 'medium', 'low']),
            technical_details: {
              ore_type: targetMineral.toLowerCase(),
              host_rock: project.geology_type,
              structural_control: getRandomElement(['fault_controlled', 'stratigraphic', 'contact_metamorphic', 'hydrothermal']),
              alteration_zone: getRandomElement(['sericitic', 'argillic', 'propylitic', 'potassic'])
            }
          },
          created_by: user.id
        });
      }
    });

    const { data: createdPredictions, error: predictionsError } = await supabase
      .from('predictions')
      .insert(predictions)
      .select();

    if (predictionsError) throw predictionsError;

    console.log('Enhanced sample data creation completed successfully!');
    console.log(`Created: ${createdModels.length} AI models, ${createdProjects.length} projects, ${createdSites.length} sites, ${createdDeposits.length} deposits, ${createdPredictions.length} predictions`);

    return {
      models: createdModels,
      projects: createdProjects,
      sites: createdSites,
      deposits: createdDeposits,
      predictions: createdPredictions,
      totalRecords: createdModels.length + createdProjects.length + createdSites.length + createdDeposits.length + createdPredictions.length
    };

  } catch (error) {
    console.error('Error creating enhanced sample data:', error);
    throw error;
  }
};