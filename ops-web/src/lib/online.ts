import { ERROR_CODES, NetworkError } from '@/core/errors/AppError';

/**
 * 쓰기 직전 오프라인 차단 — 모바일 `requireOnlineForMutation` 과 같은 계약(큐잉이 아니라 **차단**).
 * 배정 계획처럼 스냅샷 전제 쓰기를 오프라인에서 보내면 원인 불명 실패만 남는다.
 */
export function requireOnline(operation: string): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new NetworkError(ERROR_CODES.NETWORK_OFFLINE, {
      message: `offline: ${operation}`,
      userMessage: '인터넷 연결이 끊겼어요. 연결된 뒤 다시 시도해 주세요.',
    });
  }
}
