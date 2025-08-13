import { redisClient } from '@/integrations/redis/client';

export interface CacheConfig {
  defaultTTL: number;
  maxMemorySize: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  memoryUsage: number;
}

export class CacheManager {
  private config: CacheConfig;
  private memoryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    memoryUsage: 0
  };

  constructor(config: CacheConfig = {
    defaultTTL: 300, // 5 minutes
    maxMemorySize: 100 * 1024 * 1024, // 100MB
    enableCompression: true,
    enableMetrics: true
  }) {
    this.config = config;
    this.startCleanupInterval();
  }

  /**
   * Get cached data with fallback strategy
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first (L1 cache)
      if (redisClient) {
        const redisData = await redisClient.get(key);
        if (redisData) {
          this.updateMetrics('hit');
          return this.deserialize(redisData);
        }
      }

      // Try memory cache (L2 cache)
      const memoryData = this.memoryCache.get(key);
      if (memoryData && this.isValid(memoryData)) {
        this.updateMetrics('hit');
        
        // Promote to Redis if available
        if (redisClient) {
          await redisClient.setex(key, memoryData.ttl, this.serialize(memoryData.data));
        }
        
        return memoryData.data;
      }

      this.updateMetrics('miss');
      return null;
    } catch (error) {
      console.warn('Cache get failed:', error);
      this.updateMetrics('miss');
      return null;
    }
  }

  /**
   * Set cached data with multi-level storage
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const cacheTTL = ttl || this.config.defaultTTL;
    
    try {
      const serialized = this.serialize(data);
      
      // Store in Redis (L1 cache)
      if (redisClient) {
        await redisClient.setex(key, cacheTTL, serialized);
      }

      // Store in memory cache (L2 cache)
      this.setMemoryCache(key, data, cacheTTL);
      
      this.updateMetrics('set');
    } catch (error) {
      console.warn('Cache set failed:', error);
    }
  }

  /**
   * Delete cached data from all levels
   */
  async delete(key: string): Promise<void> {
    try {
      // Delete from Redis
      if (redisClient) {
        await redisClient.del(key);
      }

      // Delete from memory cache
      this.memoryCache.delete(key);
      
      this.updateMetrics('delete');
    } catch (error) {
      console.warn('Cache delete failed:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      // Clear Redis
      if (redisClient) {
        await redisClient.flushall();
      }

      // Clear memory cache
      this.memoryCache.clear();
      
      this.resetMetrics();
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }

  /**
   * Get or set pattern with automatic caching
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, ttl);
    
    return data;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
    const results: Record<string, T | null> = {};
    
    try {
      // Try Redis batch get
      if (redisClient && keys.length > 0) {
        const redisResults = await redisClient.mget(...keys);
        
        keys.forEach((key, index) => {
          const value = redisResults[index];
          if (value) {
            results[key] = this.deserialize(value);
            this.updateMetrics('hit');
          } else {
            results[key] = null;
            this.updateMetrics('miss');
          }
        });
      } else {
        // Fallback to individual gets
        for (const key of keys) {
          results[key] = await this.get<T>(key);
        }
      }
    } catch (error) {
      console.warn('Batch get failed:', error);
      
      // Fallback to individual gets
      for (const key of keys) {
        results[key] = await this.get<T>(key);
      }
    }
    
    return results;
  }

  /**
   * Batch set multiple key-value pairs
   */
  async mset<T>(data: Record<string, T>, ttl?: number): Promise<void> {
    const cacheTTL = ttl || this.config.defaultTTL;
    
    try {
      // Redis batch set
      if (redisClient) {
        const pipeline = redisClient.pipeline();
        
        Object.entries(data).forEach(([key, value]) => {
          pipeline.setex(key, cacheTTL, this.serialize(value));
        });
        
        await pipeline.exec();
      }

      // Memory cache set
      Object.entries(data).forEach(([key, value]) => {
        this.setMemoryCache(key, value, cacheTTL);
      });
      
      this.updateMetrics('set', Object.keys(data).length);
    } catch (error) {
      console.warn('Batch set failed:', error);
    }
  }

  /**
   * Cache with tags for group invalidation
   */
  async setWithTags<T>(
    key: string,
    data: T,
    tags: string[],
    ttl?: number
  ): Promise<void> {
    await this.set(key, data, ttl);
    
    // Store tag associations
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const taggedKeys = await this.get<string[]>(tagKey) || [];
      
      if (!taggedKeys.includes(key)) {
        taggedKeys.push(key);
        await this.set(tagKey, taggedKeys, ttl);
      }
    }
  }

  /**
   * Invalidate all keys with specific tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const taggedKeys = await this.get<string[]>(tagKey);
      
      if (taggedKeys) {
        // Delete all tagged keys
        for (const key of taggedKeys) {
          await this.delete(key);
        }
        
        // Delete the tag key itself
        await this.delete(tagKey);
      }
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.metrics.hitRate = this.metrics.hits + this.metrics.misses > 0
      ? this.metrics.hits / (this.metrics.hits + this.metrics.misses)
      : 0;
    
    this.metrics.memoryUsage = this.calculateMemoryUsage();
    
    return { ...this.metrics };
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmupData: Array<{ key: string; fetcher: () => Promise<any>; ttl?: number }>): Promise<void> {
    console.log('Starting cache warmup...');
    
    const promises = warmupData.map(async ({ key, fetcher, ttl }) => {
      try {
        const data = await fetcher();
        await this.set(key, data, ttl);
      } catch (error) {
        console.warn(`Cache warmup failed for key ${key}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
    console.log('Cache warmup completed');
  }

  // Private methods
  private serialize(data: any): string {
    if (this.config.enableCompression) {
      // Simple compression - in production, use a proper compression library
      return JSON.stringify(data);
    }
    return JSON.stringify(data);
  }

  private deserialize<T>(data: string): T {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.warn('Deserialization failed:', error);
      throw error;
    }
  }

  private setMemoryCache<T>(key: string, data: T, ttl: number): void {
    // Check memory limit
    if (this.calculateMemoryUsage() > this.config.maxMemorySize) {
      this.evictLRU();
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private isValid(cacheEntry: { timestamp: number; ttl: number }): boolean {
    return Date.now() - cacheEntry.timestamp < cacheEntry.ttl * 1000;
  }

  private evictLRU(): void {
    // Simple LRU eviction - remove oldest entries
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  private calculateMemoryUsage(): number {
    let size = 0;
    for (const [key, value] of this.memoryCache.entries()) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(value.data).length * 2;
    }
    return size;
  }

  private updateMetrics(operation: 'hit' | 'miss' | 'set' | 'delete', count: number = 1): void {
    if (!this.config.enableMetrics) return;
    
    this.metrics[operation === 'hit' ? 'hits' : 
                  operation === 'miss' ? 'misses' :
                  operation === 'set' ? 'sets' : 'deletes'] += count;
  }

  private resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      memoryUsage: 0
    };
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (!this.isValid(entry)) {
          this.memoryCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
}

// Specialized cache managers for different data types
export class GeologicalCacheManager extends CacheManager {
  constructor() {
    super({
      defaultTTL: 600, // 10 minutes for geological data
      maxMemorySize: 200 * 1024 * 1024, // 200MB
      enableCompression: true,
      enableMetrics: true
    });
  }

  async cacheProjectData(projectId: string, data: any): Promise<void> {
    await this.setWithTags(
      `project:${projectId}`,
      data,
      ['projects', `project:${projectId}`],
      1800 // 30 minutes
    );
  }

  async cacheSiteData(siteId: string, data: any): Promise<void> {
    await this.setWithTags(
      `site:${siteId}`,
      data,
      ['sites', `site:${siteId}`, `project:${data.project_id}`],
      900 // 15 minutes
    );
  }

  async cacheMineralData(depositId: string, data: any): Promise<void> {
    await this.setWithTags(
      `mineral:${depositId}`,
      data,
      ['minerals', `mineral:${depositId}`, `site:${data.site_id}`],
      1200 // 20 minutes
    );
  }

  async cacheAIPrediction(predictionId: string, data: any): Promise<void> {
    await this.setWithTags(
      `prediction:${predictionId}`,
      data,
      ['predictions', `prediction:${predictionId}`, `site:${data.site_id}`],
      300 // 5 minutes (AI data changes frequently)
    );
  }

  async invalidateProject(projectId: string): Promise<void> {
    await this.invalidateByTags([`project:${projectId}`]);
  }

  async invalidateSite(siteId: string): Promise<void> {
    await this.invalidateByTags([`site:${siteId}`]);
  }
}

// Export instances
export const cacheManager = new CacheManager();
export const geologicalCache = new GeologicalCacheManager();

// React hook for cache management
export function useCacheManager() {
  return {
    cache: cacheManager,
    geologicalCache,
    getMetrics: () => cacheManager.getMetrics()
  };
}