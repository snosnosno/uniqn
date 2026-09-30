/**
 * 콘솔 읽기 훅 — 모바일 useOpsTournament·useOpsParticipants·useOpsBlindLevels·useOpsClock·
 * useOpsLiveStats·useOpsTables·useOpsSeats 대응. 읽기는 Repository 사본 직접, realtime 은 무효화만.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { computeClockRemaining } from '@/core/domains/ops';
import {
  opsBlindLevelRepository,
  opsClockRepository,
  opsLiveStatsRepository,
  opsParticipantRepository,
  opsPrizeRepository,
  opsSeatRepository,
  opsTableRepository,
  opsTournamentRepository,
} from '@/core/repositories/ops';
import { subscribeTable } from '@/lib/realtime';
import { getServerOffsetMs, subscribeServerOffset } from '@/lib/serverClock';
import { opsKeys } from './keys';

/** 테이블 변경 → 해당 키 무효화(재접속 복구 때도 같은 동작). */
export function useRealtimeInvalidate(
  table: string,
  filter: string,
  key: QueryKey,
  enabled = true
) {
  const qc = useQueryClient();
  const keyHash = JSON.stringify(key);
  useEffect(() => {
    if (!enabled) return undefined;
    const invalidate = () => void qc.invalidateQueries({ queryKey: JSON.parse(keyHash) });
    return subscribeTable(table, filter, invalidate);
  }, [qc, table, filter, keyHash, enabled]);
}

export function useOpsTournament(id: string) {
  const key = opsKeys.tournamentDetail(id);
  useRealtimeInvalidate('ops_tournaments', `id=eq.${id}`, key);
  return useQuery({ queryKey: key, queryFn: () => opsTournamentRepository.getById(id) });
}

export function useOpsParticipants(id: string) {
  const key = opsKeys.participants(id);
  useRealtimeInvalidate('ops_participants', `tournament_id=eq.${id}`, key);
  return useQuery({ queryKey: key, queryFn: () => opsParticipantRepository.listByTournament(id) });
}

export function useOpsBlindLevels(id: string) {
  const key = opsKeys.blindLevels(id);
  useRealtimeInvalidate('ops_blind_levels', `tournament_id=eq.${id}`, key);
  return useQuery({ queryKey: key, queryFn: () => opsBlindLevelRepository.listByTournament(id) });
}

export function useOpsLiveStats(id: string) {
  const key = opsKeys.liveStats(id);
  useRealtimeInvalidate('ops_live_stats', `tournament_id=eq.${id}`, key);
  return useQuery({ queryKey: key, queryFn: () => opsLiveStatsRepository.get(id) });
}

export function useOpsTables(id: string) {
  const key = opsKeys.tables(id);
  useRealtimeInvalidate('ops_tables', `tournament_id=eq.${id}`, key);
  return useQuery({ queryKey: key, queryFn: () => opsTableRepository.listByTournament(id) });
}

export function useOpsSeats(id: string) {
  const key = opsKeys.seats(id);
  useRealtimeInvalidate('ops_seats', `tournament_id=eq.${id}`, key);
  return useQuery({ queryKey: key, queryFn: () => opsSeatRepository.listByTournament(id) });
}

/** 서버시각 오프셋(ms) — 응답 Date 헤더로 추정(lib/serverClock). 추정 전 0. */
export function useServerOffsetMs(): number {
  return useSyncExternalStore(subscribeServerOffset, getServerOffsetMs, getServerOffsetMs);
}

/**
 * 서버 동기 클럭 — 앵커(level_started_at) + 1초 똑딱 + **서버시각 오프셋 보정**.
 * 모바일 운영자 클럭은 기기 시계를 믿지만(serverOffsetMs=0), 브라우저 태블릿은 시계 오차가 흔해
 * 공개뷰와 같은 보정을 적용한다(설계 §5, 리뷰 M4).
 */
export function useOpsClock(id: string) {
  const key = opsKeys.clock(id);
  useRealtimeInvalidate('ops_clock', `tournament_id=eq.${id}`, key);
  const query = useQuery({ queryKey: key, queryFn: () => opsClockRepository.get(id) });
  const levels = useOpsBlindLevels(id);
  const serverOffsetMs = useServerOffsetMs();

  const clock = query.data ?? null;
  const isRunning = clock?.isRunning ?? false;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!isRunning) return undefined;
    const tick = () => setNowMs(Date.now());
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [isRunning]);

  const blindLevels = useMemo(() => levels.data ?? [], [levels.data]);
  const currentLevel = useMemo(
    () => blindLevels.find((l) => l.sort === clock?.currentLevelSort) ?? null,
    [blindLevels, clock?.currentLevelSort]
  );
  const remaining = computeClockRemaining({
    levelStartedAt: clock?.levelStartedAt ?? null,
    durationSec: currentLevel?.durationSec ?? null,
    isRunning,
    pausedRemainingSec: clock?.pausedRemainingSec ?? null,
    serverOffsetMs,
    nowMs,
  });

  return {
    clock,
    blindLevels,
    currentLevel,
    serverOffsetMs,
    nowMs,
    ...remaining,
    isPending: query.isPending || levels.isPending,
    error: query.error ?? levels.error,
  };
}

/** 상금 구조(순위별 금액) — 탈락 확인창의 예상 상금 표시·W6 상금 탭. */
export function useOpsPrizes(id: string) {
  return useQuery({ queryKey: opsKeys.prizes(id), queryFn: () => opsPrizeRepository.list(id) });
}
