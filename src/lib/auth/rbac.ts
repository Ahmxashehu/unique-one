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
  platform_admin: ['view:profile', 'edit:profile', 'manage:roles', 'manage:permissions', 'view:audit_logs', 'create:products', 'edit:products', 'manage:inventory', 'create:invoices', 'send:payment_requests', 'view:customer_info', 'manage:orders', 'manage:bookings', 'manage:business_staff', 'view:transactions', 'manage:verification', 'manage:disputes', 'access:admin_tools'],
  super_admin: ['view:profile', 'edit:profile', 'manage:roles', 'manage:permissions', 'view:audit_logs', 'create:products', 'edit:products', 'manage:inventory', 'create:invoices', 'send:payment_requests', 'view:customer_info', 'manage:orders', 'manage:bookings', 'manage:business_staff', 'view:transactions', 'manage:verification', 'manage:disputes', 'access:admin_tools'],
  administrator: ['view:profile', 'edit:profile', 'access:admin_tools', 'manage:roles', 'manage:permissions', 'view:audit_logs'],
};

export function hasRolePermission(roles: readonly Role[], customPermissions: readonly Permission[], permission: Permission): boolean {
  if (customPermissions.includes(permission)) return true;
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export function hasAnyRole(roles: readonly Role[], allowed: readonly Role[]): boolean {
  return roles.some((role) => allowed.includes(role));
}
