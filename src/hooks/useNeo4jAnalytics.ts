import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNeo4jService, SimilarDeposit, ExplorationTarget, ExplorationCriteria } from '@/integrations/neo4j/client';

// Hook for finding similar mineral deposits
export const useSimilarDeposits = (depositId: string, limit: number = 10) => {
  return useQuery({
    queryKey: ['similar-deposits', depositId, limit],
    queryFn: async () => {
      const neo4j = getNeo4jService();
      return await neo4j.findSimilarDeposits(depositId, limit);
    },
    enabled: !!depositId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook for exploration target generation
export const useExplorationTargets = (criteria: ExplorationCriteria) => {
  return useQuery({
    queryKey: ['exploration-targets', criteria],
    queryFn: async () => {
      const neo4j = getNeo4jService();
      return await neo4j.findExplorationTargets(criteria);
    },
    enabled: !!criteria.minPotential && !!criteria.minGrade,
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  });
};

// Hook for geological connection analysis
export const useGeologicalConnections = (nodeId: string, maxDepth: number = 3) => {
  return useQuery({
    queryKey: ['geological-connections', nodeId, maxDepth],
    queryFn: async () => {
      const neo4j = getNeo4jService();
      return await neo4j.analyzeGeologicalConnections(nodeId, maxDepth);
    },
    enabled: !!nodeId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  });
};

// Hook for optimal exploration path finding
export const useOptimalExplorationPath = (startId: string, targetId: string) => {
  return useQuery({
    queryKey: ['exploration-path', startId, targetId],
    queryFn: async () => {
      const neo4j = getNeo4jService();
      return await neo4j.findOptimalExplorationPath(startId, targetId);
    },
    enabled: !!startId && !!targetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook for pattern discovery
export const useGeologicalPatterns = (patternType: string) => {
  return useQuery({
    queryKey: ['geological-patterns', patternType],
    queryFn: async () => {
      const neo4j = getNeo4jService();
      return await neo4j.discoverGeologicalPatterns(patternType);
    },
    enabled: !!patternType,
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 2 * 60 * 60 * 1000, // 2 hours
  });
};

// Hook for centrality metrics
export const useCentralityMetrics = (nodeType: string) => {
  return useQuery({
    queryKey: ['centrality-metrics', nodeType],
    queryFn: async () => {
      const neo4j = getNeo4jService();
      return await neo4j.calculateCentralityMetrics(nodeType);
    },
    enabled: !!nodeType,
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 4 * 60 * 60 * 1000, // 4 hours
  });
};

// Hook for community detection
export const useCommunityDetection = () => {
  return useQuery({
    queryKey: ['community-detection'],
    queryFn: async () => {
      const neo4j = getNeo4jService();
      return await neo4j.detectCommunities();
    },
    staleTime: 2 * 60 * 60 * 1000, // 2 hours
    cacheTime: 8 * 60 * 60 * 1000, // 8 hours
  });
};

// Hook for creating mineral deposits
export const useCreateMineralDeposit = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (deposit: any) => {
      const neo4j = getNeo4jService();
      return await neo4j.createMineralDeposit(deposit);
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['similar-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['exploration-targets'] });
      queryClient.invalidateQueries({ queryKey: ['geological-connections'] });
    },
  });
};

// Hook for creating geological relationships
export const useCreateGeologicalRelationship = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sourceId, targetId, relationship }: {
      sourceId: string;
      targetId: string;
      relationship: any;
    }) => {
      const neo4j = getNeo4jService();
      return await neo4j.createGeologicalRelationship(sourceId, targetId, relationship);
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['geological-connections'] });
      queryClient.invalidateQueries({ queryKey: ['exploration-path'] });
      queryClient.invalidateQueries({ queryKey: ['geological-patterns'] });
    },
  });
};

// Hook for Neo4j health monitoring
export const useNeo4jHealth = () => {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const neo4j = getNeo4jService();
        const healthy = await neo4j.healthCheck();
        setIsHealthy(healthy);
        setLastCheck(new Date());
      } catch (error) {
        console.error('Neo4j health check failed:', error);
        setIsHealthy(false);
        setLastCheck(new Date());
      }
    };

    // Initial check
    checkHealth();

    // Set up periodic health checks every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { isHealthy, lastCheck };
};

// Advanced analytics hook for exploration intelligence
export const useExplorationIntelligence = (projectId: string) => {
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const neo4j = getNeo4jService();
      
      // Run multiple analyses in parallel
      const [
        similarDeposits,
        explorationTargets,
        geologicalPatterns,
        centralityMetrics
      ] = await Promise.all([
        neo4j.findSimilarDeposits(projectId, 20),
        neo4j.findExplorationTargets({ minPotential: 0.5, minGrade: 1.0 }),
        neo4j.discoverGeologicalPatterns('high_grade_clusters'),
        neo4j.calculateCentralityMetrics('MineralDeposit')
      ]);

      setAnalysisResults({
        similarDeposits,
        explorationTargets,
        geologicalPatterns,
        centralityMetrics,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Exploration intelligence analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    analysisResults,
    isAnalyzing,
    runAnalysis
  };
};

// Hook for real-time graph updates
export const useGraphUpdates = () => {
  const queryClient = useQueryClient();
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    // Set up WebSocket connection for real-time updates
    const ws = new WebSocket(process.env.VITE_NEO4J_WS_URL || 'ws://localhost:8080/neo4j-updates');

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      // Invalidate relevant queries based on update type
      switch (update.type) {
        case 'MINERAL_DEPOSIT_CREATED':
        case 'MINERAL_DEPOSIT_UPDATED':
          queryClient.invalidateQueries({ queryKey: ['similar-deposits'] });
          queryClient.invalidateQueries({ queryKey: ['exploration-targets'] });
          break;
        
        case 'RELATIONSHIP_CREATED':
        case 'RELATIONSHIP_UPDATED':
          queryClient.invalidateQueries({ queryKey: ['geological-connections'] });
          queryClient.invalidateQueries({ queryKey: ['exploration-path'] });
          break;
        
        case 'PATTERN_DISCOVERED':
          queryClient.invalidateQueries({ queryKey: ['geological-patterns'] });
          break;
      }

      setUpdateCount(prev => prev + 1);
    };

    ws.onerror = (error) => {
      console.error('Neo4j WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);

  return { updateCount };
};

// Export all hooks
export default {
  useSimilarDeposits,
  useExplorationTargets,
  useGeologicalConnections,
  useOptimalExplorationPath,
  useGeologicalPatterns,
  useCentralityMetrics,
  useCommunityDetection,
  useCreateMineralDeposit,
  useCreateGeologicalRelationship,
  useNeo4jHealth,
  useExplorationIntelligence,
  useGraphUpdates
};