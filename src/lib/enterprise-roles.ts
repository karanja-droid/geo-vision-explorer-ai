import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from './cache-manager';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  parentRole?: string;
  isCustom: boolean;
  isSystemRole: boolean;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  resource: string;
  actions: PermissionAction[];
  conditions?: PermissionCondition[];
  scope?: 'global' | 'organization' | 'project' | 'site';
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'export' | 'share';

export interface PermissionCondition {
  type: 'ownership' | 'membership' | 'role_hierarchy' | 'time_based' | 'location_based';
  field?: string;
  operator?: 'eq' | 'ne' | 'in' | 'not_in' | 'gt' | 'lt';
  value?: any;
}

export interface UserRole {
  userId: string;
  roleId: string;
  scope: 'global' | 'organization' | 'project' | 'site';
  scopeId?: string;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
  isActive: boolean;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  customBranding: OrganizationBranding;
  featureFlags: Record<string, boolean>;
  settings: OrganizationSettings;
  billingInfo: BillingInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  customCSS?: string;
  favicon?: string;
  loginBackground?: string;
}

export interface OrganizationSettings {
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  enableMFA: boolean;
  sessionTimeout: number;
  passwordPolicy: PasswordPolicy;
  auditLogRetention: number;
  dataRetentionPolicy: DataRetentionPolicy;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number;
  maxAge: number;
}

export interface DataRetentionPolicy {
  projects: number; // days
  sites: number;
  analyses: number;
  logs: number;
  backups: number;
}

export interface BillingInfo {
  customerId: string;
  subscriptionId: string;
  billingEmail: string;
  billingAddress: Address;
  paymentMethod: string;
  invoiceSettings: InvoiceSettings;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface InvoiceSettings {
  frequency: 'monthly' | 'quarterly' | 'annually';
  currency: string;
  taxId?: string;
  purchaseOrder?: string;
  customFields?: Record<string, string>;
}

export interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class RoleManager {
  /**
   * Create a new role
   */
  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    try {
      // Validate permissions
      await this.validatePermissions(role.permissions);

      const newRole: Omit<Role, 'id'> = {
        ...role,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { data, error } = await supabase
        .from('roles')
        .insert({
          name: newRole.name,
          description: newRole.description,
          permissions: newRole.permissions,
          parent_role: newRole.parentRole,
          is_custom: newRole.isCustom,
          is_system_role: newRole.isSystemRole,
          organization_id: newRole.organizationId,
          created_by: newRole.createdBy,
          created_at: newRole.createdAt.toISOString(),
          updated_at: newRole.updatedAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create role: ${error.message}`);
      }

      const createdRole = this.mapRoleFromDB(data);

      // Clear cache
      await this.clearRoleCache(role.organizationId);

      // Audit log
      await this.logAudit({
        userId: role.createdBy,
        organizationId: role.organizationId,
        action: 'role_created',
        resource: 'role',
        resourceId: createdRole.id,
        details: { roleName: role.name, permissions: role.permissions.length }
      });

      return createdRole;
    } catch (error) {
      console.error('Failed to create role:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleId: string,
    scope: UserRole['scope'] = 'global',
    scopeId?: string,
    grantedBy?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      // Check if user already has this role in this scope
      const existingAssignment = await this.getUserRoleAssignment(userId, roleId, scope, scopeId);
      if (existingAssignment) {
        throw new Error('User already has this role in the specified scope');
      }

      // Validate role exists and user has permission to assign it
      const role = await this.getRole(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (grantedBy) {
        const canAssign = await this.checkPermission(grantedBy, 'roles', 'create');
        if (!canAssign) {
          throw new Error('Insufficient permissions to assign role');
        }
      }

      const assignment: Omit<UserRole, 'userId' | 'roleId'> = {
        scope,
        scopeId,
        grantedAt: new Date(),
        grantedBy: grantedBy || 'system',
        expiresAt,
        isActive: true
      };

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          scope: assignment.scope,
          scope_id: assignment.scopeId,
          granted_at: assignment.grantedAt.toISOString(),
          granted_by: assignment.grantedBy,
          expires_at: assignment.expiresAt?.toISOString(),
          is_active: assignment.isActive
        });

      if (error) {
        throw new Error(`Failed to assign role: ${error.message}`);
      }

      // Clear user permissions cache
      await this.clearUserPermissionsCache(userId);

      // Audit log
      await this.logAudit({
        userId: grantedBy || 'system',
        organizationId: role.organizationId,
        action: 'role_assigned',
        resource: 'user_role',
        resourceId: userId,
        details: { roleId, roleName: role.name, scope, scopeId }
      });
    } catch (error) {
      console.error('Failed to assign role:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: PermissionAction,
    context?: Record<string, any>
  ): Promise<boolean> {
    try {
      const cacheKey = `user_permission_${userId}_${resource}_${action}_${JSON.stringify(context || {})}`;
      const cached = await cacheManager.get<boolean>(cacheKey);
      
      if (cached !== null) return cached;

      // Get user's effective permissions
      const permissions = await this.getEffectivePermissions(userId);

      // Check if user has the required permission
      const hasPermission = permissions.some(permission => {
        if (permission.resource !== resource) return false;
        if (!permission.actions.includes(action)) return false;

        // Check conditions if present
        if (permission.conditions && permission.conditions.length > 0) {
          return this.evaluateConditions(permission.conditions, context || {});
        }

        return true;
      });

      // Cache result for 5 minutes
      await cacheManager.set(cacheKey, hasPermission, 300);

      return hasPermission;
    } catch (error) {
      console.error('Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Get user's effective permissions
   */
  async getEffectivePermissions(userId: string): Promise<Permission[]> {
    try {
      const cacheKey = `user_effective_permissions_${userId}`;
      const cached = await cacheManager.get<Permission[]>(cacheKey);
      
      if (cached) return cached;

      // Get user's role assignments
      const { data: assignments, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to fetch user roles: ${error.message}`);
      }

      const permissions: Permission[] = [];
      const processedRoles = new Set<string>();

      // Process each role assignment
      for (const assignment of assignments || []) {
        if (!assignment.role) continue;

        // Check if role is expired
        if (assignment.expires_at && new Date(assignment.expires_at) < new Date()) {
          continue;
        }

        await this.collectRolePermissions(assignment.role, permissions, processedRoles);
      }

      // Remove duplicates and merge permissions
      const mergedPermissions = this.mergePermissions(permissions);

      // Cache for 5 minutes
      await cacheManager.set(cacheKey, mergedPermissions, 300);

      return mergedPermissions;
    } catch (error) {
      console.error('Failed to get effective permissions:', error);
      return [];
    }
  }

  /**
   * Audit role changes
   */
  async auditRoleChanges(organizationId: string, timeRange?: { start: Date; end: Date }): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', organizationId)
        .in('action', ['role_created', 'role_updated', 'role_deleted', 'role_assigned', 'role_revoked'])
        .order('timestamp', { ascending: false });

      if (timeRange) {
        query = query
          .gte('timestamp', timeRange.start.toISOString())
          .lte('timestamp', timeRange.end.toISOString());
      }

      const { data, error } = await query.limit(1000);

      if (error) {
        throw new Error(`Failed to fetch audit logs: ${error.message}`);
      }

      return data.map(this.mapAuditLogFromDB);
    } catch (error) {
      console.error('Failed to audit role changes:', error);
      throw error;
    }
  }

  // Private helper methods
  private async validatePermissions(permissions: Permission[]): Promise<void> {
    const validResources = [
      'projects', 'sites', 'mineral_deposits', 'ai_predictions', 'users', 'roles',
      'organizations', 'billing', 'analytics', 'reports', 'integrations'
    ];

    const validActions: PermissionAction[] = [
      'create', 'read', 'update', 'delete', 'execute', 'approve', 'export', 'share'
    ];

    for (const permission of permissions) {
      if (!validResources.includes(permission.resource)) {
        throw new Error(`Invalid resource: ${permission.resource}`);
      }

      for (const action of permission.actions) {
        if (!validActions.includes(action)) {
          throw new Error(`Invalid action: ${action}`);
        }
      }
    }
  }

  private async getRole(roleId: string): Promise<Role | null> {
    const cacheKey = `role_${roleId}`;
    const cached = await cacheManager.get<Role>(cacheKey);
    
    if (cached) return cached;

    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch role: ${error.message}`);
    }

    const role = this.mapRoleFromDB(data);
    await cacheManager.set(cacheKey, role, 3600); // 1 hour

    return role;
  }

  private async getUserRoleAssignment(
    userId: string,
    roleId: string,
    scope: string,
    scopeId?: string
  ): Promise<UserRole | null> {
    let query = supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('scope', scope)
      .eq('is_active', true);

    if (scopeId) {
      query = query.eq('scope_id', scopeId);
    } else {
      query = query.is('scope_id', null);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch role assignment: ${error.message}`);
    }

    return this.mapUserRoleFromDB(data);
  }

  private async collectRolePermissions(
    role: any,
    permissions: Permission[],
    processedRoles: Set<string>
  ): Promise<void> {
    if (processedRoles.has(role.id)) return;
    processedRoles.add(role.id);

    // Add role's permissions
    if (role.permissions) {
      permissions.push(...role.permissions);
    }

    // Process parent role if exists
    if (role.parent_role) {
      const parentRole = await this.getRole(role.parent_role);
      if (parentRole) {
        await this.collectRolePermissions(parentRole, permissions, processedRoles);
      }
    }
  }

  private mergePermissions(permissions: Permission[]): Permission[] {
    const merged = new Map<string, Permission>();

    for (const permission of permissions) {
      const key = permission.resource;
      
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        // Merge actions
        const allActions = [...existing.actions, ...permission.actions];
        existing.actions = [...new Set(allActions)];
        
        // Merge conditions (this is simplified - in practice you'd want more sophisticated merging)
        if (permission.conditions) {
          existing.conditions = [...(existing.conditions || []), ...permission.conditions];
        }
      } else {
        merged.set(key, { ...permission });
      }
    }

    return Array.from(merged.values());
  }

  private evaluateConditions(conditions: PermissionCondition[], context: Record<string, any>): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'ownership':
          return context.ownerId === context.userId;
        
        case 'membership':
          return context.memberIds?.includes(context.userId);
        
        case 'time_based':
          const now = new Date();
          if (condition.field === 'business_hours') {
            const hour = now.getHours();
            return hour >= 9 && hour <= 17; // 9 AM to 5 PM
          }
          return true;
        
        case 'location_based':
          // This would check user's location against allowed locations
          return true;
        
        default:
          return true;
      }
    });
  }

  private async logAudit(auditData: Omit<AuditLog, 'id' | 'timestamp' | 'ipAddress' | 'userAgent' | 'severity'>): Promise<void> {
    try {
      const audit: Omit<AuditLog, 'id'> = {
        ...auditData,
        timestamp: new Date(),
        ipAddress: '0.0.0.0', // This would come from the request
        userAgent: 'system', // This would come from the request
        severity: 'medium'
      };

      await supabase
        .from('audit_logs')
        .insert({
          user_id: audit.userId,
          organization_id: audit.organizationId,
          action: audit.action,
          resource: audit.resource,
          resource_id: audit.resourceId,
          details: audit.details,
          ip_address: audit.ipAddress,
          user_agent: audit.userAgent,
          timestamp: audit.timestamp.toISOString(),
          severity: audit.severity
        });
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  }

  private async clearRoleCache(organizationId: string): Promise<void> {
    // This would clear all role-related cache entries for the organization
    await cacheManager.delete(`org_roles_${organizationId}`);
  }

  private async clearUserPermissionsCache(userId: string): Promise<void> {
    // This would clear all permission-related cache entries for the user
    const pattern = `user_permission_${userId}_*`;
    // In a real implementation, you'd need a way to delete by pattern
    await cacheManager.delete(`user_effective_permissions_${userId}`);
  }

  private mapRoleFromDB(data: any): Role {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      parentRole: data.parent_role,
      isCustom: data.is_custom,
      isSystemRole: data.is_system_role,
      organizationId: data.organization_id,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapUserRoleFromDB(data: any): UserRole {
    return {
      userId: data.user_id,
      roleId: data.role_id,
      scope: data.scope,
      scopeId: data.scope_id,
      grantedAt: new Date(data.granted_at),
      grantedBy: data.granted_by,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      isActive: data.is_active
    };
  }

  private mapAuditLogFromDB(data: any): AuditLog {
    return {
      id: data.id,
      userId: data.user_id,
      organizationId: data.organization_id,
      action: data.action,
      resource: data.resource,
      resourceId: data.resource_id,
      details: data.details,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      timestamp: new Date(data.timestamp),
      severity: data.severity
    };
  }
}

// Organization Manager
export class OrganizationManager {
  private roleManager = new RoleManager();

  async createOrganization(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    try {
      const organization: Omit<Organization, 'id'> = {
        ...org,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: organization.name,
          plan: organization.plan,
          custom_branding: organization.customBranding,
          feature_flags: organization.featureFlags,
          settings: organization.settings,
          billing_info: organization.billingInfo,
          created_at: organization.createdAt.toISOString(),
          updated_at: organization.updatedAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create organization: ${error.message}`);
      }

      return this.mapOrganizationFromDB(data);
    } catch (error) {
      console.error('Failed to create organization:', error);
      throw error;
    }
  }

  async updateBranding(organizationId: string, branding: OrganizationBranding): Promise<void> {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          custom_branding: branding,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      if (error) {
        throw new Error(`Failed to update branding: ${error.message}`);
      }

      // Clear cache
      await cacheManager.delete(`organization_${organizationId}`);
    } catch (error) {
      console.error('Failed to update branding:', error);
      throw error;
    }
  }

  private mapOrganizationFromDB(data: any): Organization {
    return {
      id: data.id,
      name: data.name,
      plan: data.plan,
      customBranding: data.custom_branding,
      featureFlags: data.feature_flags,
      settings: data.settings,
      billingInfo: data.billing_info,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

// Export instances
export const roleManager = new RoleManager();
export const organizationManager = new OrganizationManager();

// React hooks
export function useRoles(organizationId: string) {
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('roles')
          .select('*')
          .eq('organization_id', organizationId)
          .order('name');

        if (error) throw error;

        setRoles(data.map(roleManager['mapRoleFromDB']));
      } catch (error) {
        console.error('Failed to fetch roles:', error);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchRoles();
    }
  }, [organizationId]);

  return { roles, loading, roleManager };
}

export function usePermissions(userId: string) {
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const perms = await roleManager.getEffectivePermissions(userId);
        setPermissions(perms);
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchPermissions();
    }
  }, [userId]);

  const checkPermission = async (resource: string, action: PermissionAction, context?: Record<string, any>) => {
    return roleManager.checkPermission(userId, resource, action, context);
  };

  return { permissions, loading, checkPermission };
}