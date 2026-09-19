/**
 * UNIQN Mobile - ID 정규화 유틸리티
 *
 * @description jobPostingId 정규화
 * @version 3.0.0 - Firebase 합성 키(`{jobPostingId}_{applicantId}`) 시절 헬퍼 제거.
 *                  Supabase UUID PK 체계에서는 합성 키를 만들 이유가 없다.
 *
 * ## 역할
 * - WorkLog/Application에서 통합 jobPostingId 추출
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
 * // WorkLog + Application 통합 공고 ID 추출
 * const ids = IdNormalizer.extractUnifiedIds(workLogs, applications);
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
  // 배치 정규화
  // ============================================================================

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
}

// ============================================================================
// Helper Functions (편의 함수)
// ============================================================================

/**
 * 공고 ID 정규화 (함수형 API)
 */
export const normalizeJobId = IdNormalizer.normalizeJobId.bind(IdNormalizer);

/**
 * 통합 ID 추출 (함수형 API)
 */
export const extractUnifiedIds = IdNormalizer.extractUnifiedIds.bind(IdNormalizer);
