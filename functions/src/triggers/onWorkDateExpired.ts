/**
 * @file onWorkDateExpired.ts
 * @description 근무일 만료 공고 작성자 알림 Firestore Trigger
 *
 * 트리거 조건:
 * - jobPostings 컬렉션 문서 업데이트 감지
 * - status: 'active' → 'closed'
 * - closedReason === 'expired_by_work_date'
 *
 * 처리 내용:
 * - 작성자에게 자동 마감 알림 전송 (Firestore + FCM)
 * - 지원자 알림은 기존 onJobPostingClosed 트리거가 처리
 */

import * as functions from 'firebase-functions';
import * as logger from 'firebase-functions/logger';
import { createAndSendNotification } from '../utils/notificationUtils';

/**
 * 근무일 만료 공고 작성자 알림 Trigger
 *
 * 경로: jobPostings/{postingId}
 * 이벤트: onUpdate
 */
export const onWorkDateExpired = functions
  .region('asia-northeast3')
  .firestore.document('jobPostings/{postingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const postingId = context.params.postingId;

    if (!before || !after) {
      return;
    }

    // 근무일 만료 감지: active → closed + closedReason === 'expired_by_work_date'
    const isWorkDateExpired =
      before.status === 'active' &&
      after.status === 'closed' &&
      after.closedReason === 'expired_by_work_date';

    if (!isWorkDateExpired) {
      return;
    }

    // fixed 공고는 onFixedPostingExpired에서 처리
    if (after.postingType === 'fixed') {
      return;
    }

    const createdBy = after.createdBy || after.ownerId;
    if (!createdBy) {
      logger.warn('작성자 정보 없음', { postingId });
      return;
    }

    logger.info(`공고 ${postingId} 근무일 만료 감지`, {
      title: after.title,
      postingType: after.postingType,
      workDate: after.workDate,
      createdBy,
    });

    try {
      const title = after.title || '제목 없음';

      await createAndSendNotification(
        createdBy,
        'job_closed',
        '공고가 자동 마감되었습니다',
        `"${title}" 공고의 마지막 근무일이 지나 자동으로 마감 처리되었습니다.`,
        {
          data: {
            postingId,
            postingTitle: title,
            postingType: after.postingType || 'regular',
            closedReason: 'expired_by_work_date',
          },
          priority: 'normal',
        }
      );

      logger.info('근무일 만료 알림 전송 완료', {
        postingId,
        recipientId: createdBy,
      });
    } catch (error) {
      logger.error('근무일 만료 알림 전송 실패', {
        postingId,
        error: error instanceof Error ? error.stack : String(error),
      });
      // 알림 전송 실패는 critical하지 않으므로 에러를 던지지 않음
    }
  });
