/**
 * 공개뷰(anon) 폴링 — 모바일 useMonitorSnapshot·usePlayerView 공통부.
 * - 실패 정책은 동기화 사본 `publicPollingPolicy`(토큰 무효만 영구 정지, 네트워크 장애는 백오프 후 자동 복귀)
 * - 타이머 = 서버 앵커 + 1초 똑딱 + 서버시각 offset(server_now − 수신 시각) — 운영자 화면과 같은 값
 * 로그인 불필요 — Repository 직접 호출(읽기 전용, 모바일과 같다).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { computeClockRemaining, computeNextBreakRemaining } from '@/core/domains/ops';
import {
  isTokenInvalidError,
  publicRefetchInterval,
  publicShouldRetry,
} from '@/core/hooks/ops/publicPollingPolicy';
import type { OpsMonitorSnapshot } from '@/core/types/ops';

/** 두 공개 스냅샷이 공통으로 가진 클럭 부분. */
export interface ClockSnapshot {
  serverNow: string;
  clock: { isRunning: boolean; levelStartedAt: string | null; pausedRemainingSec: number | null };
  currentLevel: { durationSec: number; isBreak: boolean } | null;
  nextBreak: OpsMonitorSnapshot['nextBreak'];
}

/** capability 토큰 최소 길이(모바일과 같다) — 짧으면 조회하지 않는다. */
export const MIN_TOKEN_LENGTH = 32;

export function usePublicPoll<T extends ClockSnapshot>(
  kind: 'monitor' | 'player',
  token: string | undefined,
  fetcher: (token: string) => Promise<T>,
  tokenInvalidCode: string
) {
  const enabled = !!token && token.length >= MIN_TOKEN_LENGTH;
  const query = useQuery({
    queryKey: ['public', kind, token ?? 'none'],
    queryFn: () => fetcher(token as string),
    enabled,
    refetchInterval: (q) =>
      publicRefetchInterval(q.state.error, q.state.fetchFailureCount, tokenInvalidCode),
    // 전광판은 탭이 가려져 있어도(TV 절전 화면 등) 계속 갱신해야 한다
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: (failureCount, error) => publicShouldRetry(failureCount, error, tokenInvalidCode),
  });

  const data = query.data ?? null;
  const isRunning = data?.clock.isRunning ?? false;
  const serverOffsetMs = useMemo(
    () => (data && query.dataUpdatedAt ? Date.parse(data.serverNow) - query.dataUpdatedAt : 0),
    [data, query.dataUpdatedAt]
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isRunning) return undefined;
    const tick = () => setNowMs(Date.now());
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [isRunning]);

  const anchor = {
    levelStartedAt: data?.clock.levelStartedAt ?? null,
    isRunning,
    pausedRemainingSec: data?.clock.pausedRemainingSec ?? null,
    serverOffsetMs,
    nowMs,
  };
  const remaining = computeClockRemaining({
    ...anchor,
    durationSec: data?.currentLevel?.durationSec ?? null,
  });
  const nextBreak = computeNextBreakRemaining({
    ...anchor,
    nextBreak: data?.nextBreak ?? null,
    currentLevelIsBreak: data?.currentLevel?.isBreak ?? false,
    currentLevelDurationSec: data?.currentLevel?.durationSec ?? null,
  });

  const isTokenInvalid = isTokenInvalidError(query.error, tokenInvalidCode);
  return {
    data,
    remainingSec: remaining.remainingSec,
    levelMissing: remaining.levelMissing,
    nextBreak,
    isLoading: enabled && query.isPending,
    /** 토큰이 없거나 형식이 틀림 — 조회하지 않는다 */
    isMalformed: !enabled,
    /** 토큰 자체가 무효 — 폴링 영구 정지, 새 링크가 필요 */
    isTokenInvalid,
    /** 네트워크·서버 일시 장애 — 백오프하며 계속 시도 */
    isDisconnected: !isTokenInvalid && query.isError,
  };
}
