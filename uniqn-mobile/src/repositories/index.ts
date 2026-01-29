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

import { FirebaseApplicationRepository } from './firebase';

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
  // WorkLog
  IWorkLogRepository,
  WorkLogStats,
  MonthlyPayrollSummary,
} from './interfaces';

// ============================================================================
// Firebase Implementations
// ============================================================================

export { FirebaseApplicationRepository } from './firebase';

// TODO: Phase 1 완료 후 추가
// export { FirebaseJobPostingRepository } from './firebase';
// export { FirebaseWorkLogRepository } from './firebase';

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

// TODO: Phase 1 완료 후 추가
// export const jobPostingRepository = new FirebaseJobPostingRepository();
// export const workLogRepository = new FirebaseWorkLogRepository();
