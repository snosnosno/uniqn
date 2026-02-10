/**
 * 미읽음 카운터 리셋 Callable Function
 *
 * @description markAllAsRead 호출 시 클라이언트에서 직접 호출
 * @version 1.1.0
 *
 * @changelog
 * - 1.1.0: _batchUpdate 플래그 정리 기능 추가
 *
 * @note 배치 업데이트 후 개별 트리거가 스킵되므로 직접 리셋 필요
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { resetUnreadCounter as resetCounter } from '../utils/notificationUtils';

const db = admin.firestore();

interface ResetUnreadCounterData {
  /** 플래그 정리할 알림 ID 목록 (선택) */
  notificationIds?: string[];
}

interface ResetUnreadCounterResult {
  success: boolean;
}

/**
 * 미읽음 카운터 리셋
 *
 * @description 인증된 사용자의 미읽음 카운터를 0으로 리셋하고,
 *              notificationIds가 전달되면 해당 알림의 _batchUpdate 플래그도 정리
 *
 * @example
 * // 클라이언트에서:
 * const resetCounter = httpsCallable(functions, 'resetUnreadCounter');
 * await resetCounter({ notificationIds: ['id1', 'id2'] });
 */
export const resetUnreadCounter = functions
  .region('asia-northeast3')
  .https.onCall(async (data: ResetUnreadCounterData, context): Promise<ResetUnreadCounterResult> => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const userId = context.auth.uid;
    const notificationIds = data?.notificationIds ?? [];

    try {
      // 1. 카운터 리셋
      await resetCounter(userId);

      // 2. 🆕 _batchUpdate 플래그 정리 (비동기, 실패해도 성공 반환)
      if (notificationIds.length > 0) {
        cleanupBatchUpdateFlags(notificationIds).catch((error) => {
          functions.logger.warn('_batchUpdate 플래그 정리 실패 (무시)', {
            userId,
            notificationCount: notificationIds.length,
            error: error.message,
          });
        });
      }

      functions.logger.info('미읽음 카운터 리셋 완료 (Callable)', {
        userId,
        flagsToCleanup: notificationIds.length,
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('미읽음 카운터 리셋 실패', {
        userId,
        error: errorMessage,
      });

      throw new functions.https.HttpsError(
        'internal',
        '카운터 리셋에 실패했습니다.'
      );
    }
  });

/**
 * _batchUpdate 플래그 정리
 *
 * @description 배치 업데이트 시 설정된 임시 플래그 제거
 * @param notificationIds 알림 ID 목록
 */
async function cleanupBatchUpdateFlags(notificationIds: string[]): Promise<void> {
  const BATCH_SIZE = 500; // Firestore 배치 제한

  for (let i = 0; i < notificationIds.length; i += BATCH_SIZE) {
    const chunk = notificationIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    chunk.forEach((id) => {
      const docRef = db.collection('notifications').doc(id);
      batch.update(docRef, {
        _batchUpdate: admin.firestore.FieldValue.delete(),
      });
    });

    await batch.commit();
  }

  functions.logger.info('_batchUpdate 플래그 정리 완료', {
    count: notificationIds.length,
  });
}
