/**
 * ops 레벨 자동 전환 요청 — 콘솔이 00:00 을 보는 즉시 서버에 "끝난 레벨을 따라잡아 달라"고 묻는다.
 *
 * 넘기는 주체는 서버다(fn_ops_clock_roll_forward). 이 훅이 없어도 매분 크론과 전광판·플레이어뷰 폴링이
 * 넘기지만, 그 경로는 최대 1분 늦다 — 운영자가 보는 화면이 00:00 에 멈춰 있는 시간을 없애려는 것이다.
 * 요청 시점·재시도 간격은 웹 콘솔과 같은 순수 판정(`shouldSyncClock`)을 쓴다.
 *
 * 쓰기 훅이지만 사용자 동작이 아니라 **시계가 일으키는** 요청이라 토스트를 띄우지 않는다
 * (실패해도 조용히 다시 묻는다 — 매번 알리면 운영 화면을 가린다). 오프라인이면 아예 보내지 않는다.
 *
 * 클럭 상태는 인자로 받는다 — 여기서 useOpsClock 을 또 부르면 1초 틱이 둘이 된다.
 * 콘솔에 한 번만 걸려 있어야 하므로 항상 떠 있는 OpsClockStrip 이 호출한다.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { shouldSyncClock } from '@/domains/ops';
import { opsClockService } from '@/services/ops';
import { isNetworkAvailableForMutation } from '@/services/offline/networkState';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

export interface OpsClockAutoAdvanceInput {
  isRunning: boolean;
  isExpired: boolean;
  /** 다음 레벨이 있는가 — 마지막 레벨은 넘어갈 곳이 없어 요청하지 않는다 */
  hasNext: boolean;
  /** 현재 레벨 순번 — 바뀌면 재시도 기록을 푼다 */
  currentSort: number | null;
  /** 클럭 훅의 1초 틱 */
  nowMs: number;
}

interface SyncState {
  lastAt: number | null;
  attempts: number;
  inFlight: boolean;
}

const IDLE: SyncState = { lastAt: null, attempts: 0, inFlight: false };

export function useOpsClockAutoAdvance(
  tournamentId: string | undefined,
  clock: OpsClockAutoAdvanceInput
): void {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((s) => s.user?.uid);
  const syncState = useRef<SyncState>(IDLE);
  const { isRunning, isExpired, hasNext, currentSort, nowMs } = clock;

  // 레벨이 바뀌면 재시도 기록을 푼다(새 레벨이 곧바로 끝난 상태일 수 있다 — 오래 꺼 뒀다 켠 경우).
  // 날아가 있는 요청 표시는 유지한다 — 그 요청이 돌아오기 전에 또 보내지 않게.
  useEffect(() => {
    syncState.current = { ...IDLE, inFlight: syncState.current.inFlight };
  }, [tournamentId, currentSort]);

  useEffect(() => {
    if (!tournamentId || !actorId) return;
    const state = syncState.current;
    const due = shouldSyncClock({
      isRunning,
      isExpired,
      hasNext,
      online: isNetworkAvailableForMutation(),
      nowMs,
      lastAttemptMs: state.lastAt,
      attempts: state.attempts,
      inFlight: state.inFlight,
    });
    if (!due) return;

    syncState.current = { lastAt: nowMs, attempts: state.attempts + 1, inFlight: true };
    void opsClockService
      .sync(tournamentId, actorId)
      .then((advanced) => {
        // 시계는 항상 다시 읽는다 — 이 요청이 0 이어도 다른 기기·전광판이 먼저 넘겼을 수 있다.
        void queryClient.invalidateQueries({ queryKey: queryKeys.ops.clock(tournamentId) });
        if (advanced > 0) {
          // 넘어갔을 때만 딸린 값(등록 자동 마감·평균 BB·이력)을 다시 받는다.
          void queryClient.invalidateQueries({
            queryKey: queryKeys.ops.tournamentDetail(tournamentId),
          });
          void queryClient.invalidateQueries({ queryKey: queryKeys.ops.liveStats(tournamentId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.ops.events(tournamentId) });
        }
      })
      .catch((error: unknown) => {
        logger.warn('ops 레벨 자동 전환 요청 실패', { tournamentId, error: String(error) });
      })
      .finally(() => {
        syncState.current = { ...syncState.current, inFlight: false };
      });
  }, [isRunning, isExpired, hasNext, nowMs, tournamentId, actorId, queryClient]);
}
