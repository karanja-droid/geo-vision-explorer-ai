import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  cluster?: boolean;
  nodes?: Array<{ host: string; port: number }>;
}

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  serialize?: boolean;
}

export interface PresenceData {
  userId: string;
  username: string;
  role: string;
  projectId?: string;
  lastSeen: number;
  cursor?: { x: number; y: number };
  status?: 'online' | 'away' | 'busy';
}

export interface NotificationData {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  userId: string;
  projectId?: string;
  timestamp: number;
  read?: boolean;
  actions?: Array<{ label: string; action: string }>;
}

export interface JobData {
  id: string;
  type: string;
  data: any;
  priority?: number;
  delay?: number;
  attempts?: number;
  maxAttempts?: number;
  createdAt: number;
  status?: 'waiting' | 'processing' | 'completed' | 'failed';
}

export class RedisService {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isCluster: boolean;

  constructor(config: RedisConfig) {
    this.isCluster = config.cluster || false;

    if (this.isCluster && config.nodes) {
      // Redis Cluster configuration
      this.client = new Redis.Cluster(config.nodes, {
        redisOptions: {
          password: config.password,
          keyPrefix: config.keyPrefix || 'geovision:',
          retryDelayOnFailover: config.retryDelayOnFailover || 100,
          maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
          lazyConnect: true
        }
      });
    } else {
      // Single Redis instance configuration
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db || 0,
        keyPrefix: config.keyPrefix || 'geovision:',
        retryDelayOnFailover: config.retryDelayOnFailover || 100,
        maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
        lazyConnect: true
      });
    }

    // Dedicated clients for pub/sub
    this.subscriber = this.client.duplicate();
    this.publisher = this.client.duplicate();

    // Error handling
    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
    });

    this.subscriber.on('error', (error) => {
      console.error('Redis subscriber error:', error);
    });

    this.publisher.on('error', (error) => {
      console.error('Redis publisher error:', error);
    });
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Redis GET JSON error for key ${key}:`, error);
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET JSON error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      console.error(`Redis HGET error for key ${key}, field ${field}:`, error);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.client.hset(key, field, value);
      return true;
    } catch (error) {
      console.error(`Redis HSET error for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      console.error(`Redis HGETALL error for key ${key}:`, error);
      return {};
    }
  }

  async hmset(key: string, data: Record<string, string>): Promise<boolean> {
    try {
      await this.client.hmset(key, data);
      return true;
    } catch (error) {
      console.error(`Redis HMSET error for key ${key}:`, error);
      return false;
    }
  }

  async hdel(key: string, field: string): Promise<boolean> {
    try {
      await this.client.hdel(key, field);
      return true;
    } catch (error) {
      console.error(`Redis HDEL error for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  // List operations
  async lpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.lpush(key, value);
    } catch (error) {
      console.error(`Redis LPUSH error for key ${key}:`, error);
      return 0;
    }
  }

  async rpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.rpush(key, value);
    } catch (error) {
      console.error(`Redis RPUSH error for key ${key}:`, error);
      return 0;
    }
  }

  async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lpop(key);
    } catch (error) {
      console.error(`Redis LPOP error for key ${key}:`, error);
      return null;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      console.error(`Redis RPOP error for key ${key}:`, error);
      return null;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      console.error(`Redis LRANGE error for key ${key}:`, error);
      return [];
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key);
    } catch (error) {
      console.error(`Redis LLEN error for key ${key}:`, error);
      return 0;
    }
  }

  // Set operations
  async sadd(key: string, member: string): Promise<boolean> {
    try {
      await this.client.sadd(key, member);
      return true;
    } catch (error) {
      console.error(`Redis SADD error for key ${key}:`, error);
      return false;
    }
  }

  async srem(key: string, member: string): Promise<boolean> {
    try {
      await this.client.srem(key, member);
      return true;
    } catch (error) {
      console.error(`Redis SREM error for key ${key}:`, error);
      return false;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      console.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      console.error(`Redis SISMEMBER error for key ${key}:`, error);
      return false;
    }
  }

  async scard(key: string): Promise<number> {
    try {
      return await this.client.scard(key);
    } catch (error) {
      console.error(`Redis SCARD error for key ${key}:`, error);
      return 0;
    }
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string): Promise<boolean> {
    try {
      await this.client.zadd(key, score, member);
      return true;
    } catch (error) {
      console.error(`Redis ZADD error for key ${key}:`, error);
      return false;
    }
  }

  async zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    try {
      if (withScores) {
        return await this.client.zrange(key, start, stop, 'WITHSCORES');
      }
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      console.error(`Redis ZRANGE error for key ${key}:`, error);
      return [];
    }
  }

  async zrevrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]> {
    try {
      if (withScores) {
        return await this.client.zrevrange(key, start, stop, 'WITHSCORES');
      }
      return await this.client.zrevrange(key, start, stop);
    } catch (error) {
      console.error(`Redis ZREVRANGE error for key ${key}:`, error);
      return [];
    }
  }

  async zrem(key: string, member: string): Promise<boolean> {
    try {
      await this.client.zrem(key, member);
      return true;
    } catch (error) {
      console.error(`Redis ZREM error for key ${key}:`, error);
      return false;
    }
  }

  async zcard(key: string): Promise<number> {
    try {
      return await this.client.zcard(key);
    } catch (error) {
      console.error(`Redis ZCARD error for key ${key}:`, error);
      return 0;
    }
  }

  async zscore(key: string, member: string): Promise<number | null> {
    try {
      const score = await this.client.zscore(key, member);
      return score ? parseFloat(score) : null;
    } catch (error) {
      console.error(`Redis ZSCORE error for key ${key}:`, error);
      return null;
    }
  }

  // Geospatial operations
  async geoadd(key: string, longitude: number, latitude: number, member: string): Promise<boolean> {
    try {
      await this.client.geoadd(key, longitude, latitude, member);
      return true;
    } catch (error) {
      console.error(`Redis GEOADD error for key ${key}:`, error);
      return false;
    }
  }

  async georadius(
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: 'km' | 'm' = 'km',
    withDist?: boolean,
    withCoord?: boolean
  ): Promise<any[]> {
    try {
      const options: string[] = [];
      if (withDist) options.push('WITHDIST');
      if (withCoord) options.push('WITHCOORD');

      return await this.client.georadius(key, longitude, latitude, radius, unit, ...options);
    } catch (error) {
      console.error(`Redis GEORADIUS error for key ${key}:`, error);
      return [];
    }
  }

  async geodist(key: string, member1: string, member2: string, unit: 'km' | 'm' = 'km'): Promise<number | null> {
    try {
      const distance = await this.client.geodist(key, member1, member2, unit);
      return distance ? parseFloat(distance) : null;
    } catch (error) {
      console.error(`Redis GEODIST error for key ${key}:`, error);
      return null;
    }
  }

  async geopos(key: string, member: string): Promise<[number, number] | null> {
    try {
      const positions = await this.client.geopos(key, member);
      if (positions && positions[0]) {
        return [parseFloat(positions[0][0]), parseFloat(positions[0][1])];
      }
      return null;
    } catch (error) {
      console.error(`Redis GEOPOS error for key ${key}:`, error);
      return null;
    }
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.publisher.publish(channel, message);
    } catch (error) {
      console.error(`Redis PUBLISH error for channel ${channel}:`, error);
      return 0;
    }
  }

  async subscribe(channel: string, callback: (message: string, channel: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', callback);
    } catch (error) {
      console.error(`Redis SUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      console.error(`Redis UNSUBSCRIBE error for channel ${channel}:`, error);
    }
  }

  async psubscribe(pattern: string, callback: (message: string, channel: string, pattern: string) => void): Promise<void> {
    try {
      await this.subscriber.psubscribe(pattern);
      this.subscriber.on('pmessage', callback);
    } catch (error) {
      console.error(`Redis PSUBSCRIBE error for pattern ${pattern}:`, error);
    }
  }

  // Rate limiting
  async isRateLimited(key: string, limit: number, window: number): Promise<boolean> {
    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, window);
      }
      return current > limit;
    } catch (error) {
      console.error(`Redis rate limiting error for key ${key}:`, error);
      return false;
    }
  }

  async getRateLimitInfo(key: string): Promise<{ current: number; ttl: number }> {
    try {
      const [current, ttl] = await Promise.all([
        this.client.get(key),
        this.client.ttl(key)
      ]);
      return {
        current: current ? parseInt(current) : 0,
        ttl: ttl || 0
      };
    } catch (error) {
      console.error(`Redis rate limit info error for key ${key}:`, error);
      return { current: 0, ttl: 0 };
    }
  }

  // Session management
  async createSession(sessionId: string, userId: string, data: any, ttl: number = 3600): Promise<boolean> {
    try {
      const sessionData = {
        userId,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        ...data
      };
      await this.setJSON(`session:${sessionId}`, sessionData, ttl);
      await this.sadd(`user:${userId}:sessions`, sessionId);
      return true;
    } catch (error) {
      console.error(`Redis create session error for session ${sessionId}:`, error);
      return false;
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const session = await this.getJSON(`session:${sessionId}`);
      if (session) {
        // Update last accessed time
        session.lastAccessed = Date.now();
        await this.setJSON(`session:${sessionId}`, session);
      }
      return session;
    } catch (error) {
      console.error(`Redis get session error for session ${sessionId}:`, error);
      return null;
    }
  }

  async destroySession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getJSON(`session:${sessionId}`);
      if (session) {
        await this.srem(`user:${session.userId}:sessions`, sessionId);
      }
      await this.del(`session:${sessionId}`);
      return true;
    } catch (error) {
      console.error(`Redis destroy session error for session ${sessionId}:`, error);
      return false;
    }
  }

  async getUserSessions(userId: string): Promise<string[]> {
    try {
      return await this.smembers(`user:${userId}:sessions`);
    } catch (error) {
      console.error(`Redis get user sessions error for user ${userId}:`, error);
      return [];
    }
  }

  // Health check and monitoring
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping error:', error);
      return false;
    }
  }

  async info(section?: string): Promise<string> {
    try {
      return await this.client.info(section);
    } catch (error) {
      console.error('Redis info error:', error);
      return '';
    }
  }

  async getMemoryUsage(): Promise<{ used: number; peak: number; total: number }> {
    try {
      const info = await this.info('memory');
      const lines = info.split('\r\n');
      const memoryInfo: any = {};
      
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryInfo[key] = value;
        }
      });

      return {
        used: parseInt(memoryInfo.used_memory || '0'),
        peak: parseInt(memoryInfo.used_memory_peak || '0'),
        total: parseInt(memoryInfo.maxmemory || '0')
      };
    } catch (error) {
      console.error('Redis memory usage error:', error);
      return { used: 0, peak: 0, total: 0 };
    }
  }

  // Cleanup and connection management
  async flushdb(): Promise<boolean> {
    try {
      await this.client.flushdb();
      return true;
    } catch (error) {
      console.error('Redis flushdb error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.quit(),
        this.subscriber.quit(),
        this.publisher.quit()
      ]);
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }

  // Batch operations
  async pipeline(operations: Array<{ command: string; args: any[] }>): Promise<any[]> {
    try {
      const pipeline = this.client.pipeline();
      operations.forEach(op => {
        (pipeline as any)[op.command](...op.args);
      });
      const results = await pipeline.exec();
      return results?.map(result => result[1]) || [];
    } catch (error) {
      console.error('Redis pipeline error:', error);
      return [];
    }
  }

  // Lua script execution
  async eval(script: string, keys: string[], args: string[]): Promise<any> {
    try {
      return await this.client.eval(script, keys.length, ...keys, ...args);
    } catch (error) {
      console.error('Redis eval error:', error);
      return null;
    }
  }
}

// Singleton instance
let redisService: RedisService | null = null;

export const getRedisService = (): RedisService => {
  if (!redisService) {
    const config: RedisConfig = {
      host: process.env.VITE_REDIS_HOST || 'localhost',
      port: parseInt(process.env.VITE_REDIS_PORT || '6379'),
      password: process.env.VITE_REDIS_PASSWORD,
      db: parseInt(process.env.VITE_REDIS_DB || '0'),
      keyPrefix: 'geovision:',
      cluster: process.env.VITE_REDIS_CLUSTER === 'true',
      nodes: process.env.VITE_REDIS_NODES ? 
        JSON.parse(process.env.VITE_REDIS_NODES) : undefined
    };
    
    redisService = new RedisService(config);
  }
  
  return redisService;
};

export default RedisService;