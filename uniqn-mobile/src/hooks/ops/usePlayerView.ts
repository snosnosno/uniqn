/**
 * 공개 플레이어뷰 훅 (1c-4) — anon 폴링 + 서버시각 offset 보정 + 1초 똑딱.
 * useMonitorSnapshot 과 동일 타이머 계약(서버 앵커 + 클라 틱 + offset). 본인 안전필드만 노출.
 * Repository 직접 호출(읽기 전용) — 공개 라우트는 authStore/Service 비의존.
 * token 파라미터 = view_token capability(읽기 전용). claim_pin 은 useClaimParticipant 참조.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsPlayerRepository } from '@/repositories/ops';
import { computeClockRemaining, computeNextBreakRemaining } from '@/domains/ops';

const POLL_INTERVAL_MS = 4000; // ≥3s 하한(§0.5)

export function usePlayerView(token: string | undefined) {
  const enabled = !!token && token.length >= 32;

  const query = useQuery({
    queryKey: token ? queryKeys.ops.player(token) : [...queryKeys.ops.all, 'player', 'none'],
    queryFn: () => opsPlayerRepository.getPlayerView(token as string),
    enabled,
    // 무효 토큰(error)이면 4s 폴링 중단(자원 낭비 방지). 정상이면 폴링 유지.
    refetchInterval: (q) => (q.state.status === 'error' ? false : POLL_INTERVAL_MS),
    staleTime: 0,
    retry: false,
  });

  const view = query.data ?? null;
  const isRunning = view?.clock.isRunning ?? false;

  const serverOffsetMs = useMemo(() => {
    if (!view || !query.dataUpdatedAt) return 0;
    return Date.parse(view.serverNow) - query.dataUpdatedAt;
  }, [view, query.dataUpdatedAt]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isRunning) return undefined;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const remaining = useMemo(
    () =>
      computeClockRemaining({
        levelStartedAt: view?.clock.levelStartedAt ?? null,
        durationSec: view?.currentLevel?.durationSec ?? null,
        isRunning,
        pausedRemainingSec: view?.clock.pausedRemainingSec ?? null,
        serverOffsetMs,
        nowMs,
      }),
    [
      view?.clock.levelStartedAt,
      view?.clock.pausedRemainingSec,
      view?.currentLevel?.durationSec,
      isRunning,
      serverOffsetMs,
      nowMs,
    ]
  );

  // S1 C1: 다음 브레이크 카운트다운 — 모니터와 동일 산식(표면별 드리프트 0)
  const nextBreak = useMemo(
    () =>
      computeNextBreakRemaining({
        nextBreak: view?.nextBreak ?? null,
        currentLevelIsBreak: view?.currentLevel?.isBreak ?? false,
        currentLevelDurationSec: view?.currentLevel?.durationSec ?? null,
        levelStartedAt: view?.clock.levelStartedAt ?? null,
        isRunning,
        pausedRemainingSec: view?.clock.pausedRemainingSec ?? null,
        serverOffsetMs,
        nowMs,
      }),
    [
      view?.nextBreak,
      view?.currentLevel?.isBreak,
      view?.currentLevel?.durationSec,
      view?.clock.levelStartedAt,
      view?.clock.pausedRemainingSec,
      isRunning,
      serverOffsetMs,
      nowMs,
    ]
  );

  return {
    view,
    remainingSec: remaining.remainingSec,
    isExpired: remaining.isExpired,
    levelMissing: remaining.levelMissing,
    nextBreak,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
