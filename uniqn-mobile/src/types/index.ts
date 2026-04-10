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
 */

// 역할 타입 (Phase 8 - 통합)
export type { UserRole, StaffRole, RoleFlags } from './role';

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

// 사용자 프로필 타입 (통합)
export type {
  UserProfile,
  FirestoreUserProfile,
  PortOneIdentityProfile,
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
  SocialProvider,
  ConsentItems,
  SessionInfo,
} from './auth';

// 구인공고 타입
export type {
  JobPostingDocumentV3,
  JobPostingEntity,
  JobPostingStatus,
  SalaryType,
  SalaryInfo,
  Allowances,
  TaxSettings,
  JobPostingAggregateStats,
  JobRoleStats,
  RoleRequirement,
  JobPosting,
  JobPostingFilters,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  SupportedReleasePostingType,
  SupportedReleasePostingSchedule,
  SupportedReleaseJobPosting,
  PostingLocation,
  PostingRoleCatalogEntry,
  PostingSchedule,
  PostingCompensation,
  PostingFacts,
  PostingWorkflow,
  PostingRoleAvailabilityItem,
  PostingRoleAvailability,
  PostingDateGroup,
  PostingScheduleDisplay,
  PostingCardDisplayContext,
  PostingSalaryRow,
  PostingSalaryDisplay,
  PostingApplicationEligibility,
  PostingSettlementContext,
  PostingAudience,
  PostingSurface,
  PostingCardViewModel,
  PostingDetailViewModel,
  PostingManagementViewModel,
  PostingRuntimeSnapshot,
  // 카드용 타입 (v2.0)
  CardRole,
  CardTimeSlot,
  CardDateRequirement,
  JobPostingCard,
} from './jobPosting';

// 지원서 타입
export type {
  ApplicationStatus,
  RecruitmentType,
  Application,
  CreateApplicationInput,
  ApplicationFilters,
  ConfirmApplicationInput,
  ConfirmApplicationInputV2,
  RejectApplicationInput,
  ApplicationStats,
  // 취소 요청 관련 타입
  CancellationRequestStatus,
  CancellationRequest,
  RequestCancellationInput,
  ReviewCancellationInput,
} from './application';

// Assignment 타입
export type {
  Assignment,
  AssignmentDuration,
  DurationType,
  CheckMethod,
  NormalizedAssignmentRole,
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
  TimeSlot,
  DateSpecificRequirement,
} from './postingConfig';

// 공고 작성 폼 타입
export type { FormRoleWithCount, JobPostingFormData } from './jobPostingForm';

// 사전질문 타입
export type { PreQuestion, PreQuestionAnswer } from './preQuestion';

// 지원서 이력 관리
export type {
  OriginalApplication,
  ConfirmationHistoryEntry,
  HistorySummary,
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

// 스케줄 타입
export type {
  AttendanceStatus,
  WorkLogStatus,
  ScheduleType,
  PayrollStatus,
  SchedulePostingProjection,
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

// 확정 스태프 타입
export type {
  ConfirmedStaffStatus,
  ConfirmedStaff,
  ConfirmedStaffGroup,
  UpdateWorkTimeInput,
  UpdateStaffRoleInput,
  DeleteConfirmedStaffInput,
  ConfirmedStaffFilters,
  GroupedConfirmedStaff,
  ConfirmedStaffStats,
} from './confirmedStaff';

// 정산 그룹 타입
export type { DateSettlementStatus, GroupedSettlement, GroupSettlementOptions } from './settlement';

export type { JobPostingDraft, JobPostingDraftSchedule } from './jobPostingDraft';

// 공고 템플릿 타입
export type {
  TemplateFormData,
  JobPostingTemplateData,
  JobPostingTemplate,
  CreateTemplateInput,
  TemplateListResult,
} from './jobTemplate';

// 신고 타입 (구인자 → 스태프)
export type {
  EmployeeReportType,
  ReportTypeInfo,
  ReportStatus,
  Report,
  CreateReportInput,
  ReviewReportInput,
} from './report';

// 리뷰/평가 타입 (버블 시스템)
export type {
  ReviewerType,
  ReviewSentiment,
  EmployerToStaffTag,
  StaffToEmployerTag,
  ReviewTag,
  ReviewTagInfo,
  BubbleScore,
  BubbleScoreColorRange,
  Review,
  CreateReviewInput,
  ReviewBlindResult,
} from './review';

// ============================================================================
// 통합 타입 (Unified Types)
// ============================================================================

// 역할 통합 타입
export type { RoleInfo } from './unified';

// 시간대 통합 타입
export type { TimeSlotInfo } from './unified';

// 일정 통합 타입 (Discriminated Union)
export type {
  JobScheduleType,
  DatedScheduleInfo,
  FixedScheduleInfo,
  NormalizedSchedule,
  NormalizedScheduleList,
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

export type {
  BoardType,
  BoardSource,
  BoardVisibility,
  BoardPostStatus,
  BoardCommentStatus,
  BoardVoteType,
  BoardMemberRole,
  BoardReportTargetType,
  BoardReportStatus,
  BoardAuthorRole,
  CommentReactionType,
  BoardImageAttachment,
  BoardJobSummary,
  BoardPost,
  BoardComment,
  BoardCommentNode,
  BoardVote,
  BoardCommentReaction,
  BoardMembership,
  BoardReport,
  BoardAdminReportRecord,
  BoardHomeData,
  BoardMentionCandidate,
  FetchBoardPostsInput,
  CreateBoardPostInput,
  UpdateBoardPostInput,
  CreateBoardCommentInput,
  UpdateBoardCommentInput,
  CreateBoardReportInput,
  ScheduleBoardSyncInput,
  ScheduleMembershipSyncItem,
  BoardReportFilterStatus,
  BoardReportResolutionStatus,
} from './board';
