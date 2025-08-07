import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Play,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { SecurityValidator, SecurityValidationResult } from '@/utils/securityValidation';

interface ValidationResults {
  [key: string]: SecurityValidationResult;
}

export const SecurityValidationPanel: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ValidationResults>({});
  const [overallPassed, setOverallPassed] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);

  const validationTests = [
    { key: 'rls', name: 'Row Level Security', validator: SecurityValidator.validateRLS },
    { key: 'encryption', name: 'Encryption', validator: SecurityValidator.validateEncryption },
    { key: 'audit', name: 'Audit Logging', validator: SecurityValidator.validateAuditLogging },
    { key: 'rate', name: 'Rate Limiting', validator: SecurityValidator.validateRateLimiting },
    { key: 'permissions', name: 'User Permissions', validator: SecurityValidator.validateUserPermissions }
  ];

  const runValidation = async () => {
    setRunning(true);
    setProgress(0);
    const newResults: ValidationResults = {};

    for (let i = 0; i < validationTests.length; i++) {
      const test = validationTests[i];
      try {
        newResults[test.key] = await test.validator();
      } catch (error) {
        newResults[test.key] = {
          passed: false,
          errors: [`Failed to run validation: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: [],
          recommendations: []
        };
      }
      setProgress(((i + 1) / validationTests.length) * 100);
    }

    setResults(newResults);
    setOverallPassed(Object.values(newResults).every(result => result.passed));
    setRunning(false);
  };

  const getStatusIcon = (result?: SecurityValidationResult) => {
    if (!result) return <Shield className="h-4 w-4 text-gray-400" />;
    if (result.passed) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (result?: SecurityValidationResult) => {
    if (!result) return <Badge variant="secondary">Pending</Badge>;
    if (result.passed) return <Badge variant="default" className="bg-green-600">Passed</Badge>;
    return <Badge variant="destructive">Failed</Badge>;
  };

  const getTotalIssues = () => {
    const errors = Object.values(results).reduce((sum, result) => sum + result.errors.length, 0);
    const warnings = Object.values(results).reduce((sum, result) => sum + result.warnings.length, 0);
    return { errors, warnings };
  };

  const { errors: totalErrors, warnings: totalWarnings } = getTotalIssues();

  return (
    <div className="space-y-6">
      {/* Validation Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Validation
          </CardTitle>
          <CardDescription>
            Run comprehensive security tests to validate your database configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={runValidation} disabled={running}>
              {running ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running Validation...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Security Validation
                </>
              )}
            </Button>

            {overallPassed !== null && (
              <div className="flex items-center gap-2">
                {overallPassed ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-medium ${overallPassed ? 'text-green-600' : 'text-red-600'}`}>
                  {overallPassed ? 'All Tests Passed' : 'Validation Failed'}
                </span>
              </div>
            )}
          </div>

          {running && (
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Running security validation tests... {Math.round(progress)}% complete
              </p>
            </div>
          )}

          {Object.keys(results).length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{totalErrors}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{totalWarnings}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {validationTests.map((test) => {
            const result = results[test.key];
            return (
              <Card key={test.key}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result)}
                      {test.name}
                    </div>
                    {getStatusBadge(result)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result?.errors.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="font-medium text-red-600 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Errors ({result.errors.length})
                      </h4>
                      {result.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}

                  {result?.warnings.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="font-medium text-yellow-600 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Warnings ({result.warnings.length})
                      </h4>
                      {result.warnings.map((warning, index) => (
                        <Alert key={index}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{warning}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}

                  {result?.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-blue-600 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Recommendations ({result.recommendations.length})
                      </h4>
                      <div className="space-y-1">
                        {result.recommendations.map((recommendation, index) => (
                          <div key={index} className="text-sm text-muted-foreground p-2 bg-blue-50 rounded">
                            • {recommendation}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result?.passed && result.errors.length === 0 && result.warnings.length === 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>All security checks passed for this component</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};