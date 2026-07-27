/**
 * UNIQN Mobile - 지원 이력 관리 서비스
 * @description confirmationHistory 기반 확정/취소 흐름을 관리합니다.
 * @version 1.0.0
 */

import { logger } from '@/utils/logger';
import { ERROR_CODES, ValidationError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { confirmApplicationSchema } from '@/schemas';
import type { Application, Assignment } from '@/types';
import { findActiveConfirmation } from '@/domains/application';
import { applicationRepository } from '@/repositories';
import { enqueueScheduleBoardSync } from '@/services/jobs/jobManagementService';
import type {
  CancelConfirmationResult,
  ConfirmWithHistoryResult,
  CancelActorType,
} from '@/repositories';

// Re-export types from repository interfaces for backward compatibility.
export type { CancelConfirmationResult, ConfirmWithHistoryResult } from '@/repositories';

// T-B12: 직접 sync 호출 → outbox enqueue로 전환.
// jobPostingId는 application 조회로 획득. enqueue 실패는 main mutation을 롤백시키지 않음
// (warn 로그 + outbox failed_retry_limit 모니터링 + 수동 백필이 안전망).
async function syncScheduleBoardSafely(applicationId: string, action: 'confirm' | 'cancel') {
  try {
    const app = await applicationRepository.getById(applicationId);
    if (!app?.jobPostingId) {
      logger.warn('Schedule board enqueue skipped: jobPostingId missing', {
        component: 'applicationHistoryService',
        applicationId,
        action,
      });
      return;
    }
    await enqueueScheduleBoardSync(app.jobPostingId, 'update', {
      jobPostingId: app.jobPostingId,
      applicationId,
      reason: action,
    });
  } catch (error) {
    logger.warn('Schedule board enqueue failed', {
      component: 'applicationHistoryService',
      applicationId,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 지원을 확정합니다.
 */
export async function confirmApplicationWithHistory(
  applicationId: string,
  selectedAssignments: Assignment[] | undefined,
  ownerId: string,
  notes?: string
): Promise<ConfirmWithHistoryResult> {
  const validationResult = confirmApplicationSchema.safeParse({ applicationId, notes });
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요',
      errors: validationResult.error.flatten().fieldErrors,
    });
  }

  try {
    logger.info('지원 확정 (v2.0) 시작', { applicationId, ownerId });

    const result = await applicationRepository.confirmWithHistoryTransaction(
      applicationId,
      selectedAssignments,
      ownerId,
      validationResult.data.notes
    );
    await syncScheduleBoardSafely(applicationId, 'confirm');

    logger.info('지원 확정 (v2.0) 완료', {
      applicationId,
      workLogIds: result.workLogIds,
    });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 확정 (v2.0)',
      component: 'applicationHistoryService',
      context: { applicationId },
    });
  }
}

/**
 * 확정을 취소합니다.
 *
 * @param actorType - 취소 주체 유형. **기본값을 두지 않는다** — 호출부가 반드시 밝혀야 한다.
 *   과거 기본값이 `'staff_initiates'` 였는데 구인자 훅이 인자를 생략해, RPC 의
 *   `IF v_application.applicant_id != p_actor_id THEN 'unauthorized'`
 *   (20260711020000_cancel_application_employer_initiates.sql:88-89) 분기에 걸려
 *   사장님의 '확정 해제' 가 **항상 실패**했다. 구인자 경로 전용 분기(`employer_initiates`)는
 *   그 사고를 위해 신설돼 있었는데 클라가 쓰지 않았다.
 *
 *   기본값을 없애면 타입 검사가 호출부에 의도를 강제한다 — 같은 종류의 무음 오배선이
 *   컴파일 단계에서 막힌다. 인가 주체 판정 자체는 RPC 가 수행한다.
 */
export async function cancelConfirmation(
  applicationId: string,
  ownerId: string,
  cancelReason: string | undefined,
  actorType: CancelActorType
): Promise<CancelConfirmationResult> {
  try {
    logger.info('확정 취소 시작', { applicationId, ownerId, actorType });

    const result = await applicationRepository.cancelConfirmationTransaction(
      applicationId,
      ownerId,
      cancelReason,
      actorType
    );
    await syncScheduleBoardSafely(applicationId, 'cancel');

    logger.info('확정 취소 완료', { applicationId });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '확정 취소',
      component: 'applicationHistoryService',
      context: { applicationId },
    });
  }
}

/**
 * 원본 지원 데이터를 반환합니다.
 */
export function getOriginalApplicationData(application: Application): Assignment[] {
  if (application.originalApplication?.assignments) {
    return application.originalApplication.assignments;
  }

  if (application.assignments) {
    return application.assignments;
  }

  return [];
}

/**
 * 현재 활성화된 확정 선택 정보를 반환합니다.
 */
export function getConfirmedSelections(application: Application): Assignment[] {
  if (!application.confirmationHistory?.length) {
    return [];
  }

  const activeConfirmation = findActiveConfirmation(application.confirmationHistory);
  return activeConfirmation?.assignments ?? [];
}

/**
 * assignment 기반 v2 지원서인지 판별합니다.
 */
export function isV2Application(application: Application): boolean {
  return Array.isArray(application.assignments) && application.assignments.length > 0;
}

/**
 * 지원 이력 요약을 조회합니다.
 */
export async function getApplicationHistorySummary(applicationId: string): Promise<{
  totalConfirmations: number;
  cancellations: number;
  isCurrentlyConfirmed: boolean;
  lastConfirmedAt?: Date;
  lastCancelledAt?: Date;
} | null> {
  try {
    const applicationData = await applicationRepository.getById(applicationId);

    if (!applicationData) {
      return null;
    }

    const history = applicationData.confirmationHistory ?? [];
    const activeConfirmation = findActiveConfirmation(history);
    const cancellations = history.filter((entry) => entry.cancelledAt).length;
    const lastEntry = history[history.length - 1];

    return {
      totalConfirmations: history.length,
      cancellations,
      isCurrentlyConfirmed: activeConfirmation !== null,
      lastConfirmedAt: lastEntry?.confirmedAt,
      lastCancelledAt: history.filter((entry) => entry.cancelledAt).pop()?.cancelledAt,
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '지원 이력 요약 조회',
      component: 'applicationHistoryService',
      context: { applicationId },
    });
  }
}
