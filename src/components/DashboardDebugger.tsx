import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const DashboardDebugger = () => {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-400" />
              Dashboard Debug Information
            </CardTitle>
            {!isExpanded && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getStatusColor(user ? 'success' : 'error')}>
                  {user ? 'Authenticated' : 'Not Authenticated'}
                </Badge>
                <Badge variant="outline" className={getStatusColor(session ? 'success' : 'error')}>
                  {session ? 'Active Session' : 'No Session'}
                </Badge>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
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
            <p className="text-sm font-medium text-slate-200 mb-2">User Profile:</p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-200 ml-2">{user.email}</span>
              </div>
              <div>
                <span className="text-slate-400">Account Created:</span>
                <span className="text-slate-200 ml-2">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Email Verified:</span>
                <span className="text-slate-200 ml-2">
                  {user.email_confirmed_at ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Display Name:</span>
                <span className="text-slate-200 ml-2">
                  {user.user_metadata?.display_name || user.user_metadata?.full_name || 'Not set'}
                </span>
              </div>
            </div>
          </div>
        )}
        </CardContent>
      )}
    </Card>
  );
};

export default DashboardDebugger;