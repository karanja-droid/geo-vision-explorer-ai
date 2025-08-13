import { faker } from '@faker-js/faker';
import {
  Project,
  ExplorationSite,
  MineralDeposit,
  Prediction,
  Profile,
  ProjectWithSites,
  ExplorationSiteWithDeposits,
  MineralDepositWithPredictions,
} from '@/integrations/supabase/enhanced-types';

// Geological constants and data
const MINERAL_TYPES = [
  'Gold', 'Silver', 'Copper', 'Iron', 'Lead', 'Zinc', 'Nickel', 'Platinum',
  'Palladium', 'Uranium', 'Coal', 'Diamond', 'Emerald', 'Ruby', 'Sapphire',
  'Quartz', 'Feldspar', 'Mica', 'Graphite', 'Barite', 'Fluorite', 'Gypsum',
  'Limestone', 'Dolomite', 'Sandstone', 'Shale', 'Granite', 'Basalt',
  'Molybdenum', 'Tungsten', 'Tin', 'Cobalt', 'Lithium', 'Rare Earth Elements',
  'Phosphate', 'Potash', 'Salt', 'Sulfur', 'Magnesium', 'Aluminum',
  'Chromium', 'Manganese', 'Titanium', 'Vanadium', 'Zirconium', 'Beryllium'
];

const SITE_TYPES = ['outcrop', 'drill_site', 'sample_location', 'survey_point', 'other'] as const;
const PROJECT_STATUSES = ['planning', 'active', 'completed', 'on_hold', 'cancelled'] as const;
const PREDICTION_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
const USER_ROLES = ['administrator', 'geologist', 'geophysicist', 'drilling_manager', 'qa_qc_specialist', 'environmental_officer', 'executive'] as const;

const AI_MODELS = [
  'DeepMine-v2.1', 'GeoNet-Pro', 'MineralAI-Advanced', 'GeoPredictive-3.0',
  'TerraVision-ML', 'RockSense-AI', 'GeologicalGPT', 'MineralClassifier-v4',
  'DeepGeology-Transformer', 'GeoAnalytics-Neural', 'PredictiveGeology-v3',
  'SmartMining-AI', 'GeospatialML-Pro', 'MineralDetection-CNN'
];

// Geographic regions for realistic coordinates
const MINING_REGIONS = [
  { name: 'Nevada Gold Fields', lat: 40.5, lng: -116.5, radius: 2 },
  { name: 'Colorado Rockies', lat: 39.5, lng: -106.0, radius: 1.5 },
  { name: 'Arizona Copper Belt', lat: 33.0, lng: -111.0, radius: 1.2 },
  { name: 'Montana Silver Valley', lat: 47.5, lng: -112.0, radius: 1.8 },
  { name: 'Utah Mineral District', lat: 39.3, lng: -111.7, radius: 1.0 },
  { name: 'Wyoming Coal Basin', lat: 43.0, lng: -108.0, radius: 2.2 },
  { name: 'Alaska Gold Rush', lat: 64.8, lng: -147.7, radius: 3.0 },
  { name: 'California Mother Lode', lat: 38.5, lng: -120.5, radius: 1.5 },
  { name: 'Idaho Gem State', lat: 44.0, lng: -114.0, radius: 2.0 },
  { name: 'New Mexico Turquoise', lat: 35.0, lng: -106.0, radius: 1.3 }
];

// Helper functions
const generateCoordinates = (region?: typeof MINING_REGIONS[0]) => {
  if (region) {
    const latOffset = (Math.random() - 0.5) * region.radius;
    const lngOffset = (Math.random() - 0.5) * region.radius;
    return {
      latitude: region.lat + latOffset,
      longitude: region.lng + lngOffset
    };
  }
  
  // Random US coordinates
  return {
    latitude: faker.location.latitude({ min: 25, max: 49 }),
    longitude: faker.location.longitude({ min: -125, max: -66 })
  };
};

const generateRealisticGrade = (mineralType: string): number => {
  const gradeRanges: Record<string, [number, number]> = {
    'Gold': [0.5, 15.0],
    'Silver': [50, 500],
    'Copper': [0.3, 3.5],
    'Iron': [25, 65],
    'Lead': [1.0, 8.0],
    'Zinc': [2.0, 12.0],
    'Nickel': [0.5, 2.5],
    'Platinum': [0.1, 5.0],
    'Coal': [45, 85],
    'Diamond': [0.1, 2.0],
    'Uranium': [0.05, 0.5],
    'Lithium': [0.2, 1.5],
    'Rare Earth Elements': [0.5, 5.0]
  };
  
  const range = gradeRanges[mineralType] || [0.1, 10.0];
  return faker.number.float({ min: range[0], max: range[1], fractionDigits: 2 });
};

const generateRealisticTonnage = (mineralType: string, grade: number): number => {
  // Higher grade typically means lower tonnage
  const baseMultiplier = Math.max(0.1, 1 / Math.sqrt(grade));
  const baseTonnage = faker.number.int({ min: 1000, max: 1000000 });
  return Math.round(baseTonnage * baseMultiplier);
};

// Sample data generators
export class SampleDataGenerator {
  private static instance: SampleDataGenerator;
  private generatedProjects: Project[] = [];
  private generatedSites: ExplorationSite[] = [];
  private generatedDeposits: MineralDeposit[] = [];
  private generatedPredictions: Prediction[] = [];
  private generatedProfiles: Profile[] = [];

  static getInstance(): SampleDataGenerator {
    if (!SampleDataGenerator.instance) {
      SampleDataGenerator.instance = new SampleDataGenerator();
    }
    return SampleDataGenerator.instance;
  }

  // Generate user profiles
  generateProfiles(count: number = 50): Profile[] {
    const profiles: Profile[] = [];
    
    for (let i = 0; i < count; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName });
      
      profiles.push({
        id: faker.string.uuid(),
        email,
        full_name: `${firstName} ${lastName}`,
        avatar_url: faker.image.avatar(),
        role: faker.helpers.arrayElement(USER_ROLES),
        department: faker.helpers.arrayElement([
          'Geology', 'Geophysics', 'Mining Engineering', 'Environmental',
          'Operations', 'Safety', 'Finance', 'Administration'
        ]),
        phone: faker.phone.number(),
        location: faker.location.city(),
        bio: faker.lorem.paragraph(),
        skills: faker.helpers.arrayElements([
          'Geological Mapping', 'Core Logging', 'Geochemical Analysis',
          'Geophysical Surveys', 'Resource Estimation', 'Mine Planning',
          'Environmental Assessment', 'Safety Management', 'Data Analysis',
          'GIS Mapping', 'Remote Sensing', 'Drilling Operations'
        ], { min: 2, max: 6 }),
        certifications: faker.helpers.arrayElements([
          'Professional Geologist (PG)', 'Certified Mine Safety Professional',
          'Environmental Impact Assessment', 'ISO 14001 Lead Auditor',
          'Project Management Professional (PMP)', 'GIS Professional (GISP)'
        ], { min: 0, max: 3 }),
        experience_years: faker.number.int({ min: 1, max: 35 }),
        created_at: faker.date.past({ years: 2 }).toISOString(),
        updated_at: faker.date.recent().toISOString(),
      });
    }
    
    this.generatedProfiles = profiles;
    return profiles;
  }

  // Generate projects
  generateProjects(count: number = 100): Project[] {
    const projects: Project[] = [];
    
    for (let i = 0; i < count; i++) {
      const region = faker.helpers.arrayElement(MINING_REGIONS);
      const startDate = faker.date.past({ years: 3 });
      const endDate = faker.date.future({ years: 2, refDate: startDate });
      const coordinates = generateCoordinates(region);
      
      projects.push({
        id: faker.string.uuid(),
        name: `${region.name} ${faker.helpers.arrayElement(['Exploration', 'Mining', 'Survey', 'Development'])} Project`,
        description: faker.lorem.paragraphs(2),
        location: `${faker.location.city()}, ${faker.location.state()}`,
        status: faker.helpers.arrayElement(PROJECT_STATUSES),
        budget: faker.number.float({ min: 100000, max: 50000000, fractionDigits: 2 }),
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        coordinates: `POINT(${coordinates.longitude} ${coordinates.latitude})`,
        created_at: faker.date.past({ years: 1 }).toISOString(),
        updated_at: faker.date.recent().toISOString(),
        user_id: this.generatedProfiles[faker.number.int({ min: 0, max: this.generatedProfiles.length - 1 })]?.id || faker.string.uuid(),
      });
    }
    
    this.generatedProjects = projects;
    return projects;
  }

  // Generate exploration sites
  generateSites(count: number = 500): ExplorationSite[] {
    const sites: ExplorationSite[] = [];
    
    for (let i = 0; i < count; i++) {
      const project = faker.helpers.arrayElement(this.generatedProjects);
      const projectCoords = this.parseCoordinates(project.coordinates);
      
      // Generate coordinates near the project
      const siteCoords = {
        latitude: projectCoords.latitude + (Math.random() - 0.5) * 0.1,
        longitude: projectCoords.longitude + (Math.random() - 0.5) * 0.1
      };
      
      sites.push({
        id: faker.string.uuid(),
        project_id: project.id,
        name: `${faker.helpers.arrayElement(['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot'])} Site ${faker.number.int({ min: 1, max: 999 })}`,
        description: faker.lorem.paragraph(),
        coordinates: `POINT(${siteCoords.longitude} ${siteCoords.latitude})`,
        elevation: faker.number.float({ min: 500, max: 4000, fractionDigits: 1 }),
        site_type: faker.helpers.arrayElement(SITE_TYPES),
        access_notes: faker.lorem.sentence(),
        created_at: faker.date.past({ years: 1 }).toISOString(),
        updated_at: faker.date.recent().toISOString(),
      });
    }
    
    this.generatedSites = sites;
    return sites;
  }

  // Generate mineral deposits
  generateMineralDeposits(count: number = 800): MineralDeposit[] {
    const deposits: MineralDeposit[] = [];
    
    for (let i = 0; i < count; i++) {
      const site = faker.helpers.arrayElement(this.generatedSites);
      const siteCoords = this.parseCoordinates(site.coordinates);
      const mineralType = faker.helpers.arrayElement(MINERAL_TYPES);
      const grade = generateRealisticGrade(mineralType);
      const tonnage = generateRealisticTonnage(mineralType, grade);
      
      // Generate coordinates near the site
      const depositCoords = {
        latitude: siteCoords.latitude + (Math.random() - 0.5) * 0.01,
        longitude: siteCoords.longitude + (Math.random() - 0.5) * 0.01
      };
      
      deposits.push({
        id: faker.string.uuid(),
        site_id: site.id,
        mineral_type: mineralType,
        grade,
        tonnage,
        confidence_level: faker.number.int({ min: 30, max: 95 }),
        discovery_date: faker.date.past({ years: 2 }).toISOString().split('T')[0],
        coordinates: `POINT(${depositCoords.longitude} ${depositCoords.latitude})`,
        depth: faker.number.float({ min: 5, max: 500, fractionDigits: 1 }),
        notes: faker.lorem.paragraph(),
        created_at: faker.date.past({ years: 1 }).toISOString(),
        updated_at: faker.date.recent().toISOString(),
      });
    }
    
    this.generatedDeposits = deposits;
    return deposits;
  }

  // Generate AI predictions
  generatePredictions(count: number = 1200): Prediction[] {
    const predictions: Prediction[] = [];
    
    for (let i = 0; i < count; i++) {
      const deposit = faker.helpers.arrayElement(this.generatedDeposits);
      const model = faker.helpers.arrayElement(AI_MODELS);
      const confidenceScore = faker.number.float({ min: 0.4, max: 0.98, fractionDigits: 3 });
      
      // Predicted values should be somewhat close to actual values
      const actualGrade = deposit.grade;
      const gradeVariation = actualGrade * 0.3; // 30% variation
      const predictedGrade = Math.max(0.01, actualGrade + (Math.random() - 0.5) * gradeVariation);
      
      const actualTonnage = deposit.tonnage || 10000;
      const tonnageVariation = actualTonnage * 0.4; // 40% variation
      const predictedTonnage = Math.max(100, actualTonnage + (Math.random() - 0.5) * tonnageVariation);
      
      predictions.push({
        id: faker.string.uuid(),
        deposit_id: deposit.id,
        model_name: model,
        confidence_score: confidenceScore,
        predicted_grade: Math.round(predictedGrade * 100) / 100,
        predicted_tonnage: Math.round(predictedTonnage),
        status: faker.helpers.arrayElement(PREDICTION_STATUSES),
        metadata: {
          algorithm: faker.helpers.arrayElement(['CNN', 'Random Forest', 'SVM', 'Neural Network', 'Gradient Boosting']),
          training_data_size: faker.number.int({ min: 1000, max: 100000 }),
          processing_time_ms: faker.number.int({ min: 500, max: 30000 }),
          model_version: faker.system.semver(),
          accuracy_score: faker.number.float({ min: 0.7, max: 0.99, fractionDigits: 3 }),
          cross_validation_score: faker.number.float({ min: 0.65, max: 0.95, fractionDigits: 3 })
        },
        features_used: faker.helpers.arrayElements([
          'geological_formation', 'rock_type', 'alteration_zones', 'structural_features',
          'geochemical_signatures', 'geophysical_anomalies', 'elevation', 'slope',
          'aspect', 'proximity_to_faults', 'magnetic_intensity', 'gravity_anomaly',
          'radiometric_data', 'spectral_analysis', 'drill_core_data', 'assay_results'
        ], { min: 5, max: 12 }),
        created_at: faker.date.past({ years: 1 }).toISOString(),
        updated_at: faker.date.recent().toISOString(),
      });
    }
    
    this.generatedPredictions = predictions;
    return predictions;
  }

  // Generate complete dataset
  generateCompleteDataset(): {
    profiles: Profile[];
    projects: Project[];
    sites: ExplorationSite[];
    deposits: MineralDeposit[];
    predictions: Prediction[];
    projectsWithSites: ProjectWithSites[];
    sitesWithDeposits: ExplorationSiteWithDeposits[];
    depositsWithPredictions: MineralDepositWithPredictions[];
  } {
    console.log('🔄 Generating comprehensive sample data...');
    
    const profiles = this.generateProfiles(50);
    const projects = this.generateProjects(100);
    const sites = this.generateSites(500);
    const deposits = this.generateMineralDeposits(800);
    const predictions = this.generatePredictions(1200);
    
    // Generate enhanced objects with relationships
    const projectsWithSites = this.generateProjectsWithSites();
    const sitesWithDeposits = this.generateSitesWithDeposits();
    const depositsWithPredictions = this.generateDepositsWithPredictions();
    
    console.log('✅ Sample data generation complete!');
    console.log(`📊 Generated: ${profiles.length} profiles, ${projects.length} projects, ${sites.length} sites, ${deposits.length} deposits, ${predictions.length} predictions`);
    
    return {
      profiles,
      projects,
      sites,
      deposits,
      predictions,
      projectsWithSites,
      sitesWithDeposits,
      depositsWithPredictions
    };
  }

  // Generate projects with related sites
  private generateProjectsWithSites(): ProjectWithSites[] {
    return this.generatedProjects.map(project => {
      const projectSites = this.generatedSites.filter(site => site.project_id === project.id);
      const projectDeposits = this.generatedDeposits.filter(deposit => 
        projectSites.some(site => site.id === deposit.site_id)
      );
      const projectPredictions = this.generatedPredictions.filter(prediction =>
        projectDeposits.some(deposit => deposit.id === prediction.deposit_id)
      );
      
      return {
        ...project,
        exploration_sites: projectSites,
        mineral_deposits: projectDeposits,
        predictions: projectPredictions,
        _count: {
          sites: projectSites.length,
          deposits: projectDeposits.length,
          predictions: projectPredictions.length
        }
      };
    });
  }

  // Generate sites with related deposits
  private generateSitesWithDeposits(): ExplorationSiteWithDeposits[] {
    return this.generatedSites.map(site => {
      const siteDeposits = this.generatedDeposits.filter(deposit => deposit.site_id === site.id);
      const sitePredictions = this.generatedPredictions.filter(prediction =>
        siteDeposits.some(deposit => deposit.id === prediction.deposit_id)
      );
      
      return {
        ...site,
        mineral_deposits: siteDeposits,
        predictions: sitePredictions,
        _count: {
          deposits: siteDeposits.length,
          predictions: sitePredictions.length
        }
      };
    });
  }

  // Generate deposits with related predictions
  private generateDepositsWithPredictions(): MineralDepositWithPredictions[] {
    return this.generatedDeposits.map(deposit => {
      const depositPredictions = this.generatedPredictions.filter(prediction => 
        prediction.deposit_id === deposit.id
      );
      const site = this.generatedSites.find(s => s.id === deposit.site_id);
      
      return {
        ...deposit,
        predictions: depositPredictions,
        exploration_sites: site ? [site] : [],
        _count: {
          predictions: depositPredictions.length
        }
      };
    });
  }

  // Helper method to parse coordinates
  private parseCoordinates(pointString: string): { latitude: number; longitude: number } {
    const match = pointString.match(/POINT\(([^)]+)\)/);
    if (match) {
      const [lng, lat] = match[1].split(' ').map(Number);
      return { latitude: lat, longitude: lng };
    }
    return { latitude: 0, longitude: 0 };
  }

  // Get generated data
  getGeneratedData() {
    return {
      profiles: this.generatedProfiles,
      projects: this.generatedProjects,
      sites: this.generatedSites,
      deposits: this.generatedDeposits,
      predictions: this.generatedPredictions
    };
  }

  // Export data as JSON
  exportToJSON(): string {
    const data = this.generateCompleteDataset();
    return JSON.stringify(data, null, 2);
  }

  // Export data as SQL inserts
  exportToSQL(): string {
    const data = this.generateCompleteDataset();
    let sql = '-- GeoVision AI Miner Sample Data\n\n';
    
    // Profiles
    sql += '-- Insert Profiles\n';
    data.profiles.forEach(profile => {
      sql += `INSERT INTO profiles (id, email, full_name, avatar_url, role, department, phone, location, bio, skills, certifications, experience_years, created_at, updated_at) VALUES ('${profile.id}', '${profile.email}', '${profile.full_name}', '${profile.avatar_url}', '${profile.role}', '${profile.department}', '${profile.phone}', '${profile.location}', '${profile.bio?.replace(/'/g, "''")}', '${JSON.stringify(profile.skills)}', '${JSON.stringify(profile.certifications)}', ${profile.experience_years}, '${profile.created_at}', '${profile.updated_at}');\n`;
    });
    
    // Projects
    sql += '\n-- Insert Projects\n';
    data.projects.forEach(project => {
      sql += `INSERT INTO projects (id, name, description, location, status, budget, start_date, end_date, coordinates, created_at, updated_at, user_id) VALUES ('${project.id}', '${project.name}', '${project.description?.replace(/'/g, "''")}', '${project.location}', '${project.status}', ${project.budget}, '${project.start_date}', '${project.end_date}', ST_GeomFromText('${project.coordinates}'), '${project.created_at}', '${project.updated_at}', '${project.user_id}');\n`;
    });
    
    // Sites
    sql += '\n-- Insert Exploration Sites\n';
    data.sites.forEach(site => {
      sql += `INSERT INTO exploration_sites (id, project_id, name, description, coordinates, elevation, site_type, access_notes, created_at, updated_at) VALUES ('${site.id}', '${site.project_id}', '${site.name}', '${site.description?.replace(/'/g, "''")}', ST_GeomFromText('${site.coordinates}'), ${site.elevation}, '${site.site_type}', '${site.access_notes?.replace(/'/g, "''")}', '${site.created_at}', '${site.updated_at}');\n`;
    });
    
    // Deposits
    sql += '\n-- Insert Mineral Deposits\n';
    data.deposits.forEach(deposit => {
      sql += `INSERT INTO mineral_deposits (id, site_id, mineral_type, grade, tonnage, confidence_level, discovery_date, coordinates, depth, notes, created_at, updated_at) VALUES ('${deposit.id}', '${deposit.site_id}', '${deposit.mineral_type}', ${deposit.grade}, ${deposit.tonnage}, ${deposit.confidence_level}, '${deposit.discovery_date}', ST_GeomFromText('${deposit.coordinates}'), ${deposit.depth}, '${deposit.notes?.replace(/'/g, "''")}', '${deposit.created_at}', '${deposit.updated_at}');\n`;
    });
    
    // Predictions
    sql += '\n-- Insert Predictions\n';
    data.predictions.forEach(prediction => {
      sql += `INSERT INTO predictions (id, deposit_id, model_name, confidence_score, predicted_grade, predicted_tonnage, status, metadata, features_used, created_at, updated_at) VALUES ('${prediction.id}', '${prediction.deposit_id}', '${prediction.model_name}', ${prediction.confidence_score}, ${prediction.predicted_grade}, ${prediction.predicted_tonnage}, '${prediction.status}', '${JSON.stringify(prediction.metadata)}', '${JSON.stringify(prediction.features_used)}', '${prediction.created_at}', '${prediction.updated_at}');\n`;
    });
    
    return sql;
  }
}

// Export singleton instance
export const sampleDataGenerator = SampleDataGenerator.getInstance();
export default sampleDataGenerator;