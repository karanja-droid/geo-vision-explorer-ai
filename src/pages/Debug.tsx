/**
 * Comprehensive Debug Dashboard
 * 
 * Central debugging interface for GeoVision AI Miner application
 * including environment, authentication, email, API, and feature testing.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EmailDebugger } from '@/components/EmailDebugger';
import { AuthDebugger } from '@/components/AuthDebugger';
import DashboardDebugger from '@/components/DashboardDebugger';
import { ApiTester } from '@/components/ApiTester';
import { supabase } from '@/integrations/supabase/client';
import { SITE_URL, API_BASE_URL, SUPABASE_URL, ENVIRONMENT, IS_PRODUCTION } from '@/config/env';

const Debug: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<any>({});
  const [apiStatus, setApiStatus] = useState<any>({});
  const [supabaseStatus, setSupabaseStatus] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSystemInfo();
    checkApiStatus();
    checkSupabaseStatus();
  }, []);

  const loadSystemInfo = () => {
    const info = {
      // Environment
      environment: ENVIRONMENT,
      isProduction: IS_PRODUCTION,
      siteUrl: SITE_URL,
      apiBaseUrl: API_BASE_URL,
      supabaseUrl: SUPABASE_URL,
      
      // Browser
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      
      // Window
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      
      // Performance
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      memory: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
      } : null,
    };
    
    setSystemInfo(info);
  };

  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/healthz`);
      const data = await response.json();
      
      setApiStatus({
        available: response.ok,
        status: response.status,
        data: data,
        responseTime: Date.now() - performance.now()
      });
    } catch (error) {
      setApiStatus({
        available: false,
        error: error.message
      });
    }
  };

  const checkSupabaseStatus = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      setSupabaseStatus({
        connected: !error,
        hasSession: !!data.session,
        user: data.session?.user ? {
          id: data.session.user.id,
          email: data.session.user.email,
          role: data.session.user.user_metadata?.role
        } : null,
        error: error?.message
      });
    } catch (error) {
      setSupabaseStatus({
        connected: false,
        error: error.message
      });
    }
  };

  const runHealthCheck = async () => {
    setLoading(true);
    await Promise.all([
      checkApiStatus(),
      checkSupabaseStatus(),
      loadSystemInfo()
    ]);
    setLoading(false);
  };

  const exportDebugInfo = () => {
    const debugData = {
      timestamp: new Date().toISOString(),
      systemInfo,
      apiStatus,
      supabaseStatus,
      url: window.location.href,
      referrer: document.referrer
    };
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geovision-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Debug Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive debugging tools for GeoVision AI Miner
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runHealthCheck} disabled={loading}>
              {loading ? 'Checking...' : 'Health Check'}
            </Button>
            <Button onClick={exportDebugInfo} variant="outline">
              Export Debug Info
            </Button>
          </div>
        </div>

        {/* System Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Environment Status */}
              <div className="space-y-2">
                <h4 className="font-semibold">Environment</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Mode:</span>
                    <Badge variant={IS_PRODUCTION ? 'destructive' : 'secondary'}>
                      {ENVIRONMENT}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Site URL:</span>
                    <Badge variant="outline" className="text-xs">
                      {SITE_URL}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>API URL:</span>
                    <Badge variant="outline" className="text-xs">
                      {API_BASE_URL}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* API Status */}
              <div className="space-y-2">
                <h4 className="font-semibold">API Status</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <Badge variant={apiStatus.available ? 'default' : 'destructive'}>
                      {apiStatus.available ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  {apiStatus.status && (
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <Badge variant="outline">{apiStatus.status}</Badge>
                    </div>
                  )}
                  {apiStatus.data?.baseUrl && (
                    <div className="flex justify-between">
                      <span>Base URL:</span>
                      <Badge variant="outline" className="text-xs">
                        {apiStatus.data.baseUrl}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Supabase Status */}
              <div className="space-y-2">
                <h4 className="font-semibold">Supabase Status</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Connected:</span>
                    <Badge variant={supabaseStatus.connected ? 'default' : 'destructive'}>
                      {supabaseStatus.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Session:</span>
                    <Badge variant={supabaseStatus.hasSession ? 'default' : 'secondary'}>
                      {supabaseStatus.hasSession ? 'Active' : 'None'}
                    </Badge>
                  </div>
                  {supabaseStatus.user && (
                    <div className="flex justify-between">
                      <span>User:</span>
                      <Badge variant="outline" className="text-xs">
                        {supabaseStatus.user.email}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error Alerts */}
            {(apiStatus.error || supabaseStatus.error) && (
              <div className="mt-4 space-y-2">
                {apiStatus.error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <strong>API Error:</strong> {apiStatus.error}
                    </AlertDescription>
                  </Alert>
                )}
                {supabaseStatus.error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <strong>Supabase Error:</strong> {supabaseStatus.error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debug Tools Tabs */}
        <Tabs defaultValue="system" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="system">System Info</TabsTrigger>
            <TabsTrigger value="auth">Authentication</TabsTrigger>
            <TabsTrigger value="email">Email Testing</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="api">API Testing</TabsTrigger>
          </TabsList>

          {/* System Information */}
          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Environment</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Environment:</span>
                        <code>{systemInfo.environment}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Production:</span>
                        <code>{systemInfo.isProduction?.toString()}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Site URL:</span>
                        <code className="text-xs">{systemInfo.siteUrl}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>API URL:</span>
                        <code className="text-xs">{systemInfo.apiBaseUrl}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Supabase URL:</span>
                        <code className="text-xs">{systemInfo.supabaseUrl}</code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Browser</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Platform:</span>
                        <code>{systemInfo.platform}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Language:</span>
                        <code>{systemInfo.language}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Timezone:</span>
                        <code>{systemInfo.timezone}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Online:</span>
                        <code>{systemInfo.onLine?.toString()}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Cookies:</span>
                        <code>{systemInfo.cookieEnabled?.toString()}</code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Display</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Window Size:</span>
                        <code>{systemInfo.windowSize}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Screen Size:</span>
                        <code>{systemInfo.screenSize}</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Connection:</span>
                        <code>{systemInfo.connectionType}</code>
                      </div>
                    </div>
                  </div>

                  {systemInfo.memory && (
                    <div>
                      <h4 className="font-semibold mb-3">Memory (MB)</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Used:</span>
                          <code>{systemInfo.memory.used}</code>
                        </div>
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <code>{systemInfo.memory.total}</code>
                        </div>
                        <div className="flex justify-between">
                          <span>Limit:</span>
                          <code>{systemInfo.memory.limit}</code>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />
                
                <div>
                  <h4 className="font-semibold mb-3">User Agent</h4>
                  <code className="text-xs break-all">{systemInfo.userAgent}</code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authentication Debug */}
          <TabsContent value="auth">
            <AuthDebugger />
          </TabsContent>

          {/* Email Debug */}
          <TabsContent value="email">
            <EmailDebugger />
          </TabsContent>

          {/* Dashboard Debug */}
          <TabsContent value="dashboard">
            <DashboardDebugger />
          </TabsContent>

          {/* API Testing */}
          <TabsContent value="api">
            <ApiTester />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Debug;