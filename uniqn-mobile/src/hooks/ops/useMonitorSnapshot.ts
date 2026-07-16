/**
 * 공개 모니터(전광판) 스냅샷 훅 (1c-3) — anon 폴링 + 서버시각 offset 보정 + 1초 똑딱.
 *
 * 타이머 정확도 = 서버 앵커(levelStartedAt) + 클라 똑딱(nowMs) + offset 보정(serverOffsetMs).
 * offset = (서버 server_now) − (수신 시점 로컬시각) → 모니터 기기 시계 오차를 보정해 운영자 화면과 동기.
 * 폴링 주기(≥3s)와 무관하게 카운트다운은 매 틱 앵커에서 재계산(누적 아님).
 *
 * Repository 직접 호출(읽기 전용) — 공개 라우트는 authStore/Service 비의존.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { opsMonitorRepository } from '@/repositories/ops';
import { computeClockRemaining, computeNextBreakRemaining } from '@/domains/ops';

const POLL_INTERVAL_MS = 4000; // ≥3s 하한(§0.5). 일시정지/레벨변경 최대 4s 지연 허용.

export function useMonitorSnapshot(token: string | undefined) {
  const enabled = !!token && token.length >= 32;

  const query = useQuery({
    queryKey: token ? queryKeys.ops.monitor(token) : [...queryKeys.ops.all, 'monitor', 'none'],
    queryFn: () => opsMonitorRepository.getSnapshot(token as string),
    enabled,
    // 무효 토큰(error)이면 폴링 중단(자원 낭비 방지). 정상이면 폴링 유지.
    refetchInterval: (q) => (q.state.status === 'error' ? false : POLL_INTERVAL_MS),
    staleTime: 0,
    retry: false, // 무효 토큰은 재시도 폭주 금지
  });

  const snapshot = query.data ?? null;
  const isRunning = snapshot?.clock.isRunning ?? false;

  // 서버시각 offset = (서버 server_now) − (수신 시점 로컬시각). 수신 시각은 query.dataUpdatedAt(ms).
  const serverOffsetMs = useMemo(() => {
    if (!snapshot || !query.dataUpdatedAt) return 0;
    return Date.parse(snapshot.serverNow) - query.dataUpdatedAt;
  }, [snapshot, query.dataUpdatedAt]);

  // 1초 똑딱 — running 동안만. 정지/일시정지면 불필요.
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
        levelStartedAt: snapshot?.clock.levelStartedAt ?? null,
        durationSec: snapshot?.currentLevel?.durationSec ?? null,
        isRunning,
        pausedRemainingSec: snapshot?.clock.pausedRemainingSec ?? null,
        serverOffsetMs,
        nowMs,
      }),
    [
      snapshot?.clock.levelStartedAt,
      snapshot?.clock.pausedRemainingSec,
      snapshot?.currentLevel?.durationSec,
      isRunning,
      serverOffsetMs,
      nowMs,
    ]
  );

  // S1 C1: 다음 브레이크 카운트다운 — 클럭과 동일 앵커·offset·틱(드리프트 0)
  const nextBreak = useMemo(
    () =>
      computeNextBreakRemaining({
        nextBreak: snapshot?.nextBreak ?? null,
        currentLevelIsBreak: snapshot?.currentLevel?.isBreak ?? false,
        currentLevelDurationSec: snapshot?.currentLevel?.durationSec ?? null,
        levelStartedAt: snapshot?.clock.levelStartedAt ?? null,
        isRunning,
        pausedRemainingSec: snapshot?.clock.pausedRemainingSec ?? null,
        serverOffsetMs,
        nowMs,
      }),
    [
      snapshot?.nextBreak,
      snapshot?.currentLevel?.isBreak,
      snapshot?.currentLevel?.durationSec,
      snapshot?.clock.levelStartedAt,
      snapshot?.clock.pausedRemainingSec,
      isRunning,
      serverOffsetMs,
      nowMs,
    ]
  );

  return {
    snapshot,
    remainingSec: remaining.remainingSec,
    isExpired: remaining.isExpired,
    levelMissing: remaining.levelMissing,
    nextBreak,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
