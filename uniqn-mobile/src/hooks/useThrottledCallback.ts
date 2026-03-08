/**
 * UNIQN Mobile - Throttled Callback 훅
 *
 * @description 연속 호출 방지를 위한 throttle 훅
 * 지정된 시간(ms) 내 중복 호출을 무시합니다.
 *
 * 적용 대상:
 * - 지원서 제출, 정산 처리, QR 체크인 등 중복 실행 방지가 필요한 mutation
 *
 * @version 1.0.0
 */

import { useCallback, useRef } from 'react';

/**
 * 연속 호출을 방지하는 throttle 훅
 *
 * 마치 엘리베이터 버튼처럼, 한 번 누르면 일정 시간 동안 추가 입력을 무시합니다.
 * isPending 상태만으로는 네트워크 지연 시 다중 클릭을 완벽히 방지할 수 없으므로
 * 클라이언트 레벨에서 추가 보호를 제공합니다.
 *
 * @param callback - throttle을 적용할 콜백 함수
 * @param delayMs - 최소 호출 간격 (밀리초)
 * @returns throttle이 적용된 콜백 함수
 *
 * @example
 * ```typescript
 * const throttledSubmit = useThrottledCallback(mutation.mutate, 1000);
 * // 1초 이내 중복 호출 무시
 * ```
 */
export function useThrottledCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCallRef.current < delayMs) {
        return;
      }
      lastCallRef.current = now;
      callbackRef.current(...args);
    },
    [delayMs]
  );
}
