/**
 * UNIQN Mobile - 지원자 → 스태프 변환 서비스
 *
 * @description Repository 패턴 기반 지원자 → 스태프 변환
 * @version 2.0.0
 *
 * 변경사항 (v2.0):
 * - Firebase 직접 호출 제거 → applicationRepository 사용
 * - getDocs inside runTransaction 제거 → pre-fetch 패턴 적용
 * - revertStaffConversion에서 WorkLog 취소 처리 추가
 */

import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { applicationRepository, jobPostingRepository } from '@/repositories';
import type {
  ConversionOptions,
  ConversionResult,
} from '@/repositories/interfaces/IApplicationRepository';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';

// ============================================================================
// Types
// ============================================================================

export type { ConversionResult, ConversionOptions };

interface LegacyApplicationRepository {
  convertApplicantToStaffTransaction(
    applicationId: string,
    jobPostingId: string,
    managerId: string,
    options?: ConversionOptions
  ): Promise<ConversionResult>;
  revertStaffConversionTransaction(applicationId: string, managerId: string): Promise<void>;
  isAlreadyStaff(userId: string, jobPostingId?: string): Promise<boolean>;
  canConvertToStaff(applicationId: string): Promise<{ canConvert: boolean; reason?: string }>;
}

const legacyApplicationRepository = applicationRepository as unknown as LegacyApplicationRepository;

export interface BulkConversionResult {
  successCount: number;
  failedCount: number;
  results: ConversionResult[];
  failedApplications: {
    applicationId: string;
    error: string;
  }[];
}

// ============================================================================
// Applicant Conversion Service
// ============================================================================

/**
 * 지원자를 스태프로 변환 (트랜잭션)
 *
 * @description Repository 트랜잭션으로 위임
 */
export async function convertApplicantToStaff(
  applicationId: string,
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  try {
    logger.info('지원자→스태프 변환 시작', { applicationId, jobPostingId, managerId });

    const result = await legacyApplicationRepository.convertApplicantToStaffTransaction(
      applicationId,
      jobPostingId,
      managerId,
      options
    );

    logger.info('지원자→스태프 변환 완료', {
      applicationId,
      staffId: result.staffId,
      workLogIds: result.workLogIds,
    });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원자→스태프 변환',
      component: 'applicantConversionService',
      context: { applicationId },
    });
  }
}

/**
 * 일괄 변환 (배치)
 *
 * @description 여러 지원자를 한 번에 스태프로 변환
 */
export async function batchConvertApplicants(
  applicationIds: string[],
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<BulkConversionResult> {
  try {
    logger.info('일괄 스태프 변환 시작', {
      count: applicationIds.length,
      jobPostingId,
      managerId,
    });

    // 사전 정원 검증 (부분 실패 최소화)
    const jobPosting = await jobPostingRepository.getById(jobPostingId);
    if (jobPosting) {
      const { total, filled } = getClosingStatus(jobPosting);
      const remaining = total > 0 ? total - filled : Infinity;
      if (remaining < applicationIds.length) {
        logger.warn('일괄 변환 정원 부족 경고', {
          jobPostingId,
          remaining,
          requested: applicationIds.length,
        });
      }
    }

    const result: BulkConversionResult = {
      successCount: 0,
      failedCount: 0,
      results: [],
      failedApplications: [],
    };

    // 순차적으로 처리 (트랜잭션 충돌 방지)
    for (let i = 0; i < applicationIds.length; i++) {
      const applicationId = applicationIds[i];

      try {
        const conversionResult = await convertApplicantToStaff(
          applicationId,
          jobPostingId,
          managerId,
          { ...options, skipExisting: true }
        );
        result.successCount++;
        result.results.push(conversionResult);
      } catch (error) {
        result.failedCount++;
        result.failedApplications.push({
          applicationId,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
        logger.warn('일괄 변환 중 실패', { applicationId, error });
      }

      if (onProgress) {
        onProgress(i + 1, applicationIds.length);
      }
    }

    logger.info('일괄 스태프 변환 완료', {
      successCount: result.successCount,
      failedCount: result.failedCount,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일괄 스태프 변환',
      component: 'applicantConversionService',
      context: { count: applicationIds.length, jobPostingId },
    });
  }
}

/**
 * 스태프 존재 여부 확인
 *
 * @description Repository 조회로 위임
 */
export async function isAlreadyStaff(userId: string, jobPostingId?: string): Promise<boolean> {
  return legacyApplicationRepository.isAlreadyStaff(userId, jobPostingId);
}

/**
 * 변환 가능 여부 확인
 *
 * @description Repository 조회로 위임
 */
export async function canConvertToStaff(applicationId: string): Promise<{
  canConvert: boolean;
  reason?: string;
}> {
  return legacyApplicationRepository.canConvertToStaff(applicationId);
}

/**
 * 스태프 변환 취소 (롤백)
 *
 * @description Repository 트랜잭션으로 위임 (WorkLog 취소 포함)
 */
export async function revertStaffConversion(
  applicationId: string,
  managerId: string
): Promise<void> {
  try {
    logger.info('스태프 변환 취소 시작', { applicationId, managerId });

    await legacyApplicationRepository.revertStaffConversionTransaction(applicationId, managerId);

    logger.info('스태프 변환 취소 완료', { applicationId });
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '스태프 변환 취소',
      component: 'applicantConversionService',
      context: { applicationId },
    });
  }
}
