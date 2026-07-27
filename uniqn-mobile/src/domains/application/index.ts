export type {
  ApplicationStatus,
  Application,
  CreateApplicationInput,
  ApplicationFilters,
  ConfirmApplicationInput,
  RejectApplicationInput,
  ApplicationStats,
  CancellationRequestStatus,
  CancellationRequest,
  RequestCancellationInput,
  ReviewCancellationInput,
  RecruitmentType,
  ConfirmApplicationInputV2,
} from '@/types/application';

export { APPLICATION_STATUS_COLORS, CANCELLATION_STATUS_LABELS } from '@/types/application';
export { APPLICATION_STATUS_LABELS } from '@/shared/status';

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

export { PRE_QUESTION_TYPE_LABELS } from '@/types/preQuestion';
export {
  initializePreQuestionAnswers,
  validateRequiredAnswers,
  findUnansweredRequired,
  updateAnswer,
} from '@/types/preQuestion';

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

export {
  ApplicationValidator,
  applicationValidator,
  type RoleCapacityResult,
  type ApplicationValidationResult,
  type ApplicationValidationError,
} from './ApplicationValidator';

export {
  buildPostingSlotCapacityMap,
  validateAssignmentSlotCapacity,
  type SlotCapacityIssue,
  type SlotCapacityValidationResult,
} from './slotCapacity';

// ApplicationStatusMachine 은 제거됐다(2026-07-27). 전이표·상태 메타·취소 가드를 담고 있었지만
// 앱 어디서도 소비하지 않았고, 같은 규칙이 ApplicationRepository 에 독립 구현돼 그쪽만 실행됐다.
// 규칙이 두 벌이면 다음 수정자가 죽은 쪽을 고칠 위험이 있어 단일화했다.
