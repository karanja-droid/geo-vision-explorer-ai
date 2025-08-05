-- Critical Security Fixes Migration

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

-- 2. Add missing RLS policies for new tables

-- Notifications table policies
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Documents table policies
CREATE POLICY "Users can view documents from accessible projects" 
ON public.documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = documents.project_id 
  AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
));

CREATE POLICY "Users can create documents in accessible projects" 
ON public.documents 
FOR INSERT 
WITH CHECK (uploaded_by = auth.uid() AND EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = documents.project_id 
  AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
));

CREATE POLICY "Users can update documents they uploaded" 
ON public.documents 
FOR UPDATE 
USING (uploaded_by = auth.uid() OR get_current_user_role() = 'admin');

-- Saved filters table policies
CREATE POLICY "Users can manage their own saved filters" 
ON public.saved_filters 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Report templates table policies
CREATE POLICY "Users can view all report templates" 
ON public.report_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Authorized users can create report templates" 
ON public.report_templates 
FOR INSERT 
WITH CHECK (created_by = auth.uid() AND get_current_user_role() IN ('admin', 'geologist'));

CREATE POLICY "Users can update templates they created" 
ON public.report_templates 
FOR UPDATE 
USING (created_by = auth.uid() OR get_current_user_role() = 'admin');

-- Team members table policies
CREATE POLICY "Users can view team members of accessible projects" 
ON public.team_members 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_members.project_id 
  AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
));

CREATE POLICY "Project owners can manage team members" 
ON public.team_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_members.project_id 
  AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_members.project_id 
  AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
));

-- 3. Add missing INSERT policy for profiles (for user registration)
CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Add validation constraints for security
-- Add non-negative constraints for numeric fields where appropriate
ALTER TABLE public.mineral_deposits 
ADD CONSTRAINT grade_estimate_non_negative CHECK (grade_estimate >= 0),
ADD CONSTRAINT tonnage_estimate_non_negative CHECK (tonnage_estimate >= 0),
ADD CONSTRAINT confidence_level_range CHECK (confidence_level >= 0 AND confidence_level <= 1);

ALTER TABLE public.projects 
ADD CONSTRAINT budget_non_negative CHECK (budget >= 0);

ALTER TABLE public.exploration_sites 
ADD CONSTRAINT elevation_reasonable CHECK (elevation >= -500 AND elevation <= 10000);

-- 5. Add security function for role validation
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