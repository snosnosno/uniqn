import { useEffect } from 'react';
import { logger } from './logger';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

/**
 * 화면 꺼짐 방지 — 모바일 useScreenAwake 의 웹 절반(Wake Lock API).
 * 전광판은 대회 내내 켜 둔다. 탭이 가려지면 브라우저가 잠금을 풀기 때문에 다시 보이면 다시 잡는다.
 * 지원하지 않는 브라우저(구형 Safari 등)는 조용히 넘어간다 — 화면 설정으로 대신한다.
 */
export function useScreenAwake(enabled: boolean): void {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!enabled || !wakeLock) return undefined;
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        const next = await wakeLock.request('screen');
        if (disposed) void next.release();
        else sentinel = next;
      } catch (error) {
        logger.debug('화면 꺼짐 방지 실패(무시)', { error: String(error) });
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}
