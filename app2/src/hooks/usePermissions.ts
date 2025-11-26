import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import {
  ExtendedRolePermissions,
  PermissionUtils,
  PermissionContextType,
} from '../types/permissions';

/**
 * 권한 관리를 위한 커스텀 훅
 * 사용자의 역할에 따른 권한을 관리하고 권한 검사 함수를 제공합니다
 */
export function usePermissions(): PermissionContextType {
  const { currentUser, role } = useAuth();
  const [permissions, setPermissions] = useState<ExtendedRolePermissions | null>(null);

  // 사용자 역할이 변경될 때 권한 정보 업데이트
  useEffect(() => {
    logger.info('usePermissions role 변경', {
      component: 'usePermissions',
      data: { role, currentUser: currentUser?.uid },
    });

    if (role) {
      const rolePermissions = PermissionUtils.getPermissionsByRole(role);
      logger.info('권한 설정 결과', {
        component: 'usePermissions',
        data: {
          role,
          permissions: rolePermissions,
          canManageApplicants: rolePermissions?.permissions.jobPostings.manageApplicants,
        },
      });
      setPermissions(rolePermissions);
    } else {
      logger.info('권한 초기화', { component: 'usePermissions' });
      setPermissions(null);
    }
  }, [role, currentUser?.uid]);

  // 권한 검사 함수
  const checkPermission = useCallback(
    (
      resource: keyof ExtendedRolePermissions['permissions'],
      action: string,
      targetUserId?: string
    ): boolean => {
      if (!currentUser || !permissions) return false;

      return PermissionUtils.checkPermission(
        permissions,
        resource,
        action,
        currentUser.uid,
        targetUserId
      );
    },
    [permissions, currentUser]
  );

  // 공고별 권한 검사 함수
  const checkJobPostingPermission = useCallback(
    (action: string, jobPostingCreatorId?: string): boolean => {
      if (!currentUser || !permissions) return false;

      return PermissionUtils.checkJobPostingPermission(
        permissions,
        action,
        currentUser.uid,
        jobPostingCreatorId
      );
    },
    [permissions, currentUser]
  );

  // 자주 사용되는 권한들을 미리 계산하여 성능 최적화
  const computedPermissions = useMemo(() => {
    if (!currentUser || !permissions) {
      return {
        canViewJobPostings: false,
        canCreateJobPostings: false,
        canManageApplicants: false,
        canRequestScheduleChanges: false,
        canApproveScheduleChanges: false,
        canManageJobPostings: false,
      };
    }

    return {
      canViewJobPostings: permissions.permissions.jobPostings.view !== 'none',
      canCreateJobPostings: permissions.permissions.jobPostings.create !== 'none',
      canManageApplicants: permissions.permissions.jobPostings.manageApplicants !== 'none',
      canRequestScheduleChanges: permissions.permissions.schedules.requestChanges !== 'none',
      canApproveScheduleChanges: permissions.permissions.schedules.approveChanges !== 'none',
      canManageJobPostings: PermissionUtils.canManageJobPostings(permissions, currentUser.uid),
    };
  }, [permissions, currentUser]);

  return {
    permissions,
    checkPermission,
    checkJobPostingPermission,
    ...computedPermissions,
  };
}

/**
 * 특정 리소스에 대한 권한을 확인하는 간단한 훅
 */
export function useResourcePermission(
  resource: keyof ExtendedRolePermissions['permissions'],
  action: string,
  targetUserId?: string
): boolean {
  const { checkPermission } = usePermissions();

  return useMemo(() => {
    return checkPermission(resource, action, targetUserId);
  }, [checkPermission, resource, action, targetUserId]);
}

/**
 * 공고 관리 권한을 확인하는 전용 훅 (스태프용 핵심 기능)
 */
export function useJobPostingPermissions(_eventId?: string) {
  const { permissions, checkPermission } = usePermissions();
  const { currentUser } = useAuth();

  return useMemo(() => {
    if (!currentUser || !permissions) {
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageApplicants: false,
        canViewAnalytics: false,
        hasAnyAccess: false,
      };
    }

    const canView = checkPermission('jobPostings', 'view');
    const canEdit = checkPermission('jobPostings', 'edit');
    const canDelete = checkPermission('jobPostings', 'delete');
    const canManageApplicants = checkPermission('jobPostings', 'manageApplicants');
    const canViewAnalytics = checkPermission('jobPostings', 'viewAnalytics');

    return {
      canView,
      canEdit,
      canDelete,
      canManageApplicants,
      canViewAnalytics,
      hasAnyAccess: canView || canManageApplicants,
    };
  }, [permissions, currentUser, checkPermission]);
}

/**
 * 스케줄 관리 권한을 확인하는 전용 훅
 */
export function useSchedulePermissions(targetUserId?: string) {
  const { permissions, checkPermission } = usePermissions();
  const { currentUser } = useAuth();

  return useMemo(() => {
    if (!currentUser || !permissions) {
      return {
        canView: false,
        canEdit: false,
        canRequestChanges: false,
        canApproveChanges: false,
      };
    }

    return {
      canView: checkPermission('schedules', 'view', targetUserId),
      canEdit: checkPermission('schedules', 'edit', targetUserId),
      canRequestChanges: checkPermission('schedules', 'requestChanges', targetUserId),
      canApproveChanges: checkPermission('schedules', 'approveChanges', targetUserId),
    };
  }, [permissions, currentUser, checkPermission, targetUserId]);
}

/**
 * 스태프 관리 권한을 확인하는 전용 훅
 */
export function useStaffPermissions(targetUserId?: string) {
  const { permissions, checkPermission } = usePermissions();
  const { currentUser } = useAuth();

  return useMemo(() => {
    if (!currentUser || !permissions) {
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
      };
    }

    return {
      canView: checkPermission('staff', 'view', targetUserId),
      canEdit: checkPermission('staff', 'edit', targetUserId),
      canDelete: checkPermission('staff', 'delete', targetUserId),
      canApprove: checkPermission('staff', 'approve', targetUserId),
    };
  }, [permissions, currentUser, checkPermission, targetUserId]);
}
