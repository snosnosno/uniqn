/**
 * ops 서버동기 클럭 읽기 훅 (1c).
 * Repository 직접 조회 + ops_clock 리얼타임 invalidate + 1초 똑딱(setInterval) + computeClockRemaining.
 *
 * 현재 레벨 durationSec 는 블라인드 구조에서 clock.currentLevelSort 매칭으로 도출한다.
 * Phase 1 운영자 기기는 신뢰(serverOffsetMs=0) — 모니터/플레이어뷰만 offset 보정(Phase 2/3).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import { opsClockRepository } from '@/repositories/ops';
import { createRealtimeSubscription } from '@/utils/supabase';
import { computeClockRemaining } from '@/domains/ops';
import { useOpsBlindLevels } from './useOpsBlindLevels';

export function useOpsClock(tournamentId: string | undefined) {
  const queryClient = useQueryClient();
  const { blindLevels } = useOpsBlindLevels(tournamentId);

  const query = useQuery({
    queryKey: tournamentId
      ? queryKeys.ops.clock(tournamentId)
      : [...queryKeys.ops.all, 'clock', 'none'],
    queryFn: () => opsClockRepository.get(tournamentId as string),
    enabled: !!tournamentId,
    staleTime: cachingPolicies.realtime,
  });

  useEffect(() => {
    if (!tournamentId) return undefined;
    return createRealtimeSubscription('ops_clock', `tournament_id=eq.${tournamentId}`, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.clock(tournamentId) });
    });
  }, [tournamentId, queryClient]);

  const clock = query.data ?? null;
  const isRunning = clock?.isRunning ?? false;

  // 1초 똑딱 — running 동안만 nowMs 갱신(명시 틱, useMemo 의존성에 주입). 정지/일시정지면 불필요.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isRunning) return undefined;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // 현재 진행 레벨 — clock.currentLevelSort 매칭(없으면 스케줄 축소 고아 → levelMissing 폴백).
  const currentLevel = useMemo(
    () => blindLevels.find((l) => l.sort === clock?.currentLevelSort) ?? null,
    [blindLevels, clock?.currentLevelSort]
  );

  const remaining = useMemo(
    () =>
      computeClockRemaining({
        levelStartedAt: clock?.levelStartedAt ?? null,
        durationSec: currentLevel?.durationSec ?? null,
        isRunning,
        pausedRemainingSec: clock?.pausedRemainingSec ?? null,
        serverOffsetMs: 0,
        nowMs,
      }),
    [clock?.levelStartedAt, clock?.pausedRemainingSec, currentLevel?.durationSec, isRunning, nowMs]
  );

  return {
    clock,
    currentLevel,
    remainingSec: remaining.remainingSec,
    isExpired: remaining.isExpired,
    levelMissing: remaining.levelMissing,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
