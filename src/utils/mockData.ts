import { sampleDataGenerator } from './sampleDataGenerator';
import {
  Project,
  ExplorationSite,
  MineralDeposit,
  Prediction,
  Profile,
  ProjectWithSites,
  ExplorationSiteWithDeposits,
  MineralDepositWithPredictions,
  PaginatedResponse,
  ApiResponse,
} from '@/integrations/supabase/enhanced-types';

// Generate all sample data
const sampleData = sampleDataGenerator.generateCompleteDataset();

// Export individual datasets
export const mockProfiles: Profile[] = sampleData.profiles;
export const mockProjects: Project[] = sampleData.projects;
export const mockSites: ExplorationSite[] = sampleData.sites;
export const mockDeposits: MineralDeposit[] = sampleData.deposits;
export const mockPredictions: Prediction[] = sampleData.predictions;

// Export enhanced datasets with relationships
export const mockProjectsWithSites: ProjectWithSites[] = sampleData.projectsWithSites;
export const mockSitesWithDeposits: ExplorationSiteWithDeposits[] = sampleData.sitesWithDeposits;
export const mockDepositsWithPredictions: MineralDepositWithPredictions[] = sampleData.depositsWithPredictions;

// Helper functions for paginated responses
export const createPaginatedResponse = <T>(
  data: T[],
  page: number = 1,
  limit: number = 10
): PaginatedResponse<T> => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedData = data.slice(startIndex, endIndex);
  const totalPages = Math.ceil(data.length / limit);

  return {
    data: paginatedData,
    count: data.length,
    page,
    limit,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
};

export const createApiResponse = <T>(data: T, success: boolean = true): ApiResponse<T> => ({
  data: success ? data : null,
  error: success ? null : 'Mock error',
  success,
  message: success ? 'Success' : 'Error occurred',
});

// Mock API functions
export const mockApi = {
  // Projects
  getProjects: (page: number = 1, limit: number = 10) => 
    createPaginatedResponse(mockProjects, page, limit),
  
  getProject: (id: string) => {
    const project = mockProjectsWithSites.find(p => p.id === id);
    return createApiResponse(project, !!project);
  },

  // Sites
  getSites: (projectId?: string, page: number = 1, limit: number = 10) => {
    const filteredSites = projectId 
      ? mockSites.filter(s => s.project_id === projectId)
      : mockSites;
    return createPaginatedResponse(filteredSites, page, limit);
  },

  getSite: (id: string) => {
    const site = mockSitesWithDeposits.find(s => s.id === id);
    return createApiResponse(site, !!site);
  },

  // Mineral Deposits
  getDeposits: (siteId?: string, page: number = 1, limit: number = 10) => {
    const filteredDeposits = siteId 
      ? mockDeposits.filter(d => d.site_id === siteId)
      : mockDeposits;
    return createPaginatedResponse(filteredDeposits, page, limit);
  },

  getDeposit: (id: string) => {
    const deposit = mockDepositsWithPredictions.find(d => d.id === id);
    return createApiResponse(deposit, !!deposit);
  },

  // Predictions
  getPredictions: (depositId?: string, page: number = 1, limit: number = 10) => {
    const filteredPredictions = depositId 
      ? mockPredictions.filter(p => p.deposit_id === depositId)
      : mockPredictions;
    return createPaginatedResponse(filteredPredictions, page, limit);
  },

  // Analytics
  getProjectMetrics: (projectId: string) => {
    const project = mockProjectsWithSites.find(p => p.id === projectId);
    if (!project) return createApiResponse(null, false);

    const sites = project.exploration_sites || [];
    const deposits = project.mineral_deposits || [];
    const predictions = project.predictions || [];

    // Calculate mineral distribution
    const mineralCounts: Record<string, number> = {};
    deposits.forEach(deposit => {
      mineralCounts[deposit.mineral_type] = (mineralCounts[deposit.mineral_type] || 0) + 1;
    });

    const mineralDistribution = Object.entries(mineralCounts).map(([name, value], index) => ({
      name,
      value,
      color: `hsl(${index * 137.5}, 70%, 50%)`
    }));

    // Generate monthly progress data
    const monthlyProgress = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i).toLocaleDateString('en-US', { month: 'short' }),
      sites: Math.floor(sites.length * Math.random() * 0.3),
      deposits: Math.floor(deposits.length * Math.random() * 0.4),
      predictions: Math.floor(predictions.length * Math.random() * 0.5)
    }));

    // Confidence distribution
    const confidenceRanges = ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'];
    const confidenceDistribution = confidenceRanges.map(range => {
      const [min, max] = range.split('-').map(r => parseInt(r.replace('%', '')));
      const count = deposits.filter(d => d.confidence_level >= min && d.confidence_level <= max).length;
      return { range, count };
    });

    // Grade distribution
    const gradeDistribution = Object.entries(mineralCounts).map(([mineral]) => {
      const mineralDeposits = deposits.filter(d => d.mineral_type === mineral);
      const grades = mineralDeposits.map(d => d.grade);
      return {
        mineral,
        averageGrade: grades.reduce((sum, grade) => sum + grade, 0) / grades.length || 0,
        maxGrade: Math.max(...grades, 0),
        minGrade: Math.min(...grades, 0)
      };
    });

    const metrics = {
      totalSites: sites.length,
      totalDeposits: deposits.length,
      totalPredictions: predictions.length,
      averageConfidence: deposits.reduce((sum, d) => sum + d.confidence_level, 0) / deposits.length || 0,
      budgetUtilization: Math.random() * 100,
      timelineProgress: Math.random() * 100,
      mineralDistribution,
      monthlyProgress,
      confidenceDistribution,
      gradeDistribution
    };

    return createApiResponse(metrics);
  },

  // Map data
  getMapData: () => {
    const mapData = {
      projects: mockProjects.map(project => {
        const coords = parseCoordinates(project.coordinates);
        const projectSites = mockSites.filter(s => s.project_id === project.id);
        return {
          id: project.id,
          name: project.name,
          coordinates: coords,
          status: project.status,
          sites_count: projectSites.length
        };
      }),
      sites: mockSites.map(site => {
        const coords = parseCoordinates(site.coordinates);
        const siteDeposits = mockDeposits.filter(d => d.site_id === site.id);
        return {
          id: site.id,
          name: site.name,
          coordinates: coords,
          site_type: site.site_type,
          project_id: site.project_id,
          deposits_count: siteDeposits.length
        };
      }),
      deposits: mockDeposits.map(deposit => {
        const coords = parseCoordinates(deposit.coordinates);
        return {
          id: deposit.id,
          mineral_type: deposit.mineral_type,
          coordinates: coords,
          grade: deposit.grade,
          confidence_level: deposit.confidence_level,
          site_id: deposit.site_id
        };
      })
    };

    return createApiResponse(mapData);
  }
};

// Helper function to parse coordinates
function parseCoordinates(pointString: string): { latitude: number; longitude: number } {
  const match = pointString.match(/POINT\(([^)]+)\)/);
  if (match) {
    const [lng, lat] = match[1].split(' ').map(Number);
    return { latitude: lat, longitude: lng };
  }
  return { latitude: 0, longitude: 0 };
}

// Statistics about the generated data
export const dataStatistics = {
  profiles: mockProfiles.length,
  projects: mockProjects.length,
  sites: mockSites.length,
  deposits: mockDeposits.length,
  predictions: mockPredictions.length,
  total: mockProfiles.length + mockProjects.length + mockSites.length + mockDeposits.length + mockPredictions.length,
  
  // Breakdown by categories
  mineralTypes: [...new Set(mockDeposits.map(d => d.mineral_type))].length,
  siteTypes: [...new Set(mockSites.map(s => s.site_type))].length,
  projectStatuses: [...new Set(mockProjects.map(p => p.status))].length,
  userRoles: [...new Set(mockProfiles.map(p => p.role))].length,
  
  // Geographic distribution
  regions: [...new Set(mockProjects.map(p => p.location.split(',')[1]?.trim()))].length,
  
  // Data quality metrics
  averageConfidence: mockDeposits.reduce((sum, d) => sum + d.confidence_level, 0) / mockDeposits.length,
  averageGrade: mockDeposits.reduce((sum, d) => sum + d.grade, 0) / mockDeposits.length,
  averageTonnage: mockDeposits.reduce((sum, d) => sum + (d.tonnage || 0), 0) / mockDeposits.length,
  
  // Relationship metrics
  averageSitesPerProject: mockSites.length / mockProjects.length,
  averageDepositsPerSite: mockDeposits.length / mockSites.length,
  averagePredictionsPerDeposit: mockPredictions.length / mockDeposits.length,
};

// Export everything
export default {
  profiles: mockProfiles,
  projects: mockProjects,
  sites: mockSites,
  deposits: mockDeposits,
  predictions: mockPredictions,
  projectsWithSites: mockProjectsWithSites,
  sitesWithDeposits: mockSitesWithDeposits,
  depositsWithPredictions: mockDepositsWithPredictions,
  api: mockApi,
  statistics: dataStatistics,
  generator: sampleDataGenerator
};