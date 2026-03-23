/**
 * UNIQN Mobile - 吏?먯꽌 ?대젰 愿由??쒕퉬?? *
 * @description confirmationHistory 湲곕컲 ?뺤젙/痍⑥냼 ?대젰 愿由? * @version 1.0.0
 */

import type { Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { Application, Assignment } from '@/types';
import { findActiveConfirmation } from '@/domains/application';
import { applicationRepository } from '@/repositories';
import type { ConfirmWithHistoryResult, CancelConfirmationResult } from '@/repositories';

// Re-export from domain (?섏쐞 ?명솚??
export { updateDateSpecificRequirementsFilled } from '@/domains/application';

// Re-export types from repository interfaces (?섏쐞 ?명솚??
export type { ConfirmWithHistoryResult, CancelConfirmationResult } from '@/repositories';

// ============================================================================
// Application History Service
// ============================================================================

/**
 * 吏???뺤젙 (v2.0 - confirmationHistory 吏??
 *
 * 鍮꾩쫰?덉뒪 濡쒖쭅:
 * 1. 怨듦퀬 ?뚯쑀???뺤씤
 * 2. ?뺤썝 ?뺤씤 (?좎쭨蹂???븷蹂?
 * 3. originalApplication 蹂댁〈 (理쒖큹 ?뺤젙 ??
 * 4. confirmationHistory???대젰 異붽?
 * 5. Assignment蹂?WorkLog ?앹꽦
 * 6. 怨듦퀬 filledPositions ?낅뜲?댄듃
 */
export async function confirmApplicationWithHistory(
  applicationId: string,
  selectedAssignments: Assignment[] | undefined,
  ownerId: string,
  notes?: string
): Promise<ConfirmWithHistoryResult> {
  try {
    logger.info('吏???뺤젙 (v2.0) ?쒖옉', { applicationId, ownerId });

    // Repository ?몃옖??뀡?쇰줈 ?꾩엫
    const result = await applicationRepository.confirmWithHistoryTransaction(
      applicationId,
      selectedAssignments,
      ownerId,
      notes
    );

    logger.info('吏???뺤젙 (v2.0) ?꾨즺', {
      applicationId,
      workLogIds: result.workLogIds,
    });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '吏???뺤젙 (v2.0)',
      component: 'applicationHistoryService',
      context: { applicationId },
    });
  }
}

/**
 * ?뺤젙 痍⑥냼 (v2.0 - confirmationHistory 吏??
 *
 * 鍮꾩쫰?덉뒪 濡쒖쭅:
 * 1. ?쒖꽦 ?뺤젙 議댁옱 ?뺤씤
 * 2. confirmationHistory??痍⑥냼 ?뺣낫 異붽?
 * 3. ?곌? WorkLog ??젣 ?먮뒗 痍⑥냼 泥섎━
 * 4. 怨듦퀬 filledPositions 媛먯냼
 * 5. ?곹깭瑜??먮낯(applied)?쇰줈 蹂듭썝
 */
export async function cancelConfirmation(
  applicationId: string,
  ownerId: string,
  cancelReason?: string
): Promise<CancelConfirmationResult> {
  try {
    logger.info('?뺤젙 痍⑥냼 ?쒖옉', { applicationId, ownerId });

    // Repository ?몃옖??뀡?쇰줈 ?꾩엫
    const result = await applicationRepository.cancelConfirmationTransaction(
      applicationId,
      ownerId,
      cancelReason
    );

    logger.info('?뺤젙 痍⑥냼 ?꾨즺', { applicationId });

    return result;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    throw handleServiceError(error, {
      operation: '?뺤젙 痍⑥냼',
      component: 'applicationHistoryService',
      context: { applicationId },
    });
  }
}

/**
 * 理쒖큹 吏???곗씠??議고쉶
 *
 * @description originalApplication???덉쑝硫?諛섑솚, ?놁쑝硫??꾩옱 assignments 諛섑솚
 */
export function getOriginalApplicationData(application: Application): Assignment[] {
  if (application.originalApplication?.assignments) {
    return application.originalApplication.assignments;
  }

  if (application.assignments) {
    return application.assignments;
  }

  // assignments媛 ?놁쑝硫?鍮?諛곗뿴 諛섑솚
  return [];
}

/**
 * ?꾩옱 ?뺤젙???좏깮 議고쉶
 *
 * @description ?쒖꽦 confirmationHistory?먯꽌 assignments 諛섑솚
 */
export function getConfirmedSelections(application: Application): Assignment[] {
  if (!application.confirmationHistory?.length) {
    return [];
  }

  const activeConfirmation = findActiveConfirmation(application.confirmationHistory);
  return activeConfirmation?.assignments ?? [];
}

/**
 * 吏?먯꽌媛 v2.0 ?뺤떇?몄? ?뺤씤
 */
export function isV2Application(application: Application): boolean {
  return Array.isArray(application.assignments) && application.assignments.length > 0;
}

/**
 * ?뺤젙 ?대젰 ?붿빟 議고쉶
 */
export async function getApplicationHistorySummary(applicationId: string): Promise<{
  totalConfirmations: number;
  cancellations: number;
  isCurrentlyConfirmed: boolean;
  lastConfirmedAt?: Timestamp;
  lastCancelledAt?: Timestamp;
} | null> {
  try {
    // Repository濡?吏?먯꽌 議고쉶
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
      operation: '?뺤젙 ?대젰 ?붿빟 議고쉶',
      component: 'applicationHistoryService',
      context: { applicationId },
    });
  }
}
