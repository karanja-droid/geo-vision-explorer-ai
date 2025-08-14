/**
 * Status Bar - Bottom status information and quick actions
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, 
  WifiOff, 
  Database, 
  Clock, 
  Users, 
  Activity,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface StatusBarProps {
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ className }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'syncing'>('connected');
  const [activeUsers, setActiveUsers] = useState(3);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getConnectionIcon = () => {
    if (!isOnline) return <WifiOff className="w-3 h-3 text-red-500" />;
    return <Wifi className="w-3 h-3 text-green-500" />;
  };

  const getDbStatusIcon = () => {
    switch (dbStatus) {
      case 'connected':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'disconnected':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'syncing':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between h-6 px-4 bg-muted/30 border-t text-xs",
      className
    )}>
      {/* Left side - System status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {getConnectionIcon()}
          <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          {getDbStatusIcon()}
          <span>Database</span>
        </div>

        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{activeUsers} active</span>
        </div>
      </div>

      {/* Right side - Time and actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>System healthy</span>
        </div>

        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{currentTime.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};