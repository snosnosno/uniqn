/**
 * UNIQN Mobile - ID 정규화 유틸리티
 *
 * @description eventId/jobPostingId, staffId/applicantId 혼용 문제 해결
 * @version 1.0.0
 *
 * ## 문제 상황
 * - WorkLog: eventId 필드 사용
 * - Application: jobPostingId 필드 사용
 * - 실제로는 같은 JobPosting ID를 가리킴
 *
 * ## 해결 방안
 * - 읽기 시: 자동 정규화 (normalizeJobId)
 * - 쓰기 시: 레거시 필드 포함 (withLegacyFields - Phase 9에서 구현)
 */

import type { WorkLog, Application } from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 공고 ID 필드를 가진 문서 타입
 */
export interface JobIdDocument {
  jobPostingId?: string;
}

/**
 * 사용자 ID 필드를 가진 문서 타입
 */
export interface UserIdDocument {
  staffId?: string;
  applicantId?: string;
  userId?: string; // 레거시 호환
}

/**
 * Application ID 파싱 결과
 */
export interface ParsedApplicationId {
  jobPostingId: string;
  applicantId: string;
}

// ============================================================================
// IdNormalizer Class
// ============================================================================

/**
 * ID 정규화 유틸리티 클래스
 *
 * @example
 * // 공고 ID 정규화
 * const jobId = IdNormalizer.normalizeJobId(workLog);
 *
 * // 사용자 ID 정규화
 * const userId = IdNormalizer.normalizeUserId(confirmedStaff);
 *
 * // 복합 ID 생성/파싱
 * const appId = IdNormalizer.generateApplicationId(jobPostingId, applicantId);
 * const { jobPostingId, applicantId } = IdNormalizer.parseApplicationId(appId);
 */
export class IdNormalizer {
  // ============================================================================
  // 공고 ID 정규화
  // ============================================================================

  /**
   * 문서에서 공고 ID 추출
   *
   * @param doc - jobPostingId를 가진 문서
   * @returns 공고 ID (없으면 빈 문자열)
   *
   * @example
   * IdNormalizer.normalizeJobId({ jobPostingId: 'JOB123' }) // 'JOB123'
   */
  static normalizeJobId(doc: JobIdDocument): string {
    return doc.jobPostingId || '';
  }

  // ============================================================================
  // 사용자 ID 정규화
  // ============================================================================

  /**
   * 문서에서 사용자 ID 추출 (정규화)
   *
   * @description 우선순위: staffId > applicantId > userId
   * @param doc - staffId, applicantId, userId 중 하나를 가진 문서
   * @returns 정규화된 사용자 ID (없으면 빈 문자열)
   *
   * @example
   * // WorkLog (staffId 사용)
   * IdNormalizer.normalizeUserId({ staffId: 'USER123' }) // 'USER123'
   *
   * // Application (applicantId 사용)
   * IdNormalizer.normalizeUserId({ applicantId: 'USER123' }) // 'USER123'
   */
  static normalizeUserId(doc: UserIdDocument): string {
    return doc.staffId || doc.applicantId || doc.userId || '';
  }

  /**
   * applicantId를 staffId로 변환 (WorkLog 생성 시)
   *
   * @param applicantId - 지원자 ID
   * @returns staffId 값 (동일한 값)
   */
  static toStaffId(applicantId: string): string {
    return applicantId;
  }

  /**
   * staffId를 applicantId로 변환 (Application 조회 시)
   *
   * @param staffId - 스태프 ID
   * @returns applicantId 값 (동일한 값)
   */
  static toApplicantId(staffId: string): string {
    return staffId;
  }

  // ============================================================================
  // 복합 키 생성/파싱
  // ============================================================================

  /**
   * Application ID 생성 (복합 키)
   *
   * @description WorkLog와 Application 연결을 위한 복합 키
   * @param jobPostingId - 공고 ID
   * @param applicantId - 지원자 ID
   * @returns 복합 키 (jobPostingId_applicantId)
   *
   * @example
   * IdNormalizer.generateApplicationId('JOB123', 'USER456')
   * // 'JOB123_USER456'
   */
  static generateApplicationId(jobPostingId: string, applicantId: string): string {
    return `${jobPostingId}_${applicantId}`;
  }

  /**
   * Application ID 파싱 (복합 키 분해)
   *
   * @param applicationId - 복합 키 (jobPostingId_applicantId)
   * @returns { jobPostingId, applicantId }
   *
   * @example
   * IdNormalizer.parseApplicationId('JOB123_USER456')
   * // { jobPostingId: 'JOB123', applicantId: 'USER456' }
   */
  static parseApplicationId(applicationId: string): ParsedApplicationId {
    const parts = applicationId.split('_');
    if (parts.length < 2) {
      return { jobPostingId: applicationId, applicantId: '' };
    }
    // 첫 번째 부분이 jobPostingId, 나머지가 applicantId (userId에 _가 포함될 수 있음)
    const [jobPostingId, ...rest] = parts;
    return {
      jobPostingId,
      applicantId: rest.join('_'),
    };
  }

  // ============================================================================
  // 배치 정규화
  // ============================================================================

  /**
   * WorkLog 배열에서 정규화된 공고 ID 추가
   *
   * @param workLogs - WorkLog 배열
   * @returns 정규화된 ID가 추가된 배열
   */
  static normalizeWorkLogs<T extends JobIdDocument>(
    workLogs: T[]
  ): (T & { normalizedJobPostingId: string })[] {
    return workLogs.map((wl) => ({
      ...wl,
      normalizedJobPostingId: this.normalizeJobId(wl),
    }));
  }

  /**
   * WorkLog와 Application에서 통합된 공고 ID Set 추출
   *
   * @description 중복 없이 모든 공고 ID를 수집 (배치 조회용)
   * @param workLogs - WorkLog 배열
   * @param applications - Application 배열
   * @returns 통합된 공고 ID Set
   *
   * @example
   * const workLogs = [{ jobPostingId: 'JOB1' }, { jobPostingId: 'JOB2' }];
   * const applications = [{ jobPostingId: 'JOB2' }, { jobPostingId: 'JOB3' }];
   * IdNormalizer.extractUnifiedIds(workLogs, applications)
   * // Set { 'JOB1', 'JOB2', 'JOB3' }
   */
  static extractUnifiedIds(
    workLogs: Pick<WorkLog, 'jobPostingId'>[],
    applications: Pick<Application, 'jobPostingId'>[]
  ): Set<string> {
    const ids = new Set<string>();

    workLogs.forEach((wl) => {
      if (wl.jobPostingId) {
        ids.add(wl.jobPostingId);
      }
    });

    applications.forEach((app) => {
      if (app.jobPostingId) {
        ids.add(app.jobPostingId);
      }
    });

    return ids;
  }

  /**
   * 문서 배열에서 공고 ID 배열 추출 (중복 제거)
   *
   * @param docs - eventId 또는 jobPostingId를 가진 문서 배열
   * @returns 정규화된 공고 ID 배열 (중복 제거됨)
   */
  static extractJobIds(docs: JobIdDocument[]): string[] {
    const ids = new Set<string>();

    docs.forEach((doc) => {
      const id = this.normalizeJobId(doc);
      if (id) {
        ids.add(id);
      }
    });

    return Array.from(ids);
  }

  /**
   * 문서 배열에서 사용자 ID 배열 추출 (중복 제거)
   *
   * @param docs - staffId 또는 applicantId를 가진 문서 배열
   * @returns 정규화된 사용자 ID 배열 (중복 제거됨)
   */
  static extractUserIds(docs: UserIdDocument[]): string[] {
    const ids = new Set<string>();

    docs.forEach((doc) => {
      const id = this.normalizeUserId(doc);
      if (id) {
        ids.add(id);
      }
    });

    return Array.from(ids);
  }
}

// ============================================================================
// Helper Functions (편의 함수)
// ============================================================================

/**
 * 공고 ID 정규화 (함수형 API)
 */
export const normalizeJobId = IdNormalizer.normalizeJobId.bind(IdNormalizer);

/**
 * 사용자 ID 정규화 (함수형 API)
 */
export const normalizeUserId = IdNormalizer.normalizeUserId.bind(IdNormalizer);

/**
 * 통합 ID 추출 (함수형 API)
 */
export const extractUnifiedIds = IdNormalizer.extractUnifiedIds.bind(IdNormalizer);

/**
 * Application ID 생성 (함수형 API)
 */
export const generateApplicationId = IdNormalizer.generateApplicationId.bind(IdNormalizer);

/**
 * Application ID 파싱 (함수형 API)
 */
export const parseApplicationId = IdNormalizer.parseApplicationId.bind(IdNormalizer);
