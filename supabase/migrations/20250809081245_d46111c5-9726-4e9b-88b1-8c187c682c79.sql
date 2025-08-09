-- CRITICAL SECURITY FIXES (Fixed Version)

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