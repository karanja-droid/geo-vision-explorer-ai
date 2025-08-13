// Feature flags configuration for GeoVision AI Miner
// This mirrors the Python configuration and provides TypeScript types

export interface FeatureFlags {
  // Phase A Features (Currently Implemented)
  FEATURE_AI_ANALYSIS: boolean;
  FEATURE_IOT_MONITORING: boolean;
  FEATURE_3D_MODELING: boolean;
  FEATURE_BUSINESS_INTELLIGENCE: boolean;
  FEATURE_LLM_CONSULTATION: boolean;
  FEATURE_ENHANCED_SECURITY: boolean;
  FEATURE_UNCERTAINTY_MAPS: boolean;
  FEATURE_ACTIVE_LEARNING: boolean;
  
  // Phase B Features (In Development)
  FEATURE_DRILL_MANAGEMENT: boolean;
  FEATURE_LAB_WORKFLOW: boolean;
  FEATURE_RESOURCE_MODELING: boolean;
  FEATURE_LIMS_INTEGRATION: boolean;
  FEATURE_3D_TILES_LOD: boolean;
  FEATURE_DRIFT_MONITORING: boolean;
  
  // Phase C Features (Future)
  FEATURE_GEOSPATIAL_AR: boolean;
  FEATURE_MOBILE_OFFLINE: boolean;
  FEATURE_CREDITS_WALLET: boolean;
  FEATURE_DATA_RESIDENCY: boolean;
  FEATURE_CMK_ENCRYPTION: boolean;
  
  // Advanced Features
  FEATURE_STAC_COG_PIPELINE: boolean;
  FEATURE_VECTOR_TILES: boolean;
  FEATURE_CONFORMAL_PREDICTION: boolean;
  FEATURE_SAVED_VIEWS: boolean;
  FEATURE_DEEP_LINKS: boolean;
}

// Default feature flags - matches Python configuration
const defaultFlags: FeatureFlags = {
  // Phase A - Currently Implemented
  FEATURE_AI_ANALYSIS: true,
  FEATURE_IOT_MONITORING: true,
  FEATURE_3D_MODELING: true,
  FEATURE_BUSINESS_INTELLIGENCE: true,
  FEATURE_LLM_CONSULTATION: true,
  FEATURE_ENHANCED_SECURITY: true,
  FEATURE_UNCERTAINTY_MAPS: true,
  FEATURE_ACTIVE_LEARNING: true,
  
  // Phase B - Matching Python config
  FEATURE_DRILL_MANAGEMENT: true,
  FEATURE_LAB_WORKFLOW: true,
  FEATURE_RESOURCE_MODELING: false,
  FEATURE_LIMS_INTEGRATION: true,
  FEATURE_3D_TILES_LOD: false,
  FEATURE_DRIFT_MONITORING: false,
  
  // Phase C - Matching Python config
  FEATURE_GEOSPATIAL_AR: false,
  FEATURE_MOBILE_OFFLINE: false,
  FEATURE_CREDITS_WALLET: false,
  FEATURE_DATA_RESIDENCY: false,
  FEATURE_CMK_ENCRYPTION: false,
  
  // Advanced Features
  FEATURE_STAC_COG_PIPELINE: true,
  FEATURE_VECTOR_TILES: true,
  FEATURE_CONFORMAL_PREDICTION: true,
  FEATURE_SAVED_VIEWS: false,
  FEATURE_DEEP_LINKS: false,
};

// Feature flag provider class
class FeatureFlagProvider {
  private flags: FeatureFlags;
  private subscribers: Array<(flags: FeatureFlags) => void> = [];

  constructor() {
    this.flags = { ...defaultFlags };
    this.loadFromEnvironment();
  }

  private loadFromEnvironment() {
    // Load from environment variables if available
    Object.keys(this.flags).forEach(key => {
      const envValue = process.env[`REACT_APP_${key}`];
      if (envValue !== undefined) {
        this.flags[key as keyof FeatureFlags] = envValue.toLowerCase() === 'true';
      }
    });
  }

  // Get a specific feature flag
  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature];
  }

  // Get all feature flags
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  // Update a feature flag (for admin users)
  updateFlag(feature: keyof FeatureFlags, enabled: boolean) {
    this.flags[feature] = enabled;
    this.notifySubscribers();
  }

  // Subscribe to flag changes
  subscribe(callback: (flags: FeatureFlags) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.getAllFlags()));
  }

  // Load flags from Supabase (for dynamic configuration)
  async loadFromDatabase() {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.warn('Failed to load feature flags from database:', error);
        return;
      }

      data?.forEach(flag => {
        if (flag.flag_name in this.flags) {
          this.flags[flag.flag_name as keyof FeatureFlags] = flag.is_enabled;
        }
      });

      this.notifySubscribers();
    } catch (error) {
      console.warn('Error loading feature flags:', error);
    }
  }

  // Feature flag groups for easier management
  getPhaseAFlags(): Partial<FeatureFlags> {
    return {
      FEATURE_AI_ANALYSIS: this.flags.FEATURE_AI_ANALYSIS,
      FEATURE_IOT_MONITORING: this.flags.FEATURE_IOT_MONITORING,
      FEATURE_3D_MODELING: this.flags.FEATURE_3D_MODELING,
      FEATURE_BUSINESS_INTELLIGENCE: this.flags.FEATURE_BUSINESS_INTELLIGENCE,
      FEATURE_LLM_CONSULTATION: this.flags.FEATURE_LLM_CONSULTATION,
      FEATURE_ENHANCED_SECURITY: this.flags.FEATURE_ENHANCED_SECURITY,
      FEATURE_UNCERTAINTY_MAPS: this.flags.FEATURE_UNCERTAINTY_MAPS,
      FEATURE_ACTIVE_LEARNING: this.flags.FEATURE_ACTIVE_LEARNING,
    };
  }

  getPhaseBFlags(): Partial<FeatureFlags> {
    return {
      FEATURE_DRILL_MANAGEMENT: this.flags.FEATURE_DRILL_MANAGEMENT,
      FEATURE_LAB_WORKFLOW: this.flags.FEATURE_LAB_WORKFLOW,
      FEATURE_RESOURCE_MODELING: this.flags.FEATURE_RESOURCE_MODELING,
      FEATURE_LIMS_INTEGRATION: this.flags.FEATURE_LIMS_INTEGRATION,
      FEATURE_3D_TILES_LOD: this.flags.FEATURE_3D_TILES_LOD,
      FEATURE_DRIFT_MONITORING: this.flags.FEATURE_DRIFT_MONITORING,
    };
  }

  getPhaseCFlags(): Partial<FeatureFlags> {
    return {
      FEATURE_GEOSPATIAL_AR: this.flags.FEATURE_GEOSPATIAL_AR,
      FEATURE_MOBILE_OFFLINE: this.flags.FEATURE_MOBILE_OFFLINE,
      FEATURE_CREDITS_WALLET: this.flags.FEATURE_CREDITS_WALLET,
      FEATURE_DATA_RESIDENCY: this.flags.FEATURE_DATA_RESIDENCY,
      FEATURE_CMK_ENCRYPTION: this.flags.FEATURE_CMK_ENCRYPTION,
    };
  }
}

// Singleton instance
export const featureFlags = new FeatureFlagProvider();

// React hook for using feature flags
export const useFeatureFlags = () => {
  const [flags, setFlags] = React.useState<FeatureFlags>(featureFlags.getAllFlags());

  React.useEffect(() => {
    const unsubscribe = featureFlags.subscribe(setFlags);
    featureFlags.loadFromDatabase(); // Load from database on mount
    return unsubscribe;
  }, []);

  return {
    flags,
    isEnabled: (feature: keyof FeatureFlags) => featureFlags.isEnabled(feature),
    updateFlag: (feature: keyof FeatureFlags, enabled: boolean) => 
      featureFlags.updateFlag(feature, enabled),
  };
};

// HOC for feature-gated components
export const withFeatureFlag = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredFeature: keyof FeatureFlags,
  fallback?: React.ComponentType<P>
) => {
  return (props: P) => {
    const { isEnabled } = useFeatureFlags();
    
    if (!isEnabled(requiredFeature)) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent {...props} />;
      }
      return null;
    }
    
    return <WrappedComponent {...props} />;
  };
};

// Feature flag component for conditional rendering
export const FeatureFlag: React.FC<{
  feature: keyof FeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ feature, children, fallback = null }) => {
  const { isEnabled } = useFeatureFlags();
  
  return isEnabled(feature) ? <>{children}</> : <>{fallback}</>;
};

// Import React for hooks
import React from 'react';