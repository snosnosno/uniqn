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
  DeleteConfirmedStaffContext,
  MarkNoShowContext,
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
