// Enhanced TypeScript types for GeoVision AI Miner
// This extends the auto-generated types with additional utility types

import { Database } from './types';

// Base table types
export type Tables = Database['public']['Tables'];
export type Views = Database['public']['Views'];
export type Functions = Database['public']['Functions'];
export type Enums = Database['public']['Enums'];

// Table row types
export type Project = Tables['projects']['Row'];
export type ProjectInsert = Tables['projects']['Insert'];
export type ProjectUpdate = Tables['projects']['Update'];

export type ExplorationSite = Tables['exploration_sites']['Row'];
export type ExplorationSiteInsert = Tables['exploration_sites']['Insert'];
export type ExplorationSiteUpdate = Tables['exploration_sites']['Update'];

export type MineralDeposit = Tables['mineral_deposits']['Row'];
export type MineralDepositInsert = Tables['mineral_deposits']['Insert'];
export type MineralDepositUpdate = Tables['mineral_deposits']['Update'];

export type Prediction = Tables['predictions']['Row'];
export type PredictionInsert = Tables['predictions']['Insert'];
export type PredictionUpdate = Tables['predictions']['Update'];

export type Profile = Tables['profiles']['Row'];
export type ProfileInsert = Tables['profiles']['Insert'];
export type ProfileUpdate = Tables['profiles']['Update'];

export type Subscription = Tables['subscriptions']['Row'];
export type SubscriptionInsert = Tables['subscriptions']['Insert'];
export type SubscriptionUpdate = Tables['subscriptions']['Update'];

export type FeatureFlag = Tables['feature_flags']['Row'];
export type FeatureFlagInsert = Tables['feature_flags']['Insert'];
export type FeatureFlagUpdate = Tables['feature_flags']['Update'];

export type ActivityLog = Tables['activity_logs']['Row'];
export type ActivityLogInsert = Tables['activity_logs']['Insert'];
export type ActivityLogUpdate = Tables['activity_logs']['Update'];

// Enum types
export type UserRole = Enums['user_role'];
export type ProjectStatus = Enums['project_status'];
export type PredictionStatus = Enums['prediction_status'];
export type SubscriptionTier = Enums['subscription_tier'];
export type FeatureModule = Enums['feature_module'];

// Enhanced types with relationships
export interface ProjectWithSites extends Project {
  exploration_sites: ExplorationSite[];
  mineral_deposits: MineralDeposit[];
  predictions: Prediction[];
  _count: {
    sites: number;
    deposits: number;
    predictions: number;
  };
}

export interface ExplorationSiteWithDeposits extends ExplorationSite {
  mineral_deposits: MineralDeposit[];
  predictions: Prediction[];
  _count: {
    deposits: number;
    predictions: number;
  };
}

export interface MineralDepositWithPredictions extends MineralDeposit {
  predictions: Prediction[];
  exploration_site: ExplorationSite;
  _count: {
    predictions: number;
  };
}

export interface ProfileWithSubscription extends Profile {
  subscription: Subscription | null;
  role_permissions: {
    role: UserRole;
    permissions: string[];
  };
}

export interface PredictionWithRelations extends Prediction {
  mineral_deposit: MineralDeposit;
  exploration_site: ExplorationSite;
  project: Project;
  ai_model: {
    name: string;
    version: string;
    accuracy: number;
  };
}

// Utility types for forms and API responses
export interface CreateProjectData {
  name: string;
  description?: string;
  location?: string;
  budget?: number;
  start_date?: string;
  end_date?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface CreateSiteData {
  project_id: string;
  name: string;
  description?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  elevation?: number;
  access_notes?: string;
  site_type?: string;
}

export interface CreateMineralDepositData {
  site_id: string;
  mineral_type: string;
  grade?: number;
  tonnage?: number;
  confidence_level?: number;
  discovery_date?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  depth?: number;
  notes?: string;
}

export interface CreatePredictionData {
  deposit_id: string;
  model_name: string;
  confidence_score: number;
  predicted_grade?: number;
  predicted_tonnage?: number;
  metadata?: Record<string, any>;
  features_used?: string[];
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface SearchFilters {
  query?: string;
  project_id?: string;
  site_id?: string;
  mineral_type?: string;
  status?: ProjectStatus | PredictionStatus;
  date_from?: string;
  date_to?: string;
  confidence_min?: number;
  confidence_max?: number;
  grade_min?: number;
  grade_max?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
    radius: number; // in kilometers
  };
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// Real-time subscription types
export interface RealtimePayload<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  table: string;
  schema: string;
  commit_timestamp: string;
}

export interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'cursor_moved' | 'selection_changed' | 'data_updated';
  user_id: string;
  user_name: string;
  project_id: string;
  timestamp: string;
  data?: Record<string, any>;
}

// Analytics and metrics types
export interface ProjectMetrics {
  total_sites: number;
  total_deposits: number;
  total_predictions: number;
  avg_confidence: number;
  total_tonnage: number;
  avg_grade: number;
  completion_percentage: number;
  last_activity: string;
}

export interface SiteMetrics {
  total_deposits: number;
  total_predictions: number;
  avg_confidence: number;
  total_tonnage: number;
  avg_grade: number;
  mineral_types: string[];
  depth_range: {
    min: number;
    max: number;
    avg: number;
  };
}

export interface UserMetrics {
  total_projects: number;
  total_sites: number;
  total_predictions: number;
  subscription_tier: SubscriptionTier;
  usage_stats: {
    ai_runs_used: number;
    ai_runs_limit: number;
    map_tiles_used: number;
    map_tiles_limit: number;
    storage_used: number;
    storage_limit: number;
  };
  trial_info?: {
    is_trial: boolean;
    days_remaining: number;
    trial_end_date: string;
  };
}

// Feature flag types
export interface FeatureFlagConfig {
  name: string;
  enabled: boolean;
  description: string;
  module: string;
  tier_restrictions?: SubscriptionTier[];
  user_restrictions?: string[];
  metadata?: Record<string, any>;
}

export interface FeatureFlagContext {
  user_id: string;
  subscription_tier: SubscriptionTier;
  user_role: UserRole;
  project_id?: string;
  additional_context?: Record<string, any>;
}

// Security and audit types
export interface SecurityEvent {
  event_type: 'login' | 'logout' | 'password_change' | 'permission_change' | 'data_access' | 'data_export';
  user_id: string;
  ip_address: string;
  user_agent: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address: string;
  user_agent: string;
  timestamp: string;
  session_id?: string;
}

// Geological data types
export interface GeologicalSample {
  id: string;
  site_id: string;
  sample_type: 'core' | 'chip' | 'grab' | 'channel';
  coordinates: {
    latitude: number;
    longitude: number;
    elevation?: number;
    depth?: number;
  };
  collection_date: string;
  analysis_results?: {
    elements: Record<string, number>;
    minerals: Record<string, number>;
    grade?: number;
    confidence?: number;
  };
  metadata?: Record<string, any>;
}

export interface GeophysicalData {
  id: string;
  site_id: string;
  survey_type: 'magnetic' | 'gravity' | 'electrical' | 'seismic' | 'radiometric';
  coordinates: {
    latitude: number;
    longitude: number;
  };
  measurements: Record<string, number>;
  processing_parameters?: Record<string, any>;
  quality_metrics?: {
    signal_to_noise: number;
    accuracy: number;
    completeness: number;
  };
  timestamp: string;
}

// Export utility functions for type guards
export const isProject = (obj: any): obj is Project => {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
};

export const isExplorationSite = (obj: any): obj is ExplorationSite => {
  return obj && typeof obj.id === 'string' && typeof obj.project_id === 'string';
};

export const isMineralDeposit = (obj: any): obj is MineralDeposit => {
  return obj && typeof obj.id === 'string' && typeof obj.site_id === 'string';
};

export const isPrediction = (obj: any): obj is Prediction => {
  return obj && typeof obj.id === 'string' && typeof obj.deposit_id === 'string';
};

// Type-safe database query builders
export type QueryBuilder<T> = {
  select: (columns?: string) => QueryBuilder<T>;
  eq: (column: keyof T, value: any) => QueryBuilder<T>;
  neq: (column: keyof T, value: any) => QueryBuilder<T>;
  gt: (column: keyof T, value: any) => QueryBuilder<T>;
  gte: (column: keyof T, value: any) => QueryBuilder<T>;
  lt: (column: keyof T, value: any) => QueryBuilder<T>;
  lte: (column: keyof T, value: any) => QueryBuilder<T>;
  like: (column: keyof T, pattern: string) => QueryBuilder<T>;
  ilike: (column: keyof T, pattern: string) => QueryBuilder<T>;
  in: (column: keyof T, values: any[]) => QueryBuilder<T>;
  order: (column: keyof T, ascending?: boolean) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  offset: (count: number) => QueryBuilder<T>;
};