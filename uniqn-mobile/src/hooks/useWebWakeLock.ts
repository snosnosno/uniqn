/**
 * 웹 화면 꺼짐 방지 (Screen Wake Lock API) — 전광판/상시표시 화면 전용.
 *
 * ## 왜 (감사 web-02, 웹 절반)
 * 모니터는 대회 내내 켜두는 전광판인데 keep-awake 처리가 프로젝트 전체에 0건이었다.
 * 브라우저/OS 가 몇 분 뒤 화면을 끄면 전광판의 기능 대부분이 무의미해진다.
 * 네이티브 절반(expo-keep-awake)은 네이티브 모듈이라 OTA 로 못 실어 1.0.7 빌드 대기다 —
 * 이 훅은 **웹(CF Pages)에서 즉시 효력**이 있는 절반이다.
 *
 * ## 계약
 * - 웹이 아니거나 브라우저가 API 를 지원하지 않으면 **조용히 아무것도 하지 않는다**
 *   (Safari 16.4 미만·구 Android 크롬 등). 기능 저하일 뿐 오류가 아니다.
 * - 잠금은 **탭이 보이지 않게 되면 브라우저가 자동 해제**한다. 그래서 `visibilitychange`
 *   에서 다시 요청한다 — 이 재요청이 없으면 화면 전환 한 번에 영구히 풀린다.
 * - 언마운트 시 해제한다.
 */
import { useEffect, useRef } from 'react';
import { isWeb } from '@/utils/platform';
import { logger } from '@/utils/logger';

/** lib.dom 버전에 따라 WakeLockSentinel 타입이 없을 수 있어 최소 구조만 지역 선언한다. */
type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockLike = {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
};

function getWakeLock(): WakeLockLike | null {
  if (!isWeb) return null;
  if (typeof navigator === 'undefined') return null;
  const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  return wakeLock ?? null;
}

/**
 * 🔑 `document?.x` 로는 부족하다 — 옵셔널 체이닝은 값이 null/undefined 인 경우만 막고,
 * **선언 자체가 없는 식별자**는 그대로 ReferenceError 를 던진다. RN 네이티브와 jest 의
 * node 환경에는 document 바인딩이 아예 없다. 그래서 typeof 로 걸러 지역 변수에 담는다.
 */
function getDocument(): Document | null {
  return typeof document === 'undefined' ? null : document;
}

/**
 * @param enabled false 면 잠금을 잡지 않는다(예: 아직 데이터를 못 받아 빈 화면일 때).
 * @returns 지원 여부 — 화면에서 안내 문구를 띄우고 싶을 때 쓴다.
 */
export function useWebWakeLock(enabled: boolean = true): { isSupported: boolean } {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const isSupported = getWakeLock() !== null;

  useEffect(() => {
    const wakeLock = getWakeLock();
    if (!wakeLock || !enabled) return undefined;

    const doc = getDocument();
    let disposed = false;

    const acquire = async () => {
      if (disposed || sentinelRef.current?.released === false) return;
      // 탭이 숨겨진 상태에서 요청하면 NotAllowedError 다 — 보일 때만 시도한다.
      if (doc && doc.visibilityState !== 'visible') return;
      try {
        const sentinel = await wakeLock.request('screen');
        if (disposed) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        // 브라우저가 스스로 해제하면 참조를 비워, 다음 visibilitychange 에서 재요청되게 한다.
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch (error) {
        // 배터리 절약 모드·권한 거부 등. 전광판 표시 자체는 계속돼야 하므로 삼키고 기록만.
        logger.info('화면 꺼짐 방지 요청 실패 — 표시는 계속됩니다', {
          component: 'useWebWakeLock',
          data: { message: error instanceof Error ? error.message : String(error) },
        });
      }
    };

    const onVisibilityChange = () => {
      if (doc && doc.visibilityState === 'visible') void acquire();
    };

    void acquire();
    doc?.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      doc?.removeEventListener('visibilitychange', onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [enabled]);

  return { isSupported };
}
