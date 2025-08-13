import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRedisService, CacheOptions, PresenceData, NotificationData } from '@/integrations/redis/client';

// Hook for Redis caching operations
export const useRedisCache = () => {
  const redis = getRedisService();

  const getCached = useCallback(async <T>(key: string): Promise<T | null> => {
    return await redis.getJSON<T>(key);
  }, [redis]);

  const setCached = useCallback(async <T>(key: string, value: T, ttl?: number): Promise<boolean> => {
    return await redis.setJSON(key, value, ttl);
  }, [redis]);

  const deleteCached = useCallback(async (key: string): Promise<boolean> => {
    return await redis.del(key);
  }, [redis]);

  const existsCached = useCallback(async (key: string): Promise<boolean> => {
    return await redis.exists(key);
  }, [redis]);

  return {
    getCached,
    setCached,
    deleteCached,
    existsCached
  };
};

// Hook for user presence management
export const useUserPresence = (userId: string, projectId?: string) => {
  const redis = getRedisService();
  const [onlineUsers, setOnlineUsers] = useState<PresenceData[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  // Set user presence
  const setPresence = useCallback(async (data: Partial<PresenceData>) => {
    const presenceData: PresenceData = {
      userId,
      username: data.username || 'Unknown',
      role: data.role || 'user',
      projectId,
      lastSeen: Date.now(),
      status: data.status || 'online',
      cursor: data.cursor
    };

    const success = await redis.setJSON(`presence:${userId}`, presenceData, 30);
    if (success) {
      await redis.sadd('online_users', userId);
      await redis.publish('presence_updates', JSON.stringify({
        type: 'user_online',
        data: presenceData
      }));
      setIsOnline(true);
    }
    return success;
  }, [redis, userId, projectId]);

  // Remove user presence
  const removePresence = useCallback(async () => {
    await redis.del(`presence:${userId}`);
    await redis.srem('online_users', userId);
    await redis.publish('presence_updates', JSON.stringify({
      type: 'user_offline',
      userId
    }));
    setIsOnline(false);
  }, [redis, userId]);

  // Get online users
  const getOnlineUsers = useCallback(async (): Promise<PresenceData[]> => {
    const userIds = await redis.smembers('online_users');
    const users: PresenceData[] = [];
    
    for (const id of userIds) {
      const presence = await redis.getJSON<PresenceData>(`presence:${id}`);
      if (presence) {
        users.push(presence);
      }
    }
    
    setOnlineUsers(users);
    return users;
  }, [redis]);

  // Subscribe to presence updates
  useEffect(() => {
    const handlePresenceUpdate = (message: string) => {
      try {
        const update = JSON.parse(message);
        if (update.type === 'user_online') {
          setOnlineUsers(prev => {
            const filtered = prev.filter(u => u.userId !== update.data.userId);
            return [...filtered, update.data];
          });
        } else if (update.type === 'user_offline') {
          setOnlineUsers(prev => prev.filter(u => u.userId !== update.userId));
        }
      } catch (error) {
        console.error('Error parsing presence update:', error);
      }
    };

    redis.subscribe('presence_updates', handlePresenceUpdate);

    // Initial load
    getOnlineUsers();

    // Cleanup
    return () => {
      redis.unsubscribe('presence_updates');
    };
  }, [redis, getOnlineUsers]);

  // Heartbeat to maintain presence
  useEffect(() => {
    if (!isOnline) return;

    const heartbeat = setInterval(async () => {
      const presence = await redis.getJSON<PresenceData>(`presence:${userId}`);
      if (presence) {
        presence.lastSeen = Date.now();
        await redis.setJSON(`presence:${userId}`, presence, 30);
      }
    }, 15000); // Every 15 seconds

    return () => clearInterval(heartbeat);
  }, [redis, userId, isOnline]);

  return {
    onlineUsers,
    isOnline,
    setPresence,
    removePresence,
    getOnlineUsers
  };
};

// Hook for real-time notifications
export const useNotifications = (userId: string) => {
  const redis = getRedisService();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Send notification
  const sendNotification = useCallback(async (notification: Omit<NotificationData, 'id' | 'timestamp'>) => {
    const notificationData: NotificationData = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    // Add to user's notification list
    await redis.lpush(`notifications:${notification.userId}`, JSON.stringify(notificationData));
    
    // Publish to user's channel
    await redis.publish(`user:${notification.userId}:notifications`, JSON.stringify(notificationData));

    return notificationData;
  }, [redis]);

  // Get notifications
  const getNotifications = useCallback(async (limit: number = 50): Promise<NotificationData[]> => {
    const notificationStrings = await redis.lrange(`notifications:${userId}`, 0, limit - 1);
    const notifications = notificationStrings.map(n => JSON.parse(n));
    setNotifications(notifications);
    
    // Count unread notifications
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
    
    return notifications;
  }, [redis, userId]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const notificationStrings = await redis.lrange(`notifications:${userId}`, 0, -1);
    const notifications = notificationStrings.map(n => JSON.parse(n));
    
    const updatedNotifications = notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );

    // Clear the list and repopulate with updated notifications
    await redis.del(`notifications:${userId}`);
    for (const notification of updatedNotifications.reverse()) {
      await redis.lpush(`notifications:${userId}`, JSON.stringify(notification));
    }

    setNotifications(updatedNotifications);
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [redis, userId]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const notificationStrings = await redis.lrange(`notifications:${userId}`, 0, -1);
    const notifications = notificationStrings.map(n => JSON.parse(n));
    
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));

    // Clear the list and repopulate with updated notifications
    await redis.del(`notifications:${userId}`);
    for (const notification of updatedNotifications.reverse()) {
      await redis.lpush(`notifications:${userId}`, JSON.stringify(notification));
    }

    setNotifications(updatedNotifications);
    setUnreadCount(0);
  }, [redis, userId]);

  // Subscribe to new notifications
  useEffect(() => {
    const handleNewNotification = (message: string) => {
      try {
        const notification = JSON.parse(message);
        setNotifications(prev => [notification, ...prev]);
        if (!notification.read) {
          setUnreadCount(prev => prev + 1);
        }
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    };

    redis.subscribe(`user:${userId}:notifications`, handleNewNotification);

    // Initial load
    getNotifications();

    // Cleanup
    return () => {
      redis.unsubscribe(`user:${userId}:notifications`);
    };
  }, [redis, userId, getNotifications]);

  return {
    notifications,
    unreadCount,
    sendNotification,
    getNotifications,
    markAsRead,
    markAllAsRead
  };
};

// Hook for rate limiting
export const useRateLimit = () => {
  const redis = getRedisService();

  const checkRateLimit = useCallback(async (
    key: string, 
    limit: number, 
    window: number
  ): Promise<{ allowed: boolean; current: number; remaining: number; resetTime: number }> => {
    const isLimited = await redis.isRateLimited(key, limit, window);
    const info = await redis.getRateLimitInfo(key);
    
    return {
      allowed: !isLimited,
      current: info.current,
      remaining: Math.max(0, limit - info.current),
      resetTime: Date.now() + (info.ttl * 1000)
    };
  }, [redis]);

  return { checkRateLimit };
};

// Hook for geospatial operations
export const useGeospatial = () => {
  const redis = getRedisService();

  const addLocation = useCallback(async (
    key: string, 
    longitude: number, 
    latitude: number, 
    member: string
  ): Promise<boolean> => {
    return await redis.geoadd(key, longitude, latitude, member);
  }, [redis]);

  const findNearby = useCallback(async (
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: 'km' | 'm' = 'km'
  ): Promise<any[]> => {
    return await redis.georadius(key, longitude, latitude, radius, unit, true, true);
  }, [redis]);

  const getDistance = useCallback(async (
    key: string,
    member1: string,
    member2: string,
    unit: 'km' | 'm' = 'km'
  ): Promise<number | null> => {
    return await redis.geodist(key, member1, member2, unit);
  }, [redis]);

  const getPosition = useCallback(async (
    key: string,
    member: string
  ): Promise<[number, number] | null> => {
    return await redis.geopos(key, member);
  }, [redis]);

  return {
    addLocation,
    findNearby,
    getDistance,
    getPosition
  };
};

// Hook for real-time messaging
export const useRealtimeMessaging = (channel: string) => {
  const redis = getRedisService();
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const sendMessage = useCallback(async (message: any) => {
    const messageData = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    await redis.publish(channel, JSON.stringify(messageData));
    return messageData;
  }, [redis, channel]);

  const subscribe = useCallback(() => {
    const handleMessage = (message: string, receivedChannel: string) => {
      if (receivedChannel === channel) {
        try {
          const messageData = JSON.parse(message);
          setMessages(prev => [...prev, messageData]);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      }
    };

    redis.subscribe(channel, handleMessage);
    setIsConnected(true);
  }, [redis, channel]);

  const unsubscribe = useCallback(() => {
    redis.unsubscribe(channel);
    setIsConnected(false);
  }, [redis, channel]);

  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  return {
    messages,
    isConnected,
    sendMessage,
    subscribe,
    unsubscribe
  };
};

// Hook for Redis health monitoring
export const useRedisHealth = () => {
  const redis = getRedisService();
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [memoryUsage, setMemoryUsage] = useState({ used: 0, peak: 0, total: 0 });
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const healthy = await redis.ping();
      const memory = await redis.getMemoryUsage();
      
      setIsHealthy(healthy);
      setMemoryUsage(memory);
      setLastCheck(new Date());
      
      return { healthy, memory };
    } catch (error) {
      console.error('Redis health check failed:', error);
      setIsHealthy(false);
      setLastCheck(new Date());
      return { healthy: false, memory: { used: 0, peak: 0, total: 0 } };
    }
  }, [redis]);

  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up periodic health checks every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    isHealthy,
    memoryUsage,
    lastCheck,
    checkHealth
  };
};

// Hook for session management
export const useRedisSession = () => {
  const redis = getRedisService();

  const createSession = useCallback(async (
    sessionId: string,
    userId: string,
    data: any,
    ttl: number = 3600
  ): Promise<boolean> => {
    return await redis.createSession(sessionId, userId, data, ttl);
  }, [redis]);

  const getSession = useCallback(async (sessionId: string): Promise<any | null> => {
    return await redis.getSession(sessionId);
  }, [redis]);

  const destroySession = useCallback(async (sessionId: string): Promise<boolean> => {
    return await redis.destroySession(sessionId);
  }, [redis]);

  const getUserSessions = useCallback(async (userId: string): Promise<string[]> => {
    return await redis.getUserSessions(userId);
  }, [redis]);

  return {
    createSession,
    getSession,
    destroySession,
    getUserSessions
  };
};

// Export all hooks
export default {
  useRedisCache,
  useUserPresence,
  useNotifications,
  useRateLimit,
  useGeospatial,
  useRealtimeMessaging,
  useRedisHealth,
  useRedisSession
};