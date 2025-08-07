import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  Key, 
  Database,
  RefreshCw,
  Lock,
  Users,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const SecurityDashboard = () => {
  const { 
    loading, 
    report, 
    summary, 
    generateAuditReport, 
    checkRLSStatus, 
    getAuditLogs,
    rotateEncryptionKey 
  } = useSecurityAudit();
  
  const { userSessions, loading: sessionsLoading } = useRolePermissions();
  const [rlsStatus, setRlsStatus] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [keyRotationKey, setKeyRotationKey] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const [rlsData, logsData] = await Promise.all([
      checkRLSStatus(),
      getAuditLogs(20)
    ]);
    setRlsStatus(rlsData);
    setAuditLogs(logsData);
  };

  const handleKeyRotation = async () => {
    if (!keyRotationKey.trim()) {
      return;
    }

    const newKey = crypto.getRandomValues(new Uint8Array(32))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

    const success = await rotateEncryptionKey(keyRotationKey, newKey);
    if (success) {
      setKeyRotationKey('');
      await loadInitialData(); // Refresh data
    }
  };

  const getSecurityScore = () => {
    if (!summary) return 0;
    
    const totalChecks = 5;
    let score = 0;
    
    // RLS enabled on all tables
    if (summary.tables_without_rls === 0) score += 1;
    
    // No recent security violations
    if (summary.rate_limit_violations === 0) score += 1;
    
    // Encryption enabled
    if (summary.encrypted_tables > 0) score += 1;
    
    // Recent security events under control
    if (summary.recent_security_events < 10) score += 1;
    
    // Active monitoring
    if (report?.timestamp) score += 1;
    
    return Math.round((score / totalChecks) * 100);
  };

  const getSecurityLevel = (score: number) => {
    if (score >= 80) return { level: 'High', color: 'text-green-600', icon: CheckCircle };
    if (score >= 60) return { level: 'Medium', color: 'text-yellow-600', icon: AlertTriangle };
    return { level: 'Low', color: 'text-red-600', icon: AlertTriangle };
  };

  const securityScore = getSecurityScore();
  const securityLevel = getSecurityLevel(securityScore);
  const SecurityIcon = securityLevel.icon;

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityScore}%</div>
            <div className={`text-xs flex items-center gap-1 ${securityLevel.color}`}>
              <SecurityIcon className="h-3 w-3" />
              {securityLevel.level} Security
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tables with RLS</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? summary.total_tables_checked - summary.tables_without_rls : '-'}
              {summary && `/${summary.total_tables_checked}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Row Level Security enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessionsLoading ? '-' : userSessions.filter(s => s.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Current user sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.recent_security_events || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Audit Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Audit
          </CardTitle>
          <CardDescription>
            Generate comprehensive security reports and monitor system health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={generateAuditReport} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Generate Audit Report
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={loadInitialData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>

          {report?.timestamp && (
            <p className="text-sm text-muted-foreground mt-2">
              Last audit: {formatDistanceToNow(new Date(report.timestamp), { addSuffix: true })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detailed Security Information */}
      <Tabs defaultValue="rls" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rls">RLS Status</TabsTrigger>
          <TabsTrigger value="encryption">Encryption</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>

        <TabsContent value="rls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Row Level Security Status</CardTitle>
              <CardDescription>
                RLS enforcement status for all database tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rlsStatus.map((table) => (
                  <div key={table.table_name} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="font-medium">{table.table_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={table.rls_enabled ? "default" : "destructive"}>
                        {table.rls_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {table.policy_count} policies
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encryption" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Encryption Management</CardTitle>
              <CardDescription>
                Manage encryption keys and view encryption status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary && summary.encrypted_tables > 0 && (
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    {summary.encrypted_tables} tables have encrypted columns enabled
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Current Encryption Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyRotationKey}
                    onChange={(e) => setKeyRotationKey(e.target.value)}
                    placeholder="Enter current encryption key"
                    className="flex-1 px-3 py-2 border rounded-md"
                  />
                  <Button onClick={handleKeyRotation} disabled={!keyRotationKey.trim()}>
                    <Key className="h-4 w-4 mr-2" />
                    Rotate Key
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Key rotation will re-encrypt all sensitive data with a new key
                </p>
              </div>

              {report?.encryption_status.key_rotation_history.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recent Key Rotations</h4>
                  <div className="space-y-1">
                    {report.encryption_status.key_rotation_history.map((rotation, index) => (
                      <div key={index} className="text-sm flex items-center justify-between p-2 bg-muted rounded">
                        <span>{formatDistanceToNow(new Date(rotation.timestamp), { addSuffix: true })}</span>
                        <span>Tables: {rotation.tables_affected.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Activity</CardTitle>
              <CardDescription>
                Security-related events and system activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span className="font-medium">{log.operation}</span>
                      <span className="text-sm text-muted-foreground">on {log.table_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Violations</CardTitle>
              <CardDescription>
                Rate limiting and access violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report?.rate_limit_violations.length ? (
                <div className="space-y-2">
                  {report.rate_limit_violations.map((violation, index) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        User {violation.user_id.slice(0, 8)}... exceeded rate limit on {violation.endpoint} 
                        ({violation.violation_count} violations, last: {formatDistanceToNow(new Date(violation.last_violation), { addSuffix: true })})
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No security violations detected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};