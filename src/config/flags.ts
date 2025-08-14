/**
 * Feature flags configuration for GeoVision AI Miner
 */

export type Flags = {
  FEATURE_MAPS: boolean;
  FEATURE_DATA: boolean;
  FEATURE_AI: boolean;
  FEATURE_DRILL: boolean;
  FEATURE_LIMS: boolean;
  FEATURE_ESG: boolean;
  FEATURE_3D: boolean;
  FEATURE_REPORTS: boolean;
  FEATURE_ADMIN: boolean;
  FEATURE_REPORTS_EXEC: boolean;
  FEATURE_REPORTS_GEO: boolean;
  FEATURE_REPORTS_RS: boolean;
  FEATURE_REPORTS_GCHEM: boolean;
  FEATURE_REPORTS_DRILL: boolean;
  FEATURE_REPORTS_SURVEY: boolean;
  FEATURE_REPORTS_PLAN: boolean;
  FEATURE_ADOBE_VIEW: boolean;
};

// Default feature flags - can be overridden by environment variables
const defaultFlags: Flags = {
  FEATURE_MAPS: true,
  FEATURE_DATA: true,
  FEATURE_AI: true,
  FEATURE_DRILL: true,
  FEATURE_LIMS: true,
  FEATURE_ESG: true,
  FEATURE_3D: true,
  FEATURE_REPORTS: true,
  FEATURE_ADMIN: true,
  FEATURE_REPORTS_EXEC: true,
  FEATURE_REPORTS_GEO: true,
  FEATURE_REPORTS_RS: true,
  FEATURE_REPORTS_GCHEM: true,
  FEATURE_REPORTS_DRILL: true,
  FEATURE_REPORTS_SURVEY: true,
  FEATURE_REPORTS_PLAN: true,
  FEATURE_ADOBE_VIEW: true,
};

// Read feature flags from environment variables
export const getFeatureFlags = (): Flags => {
  const flags: Flags = { ...defaultFlags };
  
  // Override with environment variables if present
  Object.keys(flags).forEach((key) => {
    const envValue = import.meta.env[`VITE_${key}`];
    if (envValue !== undefined) {
      flags[key as keyof Flags] = envValue === 'true' || envValue === '1';
    }
  });
  
  return flags;
};

// Hook to use feature flags
export const useFeatureFlags = () => {
  return getFeatureFlags();
};

// Check if a specific feature is enabled
export const isFeatureEnabled = (feature: keyof Flags): boolean => {
  const flags = getFeatureFlags();
  return flags[feature];
};