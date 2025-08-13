/**
 * Environment Configuration
 * 
 * Centralized configuration for environment variables with runtime validation.
 * Ensures required environment variables are present and provides type-safe access.
 */

// Runtime validation for required environment variables
function getRequiredEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return import.meta.env[key] || defaultValue;
}

// Site and API URLs (required)
export const SITE_URL = getRequiredEnv('VITE_SITE_URL');
export const API_BASE_URL = getRequiredEnv('VITE_API_BASE_URL');

// Supabase configuration (required)
export const SUPABASE_URL = getRequiredEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getRequiredEnv('VITE_SUPABASE_ANON_KEY');

// Optional configuration
export const MAPBOX_TOKEN = getOptionalEnv('VITE_MAPBOX_TOKEN');
export const ENVIRONMENT = getOptionalEnv('VITE_ENVIRONMENT', 'development');

// Derived configuration
export const IS_PRODUCTION = ENVIRONMENT === 'production';
export const IS_STAGING = ENVIRONMENT === 'staging';
export const IS_DEVELOPMENT = ENVIRONMENT === 'development';

// API endpoints
export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/healthz`,
  FEATURES: `${API_BASE_URL}/api/v1/features`,
  AI_INFERENCE: `${API_BASE_URL}/api/v1/ai`,
  ACTIVE_LEARNING: `${API_BASE_URL}/api/v1/active-learning`,
  DRILL_DATA: `${API_BASE_URL}/api/v1/drill-data`,
  STAC: `${API_BASE_URL}/stac`,
} as const;

// Validation on module load
if (typeof window !== 'undefined') {
  console.log('Environment Configuration:', {
    SITE_URL,
    API_BASE_URL,
    ENVIRONMENT,
    IS_PRODUCTION,
    IS_STAGING,
    IS_DEVELOPMENT,
  });
}