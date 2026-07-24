/**
 * UNIQN Mobile - Repository Layer
 *
 * @description Repository 패턴으로 데이터 접근 추상화
 * @version 1.0.0
 *
 * ## 아키텍처
 *
 * ```
 * Service Layer → Repository Interface → Supabase Implementation
 *                         ↓
 *                 Mock Implementation (테스트용)
 * ```
 *
 * ## 사용법
 *
 * ```typescript
 * // 프로덕션: 싱글톤 인스턴스 사용
 * import { applicationRepository } from '@/repositories';
 * const apps = await applicationRepository.getByApplicantId(userId);
 *
 * // 테스트: Mock 인스턴스 주입
 * const mockRepo = new MockApplicationRepository();
 * const service = new ApplicationService(mockRepo);
 * ```
 */

import {
  SupabaseApplicationRepository,
  SupabaseJobPostingRepository,
  SupabaseWorkLogRepository,
  SupabaseUserRepository,
  SupabaseNotificationRepository,
  SupabaseReportRepository,
  SupabaseSettlementRepository,
  SupabaseConfirmedStaffRepository,
  SupabaseAnnouncementRepository,
  SupabaseInquiryRepository,
  SupabaseAdminRepository,
  SupabaseReviewRepository,
  SupabaseTemplateRepository,
  SupabaseBoardRepository,
} from './supabase';

// ============================================================================
// Interfaces
// ============================================================================

export type {
  // Application
  IApplicationRepository,
  ApplicationWithJob,
  ApplyContext,
  ConfirmWithHistoryResult,
  CancelConfirmationResult,
  CancelActorType,
  // JobPosting
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
  JobPostingSubscriptionCallbacks,
  ScheduleBoardSyncAction,
  // WorkLog
  IWorkLogRepository,
  WorkLogStats,
  UpdateSlotInput,
  // User
  IUserRepository,
  DeletionReason,
  DeletionRequest,
  UserDataExport,
  UserNicknameSearchResult,
  // Notification
  INotificationRepository,
  GetNotificationsOptions,
  // Report
  IReportRepository,
  CreateReportContext,
  ReportPaginationCursor,
  FetchReportsOptions,
  FetchReportsResult,
  ReportFilters,
  ReportCounts,
  // Settlement
  ISettlementRepository,
  UpdateWorkTimeContext,
  SettleWorkLogContext,
  BulkSettlementContext,
  SettlementResultDTO,
  BulkSettlementResultDTO,
  // ConfirmedStaff
  IConfirmedStaffRepository,
  UpdateRoleContext,
  UpdateConfirmedStaffWorkTimeContext,
  MarkNoShowContext,
  UpdateStaffStatusContext,
  ConfirmedStaffSubscriptionCallbacks,
  AddDirectStaffAssignment,
  AddDirectStaffContext,
  RemoveDirectStaffContext,
  // Announcement
  IAnnouncementRepository,
  AnnouncementPaginationCursor,
  FetchAnnouncementsOptions,
  FetchAnnouncementsResult,
  AnnouncementCountByStatus,
  // Inquiry
  IInquiryRepository,
  InquiryPaginationCursor,
  FetchInquiriesOptions,
  FetchInquiriesResult,
  CreateInquiryContext,
  // Admin
  IAdminRepository,
  DashboardCounts,
  DailyCount,
  SystemMetricsData,
  // Review
  IReviewRepository,
  CreateReviewContext,
  ReviewPaginationCursor,
  PaginatedReviews,
  // Template
  ITemplateRepository,
  // Board
  IBoardRepository,
  BoardRepositoryType,
  FetchBoardRepositoryPostsOptions,
  FetchScheduleMembershipsOptions,
  FetchBoardReportsOptions,
} from './interfaces';

// ============================================================================
// Supabase Implementations
// ============================================================================

export {
  SupabaseApplicationRepository,
  SupabaseJobPostingRepository,
  SupabaseWorkLogRepository,
  SupabaseUserRepository,
  SupabaseNotificationRepository,
  SupabaseReportRepository,
  SupabaseSettlementRepository,
  SupabaseConfirmedStaffRepository,
  SupabaseAnnouncementRepository,
  SupabaseInquiryRepository,
  SupabaseAdminRepository,
  SupabaseReviewRepository,
  SupabaseTemplateRepository,
  SupabaseBoardRepository,
} from './supabase';

// ============================================================================
// Singleton Instances
// ============================================================================

/**
 * Application Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { applicationRepository } from '@/repositories';
 *
 * // 조회
 * const apps = await applicationRepository.getByApplicantId(userId);
 *
 * // 트랜잭션
 * const application = await applicationRepository.applyWithTransaction(input, context);
 * ```
 */
export const applicationRepository = new SupabaseApplicationRepository();

/**
 * JobPosting Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { jobPostingRepository } from '@/repositories';
 *
 * // 조회
 * const job = await jobPostingRepository.getById(jobPostingId);
 *
 * // 목록 조회
 * const { items, hasMore } = await jobPostingRepository.getList(filters);
 * ```
 */
export const jobPostingRepository = new SupabaseJobPostingRepository();

/**
 * WorkLog Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { workLogRepository } from '@/repositories';
 *
 * // 조회
 * const workLogs = await workLogRepository.getByStaffId(staffId);
 *
 * // 통계
 * const stats = await workLogRepository.getStats(staffId);
 * ```
 */
export const workLogRepository = new SupabaseWorkLogRepository();

/**
 * User Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { userRepository } from '@/repositories';
 *
 * // 조회
 * const profile = await userRepository.getById(userId);
 *
 * // 프로필 수정
 * await userRepository.updateProfile(userId, { nickname: '새닉네임' });
 *
 * // 탈퇴 요청 저장
 * await userRepository.requestDeletion(userId, deletionRequest);
 * ```
 */
export const userRepository = new SupabaseUserRepository();

/**
 * Notification Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { notificationRepository } from '@/repositories';
 *
 * // 조회
 * const notifications = await notificationRepository.getByUserId(userId);
 *
 * // 읽음 처리
 * await notificationRepository.markAsRead(notificationId);
 *
 * // 설정 조회
 * const settings = await notificationRepository.getSettings(userId);
 * ```
 */
export const notificationRepository = new SupabaseNotificationRepository();

/**
 * Report Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { reportRepository } from '@/repositories';
 *
 * // 조회
 * const reports = await reportRepository.getByJobPostingId(jobPostingId);
 *
 * // 트랜잭션 (중복 체크 + 생성)
 * const reportId = await reportRepository.createWithTransaction(input, context);
 *
 * // 신고 처리 (관리자)
 * await reportRepository.reviewWithTransaction(input, reviewerId);
 * ```
 */
export const reportRepository = new SupabaseReportRepository();

/**
 * Settlement Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { settlementRepository } from '@/repositories';
 *
 * // 근무 시간 수정
 * await settlementRepository.updateWorkTimeWithTransaction(context, actorId);
 *
 * // 개별 정산
 * const result = await settlementRepository.settleWorkLogWithTransaction(context, actorId);
 *
 * // 일괄 정산
 * const bulkResult = await settlementRepository.bulkSettlementWithTransaction(context, actorId);
 *
 * // 정산 상태 변경
 * await settlementRepository.updatePayrollStatusWithTransaction(workLogId, status, actorId);
 * ```
 */
export const settlementRepository = new SupabaseSettlementRepository();

/**
 * ConfirmedStaff Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { confirmedStaffRepository } from '@/repositories';
 *
 * // 조회
 * const workLogs = await confirmedStaffRepository.getByJobPostingId(jobPostingId);
 *
 * // 역할 변경
 * await confirmedStaffRepository.updateRoleWithTransaction(context);
 *
 * // 스태프 삭제 (멀티 컬렉션 트랜잭션)
 * await confirmedStaffRepository.updateStatus(context);
 *
 * // 실시간 구독
 * const unsubscribe = confirmedStaffRepository.subscribeByJobPostingId(jobPostingId, callbacks);
 * ```
 */
export const confirmedStaffRepository = new SupabaseConfirmedStaffRepository();

/**
 * Announcement Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { announcementRepository } from '@/repositories';
 *
 * // 조회
 * const announcement = await announcementRepository.getById(announcementId);
 *
 * // 발행된 공지사항
 * const { announcements } = await announcementRepository.getPublished(userRole);
 *
 * // 생성
 * const id = await announcementRepository.create(authorId, authorName, input);
 * ```
 */
export const announcementRepository = new SupabaseAnnouncementRepository();

/**
 * Inquiry Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { inquiryRepository } from '@/repositories';
 *
 * // 문의 조회
 * const inquiry = await inquiryRepository.getById(inquiryId);
 *
 * // 사용자 문의 목록
 * const { inquiries } = await inquiryRepository.getByUserId(userId);
 *
 * // 문의 생성
 * const id = await inquiryRepository.create(context, input);
 * ```
 */
export const inquiryRepository = new SupabaseInquiryRepository();

/**
 * Admin Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { adminRepository } from '@/repositories';
 *
 * // 대시보드 카운트
 * const counts = await adminRepository.getDashboardCounts();
 *
 * // 사용자 목록 조회
 * const users = await adminRepository.getUsers(filters, page, pageSize);
 *
 * // 사용자 역할 변경
 * const prevRole = await adminRepository.updateUserRole(userId, 'employer');
 * ```
 */
export const adminRepository = new SupabaseAdminRepository();

/**
 * Review Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { reviewRepository } from '@/repositories';
 *
 * // 블라인드 조회
 * const result = await reviewRepository.getReviewsWithBlindCheck(workLogId, 'employer');
 *
 * // 리뷰 생성 (트랜잭션)
 * const reviewId = await reviewRepository.createWithTransaction(input, context);
 * ```
 */
export const reviewRepository = new SupabaseReviewRepository();

/**
 * Template Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { templateRepository } from '@/repositories';
 *
 * // 목록 조회
 * const templates = await templateRepository.getTemplates(userId);
 *
 * // 저장
 * const templateId = await templateRepository.saveTemplate(input, userId);
 *
 * // 불러오기
 * const template = await templateRepository.loadTemplate(templateId);
 * ```
 */
export const templateRepository = new SupabaseTemplateRepository();

/**
 * Board Repository singleton
 */
export const boardRepository = new SupabaseBoardRepository();

/**
 * Employer Application Repository singleton
 *
 * @description 구인자 등록 신청 CRUD + RPC (register/approve/reject/getLatest)
 */
export { employerApplicationRepository } from './supabase/EmployerApplicationRepository';
export type {
  EmployerApplication,
  EmployerApplicationApplicant,
  EmployerApplicationReviewer,
  EmployerApplicationStatus,
  EmployerApplicationRejectionCategory,
  RegisterAsEmployerResult,
  ApproveRejectResult,
  FetchApplicationsOptions,
  FetchApplicationsResult,
} from './supabase/EmployerApplicationRepository';

// ============================================================================
// 워크스페이스 협업 편집 (PR #2)
// ============================================================================

export type {
  IWorkspaceRepository,
  IWorkspaceMemberRepository,
  IWorkspaceInvitationRepository,
  WorkspaceInviteCandidate,
} from './interfaces';

export {
  SupabaseWorkspaceRepository,
  SupabaseWorkspaceMemberRepository,
  SupabaseWorkspaceInvitationRepository,
  workspaceRepository,
  workspaceMemberRepository,
  workspaceInvitationRepository,
} from './supabase';

// ============================================================================
// 공고별 협업자 (Phase 5 — feat/job-posting-collaborators)
// ============================================================================

export type { IJobPostingCollaboratorRepository } from './interfaces';

export {
  SupabaseJobPostingCollaboratorRepository,
  jobPostingCollaboratorRepository,
} from './supabase/JobPostingCollaboratorRepository';

// ============================================================================
// 주간 배치 그리드 (weeklyGrid) — 지점 단가 쓰기 입력 타입 재노출
// ============================================================================

export type { SetVenueRoleSalaryInput } from './interfaces/IWeeklyGridRepository';
