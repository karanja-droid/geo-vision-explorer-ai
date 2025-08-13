import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const EmailTest = () => {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testSignup = async () => {
    if (!email) return;
    
    setLoading(true);
    setResult('Testing...');
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: 'TestPassword123!',
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      if (error) {
        setResult(`❌ Error: ${error.message}`);
      } else if (data.user && !data.session) {
        setResult(`✅ User created! Check email: ${email}\nUser ID: ${data.user.id}\nEmail confirmed: ${data.user.email_confirmed_at || 'No'}`);
      } else if (data.session) {
        setResult(`✅ User signed up and logged in automatically (email confirmation disabled)`);
      }
    } catch (err) {
      setResult(`❌ Unexpected error: ${err.message}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Test Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="email"
            placeholder="test@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button 
            onClick={testSignup}
            disabled={loading || !email}
            className="w-full"
          >
            {loading ? 'Testing...' : 'Test Signup'}
          </Button>
          
          {result && (
            <Alert>
              <AlertDescription>
                <pre className="whitespace-pre-wrap text-sm">{result}</pre>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-sm text-muted-foreground">
            <p><strong>Instructions:</strong></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter a test email</li>
              <li>Click "Test Signup"</li>
              <li>Check the result message</li>
              <li>If successful, check your email (including spam)</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailTest;