/**
 * UNIQN Mobile - Timeout 유틸리티
 *
 * @description Promise에 타임아웃을 적용하는 범용 유틸리티
 * @version 1.0.0
 *
 * 타이머처럼 일정 시간이 지나면 경기를 강제 종료하는 것.
 * 원본 Promise가 시간 내에 완료되면 그 결과를, 초과하면 타임아웃 에러를 반환.
 */

import { NetworkError, ERROR_CODES } from '@/errors';

// ============================================================================
// withTimeout
// ============================================================================

/**
 * Promise에 타임아웃 제한을 적용
 *
 * @param promise - 타임아웃을 적용할 Promise
 * @param timeoutMs - 타임아웃 시간 (밀리초)
 * @param errorMessage - 타임아웃 시 표시할 에러 메시지
 * @returns 원본 Promise 결과 또는 타임아웃 에러
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new NetworkError(ERROR_CODES.NETWORK_TIMEOUT, {
          userMessage: errorMessage,
        })
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
