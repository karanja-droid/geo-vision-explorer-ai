-- Onboarding Progress System Migration
-- Creates tables and functions for tracking user onboarding progress

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create onboarding flows table
CREATE TABLE IF NOT EXISTS onboarding_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_role VARCHAR(50) NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  estimated_duration INTEGER NOT NULL DEFAULT 0, -- in minutes
  completion_reward JSONB,
  prerequisites TEXT[] DEFAULT '{}',
  category VARCHAR(50) NOT NULL DEFAULT 'getting_started',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create user onboarding state table
CREATE TABLE IF NOT EXISTS user_onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  completed_flows TEXT[] DEFAULT '{}',
  current_flow UUID REFERENCES onboarding_flows(id),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{
    "showTooltips": true,
    "autoAdvance": false,
    "skipAnimations": false
  }',
  achievements JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create onboarding progress table
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES onboarding_flows(id) ON DELETE CASCADE,
  current_step VARCHAR(255) NOT NULL,
  completed_steps TEXT[] DEFAULT '{}',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  skipped BOOLEAN DEFAULT FALSE,
  progress DECIMAL(5,2) DEFAULT 0.00, -- percentage 0-100
  time_spent INTEGER DEFAULT 0, -- in seconds
  session_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, flow_id)
);

-- Create user achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  category VARCHAR(50),
  unlocked_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create onboarding analytics table
CREATE TABLE IF NOT EXISTS onboarding_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES onboarding_flows(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- started, step_completed, completed, skipped, etc.
  step_id VARCHAR(255),
  event_data JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW(),
  session_id VARCHAR(255),
  user_agent TEXT,
  ip_address INET
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_flows_role ON onboarding_flows(user_role);
CREATE INDEX IF NOT EXISTS idx_onboarding_flows_category ON onboarding_flows(category);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_state_user_id ON user_onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_flow_id ON onboarding_progress(flow_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_completed ON onboarding_progress(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_user_id ON onboarding_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_event_type ON onboarding_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_timestamp ON onboarding_analytics(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_onboarding_flows_updated_at 
    BEFORE UPDATE ON onboarding_flows 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_onboarding_state_updated_at 
    BEFORE UPDATE ON user_onboarding_state 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_progress_updated_at 
    BEFORE UPDATE ON onboarding_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default onboarding flows for each role
INSERT INTO onboarding_flows (name, description, user_role, steps, estimated_duration, completion_reward, category) VALUES
-- Administrator flow
('Administrator Getting Started', 'Complete onboarding for system administrators', 'administrator', '[
  {
    "id": "admin_welcome",
    "title": "Welcome to GeoMiner Admin",
    "description": "Learn how to manage users, projects, and system settings as an administrator.",
    "action"