import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionGuardProps } from '../../types/permissions';
import { useAuth } from '../../contexts/AuthContext';

/**
 * 권한 기반 접근 제어 컴포넌트
 * 사용자의 권한을 확인하여 접근을 허용하거나 차단합니다
 */
const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  resource, 
  action, 
  targetUserId,
  fallback,
  children 
}) => {
  const { checkPermission } = usePermissions();
  const { currentUser, loading } = useAuth();
  
  // 로딩 중인 경우
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-lg">권한 확인 중...</div>
      </div>
    );
  }
  
  // 로그인하지 않은 경우
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  // 권한 확인
  const hasPermission = checkPermission(resource, action, targetUserId);
  
  if (!hasPermission) {
    // 사용자 지정 fallback이 있는 경우 사용
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // 기본 접근 거부 페이지
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">접근 권한이 없습니다</h2>
          <p className="text-red-600 mb-4">
            이 페이지에 접근할 권한이 없습니다. 관리자에게 문의하세요.
          </p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mr-2"
          >
            이전 페이지로
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

/**
 * 조건부 렌더링을 위한 권한 체크 컴포넌트
 * 권한이 없어도 에러를 발생시키지 않고 단순히 렌더링하지 않습니다
 */
export const ConditionalRender: React.FC<PermissionGuardProps> = ({
  resource,
  action,
  targetUserId,
  children
}) => {
  const { checkPermission } = usePermissions();
  
  const hasPermission = checkPermission(resource, action, targetUserId);
  
  return hasPermission ? <>{children}</> : null;
};

/**
 * 역할 기반 조건부 렌더링 컴포넌트
 */
interface RoleGuardProps {
  allowedRoles: ('admin' | 'manager' | 'staff')[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallback = null
}) => {
  const { permissions } = usePermissions();
  
  if (!permissions || !allowedRoles.includes(permissions.role)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

/**
 * 스태프용 공고 관리 접근 권한 확인 컴포넌트
 */
interface JobPostingAccessGuardProps {
  requireManagement?: boolean; // 지원자 관리 권한까지 필요한지
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const JobPostingAccessGuard: React.FC<JobPostingAccessGuardProps> = ({
  requireManagement = false,
  children,
  fallback
}) => {
  const { checkPermission } = usePermissions();
  
  const canView = checkPermission('jobPostings', 'view');
  const canManage = checkPermission('jobPostings', 'manageApplicants');
  
  const hasAccess = requireManagement ? (canView && canManage) : canView;
  
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="text-yellow-800">
          <p className="font-medium">접근 제한</p>
          <p className="text-sm">
            {requireManagement 
              ? '공고 관리 권한이 필요합니다.' 
              : '공고 조회 권한이 필요합니다.'
            }
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default PermissionGuard;