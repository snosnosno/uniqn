import { useState, useSyncExternalStore } from 'react';
import { ClockStrip } from '@/components/ops/ClockStrip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OpsLiveStats } from '@/core/types/ops';
import { useOpsClock } from '@/hooks/ops/useConsoleQueries';
import { isRealtimeConnected, subscribeRealtimeStatus } from '@/lib/realtime';
import { ClockControlPanel } from './ClockControlPanel';
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
  const level = clock.currentLevel;
  return (
    <>
      <ClockStrip
        onActivate={() => setOpen(true)}
        paused={!clock.clock?.isRunning && clock.clock?.pausedRemainingSec != null}
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
