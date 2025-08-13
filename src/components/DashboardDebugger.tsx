import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const DashboardDebugger = () => {
  const { user, session, loading } = useAuth();
  const location = useLocation();

  const debugInfo = {
    'Authentication Status': {
      value: user ? 'Authenticated' : 'Not Authenticated',
      status: user ? 'success' : 'error',
      details: user ? `User: ${user.email}` : 'No user found'
    },
    'Session Status': {
      value: session ? 'Active Session' : 'No Session',
      status: session ? 'success' : 'error',
      details: session ? `Expires: ${new Date(session.expires_at! * 1000).toLocaleString()}` : 'No session found'
    },
    'Loading State': {
      value: loading ? 'Loading' : 'Loaded',
      status: loading ? 'warning' : 'success',
      details: loading ? 'Authentication state loading...' : 'Authentication state loaded'
    },
    'Current Route': {
      value: location.pathname,
      status: 'info',
      details: `Full path: ${location.pathname}${location.search}${location.hash}`
    },
    'Environment': {
      value: import.meta.env.MODE || 'development',
      status: 'info',
      details: `Base URL: ${window.location.origin}`
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 mb-6">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-400" />
          Dashboard Debug Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(debugInfo).map(([key, info]) => (
          <div key={key} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(info.status)}
              <div>
                <p className="text-sm font-medium text-slate-200">{key}</p>
                <p className="text-xs text-slate-400">{info.details}</p>
              </div>
            </div>
            <Badge variant="outline" className={getStatusColor(info.status)}>
              {info.value}
            </Badge>
          </div>
        ))}
        
        {user && (
          <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
            <p className="text-sm font-medium text-slate-200 mb-2">User Details:</p>
            <pre className="text-xs text-slate-400 overflow-auto">
              {JSON.stringify({
                id: user.id,
                email: user.email,
                email_confirmed_at: user.email_confirmed_at,
                created_at: user.created_at,
                user_metadata: user.user_metadata,
                app_metadata: user.app_metadata
              }, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardDebugger;