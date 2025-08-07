-- ============================================================================
-- SECURITY FIXES FOR LINTER WARNINGS
-- ============================================================================

-- 1. Fix function search path issues by setting search_path explicitly
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data text, key_name text DEFAULT 'ENCRYPTION_KEY')
RETURNS bytea AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(current_setting('app.encryption_key', true), 'default_key_please_change');
  RETURN pgp_sym_encrypt(data, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data bytea, key_name text DEFAULT 'ENCRYPTION_KEY')
RETURNS text AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(current_setting('app.encryption_key', true), 'default_key_please_change');
  RETURN pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION_ERROR]';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
  changed_fields text[];
  user_agent_val text;
  session_id_val text;
BEGIN
  user_agent_val := current_setting('request.headers', true)::json->>'user-agent';
  session_id_val := current_setting('request.jwt.claims', true)::json->>'session_id';

  IF TG_OP = 'INSERT' THEN
    new_data = to_jsonb(NEW);
    old_data = NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data = to_jsonb(OLD);
    new_data = to_jsonb(NEW);
    SELECT array_agg(key) INTO changed_fields
    FROM jsonb_each(old_data) 
    WHERE value != (new_data->key) OR (new_data->key) IS NULL;
  ELSIF TG_OP = 'DELETE' THEN
    old_data = to_jsonb(OLD);
    new_data = NULL;
  END IF;

  INSERT INTO audit_logs (
    table_name, operation, user_id, old_data, new_data, 
    changed_fields, ip_address, user_agent, session_id
  ) VALUES (
    TG_TABLE_NAME, TG_OP, auth.uid(), old_data, new_data,
    changed_fields, inet_client_addr(), user_agent_val, session_id_val
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION check_rls_status()
RETURNS TABLE(table_name text, rls_enabled boolean, policy_count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    t.rowsecurity,
    COUNT(p.policyname)
  FROM pg_tables t
  LEFT JOIN pg_policies p ON t.tablename = p.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
  GROUP BY t.tablename, t.rowsecurity
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION rotate_encryption_key(old_key text, new_key text)
RETURNS void AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id, contract_terms_encrypted FROM projects 
             WHERE contract_terms_encrypted IS NOT NULL LOOP
    UPDATE projects 
    SET contract_terms_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.contract_terms_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;
  
  FOR rec IN SELECT id, budget_encrypted FROM projects 
             WHERE budget_encrypted IS NOT NULL LOOP
    UPDATE projects 
    SET budget_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.budget_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;

  FOR rec IN SELECT id, phone_encrypted FROM profiles 
             WHERE phone_encrypted IS NOT NULL LOOP
    UPDATE profiles 
    SET phone_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.phone_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;
  
  INSERT INTO audit_logs (table_name, operation, user_id, new_data)
  VALUES ('system', 'KEY_ROTATION', auth.uid(), 
          jsonb_build_object('timestamp', now(), 'rotated_tables', ARRAY['projects', 'profiles']));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_limit integer DEFAULT 10,
  p_window_minutes integer DEFAULT 1
)
RETURNS boolean AS $$
DECLARE
  current_count integer;
  window_start_time timestamp with time zone;
BEGIN
  window_start_time := date_trunc('minute', now()) - (floor(extract(minute from now()) / p_window_minutes) * p_window_minutes || ' minutes')::interval;
  
  SELECT COALESCE(request_count, 0) INTO current_count
  FROM rate_limits 
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint 
    AND window_start = window_start_time;
  
  IF current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  INSERT INTO rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, window_start_time)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix existing get_current_user_role function
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
DECLARE
  user_role_val user_role;
BEGIN
  SELECT role INTO user_role_val
  FROM profiles 
  WHERE user_id = auth.uid();
  
  RETURN COALESCE(user_role_val, 'geologist'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 3. Fix user_has_permission function  
CREATE OR REPLACE FUNCTION user_has_permission(p_permission_category text, p_permission_action text, p_resource_type text, p_action_type text DEFAULT 'read'::text)
RETURNS boolean AS $$
DECLARE
  user_role_val TEXT;
  permission_exists BOOLEAN := false;
BEGIN
  SELECT get_current_user_role()::text INTO user_role_val;
  
  SELECT 
    CASE 
      WHEN p_action_type = 'create' THEN can_create
      WHEN p_action_type = 'read' THEN can_read
      WHEN p_action_type = 'update' THEN can_update
      WHEN p_action_type = 'delete' THEN can_delete
      ELSE false
    END
  INTO permission_exists
  FROM role_permissions 
  WHERE role = user_role_val 
    AND permission_category = p_permission_category 
    AND permission_action = p_permission_action 
    AND resource_type = p_resource_type;
    
  RETURN COALESCE(permission_exists, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 4. Enable RLS on spatial_ref_sys if we control it (otherwise ignore)
DO $$
BEGIN
  -- Only enable if the table exists and we can modify it
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'spatial_ref_sys') THEN
    EXECUTE 'ALTER TABLE spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "spatial_ref_sys_read_only" ON spatial_ref_sys FOR SELECT USING (true)';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Ignore if we don't have permission to modify this system table
    NULL;
END $$;