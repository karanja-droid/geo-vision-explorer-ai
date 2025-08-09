-- CRITICAL SECURITY FIXES

-- 1. Fix Privilege Escalation Vulnerability
-- Drop the problematic policy that allows users to update their own role
DROP POLICY IF EXISTS "Users can update their own profile (except role)" ON public.profiles;

-- Create a secure policy that prevents role updates by regular users
CREATE POLICY "Users can update their own profile (no role changes)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = (SELECT role FROM profiles WHERE user_id = auth.uid())
);

-- Create a separate admin-only policy for role updates
CREATE POLICY "Admins can update any user role" 
ON public.profiles 
FOR UPDATE 
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- 2. Secure Financial Data Exposure
-- Drop the insecure projects_secure view that exposes decrypted data
DROP VIEW IF EXISTS public.projects_secure;

-- 3. Fix Security Definer Functions - Add proper search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
DECLARE
  user_role_val user_role;
BEGIN
  SELECT role INTO user_role_val
  FROM public.profiles 
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role_val, 'geologist'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = 'public';

-- Update other security definer functions with proper search_path
CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission_category text, p_permission_action text, p_resource_type text, p_action_type text DEFAULT 'read'::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  FROM public.role_permissions 
  WHERE role = user_role_val 
    AND permission_category = p_permission_category 
    AND permission_action = p_permission_action 
    AND resource_type = p_resource_type;
    
  RETURN COALESCE(permission_exists, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key_name text DEFAULT 'ENCRYPTION_KEY'::text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(current_setting('app.encryption_key', true), 'default_key_please_change');
  RETURN pgp_sym_encrypt(data, encryption_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data bytea, key_name text DEFAULT 'ENCRYPTION_KEY'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(current_setting('app.encryption_key', true), 'default_key_please_change');
  RETURN pgp_sym_decrypt(encrypted_data, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN '[DECRYPTION_ERROR]';
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_encryption_key(old_key text, new_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id, contract_terms_encrypted FROM public.projects 
             WHERE contract_terms_encrypted IS NOT NULL LOOP
    UPDATE public.projects 
    SET contract_terms_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.contract_terms_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;
  
  FOR rec IN SELECT id, budget_encrypted FROM public.projects 
             WHERE budget_encrypted IS NOT NULL LOOP
    UPDATE public.projects 
    SET budget_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.budget_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;

  FOR rec IN SELECT id, phone_encrypted FROM public.profiles 
             WHERE phone_encrypted IS NOT NULL LOOP
    UPDATE public.profiles 
    SET phone_encrypted = pgp_sym_encrypt(
      pgp_sym_decrypt(rec.phone_encrypted, old_key),
      new_key
    )
    WHERE id = rec.id;
  END LOOP;
  
  INSERT INTO public.audit_logs (table_name, operation, user_id, new_data)
  VALUES ('system', 'KEY_ROTATION', auth.uid(), 
          jsonb_build_object('timestamp', now(), 'rotated_tables', ARRAY['projects', 'profiles']));
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id uuid, p_endpoint text, p_limit integer DEFAULT 10, p_window_minutes integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_count integer;
  window_start_time timestamp with time zone;
BEGIN
  window_start_time := date_trunc('minute', now()) - (floor(extract(minute from now()) / p_window_minutes) * p_window_minutes || ' minutes')::interval;
  
  SELECT COALESCE(request_count, 0) INTO current_count
  FROM public.rate_limits 
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint 
    AND window_start = window_start_time;
  
  IF current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  INSERT INTO public.rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, window_start_time)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1;
  
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

  INSERT INTO public.audit_logs (
    table_name, operation, user_id, old_data, new_data, 
    changed_fields, ip_address, user_agent, session_id
  ) VALUES (
    TG_TABLE_NAME, TG_OP, auth.uid(), old_data, new_data,
    changed_fields, inet_client_addr(), user_agent_val, session_id_val
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS TABLE(table_name text, rls_enabled boolean, policy_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- 4. Add enhanced audit logging for security events
INSERT INTO public.audit_logs (table_name, operation, user_id, new_data)
VALUES (
  'security_system', 
  'SECURITY_FIXES_APPLIED', 
  auth.uid(), 
  jsonb_build_object(
    'timestamp', now(),
    'fixes_applied', ARRAY[
      'privilege_escalation_fix',
      'financial_data_exposure_fix', 
      'security_definer_search_path_fix',
      'enhanced_rls_policies'
    ],
    'security_level', 'critical_fixes_implemented'
  )
);

-- 5. Add constraint to prevent unauthorized role changes
ALTER TABLE public.profiles ADD CONSTRAINT prevent_unauthorized_role_changes 
CHECK (
  CASE 
    WHEN role = 'admin' THEN 
      EXISTS (
        SELECT 1 FROM public.profiles p2 
        WHERE p2.user_id = auth.uid() 
        AND p2.role = 'admin'
      )
    ELSE true
  END
);