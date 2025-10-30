/**
 * @file onFixedPostingExpired.ts
 * @description 고정 공고 만료 알림 Firestore Trigger (선택적)
 *
 * 트리거 조건:
 * - jobPostings 컬렉션 문서 업데이트 감지
 * - status 필드가 'closed'로 변경됨
 * - closedReason === 'expired'
 *
 * 처리 내용:
 * - 작성자에게 만료 알림 전송
 * - 알림 타입: 'work' (근무 관련)
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

/**
 * 고정 공고 만료 알림 Trigger
 *
 * 경로: jobPostings/{postingId}
 * 이벤트: onUpdate
 */
export const onFixedPostingExpired = onDocumentUpdated(
  {
    document: 'jobPostings/{postingId}',
    memory: '256MiB'
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const postingId = event.params.postingId;

    // 변경 전후 데이터 확인
    if (!before || !after) {
      logger.warn('변경 전후 데이터 없음', { postingId });
      return;
    }

    // 만료 감지: status가 'open' → 'closed'로 변경되고 closedReason === 'expired'
    const isExpired =
      before.status === 'open' &&
      after.status === 'closed' &&
      after.closedReason === 'expired';

    if (!isExpired) {
      return; // 만료가 아니면 처리 안 함
    }

    // 고정 공고인지 확인
    if (after.postingType !== 'fixed') {
      return;
    }

    logger.info(`고정 공고 ${postingId} 만료 감지`, {
      title: after.title,
      createdBy: after.createdBy,
      expiresAt: after.fixedConfig?.expiresAt?.toDate(),
      durationDays: after.fixedConfig?.durationDays
    });

    try {
      const db = admin.firestore();
      const createdBy = after.createdBy;

      if (!createdBy) {
        logger.warn('작성자 정보 없음', { postingId });
        return;
      }

      // 알림 생성
      const notificationRef = db.collection('notifications').doc();
      await notificationRef.set({
        userId: createdBy,
        type: 'work', // 근무 관련 알림
        title: '고정 공고가 만료되었습니다',
        body: `"${after.title || '제목 없음'}" 공고의 노출 기간이 종료되어 자동으로 마감 처리되었습니다.`,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          postingId,
          postingTitle: after.title || '제목 없음',
          postingType: 'fixed',
          closedReason: 'expired',
          expiresAt: after.fixedConfig?.expiresAt || null,
          durationDays: after.fixedConfig?.durationDays || 0
        }
      });

      logger.info(`만료 알림 전송 완료`, {
        notificationId: notificationRef.id,
        userId: createdBy,
        postingId
      });
    } catch (error) {
      logger.error(`만료 알림 전송 실패: ${postingId}`, error, {
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      // 알림 전송 실패는 critical하지 않으므로 에러를 던지지 않음
    }
  }
);
