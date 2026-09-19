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
import { ERROR_CODES } from '@/errors';
import {
  isTokenInvalidError,
  publicRefetchInterval,
  publicShouldRetry,
} from './publicPollingPolicy';

const TOKEN_INVALID_CODE = ERROR_CODES.OPS_MONITOR_TOKEN_INVALID;

export function useMonitorSnapshot(token: string | undefined) {
  const enabled = !!token && token.length >= 32;

  const query = useQuery({
    queryKey: token ? queryKeys.ops.monitor(token) : [...queryKeys.ops.all, 'monitor', 'none'],
    queryFn: () => opsMonitorRepository.getSnapshot(token as string),
    enabled,
    // 토큰 무효만 영구 정지. 네트워크 장애는 백오프하며 계속 폴링해 자동 복귀한다.
    // (종전에는 status==='error' 로 끊어 1회 실패가 곧 영구 정지였다 — 감사 monitor-01)
    refetchInterval: (q) =>
      publicRefetchInterval(q.state.error, q.state.fetchFailureCount, TOKEN_INVALID_CODE),
    staleTime: 0,
    retry: (failureCount, error) => publicShouldRetry(failureCount, error, TOKEN_INVALID_CODE),
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

  // 토큰 무효(영구) vs 연결 장애(일시) — 화면이 다른 문구를 띄워야 하므로 갈라서 내보낸다.
  const isTokenInvalid = isTokenInvalidError(query.error, TOKEN_INVALID_CODE);
  const isDisconnected = !isTokenInvalid && query.isError;

  return {
    snapshot,
    remainingSec: remaining.remainingSec,
    isExpired: remaining.isExpired,
    levelMissing: remaining.levelMissing,
    nextBreak,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    /** 토큰 자체가 무효 — 폴링이 영구 정지됐고 사람이 새 링크를 받아야 한다. */
    isTokenInvalid,
    /** 네트워크·서버 일시장애 — 폴링은 백오프하며 계속되고 저절로 복귀할 수 있다. */
    isDisconnected,
  };
}
