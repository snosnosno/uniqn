import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';
import { ClockStrip } from '@/components/ops/ClockStrip';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as opsClockService from '@/core/services/ops/opsClockService';
import type { OpsLiveStats } from '@/core/types/ops';
import { opsKeys } from '@/hooks/ops/keys';
import { useOpsClock } from '@/hooks/ops/useConsoleQueries';
import { useActorId } from '@/hooks/useActorId';
import { playChime, setChimeEnabled, useChimeEnabled } from '@/lib/chime';
import { logger } from '@/lib/logger';
import { isRealtimeConnected, subscribeRealtimeStatus } from '@/lib/realtime';
import { ClockControlPanel } from './ClockControlPanel';
import { levelAlert, shouldSyncClock, WARN_AT_SEC, type ClockSample } from './clock';
import { formatMmSs } from './format';

/**
 * 상단 클럭 스트립 + 제어 대화상자. 1초 틱을 **이 말단**에 가둔다 — 콘솔 루트에서 틱을 돌리면
 * 참가자 표·단축키 맵까지 매초 다시 그려진다(리뷰 W4).
 * 완료 대회는 호출부가 렌더하지 않는다(모바일 OpsConsoleShell: !isCompleted && 스트립).
 */
export function ConsoleClock({
  tournamentId,
  stats,
}: {
  tournamentId: string;
  stats: OpsLiveStats | null;
}) {
  const clock = useOpsClock(tournamentId);
  const connected = useSyncExternalStore(subscribeRealtimeStatus, isRealtimeConnected);
  const [open, setOpen] = useState(false);
  const chime = useChimeEnabled();
  const level = clock.currentLevel;
  const isRunning = clock.clock?.isRunning ?? false;
  const sort = clock.clock?.currentLevelSort ?? 0;

  const hasNext = clock.blindLevels.some((l) => l.sort === sort + 1);
  // 틱마다 다시 읽는다(1초 틱이 이 컴포넌트를 다시 그린다) — 끊긴 동안에는 전환 요청을 보낼 수 없다.
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;

  // 레벨 알림 — 틱마다 직전 표본과 비교해 1분 전·레벨 전환을 한 번씩 울린다(판정은 순수 함수 levelAlert).
  const prevSample = useRef<ClockSample | null>(null);
  // 다른 대회로 옮기면 직전 표본을 버린다 — 이전 대회의 레벨 번호와 비교해 "전환"으로 울리지 않게.
  useEffect(() => {
    prevSample.current = null;
  }, [tournamentId]);
  useEffect(() => {
    const next: ClockSample = { sort, remainingSec: clock.remainingSec, isRunning };
    const alert =
      // 오프라인이면 00:00 에 넘어가지 못한다 → '시간 종료'를 울려 운영자가 알게 한다.
      // navigator.onLine 은 "공유기만 살아 있고 인터넷은 끊긴" 현장에서 true 라 실시간 연결도 함께 본다.
      clock.blindLevels.length > 0
        ? levelAlert(prevSample.current, next, hasNext && online && connected)
        : null;
    prevSample.current = next;
    if (alert) playChime(alert);
  }, [sort, clock.remainingSec, isRunning, clock.blindLevels.length, hasNext, online, connected]);

  // 자동 전환 — 레벨 시간이 0 이 되면 서버에 "끝난 레벨을 따라잡아 달라"고 요청한다(다음 레벨로 넘어간다).
  // 이 콘솔이 꺼져 있어도 전광판 폴링·매분 크론이 넘기지만, 콘솔이 켜져 있으면 00:00 즉시 넘어간다.
  const actorId = useActorId();
  const qc = useQueryClient();
  const syncState = useRef({ lastAt: null as number | null, attempts: 0, inFlight: false });
  // 레벨이 바뀌면 재시도 기록을 푼다(새 레벨이 곧바로 끝난 상태일 수 있다 — 오래 꺼 뒀다 켠 경우).
  useEffect(() => {
    syncState.current = { lastAt: null, attempts: 0, inFlight: syncState.current.inFlight };
  }, [tournamentId, sort]);
  useEffect(() => {
    const state = syncState.current;
    const due = shouldSyncClock({
      isRunning,
      isExpired: clock.isExpired,
      hasNext,
      online,
      nowMs: clock.nowMs,
      lastAttemptMs: state.lastAt,
      attempts: state.attempts,
      inFlight: state.inFlight,
    });
    if (!due) return;
    state.lastAt = clock.nowMs;
    state.attempts += 1;
    state.inFlight = true;
    void opsClockService
      .sync(tournamentId, actorId)
      .then((advanced) => {
        // 시계는 항상 다시 읽는다 — 이 요청이 0 이어도 다른 화면·전광판이 먼저 넘겼을 수 있다.
        void qc.invalidateQueries({ queryKey: opsKeys.clock(tournamentId) });
        if (advanced > 0) {
          // 넘어갔을 때만 딸린 값(등록 자동 마감·평균 BB·이력)을 다시 받는다 — 재시도마다 이력을 다시 받지 않게.
          void qc.invalidateQueries({ queryKey: opsKeys.tournamentDetail(tournamentId) });
          void qc.invalidateQueries({ queryKey: opsKeys.liveStats(tournamentId) });
          void qc.invalidateQueries({ queryKey: opsKeys.events(tournamentId) });
        }
      })
      .catch((error: unknown) => {
        // 조용히 다시 시도한다 — 매번 토스트를 띄우면 운영 화면을 가린다.
        logger.warn('레벨 자동 전환 요청 실패', { error: String(error) });
      })
      .finally(() => {
        syncState.current.inFlight = false;
      });
  }, [isRunning, clock.isExpired, clock.nowMs, hasNext, online, tournamentId, actorId, qc]);

  return (
    <>
      <ClockStrip
        onActivate={() => setOpen(true)}
        paused={!isRunning && clock.clock?.pausedRemainingSec != null}
        warning={isRunning && clock.remainingSec <= WARN_AT_SEC}
        data={{
          level:
            clock.blindLevels.length === 0 ? '—' : level?.isBreak ? '휴식' : (level?.level ?? '—'),
          smallBlind: level?.smallBlind ?? 0,
          bigBlind: level?.bigBlind ?? 0,
          ante: level?.ante ?? 0,
          remaining: formatMmSs(clock.remainingSec),
          playersLeft: stats?.playing ?? 0,
          playersTotal: stats?.entries ?? 0,
          averageStack: stats?.averageStack ?? 0,
          prizePool: stats?.prizePool ?? 0,
          connected,
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[440px] p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>클럭</DialogTitle>
            <DialogDescription className="sr-only">클럭 시작·정지·레벨·시간 보정</DialogDescription>
          </DialogHeader>
          <ClockControlPanel tournamentId={tournamentId} clock={clock} />
          <div className="flex items-center gap-2 border-t px-4 py-3">
            <span className="text-sm">
              레벨 알림음
              <span className="block text-xs text-muted-foreground">
                1분 전 1번 · 다음 레벨로 넘어갈 때 2번 · 마지막 레벨 종료 3번 (이 기기에만 저장)
              </span>
            </span>
            <Button
              variant={chime ? 'default' : 'outline'}
              className="ml-auto h-11"
              aria-pressed={chime}
              onClick={() => {
                setChimeEnabled(!chime);
                if (!chime) playChime('oneMinute');
              }}
            >
              {chime ? <Bell /> : <BellOff />}
              {chime ? '켜짐' : '꺼짐'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 클럭 상태가 필요한 탭(현황·블라인드)용 — 틱을 그 탭 안에 가둔다. */
export function WithClock({
  tournamentId,
  children,
}: {
  tournamentId: string;
  children: (clock: ReturnType<typeof useOpsClock>) => React.ReactNode;
}) {
  const clock = useOpsClock(tournamentId);
  return <>{children(clock)}</>;
}
