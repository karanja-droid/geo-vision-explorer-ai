import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityAuditReport {
  timestamp: string;
  rls_status: Array<{
    table_name: string;
    rls_enabled: boolean;
    policy_count: number;
  }>;
  recent_security_events: Array<{
    event_type: string;
    table_name: string;
    user_id: string;
    timestamp: string;
    details: any;
  }>;
  encryption_status: {
    encrypted_tables: string[];
    key_rotation_history: Array<{
      timestamp: string;
      tables_affected: string[];
    }>;
  };
  rate_limit_violations: Array<{
    user_id: string;
    endpoint: string;
    violation_count: number;
    last_violation: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify user is admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Generate comprehensive security audit report
    const report: SecurityAuditReport = {
      timestamp: new Date().toISOString(),
      rls_status: [],
      recent_security_events: [],
      encryption_status: {
        encrypted_tables: [],
        key_rotation_history: []
      },
      rate_limit_violations: []
    };

    // 1. Check RLS status on all tables
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('check_rls_status');
    if (!rlsError && rlsStatus) {
      report.rls_status = rlsStatus.map((row: any) => ({
        table_name: row.table_name,
        rls_enabled: row.rls_enabled,
        policy_count: parseInt(row.policy_count)
      }));
    }

    // 2. Get recent security events from audit logs
    const { data: securityEvents } = await supabase
      .from('audit_logs')
      .select('*')
      .in('operation', ['KEY_ROTATION', 'PRIVILEGE_ESCALATION', 'FAILED_AUTH'])
      .order('timestamp', { ascending: false })
      .limit(50);

    if (securityEvents) {
      report.recent_security_events = securityEvents.map((event: any) => ({
        event_type: event.operation,
        table_name: event.table_name,
        user_id: event.user_id,
        timestamp: event.timestamp,
        details: event.new_data
      }));
    }

    // 3. Check encryption status
    const { data: encryptedProjects } = await supabase
      .from('projects')
      .select('id')
      .not('contract_terms_encrypted', 'is', null);

    const { data: encryptedProfiles } = await supabase
      .from('profiles')
      .select('id')
      .not('phone_encrypted', 'is', null);

    report.encryption_status.encrypted_tables = [];
    if (encryptedProjects?.length) report.encryption_status.encrypted_tables.push('projects');
    if (encryptedProfiles?.length) report.encryption_status.encrypted_tables.push('profiles');

    // Get key rotation history
    const { data: keyRotations } = await supabase
      .from('audit_logs')
      .select('timestamp, new_data')
      .eq('operation', 'KEY_ROTATION')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (keyRotations) {
      report.encryption_status.key_rotation_history = keyRotations.map((rotation: any) => ({
        timestamp: rotation.timestamp,
        tables_affected: rotation.new_data?.rotated_tables || []
      }));
    }

    // 4. Check for rate limit violations
    const { data: rateLimitViolations } = await supabase
      .from('rate_limits')
      .select('user_id, endpoint, request_count, window_start')
      .gt('request_count', 25) // Above normal threshold
      .order('window_start', { ascending: false })
      .limit(100);

    if (rateLimitViolations) {
      const violationSummary = rateLimitViolations.reduce((acc: any, violation: any) => {
        const key = `${violation.user_id}-${violation.endpoint}`;
        if (!acc[key]) {
          acc[key] = {
            user_id: violation.user_id,
            endpoint: violation.endpoint,
            violation_count: 0,
            last_violation: violation.window_start
          };
        }
        acc[key].violation_count += 1;
        if (new Date(violation.window_start) > new Date(acc[key].last_violation)) {
          acc[key].last_violation = violation.window_start;
        }
        return acc;
      }, {});

      report.rate_limit_violations = Object.values(violationSummary);
    }

    // Log the security audit request
    await supabase.from('audit_logs').insert({
      table_name: 'security_audit',
      operation: 'AUDIT_REPORT_GENERATED',
      user_id: userData.user.id,
      new_data: { 
        report_sections: Object.keys(report),
        timestamp: report.timestamp
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        report,
        summary: {
          total_tables_checked: report.rls_status.length,
          tables_without_rls: report.rls_status.filter(t => !t.rls_enabled).length,
          recent_security_events: report.recent_security_events.length,
          encrypted_tables: report.encryption_status.encrypted_tables.length,
          rate_limit_violations: report.rate_limit_violations.length
        }
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Security audit error:', error);
    return new Response(
      JSON.stringify({ error: 'Security audit failed', details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});