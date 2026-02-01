/**
 * 알림 읽음 처리 트리거
 *
 * @description notifications 문서의 isRead가 false → true로 변경될 때
 *              사용자의 미읽음 카운터를 감소시킵니다.
 *
 * @version 1.1.0
 *
 * @changelog
 * - 1.1.0: _batchUpdate 플래그 지원 (markAllAsRead 배치 업데이트 시 개별 트리거 스킵)
 */

import * as functions from 'firebase-functions';
import { decrementUnreadCounter } from '../utils/notificationUtils';

/**
 * 알림 읽음 처리 시 카운터 감소
 *
 * @trigger notifications/{notificationId} onUpdate
 *
 * @note _batchUpdate 필드가 true이면 카운터 업데이트 스킵
 *       (markAllAsRead에서 별도로 카운터 리셋 처리)
 *
 * @example
 * // 클라이언트에서 알림 읽음 처리 시:
 * await updateDoc(notificationRef, { isRead: true });
 * // → 이 함수가 자동으로 카운터 감소
 *
 * // 배치 업데이트 시 (markAllAsRead):
 * batch.update(ref, { isRead: true, _batchUpdate: true });
 * // → 카운터 업데이트 스킵 (별도 리셋 처리)
 */
export const onNotificationRead = functions
  .region('asia-northeast3')
  .firestore.document('notifications/{notificationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const { notificationId } = context.params;

    // isRead가 false → true로 변경된 경우만 처리
    if (before.isRead === false && after.isRead === true) {
      // 🆕 배치 업데이트 플래그 확인 - markAllAsRead에서 설정
      // 배치 업데이트 시 개별 트리거에서 카운터 감소하지 않음 (별도 리셋 처리)
      if (after._batchUpdate === true) {
        functions.logger.info('배치 업데이트 - 개별 카운터 감소 스킵', {
          notificationId,
        });
        return;
      }

      const recipientId = after.recipientId;

      if (!recipientId) {
        functions.logger.warn('알림에 recipientId가 없습니다', {
          notificationId,
        });
        return;
      }

      try {
        // 🆕 미읽음 카운터 감소 (음수 방지 트랜잭션 적용)
        await decrementUnreadCounter(recipientId);

        functions.logger.info('알림 읽음 처리 - 카운터 감소', {
          notificationId,
          recipientId,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        functions.logger.error('알림 읽음 처리 실패', {
          notificationId,
          recipientId,
          error: errorMessage,
        });
      }
    }
  });
