/**
 * 미읽음 카운터 감소 Callable Function
 *
 * @description 클라이언트에서 알림 삭제 시 호출
 * @version 1.0.0
 *
 * @note 알림 삭제 시 미읽음인 경우 클라이언트에서 호출
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { decrementUnreadCounter } from '../utils/notificationUtils';
import { requireAuth, handleFunctionError } from '../errors';
import { ValidationError, ERROR_CODES } from '../errors';

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
export const decrementUnreadCounterCallable = onCall<DecrementUnreadCounterData>(
  { region: 'asia-northeast3' },
  async (request): Promise<DecrementUnreadCounterResult> => {
    try {
      // 인증 확인
      const userId = requireAuth(request);

      const delta = request.data?.delta ?? 1;

      // 입력 검증
      if (typeof delta !== 'number' || delta <= 0 || delta > 1000) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: 'delta는 1~1000 사이의 양수여야 합니다.',
          field: 'delta',
          metadata: { delta },
        });
      }

      await decrementUnreadCounter(userId, delta);

      logger.info('미읽음 카운터 감소 완료 (Callable)', {
        userId,
        delta,
      });

      return { success: true };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: 'decrementUnreadCounterCallable',
        context: { delta: request.data?.delta },
      });
    }
  });
