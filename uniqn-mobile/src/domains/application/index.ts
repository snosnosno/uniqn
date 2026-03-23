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
  updateDateSpecificRequirementsFilled,
  updatePostingScheduleFilled,
} from './DateRequirementUpdater';

export {
  buildPostingSlotCapacityMap,
  validateAssignmentSlotCapacity,
  type SlotCapacityIssue,
  type SlotCapacityValidationResult,
} from './slotCapacity';

export {
  ApplicationStatusMachine,
  applicationStatusMachine,
  type StatusAction,
  type TransitionResult,
  type StatusMetadata,
} from './ApplicationStatusMachine';
