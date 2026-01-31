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
} from './firebase';

// ============================================================================
// Interfaces
// ============================================================================

export type {
  // Application
  IApplicationRepository,
  ApplicationWithJob,
  ApplyContext,
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
