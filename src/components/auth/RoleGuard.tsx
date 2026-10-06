import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Role, Permission } from '../../lib/os/types';
import { hasDashboardAccess, type DashboardId } from '../../lib/auth/rbac';
import BusinessAccessGuard from './BusinessAccessGuard';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: Role;
  requiredPermission?: Permission;
  dashboard?: DashboardId;
  fallback?: React.ReactNode;
}

export default function RoleGuard({ children, requiredRole, requiredPermission, dashboard, fallback }: RoleGuardProps) {
  const { loading, isAuthenticated, userData, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!isAuthenticated || !userData || userData.status !== 'active') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  let hasAccess = true;

  if (requiredRole && !hasRole(requiredRole)) hasAccess = false;
  if (requiredPermission && !hasPermission(requiredPermission)) hasAccess = false;
  if (dashboard && !hasDashboardAccess(userData.roles ?? [], dashboard)) hasAccess = false;

  if (!hasAccess) {
    if (fallback !== undefined) return <>{fallback}</>;
    return <Navigate to="/os/dashboard" replace />;
  }

  if (dashboard === 'business') {
    return <BusinessAccessGuard>{children}</BusinessAccessGuard>;
  }

  return <>{children}</>;
}
