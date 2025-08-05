-- Critical Security Fixes for Existing Tables Only

-- 1. Fix Profile Role Escalation Vulnerability
-- Drop the existing update policy and create restricted ones
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a restricted policy that excludes role changes
CREATE POLICY "Users can update their own profile (except role)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid()));

-- Create admin-only policy for role updates
CREATE POLICY "Admins can update user roles" 
ON public.profiles 
FOR UPDATE 
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- 2. Add missing INSERT policy for profiles (for user registration)
CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Add validation constraints for security on existing tables
-- Add non-negative constraints for numeric fields where appropriate
ALTER TABLE public.mineral_deposits 
ADD CONSTRAINT grade_estimate_non_negative CHECK (grade_estimate >= 0),
ADD CONSTRAINT tonnage_estimate_non_negative CHECK (tonnage_estimate >= 0),
ADD CONSTRAINT confidence_level_range CHECK (confidence_level >= 0 AND confidence_level <= 1);

ALTER TABLE public.projects 
ADD CONSTRAINT budget_non_negative CHECK (budget >= 0);

ALTER TABLE public.exploration_sites 
ADD CONSTRAINT elevation_reasonable CHECK (elevation >= -500 AND elevation <= 10000);

-- 4. Add security function for role validation
CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only admins can change roles
  IF OLD.role != NEW.role AND get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can change user roles';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role validation
CREATE TRIGGER validate_role_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();