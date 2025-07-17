import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface RoleBasedRouteProps {
  allowedRoles: string[];
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ allowedRoles }) => {
  const { role, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <div className="p-6 text-center">{t('loading')}</div>;
  }

  // Check if the user's role is included in the allowed roles
  if (role && allowedRoles.includes(role)) {
    return <Outlet />;
  }

  // If not authenticated or not authorized, redirect
  return <Navigate to="/profile" replace />;
};

export default RoleBasedRoute;
