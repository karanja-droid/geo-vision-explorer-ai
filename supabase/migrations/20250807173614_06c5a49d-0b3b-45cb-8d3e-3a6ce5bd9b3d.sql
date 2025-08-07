-- ============================================================================
-- GEOVISION AI MINER SECURITY ENHANCEMENTS
-- ============================================================================

-- 1. Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create audit_logs table for comprehensive tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  timestamp timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text,
  session_id text
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Add encrypted columns to existing tables
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_terms_encrypted bytea;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_encrypted bytea;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_encrypted bytea;

-- 4. Create security definer functions for encryption/decryption
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data text, key_name text DEFAULT 'ENCRYPTION_KEY')
RETURNS bytea AS $$
DECLARE
  encryption_key text;
BEGIN
  -- In production, this would get the key from a secure vault
  encryption_key := COALESCE(current_setting('app.encryption_key', true), 'default_key_please_change');
  RETURN pgp_sym_encrypt(data, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create comprehensive audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
  changed_fields text[];
  user_agent_val text;
  session_id_val text;
BEGIN
  -- Get user agent and session info from request context
  user_agent_val := current_setting('request.headers', true)::json->>'user-agent';
  session_id_val := current_setting('request.jwt.claims', true)::json->>'session_id';

  -- Determine operation type and data
  IF TG_OP = 'INSERT' THEN
    new_data = to_jsonb(NEW);
    old_data = NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    old_data = to_jsonb(OLD);
    new_data = to_jsonb(NEW);
    -- Calculate changed fields
    SELECT array_agg(key) INTO changed_fields
    FROM jsonb_each(old_data) 
    WHERE value != (new_data->key) OR (new_data->key) IS NULL;
  ELSIF TG_OP = 'DELETE' THEN
    old_data = to_jsonb(OLD);
    new_data = NULL;
  END IF;

  -- Insert audit record
  INSERT INTO audit_logs (
    table_name, operation, user_id, old_data, new_data, 
    changed_fields, ip_address, user_agent, session_id
  ) VALUES (
    TG_TABLE_NAME, TG_OP, auth.uid(), old_data, new_data,
    changed_fields, inet_client_addr(), user_agent_val, session_id_val
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Apply audit triggers to all critical tables
CREATE TRIGGER audit_trigger_projects
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_exploration_sites
  AFTER INSERT OR UPDATE OR DELETE ON exploration_sites
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_mineral_deposits
  AFTER INSERT OR UPDATE OR DELETE ON mineral_deposits
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_predictions
  AFTER INSERT OR UPDATE OR DELETE ON predictions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_ai_models
  AFTER INSERT OR UPDATE OR DELETE ON ai_models
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trigger_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 7. Create secure indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_status ON projects (owner_id, status) 
WHERE status IN ('planning', 'active', 'completed');

CREATE INDEX IF NOT EXISTS idx_exploration_sites_secure ON exploration_sites (project_id, created_by)
WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mineral_deposits_confidence ON mineral_deposits (site_id, confidence_level)
WHERE confidence_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation ON audit_logs (table_name, operation, timestamp DESC);

-- 8. Enhanced RLS policies for projects
DROP POLICY IF EXISTS "project_owner_full_access" ON projects;
CREATE POLICY "project_owner_full_access" ON projects
FOR ALL USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "admin_projects_access" ON projects;
CREATE POLICY "admin_projects_access" ON projects
FOR ALL USING (get_current_user_role() IN ('admin', 'administrator'));

-- 9. Enhanced RLS policies for exploration sites
DROP POLICY IF EXISTS "team_member_site_access" ON exploration_sites;
CREATE POLICY "team_member_site_access" ON exploration_sites
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = exploration_sites.project_id 
    AND (p.owner_id = auth.uid() OR get_current_user_role() IN ('admin', 'administrator', 'geologist'))
  )
);

DROP POLICY IF EXISTS "authorized_site_modifications" ON exploration_sites;
CREATE POLICY "authorized_site_modifications" ON exploration_sites
FOR INSERT WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = exploration_sites.project_id 
    AND (p.owner_id = auth.uid() OR get_current_user_role() IN ('admin', 'administrator'))
  )
);

-- 10. QA/QC specific policies for mineral deposits
DROP POLICY IF EXISTS "qaqc_deposit_updates" ON mineral_deposits;
CREATE POLICY "qaqc_deposit_updates" ON mineral_deposits
FOR UPDATE USING (
  get_current_user_role() IN ('qa_qc_specialist', 'admin', 'administrator')
  OR (created_by = auth.uid() AND confidence_level IS NULL)
);

-- 11. Audit logs RLS policies
CREATE POLICY "users_view_own_audit_logs" ON audit_logs
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_view_all_audit_logs" ON audit_logs
FOR SELECT USING (get_current_user_role() IN ('admin', 'administrator'));

CREATE POLICY "system_insert_audit_logs" ON audit_logs
FOR INSERT WITH CHECK (true);

-- 12. Create secure views with encryption handling
CREATE OR REPLACE VIEW projects_secure AS
SELECT 
  id, name, description, status, owner_id, country, province,
  geology_type, target_minerals, start_date, end_date, coordinates,
  created_at, updated_at,
  CASE 
    WHEN get_current_user_role() IN ('admin', 'administrator', 'executive') 
    THEN decrypt_sensitive_data(contract_terms_encrypted)
    ELSE '[REDACTED]'
  END as contract_terms,
  CASE 
    WHEN get_current_user_role() IN ('admin', 'administrator', 'executive') 
    THEN decrypt_sensitive_data(budget_encrypted)
    ELSE '[REDACTED]'
  END as budget_details
FROM projects;

-- 13. Create function to check RLS status
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create key rotation function
CREATE OR REPLACE FUNCTION rotate_encryption_key(old_key text, new_key text)
RETURNS void AS $$
DECLARE
  rec record;
BEGIN
  -- Re-encrypt contract terms in projects
  FOR rec IN SELECT id, contract_terms_encrypted FROM projects 
             WHERE contract_terms_encrypted IS NOT NULL LOOP
    UPDATE projects 
    SET contract_terms_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.contract_terms_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;
  
  -- Re-encrypt budget data in projects
  FOR rec IN SELECT id, budget_encrypted FROM projects 
             WHERE budget_encrypted IS NOT NULL LOOP
    UPDATE projects 
    SET budget_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.budget_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;

  -- Re-encrypt phone numbers in profiles
  FOR rec IN SELECT id, phone_encrypted FROM profiles 
             WHERE phone_encrypted IS NOT NULL LOOP
    UPDATE profiles 
    SET phone_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.phone_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;
  
  -- Log rotation
  INSERT INTO audit_logs (table_name, operation, user_id, new_data)
  VALUES ('system', 'KEY_ROTATION', auth.uid(), 
          jsonb_build_object('timestamp', now(), 'rotated_tables', ARRAY['projects', 'profiles']));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, endpoint, window_start)
);

-- Enable RLS on rate limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_rate_limits" ON rate_limits
FOR ALL USING (user_id = auth.uid());

-- 16. Create indexes for rate limiting
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON rate_limits (user_id, endpoint, window_start DESC);

-- 17. Create function to check rate limits
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
  
  -- Get current count for this window
  SELECT COALESCE(request_count, 0) INTO current_count
  FROM rate_limits 
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint 
    AND window_start = window_start_time;
  
  -- Check if limit exceeded
  IF current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- Increment counter
  INSERT INTO rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, window_start_time)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;