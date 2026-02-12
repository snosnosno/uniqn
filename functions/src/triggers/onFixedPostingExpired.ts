/**
 * @file onFixedPostingExpired.ts
 * @description 고정 공고 만료 알림 Firestore Trigger
 *
 * 트리거 조건:
 * - jobPostings 컬렉션 문서 업데이트 감지
 * - status: 'active' → 'closed'
 * - closedReason === 'expired'
 *
 * 처리 내용:
 * - 작성자에게 만료 알림 전송 (Firestore + FCM)
 * - 지원자 알림은 기존 onJobPostingClosed 트리거가 처리
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { createAndSendNotification } from '../utils/notificationUtils';
import { STATUS } from '../constants/status';

/**
 * 고정 공고 만료 알림 Trigger
 *
 * 경로: jobPostings/{postingId}
 * 이벤트: onUpdate
 */
export const onFixedPostingExpired = onDocumentUpdated(
  { document: 'jobPostings/{postingId}', region: 'asia-northeast3' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const postingId = event.params.postingId;

    // 변경 전후 데이터 확인
    if (!before || !after) {
      logger.warn('변경 전후 데이터 없음', { postingId });
      return;
    }

    // 만료 감지: status가 'active' → 'closed'로 변경되고 closedReason === 'expired'
    const isExpired =
      before.status === STATUS.JOB_POSTING.ACTIVE &&
      after.status === STATUS.JOB_POSTING.CLOSED &&
      after.closedReason === 'expired';

    if (!isExpired) {
      return; // 만료가 아니면 처리 안 함
    }

    // 고정 공고인지 확인
    if (after.postingType !== 'fixed') {
      return;
    }

    const createdBy = after.createdBy || after.ownerId;
    if (!createdBy) {
      logger.warn('작성자 정보 없음', { postingId });
      return;
    }

    logger.info(`고정 공고 ${postingId} 만료 감지`, {
      title: after.title,
      createdBy,
      expiresAt: after.fixedConfig?.expiresAt?.toDate(),
      durationDays: after.fixedConfig?.durationDays,
    });

    try {
      const title = after.title || '제목 없음';

      await createAndSendNotification(
        createdBy,
        'job_closed',
        '고정 공고가 만료되었습니다',
        `"${title}" 공고의 노출 기간이 종료되어 자동으로 마감 처리되었습니다.`,
        {
          data: {
            postingId,
            postingTitle: title,
            postingType: 'fixed',
            closedReason: 'expired',
          },
          priority: 'normal',
        }
      );

      logger.info('만료 알림 전송 완료', {
        postingId,
        recipientId: createdBy,
      });
    } catch (error) {
      logger.error('만료 알림 전송 실패', {
        postingId,
        error: error instanceof Error ? error.stack : String(error),
      });
      // 알림 전송 실패는 critical하지 않으므로 에러를 던지지 않음
    }
  });
