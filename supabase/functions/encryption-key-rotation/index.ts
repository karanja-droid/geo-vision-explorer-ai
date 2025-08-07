import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeyRotationRequest {
  force_rotation?: boolean;
  dry_run?: boolean;
}

interface KeyRotationResult {
  success: boolean;
  rotated_keys: Array<{
    old_key_id: string;
    new_key_id: string;
    purpose: string;
  }>;
  errors: Array<{
    key_id: string;
    error: string;
  }>;
  total_rotated: number;
  warnings: string[];
  timestamp: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Verify authentication for manual requests
    const authHeader = req.headers.get('authorization');
    let isAutomatedRequest = false;
    let requestingUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // Check if this is the cron job token (for automated requests)
      if (token === Deno.env.get('CRON_SECRET_TOKEN')) {
        isAutomatedRequest = true;
        console.log('Automated key rotation request received');
      } else {
        // Verify user token for manual requests
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        
        if (userError || !userData.user) {
          return new Response(
            JSON.stringify({ error: 'Invalid user token' }),
            { status: 401, headers: corsHeaders }
          );
        }

        requestingUserId = userData.user.id;

        // Check if user is admin for manual rotation
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', userData.user.id)
          .single();

        if (profile?.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Admin access required for manual key rotation' }),
            { status: 403, headers: corsHeaders }
          );
        }
      }
    } else if (!isAutomatedRequest) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    let requestData: KeyRotationRequest = {};
    try {
      if (req.body) {
        requestData = await req.json();
      }
    } catch (error) {
      console.log('No request body or invalid JSON, using defaults');
    }

    const { force_rotation = false, dry_run = false } = requestData;

    console.log(`Starting key rotation - Force: ${force_rotation}, Dry run: ${dry_run}, Automated: ${isAutomatedRequest}`);

    // Check which keys need rotation
    const { data: keysNeedingRotation, error: checkError } = await supabase
      .rpc('check_key_rotation_needed');

    if (checkError) {
      console.error('Error checking keys for rotation:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check key rotation status', details: checkError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const result: KeyRotationResult = {
      success: false,
      rotated_keys: [],
      errors: [],
      total_rotated: 0,
      warnings: [],
      timestamp: new Date().toISOString()
    };

    // Log pre-rotation status
    console.log(`Found ${keysNeedingRotation?.length || 0} keys needing rotation`);
    
    if (keysNeedingRotation && keysNeedingRotation.length > 0) {
      for (const key of keysNeedingRotation) {
        console.log(`Key ${key.key_id} expires at ${key.expires_at} (${key.days_remaining} days remaining)`);
      }
    }

    if (dry_run) {
      // Return what would be rotated without actually doing it
      result.success = true;
      result.warnings.push(`DRY RUN: Would rotate ${keysNeedingRotation?.length || 0} keys`);
      
      if (keysNeedingRotation) {
        for (const key of keysNeedingRotation) {
          result.warnings.push(`Would rotate key: ${key.key_id} (expires: ${key.expires_at})`);
        }
      }

      return new Response(
        JSON.stringify(result),
        { headers: corsHeaders }
      );
    }

    // Perform actual key rotation
    const { data: rotationResult, error: rotationError } = await supabase
      .rpc('rotate_encryption_keys', { force_rotation });

    if (rotationError) {
      console.error('Key rotation failed:', rotationError);
      result.errors.push({
        key_id: 'system',
        error: rotationError.message
      });
      
      return new Response(
        JSON.stringify(result),
        { status: 500, headers: corsHeaders }
      );
    }

    // Parse rotation results
    if (rotationResult) {
      result.success = true;
      result.rotated_keys = rotationResult.rotated_keys || [];
      result.errors = rotationResult.errors || [];
      result.total_rotated = rotationResult.total_rotated || 0;

      console.log(`Key rotation completed successfully. Rotated ${result.total_rotated} keys.`);
      
      if (result.errors.length > 0) {
        console.warn(`Rotation completed with ${result.errors.length} errors:`, result.errors);
      }
    }

    // Log audit trail for manual requests
    if (!isAutomatedRequest && requestingUserId) {
      await supabase.from('audit_logs').insert({
        table_name: 'encryption_keys',
        operation: 'MANUAL_KEY_ROTATION',
        user_id: requestingUserId,
        new_data: {
          force_rotation,
          result: result,
          timestamp: result.timestamp
        }
      });
    }

    // Send notification if keys were rotated
    if (result.total_rotated > 0) {
      console.log(`Successfully rotated ${result.total_rotated} encryption keys`);
      
      // Add warning if we're close to next rotation
      const nextRotationDate = new Date();
      nextRotationDate.setDate(nextRotationDate.getDate() + 83); // 7 days before 90-day expiry
      
      result.warnings.push(`Next automated rotation check: ${nextRotationDate.toISOString()}`);
    } else if (!force_rotation) {
      result.warnings.push('No keys required rotation at this time');
    }

    return new Response(
      JSON.stringify(result),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Encryption key rotation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Key rotation failed', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});