/**
 * UNIQN Mobile - 타입 정의 중앙 인덱스
 *
 * @description 프로젝트의 모든 타입들을 중앙에서 관리하고 export
 * @version 1.0.0
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
  RoleRequirement,
  JobPosting,
  JobPostingFilters,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  JobPostingCard,
} from './jobPosting';

export { toJobPostingCard } from './jobPosting';

// 지원서 타입
export type {
  ApplicationStatus,
  Application,
  CreateApplicationInput,
  ApplicationFilters,
  ConfirmApplicationInput,
  RejectApplicationInput,
  ApplicationStats,
} from './application';

export { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from './application';

// 알림 타입
export type {
  NotificationCategory,
  NotificationType,
  NotificationPriority,
  NotificationActionType,
  NotificationAction,
  Notification,
  NotificationSettings,
  NotificationFilter,
  NotificationStats,
  CreateNotificationInput,
} from './notification';

export { NOTIFICATION_TYPE_LABELS, toDateFromTimestamp } from './notification';

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
} from './schedule';

export {
  SCHEDULE_COLORS,
  ATTENDANCE_STATUS_COLORS,
  SCHEDULE_TYPE_LABELS,
  ATTENDANCE_STATUS_LABELS,
} from './schedule';
