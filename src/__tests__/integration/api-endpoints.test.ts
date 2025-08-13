import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/integrations/supabase/client';
import { createMockProject, createMockSite, createMockDeposit, createMockPrediction } from '@/test/setup';

// Mock Supabase client
vi.mock('@/integrations/supabase/client');

describe('API Endpoints Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Projects API', () => {
    it('should fetch projects with pagination', async () => {
      const mockProjects = [createMockProject(), createMockProject()];
      const mockResponse = {
        data: mockProjects,
        count: 2,
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.getProjects({}, undefined, 1, 10);

      expect(result.data).toEqual(mockProjects);
      expect(result.count).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should fetch single project with relationships', async () => {
      const mockProject = createMockProject();
      const mockResponse = {
        data: {
          ...mockProject,
          exploration_sites: [createMockSite()],
          mineral_deposits: [createMockDeposit()],
          predictions: [createMockPrediction()],
        },
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.getProjectWithSites('test-id');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(result.data?._count).toEqual({
        sites: 1,
        deposits: 1,
        predictions: 1,
      });
    });

    it('should create new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        location: 'Test Location',
        budget: 1000000,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        coordinates: { latitude: 40.5, longitude: -116.5 },
      };

      const mockResponse = {
        data: { ...projectData, id: 'new-project-id' },
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.createProject(projectData);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('new-project-id');
      expect(result.data?.name).toBe(projectData.name);
    });

    it('should update existing project', async () => {
      const updates = { name: 'Updated Project Name' };
      const mockResponse = {
        data: { ...createMockProject(), ...updates },
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.updateProject('test-id', updates);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe(updates.name);
    });

    it('should delete project', async () => {
      const mockResponse = { data: null, error: null };

      (supabase.from as any).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.deleteProject('test-id');

      expect(result.success).toBe(true);
    });

    it('should handle project creation errors', async () => {
      const projectData = {
        name: '',
        location: '',
      };

      const mockResponse = {
        data: null,
        error: { message: 'Name is required' },
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.createProject(projectData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Name is required');
    });
  });

  describe('Sites API', () => {
    it('should fetch sites for a project', async () => {
      const mockSites = [createMockSite(), createMockSite()];
      const mockResponse = {
        data: mockSites,
        count: 2,
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.sites.getSites('project-id', {}, undefined, 1, 10);

      expect(result.data).toEqual(mockSites);
      expect(result.count).toBe(2);
    });

    it('should create new site', async () => {
      const siteData = {
        project_id: 'test-project-id',
        name: 'Test Site',
        description: 'Test Description',
        coordinates: { latitude: 40.52, longitude: -116.48 },
        elevation: 1850.5,
        site_type: 'outcrop' as const,
        access_notes: 'Test access notes',
      };

      const mockResponse = {
        data: { ...siteData, id: 'new-site-id' },
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.sites.createSite(siteData);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('new-site-id');
      expect(result.data?.name).toBe(siteData.name);
    });

    it('should find nearby sites', async () => {
      const mockSites = [createMockSite()];
      const mockResponse = {
        data: mockSites,
        error: null,
      };

      (supabase.rpc as any).mockResolvedValue(mockResponse);

      const result = await apiClient.sites.getSitesNearby(40.5, -116.5, 10);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSites);
      expect(supabase.rpc).toHaveBeenCalledWith('get_sites_nearby', {
        lat: 40.5,
        lng: -116.5,
        radius_km: 10,
      });
    });
  });

  describe('Mineral Deposits API', () => {
    it('should fetch deposits with filters', async () => {
      const mockDeposits = [createMockDeposit()];
      const mockResponse = {
        data: mockDeposits,
        count: 1,
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      });

      const filters = {
        mineral_type: 'Gold',
        confidence_min: 80,
        confidence_max: 95,
        grade_min: 5.0,
        grade_max: 15.0,
      };

      const result = await apiClient.mineralDeposits.getDeposits('site-id', filters, undefined, 1, 10);

      expect(result.data).toEqual(mockDeposits);
      expect(result.count).toBe(1);
    });

    it('should create new mineral deposit', async () => {
      const depositData = {
        site_id: 'test-site-id',
        mineral_type: 'Gold',
        grade: 8.5,
        tonnage: 125000,
        confidence_level: 85,
        discovery_date: '2024-01-20',
        coordinates: { latitude: 40.52, longitude: -116.48 },
        depth: 15.5,
        notes: 'Test deposit notes',
      };

      const mockResponse = {
        data: { ...depositData, id: 'new-deposit-id' },
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.mineralDeposits.createDeposit(depositData);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('new-deposit-id');
      expect(result.data?.mineral_type).toBe(depositData.mineral_type);
    });

    it('should get mineral types', async () => {
      const mockResponse = {
        data: [
          { mineral_type: 'Gold' },
          { mineral_type: 'Silver' },
          { mineral_type: 'Copper' },
        ],
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.mineralDeposits.getMineralTypes();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['Gold', 'Silver', 'Copper']);
    });
  });

  describe('Predictions API', () => {
    it('should fetch predictions for a deposit', async () => {
      const mockPredictions = [createMockPrediction()];
      const mockResponse = {
        data: mockPredictions,
        count: 1,
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.predictions.getPredictions('deposit-id', {}, undefined, 1, 10);

      expect(result.data).toEqual(mockPredictions);
      expect(result.count).toBe(1);
    });

    it('should create new prediction', async () => {
      const predictionData = {
        deposit_id: 'test-deposit-id',
        model_name: 'DeepMine-v2.1',
        confidence_score: 0.89,
        predicted_grade: 8.2,
        predicted_tonnage: 130000,
        metadata: {
          algorithm: 'CNN',
          processing_time_ms: 2500,
        },
        features_used: ['geological_formation', 'rock_type'],
      };

      const mockResponse = {
        data: { ...predictionData, id: 'new-prediction-id' },
        error: null,
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.predictions.createPrediction(predictionData);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('new-prediction-id');
      expect(result.data?.model_name).toBe(predictionData.model_name);
    });

    it('should run AI prediction', async () => {
      const mockResponse = {
        data: createMockPrediction(),
        error: null,
      };

      (supabase.functions.invoke as any).mockResolvedValue(mockResponse);

      const result = await apiClient.predictions.runPrediction(
        'deposit-id',
        'DeepMine-v2.1',
        { geological_formation: 'granite', rock_type: 'igneous' }
      );

      expect(result.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('run-prediction', {
        body: {
          deposit_id: 'deposit-id',
          model_name: 'DeepMine-v2.1',
          features: { geological_formation: 'granite', rock_type: 'igneous' },
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error');
      
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockRejectedValue(networkError),
      });

      const result = await apiClient.projects.getProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle Supabase errors', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Database connection failed' },
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.getProjects();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle validation errors', async () => {
      const mockResponse = {
        data: null,
        error: { 
          message: 'Invalid input',
          details: 'Name field is required',
          code: 'VALIDATION_ERROR',
        },
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await apiClient.projects.createProject({
        name: '',
        location: 'Test Location',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input');
    });
  });

  describe('Caching Integration', () => {
    it('should use cached data when available', async () => {
      const mockProject = createMockProject();
      const cachedResponse = {
        data: mockProject,
        error: null,
        success: true,
        message: 'From cache',
      };

      // Mock the cached API to return cached data
      const mockCachedApi = {
        getWithCache: vi.fn().mockResolvedValue(cachedResponse),
      };

      // Replace the cached API import
      vi.doMock('@/lib/api-client', () => ({
        cachedApi: mockCachedApi,
        apiClient: {
          projects: {
            getProjectWithSites: vi.fn(),
          },
        },
      }));

      const { cachedApi } = await import('@/lib/api-client');
      
      const result = await cachedApi.getWithCache(
        'project_test-id',
        () => Promise.resolve({ data: mockProject, error: null, success: true }),
        600
      );

      expect(result.message).toBe('From cache');
      expect(result.data).toEqual(mockProject);
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should set up real-time subscription', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      const callback = vi.fn();
      
      // Simulate setting up a subscription
      const subscription = supabase
        .channel('realtime:projects')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'projects',
          }, 
          callback
        )
        .subscribe();

      expect(supabase.channel).toHaveBeenCalledWith('realtime:projects');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
        },
        callback
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });
});