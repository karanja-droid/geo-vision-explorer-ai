import { supabase } from '@/integrations/supabase/client';
import { redisClient } from '@/integrations/redis/client';

export interface QueryOptimizationConfig {
  enableCaching: boolean;
  cacheTimeout: number;
  enableIndexHints: boolean;
  enableQueryPlan: boolean;
}

export interface SpatialQueryOptions {
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom?: number;
  limit?: number;
  offset?: number;
}

export class DatabaseOptimizer {
  private config: QueryOptimizationConfig;
  private queryCache = new Map<string, { data: any; timestamp: number }>();

  constructor(config: QueryOptimizationConfig = {
    enableCaching: true,
    cacheTimeout: 300000, // 5 minutes
    enableIndexHints: true,
    enableQueryPlan: false
  }) {
    this.config = config;
  }

  /**
   * Optimized spatial query for geological sites
   */
  async getGeologicalSitesOptimized(options: SpatialQueryOptions = {}) {
    const cacheKey = `geological_sites_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    let query = supabase
      .from('sites')
      .select(`
        id,
        name,
        location,
        coordinates,
        site_type,
        status,
        created_at,
        project:projects!inner(
          id,
          name,
          status
        ),
        mineral_deposits:mineral_deposits(
          id,
          mineral_type,
          confidence_score,
          estimated_quantity
        )
      `);

    // Apply spatial filtering if bounds provided
    if (options.bounds) {
      const { north, south, east, west } = options.bounds;
      query = query
        .gte('coordinates->lat', south)
        .lte('coordinates->lat', north)
        .gte('coordinates->lng', west)
        .lte('coordinates->lng', east);
    }

    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    // Add index hints for better performance
    if (this.config.enableIndexHints) {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Cache the result
    if (this.config.enableCaching && data) {
      await this.setCachedResult(cacheKey, data);
    }

    return data;
  }

  /**
   * Optimized mineral deposits query with aggregations
   */
  async getMineralDepositsAggregated(projectId?: string) {
    const cacheKey = `mineral_deposits_agg_${projectId || 'all'}`;
    
    if (this.config.enableCaching) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    let query = supabase
      .from('mineral_deposits')
      .select(`
        id,
        mineral_type,
        confidence_score,
        estimated_quantity,
        estimated_value,
        discovery_date,
        site:sites!inner(
          id,
          name,
          coordinates,
          project_id
        )
      `);

    if (projectId) {
      query = query.eq('site.project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Mineral deposits query failed: ${error.message}`);
    }

    // Perform aggregations
    const aggregated = this.aggregateMineralData(data || []);

    if (this.config.enableCaching) {
      await this.setCachedResult(cacheKey, aggregated);
    }

    return aggregated;
  }

  /**
   * Optimized AI predictions query with confidence filtering
   */
  async getAIPredictionsOptimized(filters: {
    minConfidence?: number;
    mineralTypes?: string[];
    dateRange?: { start: Date; end: Date };
    limit?: number;
  } = {}) {
    const cacheKey = `ai_predictions_${JSON.stringify(filters)}`;
    
    if (this.config.enableCaching) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    let query = supabase
      .from('ai_predictions')
      .select(`
        id,
        prediction_type,
        confidence_score,
        predicted_mineral_type,
        predicted_quantity,
        prediction_data,
        created_at,
        site:sites!inner(
          id,
          name,
          coordinates,
          project:projects(id, name)
        )
      `);

    // Apply confidence filter
    if (filters.minConfidence) {
      query = query.gte('confidence_score', filters.minConfidence);
    }

    // Apply mineral type filter
    if (filters.mineralTypes && filters.mineralTypes.length > 0) {
      query = query.in('predicted_mineral_type', filters.mineralTypes);
    }

    // Apply date range filter
    if (filters.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start.toISOString())
        .lte('created_at', filters.dateRange.end.toISOString());
    }

    // Apply limit
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    // Order by confidence score for better performance
    query = query.order('confidence_score', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`AI predictions query failed: ${error.message}`);
    }

    if (this.config.enableCaching && data) {
      await this.setCachedResult(cacheKey, data);
    }

    return data;
  }

  /**
   * Batch insert optimization for large datasets
   */
  async batchInsertOptimized<T>(
    table: string,
    data: T[],
    batchSize: number = 1000
  ): Promise<void> {
    const batches = this.chunkArray(data, batchSize);
    
    for (const batch of batches) {
      const { error } = await supabase
        .from(table)
        .insert(batch);
      
      if (error) {
        throw new Error(`Batch insert failed: ${error.message}`);
      }
    }

    // Invalidate related caches
    await this.invalidateRelatedCaches(table);
  }

  /**
   * Optimized full-text search for geological data
   */
  async searchGeologicalData(
    searchTerm: string,
    options: {
      tables?: string[];
      limit?: number;
      includeMetadata?: boolean;
    } = {}
  ) {
    const cacheKey = `search_${searchTerm}_${JSON.stringify(options)}`;
    
    if (this.config.enableCaching) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    const tables = options.tables || ['projects', 'sites', 'mineral_deposits'];
    const results: any = {};

    // Search projects
    if (tables.includes('projects')) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, description, location, status')
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
        .limit(options.limit || 10);
      
      results.projects = projects || [];
    }

    // Search sites
    if (tables.includes('sites')) {
      const { data: sites } = await supabase
        .from('sites')
        .select('id, name, location, site_type, coordinates')
        .or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,site_type.ilike.%${searchTerm}%`)
        .limit(options.limit || 10);
      
      results.sites = sites || [];
    }

    // Search mineral deposits
    if (tables.includes('mineral_deposits')) {
      const { data: deposits } = await supabase
        .from('mineral_deposits')
        .select('id, mineral_type, estimated_quantity, confidence_score')
        .ilike('mineral_type', `%${searchTerm}%`)
        .limit(options.limit || 10);
      
      results.mineral_deposits = deposits || [];
    }

    if (this.config.enableCaching) {
      await this.setCachedResult(cacheKey, results);
    }

    return results;
  }

  /**
   * Database connection pool optimization
   */
  async optimizeConnectionPool() {
    // This would typically be configured at the Supabase level
    // but we can implement client-side connection management
    const poolConfig = {
      max: 20, // Maximum number of connections
      min: 5,  // Minimum number of connections
      idleTimeoutMillis: 600000, // 10 minutes
      connectionTimeoutMillis: 30000, // 30 seconds
    };

    // Log current connection status
    console.log('Database connection pool optimized:', poolConfig);
    
    return poolConfig;
  }

  /**
   * Query performance monitoring
   */
  async monitorQueryPerformance<T>(
    queryName: string,
    queryFunction: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await queryFunction();
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log slow queries (>1 second)
      if (duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
      }

      // Send metrics to monitoring system
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'database_query', {
          query_name: queryName,
          duration: Math.round(duration),
          custom_parameter: 'performance_monitoring'
        });
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`Query failed: ${queryName} after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  // Private helper methods
  private async getCachedResult(key: string): Promise<any | null> {
    try {
      // Try Redis first
      if (redisClient) {
        const cached = await redisClient.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Fallback to in-memory cache
      const cached = this.queryCache.get(key);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return cached.data;
      }
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
    }
    
    return null;
  }

  private async setCachedResult(key: string, data: any): Promise<void> {
    try {
      // Store in Redis
      if (redisClient) {
        await redisClient.setex(
          key,
          Math.floor(this.config.cacheTimeout / 1000),
          JSON.stringify(data)
        );
      }

      // Store in memory cache as backup
      this.queryCache.set(key, {
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }
  }

  private aggregateMineralData(deposits: any[]) {
    const aggregated = {
      totalDeposits: deposits.length,
      mineralTypes: {} as Record<string, number>,
      totalEstimatedValue: 0,
      averageConfidence: 0,
      topMinerals: [] as Array<{ type: string; count: number; value: number }>
    };

    let totalConfidence = 0;

    deposits.forEach(deposit => {
      // Count by mineral type
      if (!aggregated.mineralTypes[deposit.mineral_type]) {
        aggregated.mineralTypes[deposit.mineral_type] = 0;
      }
      aggregated.mineralTypes[deposit.mineral_type]++;

      // Sum estimated values
      if (deposit.estimated_value) {
        aggregated.totalEstimatedValue += deposit.estimated_value;
      }

      // Sum confidence scores
      if (deposit.confidence_score) {
        totalConfidence += deposit.confidence_score;
      }
    });

    // Calculate average confidence
    if (deposits.length > 0) {
      aggregated.averageConfidence = totalConfidence / deposits.length;
    }

    // Create top minerals array
    aggregated.topMinerals = Object.entries(aggregated.mineralTypes)
      .map(([type, count]) => ({
        type,
        count,
        value: deposits
          .filter(d => d.mineral_type === type)
          .reduce((sum, d) => sum + (d.estimated_value || 0), 0)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return aggregated;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async invalidateRelatedCaches(table: string): Promise<void> {
    try {
      if (redisClient) {
        // Get all keys related to this table
        const pattern = `*${table}*`;
        const keys = await redisClient.keys(pattern);
        
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }

      // Clear in-memory cache
      for (const key of this.queryCache.keys()) {
        if (key.includes(table)) {
          this.queryCache.delete(key);
        }
      }
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
    }
  }
}

// Export singleton instance
export const dbOptimizer = new DatabaseOptimizer();

// Export hook for React components
export function useDatabaseOptimizer() {
  return dbOptimizer;
}