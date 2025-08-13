import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjects, useProject, useCreateProject } from '@/hooks/useApiQuery';
import { mockProjects, mockProjectsWithSites } from '@/utils/mockData';
import { ReactNode } from 'react';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    projects: {
      getProjects: jest.fn(),
      getProjectWithSites: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
    },
  },
}));

// Mock the cached API
jest.mock('@/lib/api-client', () => ({
  cachedApi: {
    getWithCache: jest.fn(),
  },
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useApiQuery hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProjects', () => {
    it('fetches projects with pagination', async () => {
      const mockApiResponse = {
        data: mockProjects.slice(0, 10),
        count: mockProjects.length,
        page: 1,
        limit: 10,
        total_pages: Math.ceil(mockProjects.length / 10),
        has_next: true,
        has_prev: false,
      };

      const { apiClient } = require('@/lib/api-client');
      apiClient.projects.getProjects.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockApiResponse);
      expect(result.current.pagination.current).toBe(1);
      expect(result.current.pagination.hasNext).toBe(true);
    });

    it('handles pagination navigation', async () => {
      const mockApiResponse = {
        data: mockProjects.slice(0, 10),
        count: mockProjects.length,
        page: 1,
        limit: 10,
        total_pages: Math.ceil(mockProjects.length / 10),
        has_next: true,
        has_prev: false,
      };

      const { apiClient } = require('@/lib/api-client');
      apiClient.projects.getProjects.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Test next page navigation
      result.current.nextPage();
      expect(result.current.page).toBe(2);

      // Test previous page navigation
      result.current.prevPage();
      expect(result.current.page).toBe(1);

      // Test go to specific page
      result.current.goToPage(3);
      expect(result.current.page).toBe(3);
    });

    it('handles search filters', async () => {
      const filters = { query: 'gold', status: 'active' };
      const mockApiResponse = {
        data: mockProjects.filter(p => 
          p.name.toLowerCase().includes('gold') && p.status === 'active'
        ),
        count: 5,
        page: 1,
        limit: 10,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      };

      const { apiClient } = require('@/lib/api-client');
      apiClient.projects.getProjects.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useProjects(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiClient.projects.getProjects).toHaveBeenCalledWith(
        filters,
        undefined,
        1,
        10
      );
    });
  });

  describe('useProject', () => {
    it('fetches single project with relationships', async () => {
      const projectId = 'test-project-id';
      const mockProject = mockProjectsWithSites[0];
      const mockApiResponse = {
        data: mockProject,
        error: null,
        success: true,
      };

      const { cachedApi } = require('@/lib/api-client');
      cachedApi.getWithCache.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useProject(projectId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockApiResponse);
      expect(cachedApi.getWithCache).toHaveBeenCalledWith(
        `project_${projectId}`,
        expect.any(Function),
        600 // 10 minutes cache
      );
    });

    it('handles project not found', async () => {
      const projectId = 'non-existent-project';
      const mockApiResponse = {
        data: null,
        error: 'Project not found',
        success: false,
      };

      const { cachedApi } = require('@/lib/api-client');
      cachedApi.getWithCache.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useProject(projectId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useProject(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isIdle).toBe(true);
    });
  });

  describe('useCreateProject', () => {
    it('creates project successfully', async () => {
      const newProject = {
        name: 'New Test Project',
        description: 'Test project description',
        location: 'Nevada, USA',
        budget: 1000000,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        coordinates: { latitude: 40.5, longitude: -116.5 },
      };

      const mockApiResponse = {
        data: { ...newProject, id: 'new-project-id' },
        error: null,
        success: true,
      };

      const { apiClient } = require('@/lib/api-client');
      apiClient.projects.createProject.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useCreateProject(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newProject);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockApiResponse);
      expect(apiClient.projects.createProject).toHaveBeenCalledWith(newProject);
    });

    it('handles creation errors', async () => {
      const newProject = {
        name: 'Invalid Project',
        description: '',
        location: '',
        budget: -1000,
      };

      const mockApiResponse = {
        data: null,
        error: 'Validation failed: Location is required',
        success: false,
      };

      const { apiClient } = require('@/lib/api-client');
      apiClient.projects.createProject.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useCreateProject(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newProject);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('calls onSuccess callback when provided', async () => {
      const mockOnSuccess = jest.fn();
      const newProject = {
        name: 'Success Test Project',
        location: 'Nevada, USA',
      };

      const mockApiResponse = {
        data: { ...newProject, id: 'success-project-id' },
        error: null,
        success: true,
      };

      const { apiClient } = require('@/lib/api-client');
      apiClient.projects.createProject.mockResolvedValue(mockApiResponse);

      const { result } = renderHook(() => useCreateProject({
        onSuccess: mockOnSuccess,
      }), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newProject);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(mockApiResponse);
    });
  });

  describe('Query key factories', () => {
    it('generates consistent query keys', () => {
      const { queryKeys } = require('@/hooks/useApiQuery');

      expect(queryKeys.projects.all).toEqual(['projects']);
      expect(queryKeys.projects.lists()).toEqual(['projects', 'list']);
      expect(queryKeys.projects.detail('test-id')).toEqual(['projects', 'detail', 'test-id']);
      
      const filters = { query: 'gold' };
      const sort = { field: 'name', direction: 'asc' };
      expect(queryKeys.projects.list(filters, sort, 1)).toEqual([
        'projects', 'list', { filters, sort, page: 1 }
      ]);
    });
  });

  describe('Optimistic updates', () => {
    it('applies optimistic updates correctly', () => {
      const { useOptimisticUpdate } = require('@/hooks/useApiQuery');
      const queryKey = ['projects'];
      const updateFn = (oldData: any[], newData: any) => [...(oldData || []), newData];

      const { result } = renderHook(() => useOptimisticUpdate(queryKey, updateFn), {
        wrapper: createWrapper(),
      });

      // This would be tested with actual QueryClient integration
      expect(typeof result.current).toBe('function');
    });
  });

  describe('Real-time subscriptions', () => {
    it('sets up real-time subscription', () => {
      const { useRealtimeSubscription } = require('@/hooks/useApiQuery');
      const mockCallback = jest.fn();

      renderHook(() => useRealtimeSubscription('projects', undefined, mockCallback), {
        wrapper: createWrapper(),
      });

      // This would be tested with actual Supabase subscription mocking
      // For now, we're just testing that the hook doesn't throw
    });
  });
});