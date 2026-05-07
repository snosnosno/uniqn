/**
 * UNIQN Mobile - Repository Interfaces Barrel Export
 *
 * @description Repository 인터페이스 중앙 export
 * @version 1.0.0
 */

// Application Repository
export type {
  IApplicationRepository,
  ApplicationWithJob,
  ApplyContext,
  ApplicantListWithStats,
  SubscribeCallbacks,
  ConfirmWithHistoryResult,
  CancelConfirmationResult,
} from './IApplicationRepository';

// JobPosting Repository
export type {
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
  JobPostingSubscriptionCallbacks,
} from './IJobPostingRepository';

// WorkLog Repository
export type {
  IWorkLogRepository,
  WorkLogStats,
  MonthlyPayrollSummary,
  WorkLogFilterOptions,
} from './IWorkLogRepository';

// User Repository
export type {
  IUserRepository,
  DeletionReason,
  DeletionRequest,
  UserDataExport,
  EmployerRegistrationInput,
} from './IUserRepository';

// EventQR Repository
export type { IEventQRRepository } from './IEventQRRepository';

// Notification Repository
export type { INotificationRepository, GetNotificationsOptions } from './INotificationRepository';

// Report Repository
export type {
  IReportRepository,
  CreateReportContext,
  ReportPaginationCursor,
  FetchReportsOptions,
  FetchReportsResult,
  ReportFilters,
  ReportCounts,
} from './IReportRepository';

// Settlement Repository
export type {
  ISettlementRepository,
  UpdateWorkTimeContext,
  SettleWorkLogContext,
  BulkSettlementContext,
  SettlementResultDTO,
  BulkSettlementResultDTO,
} from './ISettlementRepository';

// ConfirmedStaff Repository
export type {
  IConfirmedStaffRepository,
  UpdateRoleContext,
  UpdateConfirmedStaffWorkTimeContext,
  MarkNoShowContext,
  UpdateStaffStatusContext,
  ConfirmedStaffSubscriptionCallbacks,
} from './IConfirmedStaffRepository';

// Announcement Repository
export type {
  IAnnouncementRepository,
  AnnouncementPaginationCursor,
  FetchAnnouncementsOptions,
  FetchAnnouncementsResult,
  AnnouncementCountByStatus,
} from './IAnnouncementRepository';

// Inquiry Repository
export type {
  IInquiryRepository,
  InquiryPaginationCursor,
  FetchInquiriesOptions,
  FetchInquiriesResult,
  CreateInquiryContext,
} from './IInquiryRepository';

// Admin Repository
export type {
  IAdminRepository,
  DashboardCounts,
  DailyCount,
  SystemMetricsData,
} from './IAdminRepository';

// Review Repository
export type {
  IReviewRepository,
  CreateReviewContext,
  ReviewPaginationCursor,
  PaginatedReviews,
} from './IReviewRepository';

// Template Repository
export type { ITemplateRepository } from './ITemplateRepository';

// Board Repository
export type {
  IBoardRepository,
  BoardRepositoryType,
  FetchBoardRepositoryPostsOptions,
  FetchScheduleMembershipsOptions,
  FetchBoardReportsOptions,
} from './IBoardRepository';

// 워크스페이스 협업 편집 (PR #2)
export type {
  IWorkspaceRepository,
  IWorkspaceMemberRepository,
  IWorkspaceInvitationRepository,
} from './IWorkspaceRepository';
