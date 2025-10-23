import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ExtendedRolePermissions } from '../../types/permissions';

interface RoleBasedRouteProps {
  allowedRoles: string[];
  // 새로운 권한 기반 접근 제어 (선택적)
  requiredPermission?: {
    resource: keyof ExtendedRolePermissions['permissions'];
    action: string;
  };
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ 
  allowedRoles, 
  requiredPermission 
}) => {
  const { role, loading } = useAuth();
  const { checkPermission } = usePermissions();
  const { t } = useTranslation();

  if (loading) {
    return <div className="p-6 text-center">{t('common.messages.loading')}</div>;
  }

  // 역할 기반 접근 제어 (기존 방식 유지)
  const hasRoleAccess = role && allowedRoles.includes(role);
  
  // 권한 기반 접근 제어 (새로운 방식)
  const hasPermissionAccess = requiredPermission ? 
    checkPermission(requiredPermission.resource, requiredPermission.action) : 
    true;

  // 역할과 권한 모두 확인
  if (hasRoleAccess && hasPermissionAccess) {
    return <Outlet />;
  }

  // 스태프가 공고 관리 페이지에 접근하려는 경우 특별 처리
  if (role === 'staff' && allowedRoles.includes('admin') && 
      checkPermission('jobPostings', 'manageApplicants')) {
    return <Outlet />;
  }

  // If not authenticated or not authorized, redirect
  return <Navigate to="/app/profile" replace />;
};

export default RoleBasedRoute;
