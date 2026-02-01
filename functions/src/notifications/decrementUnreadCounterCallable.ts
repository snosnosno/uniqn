/**
 * 미읽음 카운터 감소 Callable Function
 *
 * @description 클라이언트에서 알림 삭제 시 호출
 * @version 1.0.0
 *
 * @note 알림 삭제 시 미읽음인 경우 클라이언트에서 호출
 */

import * as functions from 'firebase-functions';
import { decrementUnreadCounter } from '../utils/notificationUtils';

interface DecrementUnreadCounterData {
  /** 감소할 양 */
  delta: number;
}

interface DecrementUnreadCounterResult {
  success: boolean;
}

/**
 * 미읽음 카운터 감소
 *
 * @description 인증된 사용자의 미읽음 카운터를 감소
 *
 * @example
 * // 클라이언트에서:
 * const decrementCounter = httpsCallable(functions, 'decrementUnreadCounter');
 * await decrementCounter({ delta: 1 });
 */
export const decrementUnreadCounterCallable = functions
  .region('asia-northeast3')
  .https.onCall(async (data: DecrementUnreadCounterData, context): Promise<DecrementUnreadCounterResult> => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const userId = context.auth.uid;
    const delta = data?.delta ?? 1;

    // 입력 검증
    if (typeof delta !== 'number' || delta <= 0 || delta > 1000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'delta는 1~1000 사이의 양수여야 합니다.'
      );
    }

    try {
      await decrementUnreadCounter(userId, delta);

      functions.logger.info('미읽음 카운터 감소 완료 (Callable)', {
        userId,
        delta,
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('미읽음 카운터 감소 실패', {
        userId,
        delta,
        error: errorMessage,
      });

      throw new functions.https.HttpsError(
        'internal',
        '카운터 감소에 실패했습니다.'
      );
    }
  });
