/**
 * UNIQN Mobile - 지원서 이력 관리 서비스
 *
 * @description confirmationHistory 기반 확정/취소 이력 관리
 * @version 1.0.0
 */

import type { Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { Application, Assignment } from '@/types';
import { findActiveConfirmation } from '@/types';
import { applicationRepository } from '@/repositories';
import type { ConfirmWithHistoryResult, CancelConfirmationResult } from '@/repositories';

// Re-export from domain (하위 호환성)
export { updateDateSpecificRequirementsFilled } from '@/domains/application';

// Re-export types from repository interfaces (하위 호환성)
export type { ConfirmWithHistoryResult, CancelConfirmationResult } from '@/repositories';

// ============================================================================
// Application History Service
// ============================================================================

/**
 * 지원 확정 (v2.0 - confirmationHistory 지원)
 *
 * 비즈니스 로직:
 * 1. 공고 소유자 확인
 * 2. 정원 확인 (날짜별/역할별)
 * 3. originalApplication 보존 (최초 확정 시)
 * 4. confirmationHistory에 이력 추가
 * 5. Assignment별 WorkLog 생성
 * 6. 공고 filledPositions 업데이트
 */
export async function confirmApplicationWithHistory(
  applicationId: string,
  selectedAssignments: Assignment[] | undefined,
  ownerId: string,
  notes?: string
): Promise<ConfirmWithHistoryResult> {
  try {
    logger.info('지원 확정 (v2.0) 시작', { applicationId, ownerId });

    // Repository 트랜잭션으로 위임
    const result = await applicationRepository.confirmWithHistoryTransaction(
      applicationId,
      selectedAssignments,
      ownerId,
      notes
    );

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
 * 확정 취소 (v2.0 - confirmationHistory 지원)
 *
 * 비즈니스 로직:
 * 1. 활성 확정 존재 확인
 * 2. confirmationHistory에 취소 정보 추가
 * 3. 연관 WorkLog 삭제 또는 취소 처리
 * 4. 공고 filledPositions 감소
 * 5. 상태를 원본(applied)으로 복원
 */
export async function cancelConfirmation(
  applicationId: string,
  ownerId: string,
  cancelReason?: string
): Promise<CancelConfirmationResult> {
  try {
    logger.info('확정 취소 시작', { applicationId, ownerId });

    // Repository 트랜잭션으로 위임
    const result = await applicationRepository.cancelConfirmationTransaction(
      applicationId,
      ownerId,
      cancelReason
    );

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
 * 최초 지원 데이터 조회
 *
 * @description originalApplication이 있으면 반환, 없으면 현재 assignments 반환
 */
export function getOriginalApplicationData(application: Application): Assignment[] {
  if (application.originalApplication?.assignments) {
    return application.originalApplication.assignments;
  }

  if (application.assignments) {
    return application.assignments;
  }

  // assignments가 없으면 빈 배열 반환
  return [];
}

/**
 * 현재 확정된 선택 조회
 *
 * @description 활성 confirmationHistory에서 assignments 반환
 */
export function getConfirmedSelections(application: Application): Assignment[] {
  if (!application.confirmationHistory?.length) {
    return [];
  }

  const activeConfirmation = findActiveConfirmation(application.confirmationHistory);
  return activeConfirmation?.assignments ?? [];
}

/**
 * 지원서가 v2.0 형식인지 확인
 */
export function isV2Application(application: Application): boolean {
  return Array.isArray(application.assignments) && application.assignments.length > 0;
}

/**
 * 확정 이력 요약 조회
 */
export async function getApplicationHistorySummary(applicationId: string): Promise<{
  totalConfirmations: number;
  cancellations: number;
  isCurrentlyConfirmed: boolean;
  lastConfirmedAt?: Timestamp;
  lastCancelledAt?: Timestamp;
} | null> {
  try {
    // Repository로 지원서 조회
    const applicationData = await applicationRepository.getById(applicationId);

    if (!applicationData) {
      return null;
    }

    const history = applicationData.confirmationHistory ?? [];

    const activeConfirmation = findActiveConfirmation(history);
    const cancellations = history.filter((e) => e.cancelledAt).length;
    const lastEntry = history[history.length - 1];

    return {
      totalConfirmations: history.length,
      cancellations,
      isCurrentlyConfirmed: activeConfirmation !== null,
      lastConfirmedAt: lastEntry?.confirmedAt,
      lastCancelledAt: history.filter((e) => e.cancelledAt).pop()?.cancelledAt,
    };
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '확정 이력 요약 조회',
      component: 'applicationHistoryService',
      context: { applicationId },
    });
  }
}
