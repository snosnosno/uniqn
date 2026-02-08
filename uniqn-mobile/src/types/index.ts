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

// 역할 타입 (Phase 8 - 통합)
export type { UserRole, StaffRole, RoleFlags } from './role';
export {
  USER_ROLE_HIERARCHY,
  USER_ROLE_LABELS,
  VALID_USER_ROLES,
  STAFF_ROLE_LABELS,
  VALID_STAFF_ROLES,
  isUserRole,
  isStaffRole,
  getUserRoleLabel,
  getStaffRoleLabel,
} from './role';

// 공통 타입
export type {
  FirebaseDocument,
  User,
  Staff,
  ApiResponse,
  PaginationInfo,
  FormErrors,
  Location,
  DateString,
  TimeString,
} from './common';

export { toDate } from './common';

// 사용자 프로필 타입 (통합)
export type {
  UserProfile,
  FirestoreUserProfile,
  EditableProfileFields,
  ProfileViewFields,
  MyDataEditableFields,
} from './user';

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
  // 카드용 타입 (v2.0)
  CardRole,
  CardTimeSlot,
  CardDateRequirement,
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

export { APPLICATION_STATUS_COLORS, CANCELLATION_STATUS_LABELS } from './application';
export { APPLICATION_STATUS_LABELS } from '@/shared/status';

// 지원서 v2.0 추가 타입
export type { RecruitmentType, ConfirmApplicationInputV2 } from './application';

// Assignment v3.0 타입 (role/roles → roleIds 통합)
export type {
  DurationType,
  AssignmentDuration,
  CheckMethod,
  Assignment,
  CreateSimpleAssignmentOptions,
} from './assignment';

export {
  // 상수
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
  TBA_TIME_MARKER,
  // 함수
  getAssignmentRole,
  getAssignmentRoles,
  isValidAssignment,
  createSimpleAssignment,
  createGroupedAssignment,
  createMultiRoleAssignment,
} from './assignment';

// 공고 타입별 설정
export type {
  PostingType,
  TournamentApprovalStatus,
  FixedConfig,
  FixedJobPostingData,
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
  WorkLogStatus,
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
  RoleChangeHistory,
  SettlementModification,
  // QR 코드 타입
  QRCodeAction,
  QRCodeScanResult,
  QRScanError,
  // Event QR 타입 (eventQRCodes 컬렉션)
  EventQRCode,
  EventQRDisplayData,
  GenerateEventQRInput,
  EventQRScanResult,
  EventQRValidationResult,
  // 통합 스케줄 타입 (연속/다중 날짜 표시용)
  DateStatus,
  GroupedScheduleEvent,
} from './schedule';

export {
  toAttendanceStatus,
  isGroupedScheduleEvent,
  SCHEDULE_COLORS,
  ATTENDANCE_STATUS_COLORS,
} from './schedule';
export { SCHEDULE_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/shared/status';

// 정산 그룹핑 타입
export type { DateSettlementStatus, GroupedSettlement, GroupSettlementOptions } from './settlement';

export { isGroupedSettlement } from './settlement';

// 공고 작성 폼 타입 (v2.0)
export type { JobPostingFormData, TournamentDay, FormRoleWithCount } from './jobPostingForm';
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
  // USER_ROLE_LABELS는 role.ts에서 export (Phase 8)
  USER_ROLE_BADGE_VARIANT,
  COUNTRIES,
  getCountryByCode,
} from './admin';

// 공고 템플릿 타입
export type {
  TemplateFormData,
  TemplateExcludedFields,
  JobPostingTemplate,
  CreateTemplateInput,
  TemplateListResult,
} from './jobTemplate';

export { extractTemplateData, templateToFormData } from './jobTemplate';

// 확정 스태프 타입 (v2.0 - 스태프 관리 탭)
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
} from './confirmedStaff';

export {
  CONFIRMED_STAFF_STATUS_LABELS,
  CONFIRMED_STAFF_STATUS_COLORS,
  groupStaffByDate,
  sortStaffByStatus,
  workLogToConfirmedStaff,
  calculateStaffStats,
} from './confirmedStaff';

// 신고 타입 (구인자 → 스태프)
export type {
  EmployeeReportType,
  ReportTypeInfo,
  ReportStatus,
  Report,
  CreateReportInput,
  ReviewReportInput,
} from './report';

export {
  EMPLOYEE_REPORT_TYPES,
  EMPLOYEE_REPORT_TYPE_LABELS,
  REPORT_SEVERITY_COLORS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_COLORS,
  getReportTypeInfo,
  getReportSeverity,
} from './report';

// ============================================================================
// 통합 타입 (Unified Types)
// ============================================================================

// 역할 통합 타입
export type { RoleInfo } from './unified';
export {
  getRoleDisplayName,
  createRoleInfo,
  isRoleFilled,
  getRemainingCount,
  findRoleById,
  filterAvailableRoles,
  getTotalRequiredCount,
  getTotalFilledCount,
  isAllRolesFilled,
} from './unified';

// 시간대 통합 타입
export type { TimeSlotInfo } from './unified';
export {
  createTimeSlotInfo,
  formatTimeSlotDisplay,
  getSlotTotalRequired,
  getSlotTotalFilled,
  isSlotFilled,
} from './unified';

// 일정 통합 타입 (Discriminated Union)
export type {
  JobScheduleType,
  DatedScheduleInfo,
  FixedScheduleInfo,
  NormalizedSchedule,
  NormalizedScheduleList,
} from './unified';
export {
  isDatedSchedule,
  isFixedSchedule,
  createDatedSchedule,
  createFixedSchedule,
  extractAllDates,
  extractAllRoles,
  formatFixedScheduleDisplay,
  formatDateDisplay,
} from './unified';

// 문의 타입
export type {
  InquiryCategory,
  InquiryStatus,
  Inquiry,
  InquiryAttachment,
  CreateInquiryInput,
  RespondInquiryInput,
  InquiryFilters,
  FAQItem,
  InquiryCategoryInfo,
} from './inquiry';

export {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_CONFIG,
  INQUIRY_STATUS_LABELS,
  FAQ_DATA,
  filterFAQByCategory,
  getCategoryInfo,
} from './inquiry';

// 공지사항 타입
export type {
  AnnouncementCategory,
  AnnouncementStatus,
  AnnouncementPriority,
  TargetAudience,
  AnnouncementImage,
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilters,
  AnnouncementCategoryInfo,
} from './announcement';

export {
  MAX_ANNOUNCEMENT_IMAGES,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_STATUS_CONFIG,
  ANNOUNCEMENT_STATUS_LABELS,
  ANNOUNCEMENT_PRIORITY_CONFIG,
  ANNOUNCEMENT_PRIORITY_LABELS,
  TARGET_AUDIENCE_LABELS,
  getCategoryInfo as getAnnouncementCategoryInfo,
  isAnnouncementForRole,
  getAnnouncementImages,
  sortAnnouncements,
} from './announcement';
