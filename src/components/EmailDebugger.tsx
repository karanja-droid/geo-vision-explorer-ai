import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const EmailDebugger = () => {
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (type: string, data: any) => {
    setResults(prev => [...prev, { 
      type, 
      data, 
      timestamp: new Date().toISOString() 
    }]);
  };

  const testSupabaseConnection = async () => {
    setLoading(true);
    addResult('info', 'Testing Supabase connection...');
    
    try {
      const { data, error } = await supabase.auth.getSession();
      addResult('connection', { 
        success: !error, 
        error: error?.message,
        hasSession: !!data.session 
      });
    } catch (err) {
      addResult('connection', { 
        success: false, 
        error: err.message 
      });
    }
    setLoading(false);
  };

  const testSignup = async () => {
    if (!email) {
      addResult('error', 'Please enter an email address');
      return;
    }

    setLoading(true);
    addResult('info', `Testing signup for: ${email}`);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: 'TestPassword123!',
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            display_name: 'Test User',
            role: 'geologist'
          }
        }
      });

      addResult('signup', {
        success: !error,
        error: error?.message,
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: data.user.email_confirmed_at,
          createdAt: data.user.created_at
        } : null,
        session: !!data.session
      });

    } catch (err) {
      addResult('signup', { 
        success: false, 
        error: err.message 
      });
    }
    setLoading(false);
  };

  const testMagicLink = async () => {
    if (!email) {
      addResult('error', 'Please enter an email address');
      return;
    }

    setLoading(true);
    addResult('info', `Testing magic link for: ${email}`);
    
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      addResult('magiclink', {
        success: !error,
        error: error?.message,
        data
      });

    } catch (err) {
      addResult('magiclink', { 
        success: false, 
        error: err.message 
      });
    }
    setLoading(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Email Debug Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="test@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={testSupabaseConnection}
            disabled={loading}
            variant="outline"
          >
            Test Connection
          </Button>
          <Button 
            onClick={testSignup}
            disabled={loading || !email}
          >
            Test Signup
          </Button>
          <Button 
            onClick={testMagicLink}
            disabled={loading || !email}
            variant="outline"
          >
            Test Magic Link
          </Button>
          <Button 
            onClick={clearResults}
            variant="destructive"
            size="sm"
          >
            Clear
          </Button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.map((result, index) => (
            <Alert key={index} className={
              result.type === 'error' ? 'border-red-500' :
              result.type === 'info' ? 'border-blue-500' :
              result.data?.success === false ? 'border-red-500' :
              'border-green-500'
            }>
              <AlertDescription>
                <div className="text-xs text-muted-foreground mb-1">
                  {result.timestamp} - {result.type}
                </div>
                <pre className="text-xs whitespace-pre-wrap">
                  {typeof result.data === 'string' 
                    ? result.data 
                    : JSON.stringify(result.data, null, 2)
                  }
                </pre>
              </AlertDescription>
            </Alert>
          ))}
        </div>

        <Alert>
          <AlertDescription>
            <strong>Instructions:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Enter a test email address</li>
              <li>Click "Test Connection" to verify Supabase is working</li>
              <li>Click "Test Signup" to see what happens during signup</li>
              <li>Check the results below for detailed error information</li>
              <li>Share the results with support for debugging</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};