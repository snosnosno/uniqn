/**
 * 지원서 도메인 모듈
 *
 * @description Phase 7 + Phase 8 - 도메인 모듈 구조 완성
 * 지원서 관련 도메인 로직을 중앙에서 export
 *
 * ## 도메인 클래스
 * - ApplicationValidator: 지원서 유효성 검증 (Phase 8)
 * - ApplicationStatusMachine: 상태 전이 관리 (Phase 8)
 *
 * ## 향후 확장 계획
 * - ApplicationMerger: 중복 지원 처리
 */

// ============================================================================
// Types (Re-export from @/types)
// ============================================================================

export type {
  // 지원서 기본 타입
  ApplicationStatus,
  Application,
  CreateApplicationInput,
  ApplicationFilters,
  ConfirmApplicationInput,
  RejectApplicationInput,
  ApplicationStats,
  // 취소 요청 타입
  CancellationRequestStatus,
  CancellationRequest,
  RequestCancellationInput,
  ReviewCancellationInput,
  // v2.0 타입
  RecruitmentType,
  ConfirmApplicationInputV2,
} from '@/types/application';

export {
  APPLICATION_STATUS_COLORS,
  CANCELLATION_STATUS_LABELS,
} from '@/types/application';

export { APPLICATION_STATUS_LABELS } from '@/shared/status';

// Assignment v3.0 타입
export type {
  DurationType,
  AssignmentDuration,
  CheckMethod,
  Assignment,
  CreateSimpleAssignmentOptions,
} from '@/types/assignment';

export {
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
  TBA_TIME_MARKER,
  getAssignmentRole,
  getAssignmentRoles,
  isValidAssignment,
  createSimpleAssignment,
  createGroupedAssignment,
  createMultiRoleAssignment,
} from '@/types/assignment';

// 지원서 이력 관리
export type {
  OriginalApplication,
  ConfirmationHistoryEntry,
  HistorySummary,
} from '@/types/applicationHistory';

export {
  createHistoryEntry,
  addCancellationToEntry,
  findActiveConfirmation,
  countConfirmations,
  countCancellations,
  createHistorySummary,
} from '@/types/applicationHistory';

// ============================================================================
// Domain Classes (Phase 8)
// ============================================================================

// ApplicationValidator - 지원서 검증 로직
export {
  ApplicationValidator,
  applicationValidator,
  type RoleCapacityResult,
  type ApplicationValidationResult,
  type ApplicationValidationError,
} from './ApplicationValidator';

// ApplicationStatusMachine - 상태 전이 관리
export {
  ApplicationStatusMachine,
  applicationStatusMachine,
  type StatusAction,
  type TransitionResult,
  type StatusMetadata,
} from './ApplicationStatusMachine';
