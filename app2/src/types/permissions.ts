// 확장된 권한 시스템 타입 정의
export type PermissionScope = 'none' | 'own' | 'team' | 'all';

export interface ExtendedRolePermissions {
  // 기본 역할
  role: 'admin' | 'manager' | 'staff';

  // 세분화된 권한
  permissions: {
    jobPostings: {
      view: PermissionScope;
      create: PermissionScope;
      edit: PermissionScope;
      delete: PermissionScope;
      manageApplicants: PermissionScope;
      viewAnalytics: PermissionScope;
    };
    staff: {
      view: PermissionScope;
      edit: PermissionScope;
      delete: PermissionScope;
      approve: PermissionScope;
    };
    schedules: {
      view: PermissionScope;
      edit: PermissionScope;
      requestChanges: PermissionScope;
      approveChanges: PermissionScope;
    };
    announcements: {
      view: PermissionScope;
      create: PermissionScope;
      edit: PermissionScope;
      delete: PermissionScope;
    };
    payroll: {
      viewOwn: boolean;
      viewAll: boolean;
      process: boolean;
    };
    system: {
      manageUsers: boolean;
      viewLogs: boolean;
      manageSettings: boolean;
    };
  };
}

// 역할별 기본 권한 설정
export const DEFAULT_PERMISSIONS: Record<string, ExtendedRolePermissions> = {
  admin: {
    role: 'admin',
    permissions: {
      jobPostings: {
        view: 'all',
        create: 'all',
        edit: 'all',
        delete: 'all',
        manageApplicants: 'all',
        viewAnalytics: 'all',
      },
      staff: {
        view: 'all',
        edit: 'all',
        delete: 'all',
        approve: 'all',
      },
      schedules: {
        view: 'all',
        edit: 'all',
        requestChanges: 'all',
        approveChanges: 'all',
      },
      announcements: {
        view: 'all',
        create: 'all',
        edit: 'all',
        delete: 'all',
      },
      payroll: {
        viewOwn: true,
        viewAll: true,
        process: true,
      },
      system: {
        manageUsers: true,
        viewLogs: true,
        manageSettings: true,
      },
    },
  },

  manager: {
    role: 'manager',
    permissions: {
      jobPostings: {
        view: 'own', // ✅ 본인이 작성한 공고만 조회 가능
        create: 'own', // ✅ 공고 생성 가능
        edit: 'own', // ✅ 본인 공고 수정 가능
        delete: 'own', // ✅ 본인 공고 삭제 가능
        manageApplicants: 'own', // ✅ 본인 공고의 지원자 관리 가능
        viewAnalytics: 'own', // ✅ 본인 공고 분석 데이터 조회 가능
      },
      staff: {
        view: 'all',
        edit: 'team',
        delete: 'none',
        approve: 'team',
      },
      schedules: {
        view: 'all',
        edit: 'team',
        requestChanges: 'own',
        approveChanges: 'team',
      },
      announcements: {
        view: 'all',
        create: 'team',
        edit: 'own',
        delete: 'own',
      },
      payroll: {
        viewOwn: true,
        viewAll: false,
        process: false,
      },
      system: {
        manageUsers: false,
        viewLogs: false,
        manageSettings: false,
      },
    },
  },

  staff: {
    role: 'staff',
    permissions: {
      jobPostings: {
        view: 'own', // ✅ 본인이 작성한 공고만 조회 가능
        create: 'own', // ✅ 공고 생성 가능
        edit: 'own', // ✅ 본인 공고 수정 가능
        delete: 'own', // ✅ 본인 공고 삭제 가능
        manageApplicants: 'own', // ✅ 본인 공고의 지원자 관리 가능
        viewAnalytics: 'own', // ✅ 본인 공고 분석 데이터 조회 가능
      },
      staff: {
        view: 'own', // 본인 정보만 조회
        edit: 'own', // 본인 정보만 수정
        delete: 'none', // 삭제 불가
        approve: 'none', // 승인 권한 없음
      },
      schedules: {
        view: 'own', // 본인 스케줄만 조회
        edit: 'none', // 직접 수정 불가
        requestChanges: 'own', // ✅ 본인 일정 변경 요청 가능
        approveChanges: 'none', // 승인 권한 없음
      },
      announcements: {
        view: 'all', // 모든 공지 조회 가능
        create: 'none', // 공지 작성 불가
        edit: 'none', // 공지 수정 불가
        delete: 'none', // 공지 삭제 불가
      },
      payroll: {
        viewOwn: true, // ✅ 본인 급여 조회 가능
        viewAll: false, // 타인 급여 조회 불가
        process: false, // 급여 처리 권한 없음
      },
      system: {
        manageUsers: false, // 사용자 관리 불가
        viewLogs: false, // 로그 조회 불가
        manageSettings: false, // 설정 관리 불가
      },
    },
  },
};

// 권한 검사 유틸리티 함수
export class PermissionUtils {
  /**
   * 특정 권한을 확인합니다
   */
  static checkPermission(
    permissions: ExtendedRolePermissions | null,
    resource: keyof ExtendedRolePermissions['permissions'],
    action: string,
    currentUserId: string,
    targetUserId?: string
  ): boolean {
    if (!permissions) return false;

    const resourcePermissions = permissions.permissions[resource] as any;
    const actionPermission = resourcePermissions[action];

    if (actionPermission === 'none') return false;
    if (actionPermission === 'all') return true;
    if (actionPermission === 'own') return targetUserId === currentUserId;
    if (actionPermission === 'team') {
      // 팀 권한 로직 (추후 구현 - 현재는 all로 처리)
      return true;
    }

    // boolean 타입 권한 (payroll, system)
    return actionPermission === true;
  }

  /**
   * 공고에 대한 권한을 확인합니다 (작성자 ID 기반)
   */
  static checkJobPostingPermission(
    permissions: ExtendedRolePermissions | null,
    action: string,
    currentUserId: string,
    jobPostingCreatorId?: string
  ): boolean {
    if (!permissions) return false;

    const resourcePermissions = permissions.permissions.jobPostings as any;
    const actionPermission = resourcePermissions[action];

    if (actionPermission === 'none') return false;
    if (actionPermission === 'all') return true;
    if (actionPermission === 'own') return jobPostingCreatorId === currentUserId;
    if (actionPermission === 'team') {
      // 팀 권한 로직 (추후 구현 - 현재는 all로 처리)
      return true;
    }

    return false;
  }

  /**
   * 사용자 역할로부터 권한 객체를 가져옵니다
   */
  static getPermissionsByRole(role: string): ExtendedRolePermissions | null {
    return DEFAULT_PERMISSIONS[role] || null;
  }

  /**
   * 공고 관리 권한이 있는지 확인합니다 (스태프용 핵심 기능)
   */
  static canManageJobPostings(
    permissions: ExtendedRolePermissions | null,
    currentUserId: string
  ): boolean {
    if (!permissions) return false;

    return (
      this.checkPermission(permissions, 'jobPostings', 'view', currentUserId) &&
      this.checkPermission(permissions, 'jobPostings', 'manageApplicants', currentUserId)
    );
  }

  /**
   * 일정 변경 요청 권한이 있는지 확인합니다
   */
  static canRequestScheduleChanges(
    permissions: ExtendedRolePermissions | null,
    currentUserId: string
  ): boolean {
    if (!permissions) return false;

    return this.checkPermission(permissions, 'schedules', 'requestChanges', currentUserId);
  }

  /**
   * 일정 변경 승인 권한이 있는지 확인합니다
   */
  static canApproveScheduleChanges(
    permissions: ExtendedRolePermissions | null,
    currentUserId: string
  ): boolean {
    if (!permissions) return false;

    return this.checkPermission(permissions, 'schedules', 'approveChanges', currentUserId);
  }
}

// 권한 기반 라우팅을 위한 타입
export interface PermissionGuardProps {
  resource: keyof ExtendedRolePermissions['permissions'];
  action: string;
  targetUserId?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// 권한 컨텍스트를 위한 타입
export interface PermissionContextType {
  permissions: ExtendedRolePermissions | null;
  checkPermission: (
    resource: keyof ExtendedRolePermissions['permissions'],
    action: string,
    targetUserId?: string
  ) => boolean;
  checkJobPostingPermission: (action: string, jobPostingCreatorId?: string) => boolean;
  canViewJobPostings: boolean;
  canCreateJobPostings: boolean;
  canManageApplicants: boolean;
  canRequestScheduleChanges: boolean;
  canApproveScheduleChanges: boolean;
  canManageJobPostings: boolean;
}
