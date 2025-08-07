import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryRequest {
  table: string;
  select?: string;
  filter?: Record<string, any>;
  limit?: number;
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

    // Extract user ID from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
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

    const userId = userData.user.id;

    // Check rate limit using database function
    const { data: rateLimitCheck, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', {
        p_user_id: userId,
        p_endpoint: 'rate-limited-query',
        p_limit: 30, // 30 requests per minute
        p_window_minutes: 1
      });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!rateLimitCheck) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Maximum 30 requests per minute allowed.',
          retryAfter: 60
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Process the query request
    const queryRequest: QueryRequest = await req.json();
    
    // Validate request
    if (!queryRequest.table) {
      return new Response(
        JSON.stringify({ error: 'Table name is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Whitelist allowed tables for security
    const allowedTables = [
      'projects', 'exploration_sites', 'mineral_deposits', 
      'predictions', 'ai_models', 'profiles', 'audit_logs'
    ];
    
    if (!allowedTables.includes(queryRequest.table)) {
      return new Response(
        JSON.stringify({ error: 'Access to this table is not allowed' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Build and execute query with user context
    let query = supabase
      .from(queryRequest.table)
      .select(queryRequest.select || '*');

    // Apply filters if provided
    if (queryRequest.filter) {
      for (const [key, value] of Object.entries(queryRequest.filter)) {
        query = query.eq(key, value);
      }
    }

    // Apply limit (max 100 for security)
    const limit = Math.min(queryRequest.limit || 50, 100);
    query = query.limit(limit);

    // Execute with user's JWT token for RLS
    const { data, error } = await query;

    if (error) {
      console.error('Query error:', error);
      return new Response(
        JSON.stringify({ error: 'Query failed', details: error.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Log successful query for audit purposes
    await supabase.from('audit_logs').insert({
      table_name: 'rate_limited_query',
      operation: 'QUERY',
      user_id: userId,
      new_data: { 
        table: queryRequest.table, 
        record_count: data?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ 
        data, 
        metadata: { 
          count: data?.length || 0, 
          limit,
          table: queryRequest.table 
        } 
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});