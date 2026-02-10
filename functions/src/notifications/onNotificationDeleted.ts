/**
 * 알림 삭제 트리거
 *
 * @description 알림 문서가 삭제될 때 미읽음 카운터 감소
 * @version 1.0.0
 *
 * @note 클라이언트 외 경로(Admin SDK, Console 등)로 삭제 시 대비
 * @note 클라이언트에서는 NotificationRepository.delete()가 직접 처리
 */

import * as functions from 'firebase-functions/v1';
import { decrementUnreadCounter } from '../utils/notificationUtils';

/**
 * 알림 삭제 시 카운터 감소 트리거
 *
 * @trigger notifications/{notificationId} onDelete
 *
 * @description
 * - 읽지 않은 알림이 삭제되면 카운터 감소
 * - 이미 읽은 알림 삭제 시 무시
 * - recipientId가 없으면 무시 (데이터 무결성 보호)
 *
 * @note 클라이언트 삭제 시 중복 감소 방지:
 *       클라이언트는 삭제 전 카운터를 직접 감소시킴.
 *       서버 트리거는 _clientHandled 플래그로 중복 처리 방지.
 */
export const onNotificationDeleted = functions
  .region('asia-northeast3')
  .firestore.document('notifications/{notificationId}')
  .onDelete(async (snap, context) => {
    const { notificationId } = context.params;
    const data = snap.data();

    // 읽지 않은 알림만 카운터 감소
    if (data.isRead === true) {
      functions.logger.debug('이미 읽은 알림 삭제 - 카운터 감소 스킵', {
        notificationId,
      });
      return;
    }

    // recipientId 확인
    const recipientId = data.recipientId;
    if (!recipientId) {
      functions.logger.warn('알림에 recipientId가 없습니다', {
        notificationId,
      });
      return;
    }

    // 🆕 클라이언트 처리 플래그 확인 (중복 감소 방지)
    // 클라이언트에서 삭제 시 _clientHandled: true 설정 후 삭제
    if (data._clientHandled === true) {
      functions.logger.info('클라이언트에서 이미 카운터 처리됨 - 트리거 스킵', {
        notificationId,
        recipientId,
      });
      return;
    }

    try {
      await decrementUnreadCounter(recipientId, 1, notificationId);

      functions.logger.info('알림 삭제 - 카운터 감소', {
        notificationId,
        recipientId,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('알림 삭제 시 카운터 감소 실패', {
        notificationId,
        recipientId,
        error: errorMessage,
      });
      // 에러는 decrementUnreadCounter 내부에서 _failedCounterOps에 기록됨
    }
  });
