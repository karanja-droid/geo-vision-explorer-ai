import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import {
  ApiResponse,
  PaginatedResponse,
  SearchFilters,
  SortOptions,
  Project,
  ExplorationSite,
  MineralDeposit,
  Prediction,
  ProjectWithSites,
  ExplorationSiteWithDeposits,
  MineralDepositWithPredictions,
  CreateProjectData,
  CreateSiteData,
  CreateMineralDepositData,
  CreatePredictionData,
} from '@/integrations/supabase/enhanced-types';
import { apiClient, cachedApi } from '@/lib/api-client';
import { toast } from '@/components/ui/enhanced-toast';
import { supabase } from '@/integrations/supabase/client';

// Query key factories
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: SearchFilters, sort?: SortOptions, page?: number) => 
      [...queryKeys.projects.lists(), { filters, sort, page }] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    metrics: (id: string) => [...queryKeys.projects.all, 'metrics', id] as const,
  },
  sites: {
    all: ['sites'] as const,
    lists: () => [...queryKeys.sites.all, 'list'] as const,
    list: (projectId?: string, filters?: SearchFilters, sort?: SortOptions, page?: number) => 
      [...queryKeys.sites.lists(), { projectId, filters, sort, page }] as const,
    details: () => [...queryKeys.sites.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.sites.details(), id] as const,
    nearby: (lat: number, lng: number, radius: number) => 
      [...queryKeys.sites.all, 'nearby', { lat, lng, radius }] as const,
  },
  mineralDeposits: {
    all: ['mineralDeposits'] as const,
    lists: () => [...queryKeys.mineralDeposits.all, 'list'] as const,
    list: (siteId?: string, filters?: SearchFilters, sort?: SortOptions, page?: number) => 
      [...queryKeys.mineralDeposits.lists(), { siteId, filters, sort, page }] as const,
    details: () => [...queryKeys.mineralDeposits.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.mineralDeposits.details(), id] as const,
    types: () => [...queryKeys.mineralDeposits.all, 'types'] as const,
  },
  predictions: {
    all: ['predictions'] as const,
    lists: () => [...queryKeys.predictions.all, 'list'] as const,
    list: (depositId?: string, filters?: SearchFilters, sort?: SortOptions, page?: number) => 
      [...queryKeys.predictions.lists(), { depositId, filters, sort, page }] as const,
    details: () => [...queryKeys.predictions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.predictions.details(), id] as const,
  },
};

// Generic hook for paginated queries
export function usePaginatedQuery<T>(
  queryKey: any[],
  queryFn: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  options?: Omit<UseQueryOptions<PaginatedResponse<T>>, 'queryKey' | 'queryFn'>
) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  
  const query = useQuery({
    queryKey: [...queryKey, page, limit],
    queryFn: () => queryFn(page, limit),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
  
  const nextPage = useCallback(() => {
    if (query.data?.has_next) {
      setPage(prev => prev + 1);
    }
  }, [query.data?.has_next]);
  
  const prevPage = useCallback(() => {
    if (query.data?.has_prev) {
      setPage(prev => prev - 1);
    }
  }, [query.data?.has_prev]);
  
  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= (query.data?.total_pages || 1)) {
      setPage(newPage);
    }
  }, [query.data?.total_pages]);
  
  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page when changing limit
  }, []);
  
  return {
    ...query,
    page,
    limit,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    pagination: {
      current: page,
      total: query.data?.total_pages || 0,
      hasNext: query.data?.has_next || false,
      hasPrev: query.data?.has_prev || false,
      count: query.data?.count || 0,
      limit,
    },
  };
}

// Projects hooks
export function useProjects(
  filters: SearchFilters = {},
  sort?: SortOptions,
  options?: Omit<UseQueryOptions<PaginatedResponse<Project>>, 'queryKey' | 'queryFn'>
) {
  return usePaginatedQuery(
    queryKeys.projects.list(filters, sort),
    (page, limit) => apiClient.projects.getProjects(filters, sort, page, limit),
    options
  );
}

export function useProject(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<ProjectWithSites>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => cachedApi.getWithCache(
      `project_${id}`,
      () => apiClient.projects.getProjectWithSites(id),
      10 * 60 // 10 minutes cache
    ),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useProjectMetrics(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<any>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.projects.metrics(id),
    queryFn: () => apiClient.projects.getProjectMetrics(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes for metrics
    ...options,
  });
}

export function useCreateProject(
  options?: UseMutationOptions<ApiResponse<Project>, Error, CreateProjectData>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateProjectData) => apiClient.projects.createProject(data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        toast.success('Project created successfully', {
          description: `${response.data?.name} has been created`,
          variant: 'geological',
        });
      } else {
        toast.error('Failed to create project', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to create project', {
        description: error.message,
      });
    },
    ...options,
  });
}

export function useUpdateProject(
  options?: UseMutationOptions<ApiResponse<Project>, Error, { id: string; updates: Partial<CreateProjectData> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }) => apiClient.projects.updateProject(id, updates),
    onSuccess: (response, { id }) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
        toast.success('Project updated successfully');
      } else {
        toast.error('Failed to update project', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to update project', {
        description: error.message,
      });
    },
    ...options,
  });
}

export function useDeleteProject(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.projects.deleteProject(id),
    onSuccess: (response, id) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
        queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
        toast.success('Project deleted successfully');
      } else {
        toast.error('Failed to delete project', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to delete project', {
        description: error.message,
      });
    },
    ...options,
  });
}

// Sites hooks
export function useSites(
  projectId?: string,
  filters: SearchFilters = {},
  sort?: SortOptions,
  options?: Omit<UseQueryOptions<PaginatedResponse<ExplorationSite>>, 'queryKey' | 'queryFn'>
) {
  return usePaginatedQuery(
    queryKeys.sites.list(projectId, filters, sort),
    (page, limit) => apiClient.sites.getSites(projectId, filters, sort, page, limit),
    options
  );
}

export function useSite(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<ExplorationSiteWithDeposits>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.sites.detail(id),
    queryFn: () => cachedApi.getWithCache(
      `site_${id}`,
      () => apiClient.sites.getSiteWithDeposits(id),
      10 * 60 // 10 minutes cache
    ),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useNearbySites(
  latitude: number,
  longitude: number,
  radiusKm: number = 10,
  options?: Omit<UseQueryOptions<ApiResponse<ExplorationSite[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.sites.nearby(latitude, longitude, radiusKm),
    queryFn: () => apiClient.sites.getSitesNearby(latitude, longitude, radiusKm),
    enabled: !!(latitude && longitude),
    staleTime: 10 * 60 * 1000, // 10 minutes for spatial queries
    ...options,
  });
}

export function useCreateSite(
  options?: UseMutationOptions<ApiResponse<ExplorationSite>, Error, CreateSiteData>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateSiteData) => apiClient.sites.createSite(data),
    onSuccess: (response, data) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(data.project_id) });
        toast.success('Exploration site created successfully', {
          description: `${response.data?.name} has been added`,
          variant: 'geological',
        });
      } else {
        toast.error('Failed to create site', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to create site', {
        description: error.message,
      });
    },
    ...options,
  });
}

export function useUpdateSite(
  options?: UseMutationOptions<ApiResponse<ExplorationSite>, Error, { id: string; updates: Partial<CreateSiteData> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }) => apiClient.sites.updateSite(id, updates),
    onSuccess: (response, { id }) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sites.lists() });
        toast.success('Site updated successfully');
      } else {
        toast.error('Failed to update site', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to update site', {
        description: error.message,
      });
    },
    ...options,
  });
}

export function useDeleteSite(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.sites.deleteSite(id),
    onSuccess: (response, id) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
        queryClient.removeQueries({ queryKey: queryKeys.sites.detail(id) });
        toast.success('Site deleted successfully');
      } else {
        toast.error('Failed to delete site', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to delete site', {
        description: error.message,
      });
    },
    ...options,
  });
}

// Mineral Deposits hooks
export function useMineralDeposits(
  siteId?: string,
  filters: SearchFilters = {},
  sort?: SortOptions,
  options?: Omit<UseQueryOptions<PaginatedResponse<MineralDeposit>>, 'queryKey' | 'queryFn'>
) {
  return usePaginatedQuery(
    queryKeys.mineralDeposits.list(siteId, filters, sort),
    (page, limit) => apiClient.mineralDeposits.getDeposits(siteId, filters, sort, page, limit),
    options
  );
}

export function useMineralDeposit(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<MineralDepositWithPredictions>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.mineralDeposits.detail(id),
    queryFn: () => cachedApi.getWithCache(
      `deposit_${id}`,
      () => apiClient.mineralDeposits.getDepositWithPredictions(id),
      15 * 60 // 15 minutes cache for detailed deposit data
    ),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    ...options,
  });
}

export function useMineralTypes(
  options?: Omit<UseQueryOptions<ApiResponse<string[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.mineralDeposits.types(),
    queryFn: () => cachedApi.getWithCache(
      'mineral_types',
      () => apiClient.mineralDeposits.getMineralTypes(),
      60 * 60 // 1 hour cache for mineral types
    ),
    staleTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

export function useCreateMineralDeposit(
  options?: UseMutationOptions<ApiResponse<MineralDeposit>, Error, CreateMineralDepositData>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateMineralDepositData) => apiClient.mineralDeposits.createDeposit(data),
    onSuccess: (response, data) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.mineralDeposits.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(data.site_id) });
        toast.success('Mineral deposit recorded successfully', {
          description: `${response.data?.mineral_type} deposit added`,
          variant: 'geological',
        });
      } else {
        toast.error('Failed to create mineral deposit', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to create mineral deposit', {
        description: error.message,
      });
    },
    ...options,
  });
}

export function useUpdateMineralDeposit(
  options?: UseMutationOptions<ApiResponse<MineralDeposit>, Error, { id: string; updates: Partial<CreateMineralDepositData> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }) => apiClient.mineralDeposits.updateDeposit(id, updates),
    onSuccess: (response, { id }) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.mineralDeposits.detail(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.mineralDeposits.lists() });
        toast.success('Mineral deposit updated successfully');
      } else {
        toast.error('Failed to update mineral deposit', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to update mineral deposit', {
        description: error.message,
      });
    },
    ...options,
  });
}

export function useDeleteMineralDeposit(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.mineralDeposits.deleteDeposit(id),
    onSuccess: (response, id) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.mineralDeposits.all });
        queryClient.removeQueries({ queryKey: queryKeys.mineralDeposits.detail(id) });
        toast.success('Mineral deposit deleted successfully');
      } else {
        toast.error('Failed to delete mineral deposit', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to delete mineral deposit', {
        description: error.message,
      });
    },
    ...options,
  });
}

// Predictions hooks
export function usePredictions(
  depositId?: string,
  filters: SearchFilters = {},
  sort?: SortOptions,
  options?: Omit<UseQueryOptions<PaginatedResponse<Prediction>>, 'queryKey' | 'queryFn'>
) {
  return usePaginatedQuery(
    queryKeys.predictions.list(depositId, filters, sort),
    (page, limit) => apiClient.predictions.getPredictions(depositId, filters, sort, page, limit),
    options
  );
}

export function usePrediction(
  id: string,
  options?: Omit<UseQueryOptions<Prediction>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.predictions.detail(id),
    queryFn: async () => {
      const response = await apiClient.predictions.getPredictions();
      const prediction = response.data?.find(p => p.id === id);
      if (!prediction) throw new Error('Prediction not found');
      return prediction;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useCreatePrediction(
  options?: UseMutationOptions<ApiResponse<Prediction>, Error, CreatePredictionData>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreatePredictionData) => apiClient.predictions.createPrediction(data),
    onSuccess: (response, data) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.predictions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.mineralDeposits.detail(data.deposit_id) });
        toast.success('AI prediction completed successfully', {
          description: `Confidence: ${(response.data?.confidence_score || 0) * 100}%`,
          variant: 'geological',
        });
      } else {
        toast.error('Failed to create prediction', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to create prediction', {
        description: error.message,
      });
    },
    ...options,
  });
}

export function useRunPrediction(
  options?: UseMutationOptions<ApiResponse<Prediction>, Error, { depositId: string; modelName: string; features: Record<string, any> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ depositId, modelName, features }) => 
      apiClient.predictions.runPrediction(depositId, modelName, features),
    onSuccess: (response, { depositId }) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.predictions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.mineralDeposits.detail(depositId) });
        toast.success('AI analysis completed', {
          description: `Model: ${response.data?.model_name}`,
          variant: 'geological',
        });
      } else {
        toast.error('AI analysis failed', {
          description: response.error,
        });
      }
    },
    onError: (error) => {
      toast.error('AI analysis failed', {
        description: error.message,
      });
    },
    ...options,
  });
}

// Optimistic updates helper
export function useOptimisticUpdate<T>(
  queryKey: any[],
  updateFn: (oldData: T | undefined, newData: any) => T
) {
  const queryClient = useQueryClient();
  
  return useCallback((newData: any) => {
    queryClient.setQueryData<T>(queryKey, (oldData) => updateFn(oldData, newData));
  }, [queryClient, queryKey, updateFn]);
}

// Real-time subscription hook
export function useRealtimeSubscription<T>(
  table: string,
  filter?: string,
  callback?: (payload: any) => void
) {
  const queryClient = useQueryClient();
  
  useState(() => {
    const subscription = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table,
          filter 
        }, 
        (payload) => {
          // Invalidate relevant queries
          queryClient.invalidateQueries({ 
            predicate: (query) => 
              query.queryKey.some(key => 
                typeof key === 'string' && key.includes(table)
              )
          });
          
          callback?.(payload);
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  });
}

export default {
  // Projects
  useProjects,
  useProject,
  useProjectMetrics,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  
  // Sites
  useSites,
  useSite,
  useNearbySites,
  useCreateSite,
  useUpdateSite,
  useDeleteSite,
  
  // Mineral Deposits
  useMineralDeposits,
  useMineralDeposit,
  useMineralTypes,
  useCreateMineralDeposit,
  useUpdateMineralDeposit,
  useDeleteMineralDeposit,
  
  // Predictions
  usePredictions,
  usePrediction,
  useCreatePrediction,
  useRunPrediction,
  
  // Utilities
  useOptimisticUpdate,
  useRealtimeSubscription,
  usePaginatedQuery,
};