import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type CallbackStatus = 'loading' | 'success' | 'error';

export const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          setError(error.message);
          setStatus('error');
          return;
        }

        // Check if user is authenticated
        if (data.session?.user) {
          const user = data.session.user;
          
          // Check if email is confirmed
          if (user.email_confirmed_at) {
            setStatus('success');
            
            toast({
              title: 'Email verified successfully!',
              description: 'Your account has been verified. You can now access all features.',
            });

            // Get redirect URL from params or default to dashboard
            const redirectTo = searchParams.get('redirect') || '/dashboard';
            
            // Redirect after a short delay
            setTimeout(() => {
              navigate(redirectTo, { replace: true });
            }, 2000);
          } else {
            setError('Email verification is still pending. Please check your email.');
            setStatus('error');
          }
        } else {
          // Handle the case where there's no session but we might have auth tokens in URL
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Set the session manually
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              setError(sessionError.message);
              setStatus('error');
              return;
            }

            if (sessionData.user?.email_confirmed_at) {
              setStatus('success');
              toast({
                title: 'Email verified successfully!',
              });
              
              const redirectTo = searchParams.get('redirect') || '/dashboard';
              setTimeout(() => {
                navigate(redirectTo, { replace: true });
              }, 2000);
            } else {
              setError('Email verification failed. Please try again.');
              setStatus('error');
            }
          } else {
            setError('No authentication data found. Please try signing up again.');
            setStatus('error');
          }
        }
      } catch (err) {
        console.error('Unexpected error in auth callback:', err);
        setError('An unexpected error occurred during verification.');
        setStatus('error');
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams, toast]);

  const handleReturnToAuth = () => {
    navigate('/auth', { replace: true });
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            {status === 'loading' && <LoadingSpinner size="lg" />}
            {status === 'success' && <CheckCircle className="w-8 h-8 text-green-600" />}
            {status === 'error' && <XCircle className="w-8 h-8 text-red-600" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {status === 'loading' && 'Verifying your email...'}
              {status === 'success' && 'Email verified!'}
              {status === 'error' && 'Verification failed'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {status === 'loading' && 'Please wait while we verify your email address'}
              {status === 'success' && 'Your account has been successfully verified'}
              {status === 'error' && 'There was a problem verifying your email'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {status === 'loading' && (
            <div className="text-center">
              <p className="text-muted-foreground">
                This should only take a moment...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  Welcome to GeoMiner! You'll be redirected to your dashboard shortly.
                </p>
              </div>
              
              <Button
                onClick={handleGoToDashboard}
                className="w-full"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-destructive text-sm mb-4">
                  {error}
                </p>
              </div>
              
              <div className="space-y-3">
                <Button
                  onClick={handleReturnToAuth}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;