import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRolePermissions, ROLE_LABELS } from '@/hooks/useRolePermissions';
import { useProfiles } from '@/hooks/useProfiles';
import { BackupCodesModal } from './BackupCodesModal';
import { Shield, Smartphone, Key, AlertTriangle, Clock, Monitor } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const SecuritySettings = () => {
  const { profile } = useProfiles();
  const { mfaSettings, userSessions, enableMFA, disableMFA, revokeSession, loading } = useRolePermissions();
  const [isEnablingMFA, setIsEnablingMFA] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  
  // Generate cryptographically secure TOTP secret
  const [totpSecret] = useState(() => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(36)).join('').substring(0, 16);
  });

  const handleEnableMFA = async () => {
    setIsEnablingMFA(true);
    try {
      const result = await enableMFA(totpSecret, recoveryEmail);
      if (result?.success && result.backupCodes) {
        setBackupCodes(result.backupCodes);
        setShowBackupCodes(true);
      }
    } catch (error) {
      console.error('Failed to enable MFA:', error);
    } finally {
      setIsEnablingMFA(false);
    }
  };

  const handleDisableMFA = async () => {
    if (confirm('Are you sure you want to disable MFA? This will reduce your account security.')) {
      await disableMFA();
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to revoke this session?')) {
      await revokeSession(sessionId);
    }
  };

  if (loading) {
    return <div className="space-y-6">Loading security settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Role Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User Role & Permissions
          </CardTitle>
          <CardDescription>
            Your current role determines what actions you can perform in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Label>Current Role</Label>
              <div className="mt-1">
                <Badge variant="secondary" className="text-sm">
                  {profile?.role ? ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || profile.role : 'Loading...'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>MFA Status</Label>
              <p className="text-sm text-muted-foreground">
                {mfaSettings?.mfa_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Switch
              checked={mfaSettings?.mfa_enabled || false}
              onCheckedChange={() => {
                if (mfaSettings?.mfa_enabled) {
                  handleDisableMFA();
                } else {
                  handleEnableMFA();
                }
              }}
              disabled={isEnablingMFA}
            />
          </div>

          {!mfaSettings?.mfa_enabled && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Enable MFA to significantly improve your account security. You'll need an authenticator app.
                </AlertDescription>
              </Alert>
              
              <div>
                <Label htmlFor="recovery-email">Recovery Email (Optional)</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  placeholder="backup@email.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleEnableMFA} 
                disabled={isEnablingMFA}
                className="w-full"
              >
                {isEnablingMFA ? 'Enabling MFA...' : 'Enable MFA'}
              </Button>
            </div>
          )}

          {mfaSettings?.mfa_enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Backup Codes Available</span>
                <Badge variant="outline">
                  {mfaSettings.backup_codes?.length || 0} codes
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Recovery Email</span>
                <span className="text-muted-foreground">
                  {mfaSettings.recovery_email || 'Not set'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active login sessions across devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active sessions found</p>
            ) : (
              userSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={session.is_active ? "default" : "secondary"}>
                        {session.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {session.mfa_verified && (
                        <Badge variant="outline" className="text-green-600">
                          <Shield className="h-3 w-3 mr-1" />
                          MFA Verified
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>IP: {session.ip_address || 'Unknown'}</div>
                      <div>User Agent: {session.user_agent || 'Unknown'}</div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last active: {formatDistanceToNow(new Date(session.last_activity), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  {session.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password Security
          </CardTitle>
          <CardDescription>
            Manage your account password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full">
            Change Password
          </Button>
        </CardContent>
      </Card>

      <BackupCodesModal
        isOpen={showBackupCodes}
        onClose={() => setShowBackupCodes(false)}
        backupCodes={backupCodes}
      />
    </div>
  );
};