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
} from './interfaces';

// ============================================================================
// Firebase Implementations
// ============================================================================

export {
  FirebaseApplicationRepository,
  FirebaseJobPostingRepository,
  FirebaseWorkLogRepository,
  FirebaseUserRepository,
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
