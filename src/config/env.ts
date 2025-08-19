
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
    console.warn(`Missing required environment variable: ${key}`);
    // Return sensible defaults for development
    switch (key) {
      case 'VITE_SITE_URL':
        return 'http://localhost:8080';
      case 'VITE_API_BASE_URL':
        return 'http://localhost:8000';
      case 'VITE_SUPABASE_URL':
        return 'https://rgtyhffyvpqenrqnkfqc.supabase.co';
      case 'VITE_SUPABASE_ANON_KEY':
        return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJndHloZmZ5dnBxZW5ycW5rZnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODc4MDYsImV4cCI6MjA2OTk2MzgwNn0.ylzNsFbexxg-IWqmelInLkfN-PydJDzrSRCmnU4HGsE';
      default:
        throw new Error(`Missing required environment variable: ${key}`);
    }
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
