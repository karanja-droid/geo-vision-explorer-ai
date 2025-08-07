import { supabase } from '@/integrations/supabase/client';

export interface SecurityValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export class SecurityValidator {
  /**
   * Validate that all tables have RLS enabled
   */
  static async validateRLS(): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      const { data: rlsStatus, error } = await supabase.rpc('check_rls_status');
      
      if (error) {
        result.passed = false;
        result.errors.push(`Failed to check RLS status: ${error.message}`);
        return result;
      }

      const tablesWithoutRLS = rlsStatus?.filter((table: any) => !table.rls_enabled) || [];
      const tablesWithoutPolicies = rlsStatus?.filter((table: any) => table.rls_enabled && table.policy_count === 0) || [];

      if (tablesWithoutRLS.length > 0) {
        result.passed = false;
        result.errors.push(`Tables without RLS: ${tablesWithoutRLS.map((t: any) => t.table_name).join(', ')}`);
      }

      if (tablesWithoutPolicies.length > 0) {
        result.warnings.push(`Tables with RLS but no policies: ${tablesWithoutPolicies.map((t: any) => t.table_name).join(', ')}`);
      }

      result.recommendations.push('Regularly audit RLS policies to ensure they match business requirements');

    } catch (error) {
      result.passed = false;
      result.errors.push(`RLS validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Validate encryption implementation
   */
  static async validateEncryption(): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      // Check if sensitive data is encrypted
      const { data: projectsWithUnencryptedData } = await supabase
        .from('projects')
        .select('id, budget')
        .not('budget', 'is', null)
        .is('budget_encrypted', null)
        .limit(5);

      if (projectsWithUnencryptedData && projectsWithUnencryptedData.length > 0) {
        result.warnings.push('Some projects have unencrypted budget data');
        result.recommendations.push('Encrypt sensitive financial data in the budget field');
      }

      // Check for recent key rotations
      const { data: recentKeyRotations } = await supabase
        .from('audit_logs')
        .select('timestamp')
        .eq('operation', 'KEY_ROTATION')
        .gte('timestamp', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
        .limit(1);

      if (!recentKeyRotations || recentKeyRotations.length === 0) {
        result.warnings.push('No recent encryption key rotations detected');
        result.recommendations.push('Rotate encryption keys every 90 days');
      }

      result.recommendations.push('Use strong, randomly generated encryption keys');
      result.recommendations.push('Store encryption keys securely using a key management service');

    } catch (error) {
      result.errors.push(`Encryption validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Validate audit logging
   */
  static async validateAuditLogging(): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      // Check if audit logging is working
      const { data: recentLogs } = await supabase
        .from('audit_logs')
        .select('id, timestamp')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .limit(10);

      if (!recentLogs || recentLogs.length === 0) {
        result.warnings.push('No recent audit logs found');
        result.recommendations.push('Verify audit triggers are properly configured');
      }

      // Check for suspicious activity patterns
      const { data: suspiciousActivity } = await supabase
        .from('audit_logs')
        .select('user_id, operation, table_name, timestamp')
        .in('operation', ['DELETE', 'UPDATE'])
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (suspiciousActivity && suspiciousActivity.length > 20) {
        result.warnings.push('High number of data modifications detected in the last 24 hours');
        result.recommendations.push('Review recent data modification activities');
      }

      result.recommendations.push('Regularly review audit logs for suspicious activity');
      result.recommendations.push('Set up alerts for critical operations');

    } catch (error) {
      result.errors.push(`Audit logging validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Validate rate limiting
   */
  static async validateRateLimiting(): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      // Check for rate limit violations
      const { data: rateLimitViolations } = await supabase
        .from('rate_limits')
        .select('user_id, endpoint, request_count')
        .gt('request_count', 25) // Above normal threshold
        .gte('window_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(10);

      if (rateLimitViolations && rateLimitViolations.length > 0) {
        result.warnings.push(`${rateLimitViolations.length} rate limit violations detected in the last 24 hours`);
        result.recommendations.push('Review rate limiting policies and user behavior');
      }

      result.recommendations.push('Implement progressive rate limiting for repeat offenders');
      result.recommendations.push('Monitor API usage patterns for anomalies');

    } catch (error) {
      result.errors.push(`Rate limiting validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Validate user permissions and roles
   */
  static async validateUserPermissions(): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      // Check for users without proper roles
      const { data: usersWithoutRoles } = await supabase
        .from('profiles')
        .select('id, role')
        .is('role', null)
        .limit(5);

      if (usersWithoutRoles && usersWithoutRoles.length > 0) {
        result.warnings.push(`${usersWithoutRoles.length} users without assigned roles`);
        result.recommendations.push('Assign appropriate roles to all users');
      }

      // Check for excessive admin users
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 3) {
        result.warnings.push('High number of admin users detected');
        result.recommendations.push('Review admin access and apply principle of least privilege');
      }

      result.recommendations.push('Regularly review user permissions and roles');
      result.recommendations.push('Implement role-based access control consistently');

    } catch (error) {
      result.errors.push(`User permissions validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Run comprehensive security validation
   */
  static async runComprehensiveValidation(): Promise<{
    overall: boolean;
    results: Record<string, SecurityValidationResult>;
  }> {
    const validations = {
      'Row Level Security': await this.validateRLS(),
      'Encryption': await this.validateEncryption(),
      'Audit Logging': await this.validateAuditLogging(),
      'Rate Limiting': await this.validateRateLimiting(),
      'User Permissions': await this.validateUserPermissions()
    };

    const overall = Object.values(validations).every(result => result.passed);

    return {
      overall,
      results: validations
    };
  }
}

/**
 * Security testing utilities for CI/CD
 */
export class SecurityTestRunner {
  /**
   * Test that can be run in CI/CD to ensure security measures are in place
   */
  static async runSecurityTests(): Promise<{
    passed: boolean;
    summary: string;
    details: any;
  }> {
    const validation = await SecurityValidator.runComprehensiveValidation();
    
    const totalErrors = Object.values(validation.results)
      .reduce((sum, result) => sum + result.errors.length, 0);
    
    const totalWarnings = Object.values(validation.results)
      .reduce((sum, result) => sum + result.warnings.length, 0);

    return {
      passed: validation.overall && totalErrors === 0,
      summary: `Security validation ${validation.overall ? 'PASSED' : 'FAILED'}: ${totalErrors} errors, ${totalWarnings} warnings`,
      details: validation.results
    };
  }
}