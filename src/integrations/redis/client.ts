// Simplified Redis client for basic caching
export class RedisService {
  private isEnabled: boolean = false;

  constructor() {
    console.log('Redis service initialized (simplified version)');
  }

  async get(key: string): Promise<string | null> {
    return null; // Simplified implementation
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    return true; // Simplified implementation
  }

  async getJSON<T>(key: string): Promise<T | null> {
    return null; // Simplified implementation
  }

  async setJSON<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    return true; // Simplified implementation
  }

  async del(key: string): Promise<boolean> {
    return true; // Simplified implementation
  }
}

export const redisService = new RedisService();
export default redisService;