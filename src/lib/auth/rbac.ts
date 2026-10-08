import type { Permission, Role } from '../os/types';

/** Canonical RBAC contract shared by UI guards and server policy definitions. */
export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  customer: ['view:profile', 'edit:profile', 'view:transactions'],
  buyer: ['view:profile', 'edit:profile', 'view:transactions', 'manage:orders', 'manage:bookings'],
  seller: ['view:profile', 'edit:profile', 'create:products', 'edit:products', 'manage:inventory', 'manage:orders', 'manage:bookings', 'view:customer_info', 'view:transactions'],
  business_owner: ['view:profile', 'edit:profile', 'create:products', 'edit:products', 'manage:inventory', 'create:invoices', 'send:payment_requests', 'view:customer_info', 'manage:orders', 'manage:bookings', 'manage:business_staff', 'view:transactions'],
  staff_member: ['view:profile', 'edit:profile', 'manage:orders', 'manage:bookings'],
  service_provider: ['view:profile', 'edit:profile', 'manage:bookings', 'manage:orders', 'view:customer_info'],
  school_administrator: ['view:profile', 'edit:profile', 'manage:orders', 'manage:bookings', 'view:transactions'],
  finance_officer: ['view:profile', 'view:transactions', 'manage:disputes', 'view:audit_logs'],
  risk_security_officer: ['view:profile', 'manage:verification', 'manage:disputes', 'access:admin_tools', 'view:audit_logs'],
  platform_admin: ['view:profile', 'edit:profile', 'manage:roles', 'manage:permissions', 'view:audit_logs', 'create:products', 'edit:products', 'manage:inventory', 'create:invoices', 'send:payment_requests', 'view:customer_info', 'manage:orders', 'manage:bookings', 'manage:business_staff', 'view:transactions', 'manage:verification', 'manage:restaurant_verification', 'manage:restaurant', 'manage:restaurant_menu', 'manage:restaurant_orders', 'manage:disputes', 'access:admin_tools'],
  super_admin: ['view:profile', 'edit:profile', 'manage:roles', 'manage:permissions', 'view:audit_logs', 'create:products', 'edit:products', 'manage:inventory', 'create:invoices', 'send:payment_requests', 'view:customer_info', 'manage:orders', 'manage:bookings', 'manage:business_staff', 'view:transactions', 'manage:verification', 'manage:disputes', 'access:admin_tools'],
  // Administrator is a standard administrative role, not a platform or Super Admin role.
  // RBAC-management permissions remain exclusive to platform_admin/super_admin.
  administrator: ['view:profile', 'edit:profile', 'access:admin_tools', 'view:audit_logs'],
};

export function hasRolePermission(roles: readonly Role[], customPermissions: readonly Permission[], permission: Permission): boolean {
  if (customPermissions.includes(permission)) return true;
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export type DashboardId =
  | 'personal'
  | 'uniquepay'
  | 'store_seller'
  | 'business'
  | 'institution'
  | 'operations'
  | 'active_edge'
  | 'unique_ai'
  | 'finance_settlement'
  | 'security_risk'
  | 'platform_admin'
  | 'super_admin';

/**
 * Canonical dashboard access policy. This is the source of truth for workspace
 * visibility; individual actions remain controlled by Permission.
 */
export const DASHBOARD_ACCESS_ROLES: Record<DashboardId, readonly Role[]> = {
  personal: [
    'customer', 'buyer', 'seller', 'business_owner', 'staff_member', 'farmer',
    'service_provider', 'school_administrator', 'parent', 'healthcare_provider',
    'property_owner', 'hotel_owner', 'driver', 'logistics_provider', 'moderator',
    'administrator', 'partner', 'developer', 'finance_officer', 'risk_security_officer',
    'platform_admin', 'super_admin',
  ],
  uniquepay: [
    'customer', 'buyer', 'seller', 'business_owner', 'staff_member', 'finance_officer',
    'platform_admin', 'super_admin', 'administrator',
  ],
  store_seller: [
    'seller', 'business_owner', 'staff_member', 'platform_admin', 'super_admin', 'administrator',
  ],
  business: [
    'business_owner', 'staff_member', 'seller', 'platform_admin', 'super_admin', 'administrator',
  ],
  institution: [
    'school_administrator', 'business_owner', 'staff_member', 'platform_admin', 'super_admin', 'administrator',
  ],
  operations: [
    'service_provider', 'driver', 'logistics_provider', 'staff_member', 'business_owner',
    'platform_admin', 'super_admin', 'administrator',
  ],
  active_edge: [
    'customer', 'buyer', 'seller', 'business_owner', 'staff_member', 'service_provider',
    'school_administrator', 'parent', 'healthcare_provider', 'property_owner', 'hotel_owner',
    'driver', 'logistics_provider', 'moderator', 'partner', 'developer',
    'platform_admin', 'super_admin', 'administrator',
  ],
  unique_ai: [
    'customer', 'buyer', 'seller', 'business_owner', 'staff_member', 'farmer', 'service_provider',
    'school_administrator', 'parent', 'healthcare_provider', 'property_owner', 'hotel_owner',
    'driver', 'logistics_provider', 'moderator', 'partner', 'developer', 'administrator',
    'platform_admin', 'super_admin',
  ],
  finance_settlement: [
    'finance_officer', 'platform_admin', 'super_admin',
  ],
  security_risk: [
    'risk_security_officer', 'moderator', 'platform_admin', 'super_admin',
  ],
  platform_admin: [
    'platform_admin', 'super_admin',
  ],
  super_admin: [
    'super_admin',
  ],
};

export function hasDashboardAccess(roles: readonly Role[], dashboardId: DashboardId): boolean {
  return roles.some((role) => DASHBOARD_ACCESS_ROLES[dashboardId].includes(role));
}

export function hasAnyRole(roles: readonly Role[], allowed: readonly Role[]): boolean {
  return roles.some((role) => allowed.includes(role));
}
