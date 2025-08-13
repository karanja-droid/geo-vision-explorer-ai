import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Session } from '@supabase/supabase-js';

export const AuthDebugger = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authEvents, setAuthEvents] = useState<string[]>([]);
  const [supabaseConfig, setSupabaseConfig] = useState<any>(null);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        addAuthEvent(`Session error: ${error.message}`);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        addAuthEvent(`Initial session: ${session ? 'Found' : 'None'}`);
      }
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        addAuthEvent(`Auth event: ${event}`);
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Get Supabase configuration
    setSupabaseConfig({
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      environment: import.meta.env.MODE,
    });

    return () => subscription.unsubscribe();
  }, []);

  const addAuthEvent = (event: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setAuthEvents(prev => [`[${timestamp}] ${event}`, ...prev.slice(0, 9)]);
  };

  const testConnection = async () => {
    addAuthEvent('Testing Supabase connection...');
    try {
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      if (error) {
        addAuthEvent(`Connection test failed: ${error.message}`);
      } else {
        addAuthEvent('Connection test successful');
      }
    } catch (error) {
      addAuthEvent(`Connection test error: ${error}`);
    }
  };

  const testSignOut = async () => {
    addAuthEvent('Testing sign out...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      addAuthEvent(`Sign out error: ${error.message}`);
    } else {
      addAuthEvent('Sign out successful');
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>🔍 Authentication Debugger</CardTitle>
          <CardDescription>Loading authentication state...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Authentication Debugger</CardTitle>
          <CardDescription>
            Debug authentication issues and verify Supabase configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configuration Status */}
          <div>
            <h3 className="font-semibold mb-2">Configuration Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Badge variant={supabaseConfig?.url ? 'default' : 'destructive'}>
                Supabase URL: {supabaseConfig?.url ? 'Set' : 'Missing'}
              </Badge>
              <Badge variant={supabaseConfig?.anonKey === 'Set' ? 'default' : 'destructive'}>
                Anon Key: {supabaseConfig?.anonKey}
              </Badge>
              <Badge variant="outline">
                Environment: {supabaseConfig?.environment}
              </Badge>
            </div>
          </div>

          {/* Authentication Status */}
          <div>
            <h3 className="font-semibold mb-2">Authentication Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Badge variant={session ? 'default' : 'secondary'}>
                  Session: {session ? 'Active' : 'None'}
                </Badge>
                {session && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Access Token: {session.access_token ? 'Present' : 'Missing'}</p>
                    <p>Expires: {new Date(session.expires_at! * 1000).toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div>
                <Badge variant={user ? 'default' : 'secondary'}>
                  User: {user ? 'Authenticated' : 'Anonymous'}
                </Badge>
                {user && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Email: {user.email}</p>
                    <p>Confirmed: {user.email_confirmed_at ? 'Yes' : 'No'}</p>
                    <p>ID: {user.id.substring(0, 8)}...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Test Actions */}
          <div>
            <h3 className="font-semibold mb-2">Test Actions</h3>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={testConnection} variant="outline" size="sm">
                Test Connection
              </Button>
              {user && (
                <Button onClick={testSignOut} variant="outline" size="sm">
                  Test Sign Out
                </Button>
              )}
              <Button 
                onClick={() => window.location.href = '/auth'} 
                variant="outline" 
                size="sm"
              >
                Go to Auth Page
              </Button>
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <h3 className="font-semibold mb-2">Recent Auth Events</h3>
            <div className="bg-gray-50 p-3 rounded-md max-h-40 overflow-y-auto">
              {authEvents.length > 0 ? (
                <div className="space-y-1">
                  {authEvents.map((event, index) => (
                    <div key={index} className="text-sm font-mono text-gray-700">
                      {event}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No events yet</p>
              )}
            </div>
          </div>

          {/* Configuration Issues */}
          {(!supabaseConfig?.url || supabaseConfig?.anonKey !== 'Set') && (
            <Alert>
              <AlertDescription>
                <strong>Configuration Issue:</strong> Missing Supabase environment variables.
                <br />
                Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment.
              </AlertDescription>
            </Alert>
          )}

          {/* Authentication Issues */}
          {user && !user.email_confirmed_at && (
            <Alert>
              <AlertDescription>
                <strong>Email Not Confirmed:</strong> User email has not been confirmed.
                <br />
                Check email for confirmation link or disable email confirmation in Supabase settings.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Raw Data (for debugging) */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 Raw Debug Data</CardTitle>
          <CardDescription>Technical details for troubleshooting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-1">Environment Variables</h4>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify({
                  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'Not set',
                  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set (hidden)' : 'Not set',
                  MODE: import.meta.env.MODE,
                  DEV: import.meta.env.DEV,
                  PROD: import.meta.env.PROD,
                }, null, 2)}
              </pre>
            </div>
            
            {session && (
              <div>
                <h4 className="font-medium mb-1">Session Data</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify({
                    access_token: session.access_token ? 'Present (hidden)' : 'Missing',
                    refresh_token: session.refresh_token ? 'Present (hidden)' : 'Missing',
                    expires_at: session.expires_at,
                    token_type: session.token_type,
                    provider_token: session.provider_token,
                  }, null, 2)}
                </pre>
              </div>
            )}

            {user && (
              <div>
                <h4 className="font-medium mb-1">User Data</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify({
                    id: user.id,
                    email: user.email,
                    email_confirmed_at: user.email_confirmed_at,
                    phone: user.phone,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                    app_metadata: user.app_metadata,
                    user_metadata: user.user_metadata,
                  }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};