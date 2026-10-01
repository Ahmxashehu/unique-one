import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Role, Permission } from '../../lib/os/types';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: Role;
  requiredPermission?: Permission;
  fallback?: React.ReactNode;
}

export default function RoleGuard({ children, requiredRole, requiredPermission, fallback }: RoleGuardProps) {
  const { loading, isAuthenticated, userData, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!isAuthenticated || !userData || userData.status !== 'active') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  let hasAccess = true;

  if (requiredRole && !hasRole(requiredRole)) {
    hasAccess = false;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    hasAccess = false;
  }

  if (!hasAccess) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    return <Navigate to="/os/dashboard" replace />; // Redirect to dashboard if unauthorized
  }

  return <>{children}</>;
}
