/**
 * 스태프 도메인 모듈
 *
 * @description Phase 7 - 도메인 모듈 구조 완성
 * 스태프 관련 도메인 로직을 중앙에서 export
 *
 * ## 향후 확장 계획
 * - StaffValidator: 스태프 유효성 검증
 * - StaffMatcher: 역할 매칭 로직
 * - StaffRanker: 평가 및 순위 산정
 */

// ============================================================================
// Types (Re-export from @/types)
// ============================================================================

// 공통 타입 (스태프 관련)
export type {
  UserRole,
  StaffRole,
  Staff,
} from '@/types/common';

// 사용자 프로필
export type {
  UserProfile,
  FirestoreUserProfile,
  EditableProfileFields,
  ProfileViewFields,
  MyDataEditableFields,
} from '@/types/user';

// 확정 스태프 타입
export type {
  ConfirmedStaffStatus,
  ConfirmedStaff,
  ConfirmedStaffGroup,
  GroupedConfirmedStaff,
  ConfirmedStaffFilters,
  UpdateStaffRoleInput,
  UpdateWorkTimeInput,
  DeleteConfirmedStaffInput,
  ConfirmedStaffStats,
} from '@/types/confirmedStaff';

export {
  CONFIRMED_STAFF_STATUS_LABELS,
  CONFIRMED_STAFF_STATUS_COLORS,
  groupStaffByDate,
  sortStaffByStatus,
  workLogToConfirmedStaff,
  calculateStaffStats,
} from '@/types/confirmedStaff';

// 신고 타입 (스태프 신고)
export type {
  EmployeeReportType,
  ReportTypeInfo,
  ReportStatus,
  Report,
  CreateReportInput,
  ReviewReportInput,
} from '@/types/report';

export {
  EMPLOYEE_REPORT_TYPES,
  EMPLOYEE_REPORT_TYPE_LABELS,
  REPORT_SEVERITY_COLORS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_COLORS,
  getReportTypeInfo,
  getReportSeverity,
} from '@/types/report';
