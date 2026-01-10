/**
 * UNIQN Mobile - 타입 정의 중앙 인덱스
 *
 * @description 프로젝트의 모든 타입들을 중앙에서 관리하고 export
 * @version 2.0.0
 *
 * ## 순환 의존성 방지 가이드
 *
 * 1. 타입 전용 import 사용: `import type { X } from '@/types'`
 * 2. 함수 import는 해당 모듈에서 직접: `import { fn } from './someModule'`
 * 3. 런타임 함수는 가급적 이 파일에서 re-export 하지 않음 (상수/유틸만 예외)
 *
 * ## 타입 명명 규칙
 *
 * - DateSpecificRequirement: dateRequirement.ts 정식 버전 사용
 * - TimeSlot: dateRequirement.ts 정식 버전 사용
 * - RoleRequirement: dateRequirement.ts 정식 버전 (폼용) / JobRoleStats (공고 통계용)
 * - Legacy*: 하위 호환성을 위한 레거시 타입 (신규 코드에서 사용 금지)
 */

// 공통 타입
export type {
  FirebaseDocument,
  UserRole,
  User,
  StaffRole,
  Staff,
  ApiResponse,
  PaginationInfo,
  FormErrors,
  Location,
  DateString,
  TimeString,
} from './common';

export { toDate } from './common';

// 인증 타입
export type {
  AuthStatus,
  AuthUser,
  LoginRequest,
  SignUpRequest,
  ResetPasswordRequest,
  VerificationStatus,
  PhoneVerification,
  UserVerificationStatus,
  SocialProvider,
  ConsentItems,
  SessionInfo,
} from './auth';

// 구인공고 타입
export type {
  JobPostingStatus,
  SalaryType,
  SalaryInfo,
  Allowances,
  TaxSettings,
  JobRoleStats,
  RoleRequirement,
  JobPosting,
  JobPostingFilters,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  JobPostingCard,
} from './jobPosting';

export { toJobPostingCard } from './jobPosting';

// 날짜별 요구사항 타입 (정식 버전 - 신규 코드에서 사용)
export type {
  RoleRequirement as FormRoleRequirement,
  TimeSlot as FormTimeSlot,
  DateSpecificRequirement as FormDateSpecificRequirement,
  DateConstraint,
} from './jobPosting/dateRequirement';

export {
  getDateString,
  sortDateRequirements as sortFormDateRequirements,
  createDefaultTimeSlot,
  createDefaultRole,
} from './jobPosting/dateRequirement';

// 지원서 타입
export type {
  ApplicationStatus,
  Application,
  CreateApplicationInput,
  ApplicationFilters,
  ConfirmApplicationInput,
  RejectApplicationInput,
  ApplicationStats,
  // 취소 요청 관련 타입
  CancellationRequestStatus,
  CancellationRequest,
  RequestCancellationInput,
  ReviewCancellationInput,
} from './application';

export { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, CANCELLATION_STATUS_LABELS } from './application';

// 지원서 v2.0 추가 타입
export type {
  RecruitmentType,
  CreateApplicationInputV2,
  ConfirmApplicationInputV2,
} from './application';

// Assignment v2.0 타입
export type {
  DurationType,
  AssignmentDuration,
  CheckMethod,
  Assignment,
} from './assignment';

export {
  getAssignmentRole,
  getAssignmentRoles,
  isValidAssignment,
  createSimpleAssignment,
  createGroupedAssignment,
} from './assignment';

// 공고 타입별 설정
export type {
  PostingType,
  FixedConfig,
  FixedJobPostingData,
  WorkSchedule,
  RoleWithCount,
  TournamentConfig,
  UrgentConfig,
  // 레거시 타입 (하위 호환성 - 신규 코드에서 사용 금지)
  LegacyRoleRequirement,
  LegacyTimeSlot,
  LegacyDateSpecificRequirement,
  TimeSlot,
  DateSpecificRequirement,
} from './postingConfig';

export {
  POSTING_TYPE_LABELS,
  POSTING_TYPE_BADGE_STYLES,
  getDateFromRequirement,
  sortDateRequirements,
} from './postingConfig';

// 사전질문 타입
export type { PreQuestion, PreQuestionAnswer } from './preQuestion';

export {
  PRE_QUESTION_TYPE_LABELS,
  initializePreQuestionAnswers,
  validateRequiredAnswers,
  findUnansweredRequired,
  updateAnswer,
} from './preQuestion';

// 지원서 이력 관리
export type {
  OriginalApplication,
  ConfirmationHistoryEntry,
  HistorySummary,
} from './applicationHistory';

export {
  createHistoryEntry,
  addCancellationToEntry,
  findActiveConfirmation,
  countConfirmations,
  countCancellations,
  createHistorySummary,
} from './applicationHistory';

// 알림 타입
export type {
  NotificationCategory,
  NotificationType,
  NotificationPriority,
  NotificationData,
  NotificationSettings,
  NotificationFilter,
  NotificationStats,
} from './notification';

export {
  NotificationCategory as NotificationCategoryConst,
  NotificationType as NotificationTypeConst,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_CATEGORY_LABELS,
  toDateFromTimestamp,
  createDefaultNotificationSettings,
} from './notification';

// 스케줄 타입
export type {
  AttendanceStatus,
  ScheduleType,
  PayrollStatus,
  ScheduleEvent,
  ScheduleFilters,
  ScheduleStats,
  CalendarView,
  ScheduleGroup,
  AttendanceRequest,
  WorkLog,
  WorkTimeModification,
  // QR 코드 타입
  QRCodeAction,
  QRCodeData,
  CreateQRCodeRequest,
  QRCodeScanResult,
  QRCodeValidationResult,
} from './schedule';

export {
  SCHEDULE_COLORS,
  ATTENDANCE_STATUS_COLORS,
  SCHEDULE_TYPE_LABELS,
  ATTENDANCE_STATUS_LABELS,
} from './schedule';

// 공고 작성 폼 타입 (v2.0)
export type {
  JobPostingFormData,
  TournamentDay,
  FormRoleWithCount,
} from './jobPostingForm';
export {
  INITIAL_JOB_POSTING_FORM_DATA,
  DEFAULT_ROLES,
  POSTING_TYPE_INFO,
  validateStep,
  validateForm,
} from './jobPostingForm';

// Admin 타입
export type {
  AdminUser,
  AdminUserProfile,
  AdminPenalty,
  PenaltyType,
  AdminUserFilters,
  AdminUserSortField,
  UpdateUserRoleInput,
  UpdateUserInput,
  CreatePenaltyInput,
} from './admin';

export {
  PENALTY_TYPE_LABELS,
  ADMIN_USER_SORT_LABELS,
  USER_ROLE_LABELS,
  USER_ROLE_BADGE_VARIANT,
  COUNTRIES,
  getCountryByCode,
} from './admin';
