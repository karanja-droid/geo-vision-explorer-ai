/**
 * Authentication and role management configuration
 */

export type UserRole = 
  | "admin" 
  | "executive" 
  | "geologist" 
  | "geophysicist" 
  | "geochemist" 
  | "driller" 
  | "surveyor" 
  | "planner" 
  | "viewer";

export interface UserClaims {
  sub: string;
  email: string;
  role: UserRole;
  org_id: string;
  project_ids: string[];
  permissions: string[];
  country_codes: string[];
  data_classifications: string[];
}

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<any>;
  roles?: UserRole[];
  featureFlag?: string;
  badgeCountKey?: string;
  children?: NavItem[];
}

// Role hierarchy for permission inheritance
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  executive: 90,
  geologist: 80,
  geophysicist: 70,
  geochemist: 70,
  driller: 70,
  surveyor: 70,
  planner: 80,
  viewer: 10
};

// Role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'], // All permissions
  executive: [
    'view_dashboard',
    'view_reports',
    'manage_budgets',
    'manage_esg',
    'view_all_projects',
    'export_executive_reports'
  ],
  geologist: [
    'view_dashboard',
    'manage_field_observations',
    'manage_geological_targets',
    'view_maps',
    'manage_samples',
    'export_geological_reports'
  ],
  geophysicist: [
    'view_dashboard',
    'manage_geophysical_surveys',
    'manage_anomalies',
    'manage_remote_sensing',
    'view_maps',
    'export_geophysical_reports'
  ],
  geochemist: [
    'view_dashboard',
    'manage_samples',
    'manage_assays',
    'manage_qc',
    'view_lims',
    'export_geochemical_reports'
  ],
  driller: [
    'view_dashboard',
    'manage_drill_plans',
    'manage_daily_reports',
    'view_drilling_progress',
    'export_drilling_reports'
  ],
  surveyor: [
    'view_dashboard',
    'manage_control_points',
    'manage_collar_surveys',
    'manage_topographic_surveys',
    'export_survey_reports'
  ],
  planner: [
    'view_dashboard',
    'manage_resource_models',
    'manage_mining_scenarios',
    'manage_schedules',
    'view_economics',
    'export_planning_reports'
  ],
  viewer: [
    'view_dashboard',
    'view_reports'
  ]
};

// Check if user has permission
export const hasPermission = (userRole: UserRole, permission: string): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
};

// Check if user has any of the required roles
export const hasAnyRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(userRole) || userRole === 'admin';
};

// Get user's effective permissions
export const getUserPermissions = (userRole: UserRole): string[] => {
  return ROLE_PERMISSIONS[userRole];
};

// Role display names
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: 'Administrator',
  executive: 'Executive',
  geologist: 'Geologist',
  geophysicist: 'Geophysicist',
  geochemist: 'Geochemist',
  driller: 'Drilling Manager',
  surveyor: 'Surveyor',
  planner: 'Mine Planner',
  viewer: 'Viewer'
};

// Role colors for UI
export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  executive: 'bg-purple-100 text-purple-800',
  geologist: 'bg-amber-100 text-amber-800',
  geophysicist: 'bg-blue-100 text-blue-800',
  geochemist: 'bg-green-100 text-green-800',
  driller: 'bg-orange-100 text-orange-800',
  surveyor: 'bg-teal-100 text-teal-800',
  planner: 'bg-indigo-100 text-indigo-800',
  viewer: 'bg-gray-100 text-gray-800'
};