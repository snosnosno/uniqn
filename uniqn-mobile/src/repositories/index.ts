/**
 * UNIQN Mobile - Repository Layer
 *
 * @description Repository 패턴으로 데이터 접근 추상화
 * @version 1.0.0
 *
 * ## 아키텍처
 *
 * ```
 * Service Layer → Repository Interface → Firebase Implementation
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
  FirebaseApplicationRepository,
  FirebaseJobPostingRepository,
  FirebaseWorkLogRepository,
  FirebaseUserRepository,
  FirebaseEventQRRepository,
  FirebaseNotificationRepository,
  FirebaseReportRepository,
  FirebaseSettlementRepository,
  FirebaseConfirmedStaffRepository,
  FirebaseAnnouncementRepository,
  FirebaseAdminRepository,
} from './firebase';

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
  // JobPosting
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
  // WorkLog
  IWorkLogRepository,
  WorkLogStats,
  MonthlyPayrollSummary,
  // User
  IUserRepository,
  DeletionReason,
  DeletionRequest,
  UserDataExport,
  // EventQR
  IEventQRRepository,
  // Notification
  INotificationRepository,
  GetNotificationsOptions,
  // Report
  IReportRepository,
  CreateReportContext,
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
  DeleteConfirmedStaffContext,
  MarkNoShowContext,
  ConfirmedStaffSubscriptionCallbacks,
  // Announcement
  IAnnouncementRepository,
  FetchAnnouncementsOptions,
  FetchAnnouncementsResult,
  AnnouncementCountByStatus,
  // Admin
  IAdminRepository,
  DashboardCounts,
  DailyCount,
  SystemMetricsData,
} from './interfaces';

// ============================================================================
// Firebase Implementations
// ============================================================================

export {
  FirebaseApplicationRepository,
  FirebaseJobPostingRepository,
  FirebaseWorkLogRepository,
  FirebaseUserRepository,
  FirebaseEventQRRepository,
  FirebaseNotificationRepository,
  FirebaseReportRepository,
  FirebaseSettlementRepository,
  FirebaseConfirmedStaffRepository,
  FirebaseAnnouncementRepository,
  FirebaseAdminRepository,
} from './firebase';

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
export const applicationRepository = new FirebaseApplicationRepository();

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
export const jobPostingRepository = new FirebaseJobPostingRepository();

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
export const workLogRepository = new FirebaseWorkLogRepository();

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
export const userRepository = new FirebaseUserRepository();

/**
 * EventQR Repository 싱글톤 인스턴스
 *
 * @description 프로덕션에서 사용하는 기본 인스턴스
 *
 * @example
 * ```typescript
 * import { eventQRRepository } from '@/repositories';
 *
 * // 조회
 * const qr = await eventQRRepository.getActiveByJobAndDate(jobPostingId, date, 'checkIn');
 *
 * // 생성
 * const qrId = await eventQRRepository.create(qrData);
 *
 * // 비활성화
 * await eventQRRepository.deactivate(qrId);
 * ```
 */
export const eventQRRepository = new FirebaseEventQRRepository();

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
export const notificationRepository = new FirebaseNotificationRepository();

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
export const reportRepository = new FirebaseReportRepository();

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
 * await settlementRepository.updateWorkTimeWithTransaction(context, ownerId);
 *
 * // 개별 정산
 * const result = await settlementRepository.settleWorkLogWithTransaction(context, ownerId);
 *
 * // 일괄 정산
 * const bulkResult = await settlementRepository.bulkSettlementWithTransaction(context, ownerId);
 *
 * // 정산 상태 변경
 * await settlementRepository.updatePayrollStatusWithTransaction(workLogId, status, ownerId);
 * ```
 */
export const settlementRepository = new FirebaseSettlementRepository();

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
 * await confirmedStaffRepository.deleteWithTransaction(context);
 *
 * // 실시간 구독
 * const unsubscribe = confirmedStaffRepository.subscribeByJobPostingId(jobPostingId, callbacks);
 * ```
 */
export const confirmedStaffRepository = new FirebaseConfirmedStaffRepository();

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
export const announcementRepository = new FirebaseAnnouncementRepository();

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
export const adminRepository = new FirebaseAdminRepository();
