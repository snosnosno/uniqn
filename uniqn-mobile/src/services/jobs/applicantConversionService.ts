/**
 * Legacy applicant conversion service.
 *
 * This module is intentionally kept as a deprecated stub until the remaining
 * tests and documentation are cleaned up. Runtime usage is blocked so that the
 * canonical V3 flow can only enter staffing through application confirmation.
 */

import { BusinessError, ERROR_CODES } from '@/errors';
import { logger } from '@/utils/logger';
import type {
  ConversionOptions,
  ConversionResult,
} from '@/repositories/interfaces/IApplicationRepository';

export type { ConversionResult, ConversionOptions };

export interface BulkConversionResult {
  successCount: number;
  failedCount: number;
  results: ConversionResult[];
  failedApplications: {
    applicationId: string;
    error: string;
  }[];
}

function createLegacyConversionError(): BusinessError {
  return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
    userMessage:
      '지원자-스태프 직접 변환은 더 이상 지원되지 않습니다. 지원자 확정 플로우를 사용해주세요.',
  });
}

export async function convertApplicantToStaff(
  applicationId: string,
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  logger.warn('Blocked deprecated convertApplicantToStaff call', {
    applicationId,
    jobPostingId,
    managerId,
    options,
  });
  throw createLegacyConversionError();
}

export async function batchConvertApplicants(
  applicationIds: string[],
  jobPostingId: string,
  managerId: string,
  options: ConversionOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<BulkConversionResult> {
  logger.warn('Blocked deprecated batchConvertApplicants call', {
    applicationIds,
    jobPostingId,
    managerId,
    options,
  });

  applicationIds.forEach((_, index) => {
    onProgress?.(index + 1, applicationIds.length);
  });

  return {
    successCount: 0,
    failedCount: applicationIds.length,
    results: [],
    failedApplications: applicationIds.map((applicationId) => ({
      applicationId,
      error: '지원자-스태프 직접 변환은 더 이상 지원되지 않습니다.',
    })),
  };
}

export async function isAlreadyStaff(_userId: string, _jobPostingId?: string): Promise<boolean> {
  logger.warn('Blocked deprecated isAlreadyStaff call');
  return false;
}

export async function canConvertToStaff(_applicationId: string): Promise<{
  canConvert: boolean;
  reason?: string;
}> {
  logger.warn('Blocked deprecated canConvertToStaff call');
  return {
    canConvert: false,
    reason: '지원자-스태프 직접 변환은 더 이상 지원되지 않습니다.',
  };
}

export async function revertStaffConversion(
  applicationId: string,
  managerId: string
): Promise<void> {
  logger.warn('Blocked deprecated revertStaffConversion call', {
    applicationId,
    managerId,
  });
  throw createLegacyConversionError();
}
