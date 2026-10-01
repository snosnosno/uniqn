import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import type { OpsTournament } from '@/core/types/ops';
import { ParticipantDetail } from '../players/ParticipantDetail';
import type { usePlayerActions } from '../players/usePlayerActions';
import type { SeatController } from './useSeatController';

type Actions = ReturnType<typeof usePlayerActions>;

/** 선택 좌석 — 좌석 동작(이동·비우기) + 참가자 동작(참가 탭과 같은 패널). */
export function SeatDetail({
  tournament,
  ctl,
  actions,
}: {
  tournament: OpsTournament;
  ctl: SeatController;
  actions: Actions;
}) {
  const seat = ctl.selectedSeat;
  const p = ctl.occupant;
  if (!seat || !p) return null;
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 gap-2 border-b p-4">
        <p className="label col-span-2">
          선택됨 ·{' '}
          <span className="num">
            T{seat.tableNo}-{seat.seatNo}
          </span>
        </p>
        <Button variant="outline" size="lg" disabled={ctl.busy} onClick={ctl.startMove}>
          이동 <Kbd>M</Kbd>
        </Button>
        {/* 비우기는 좌석을 잃는 동작 — 모바일처럼 위험 톤으로 구분 */}
        <Button
          variant="outline"
          size="lg"
          className="text-destructive"
          disabled={ctl.busy}
          onClick={ctl.freeSelected}
        >
          비우기
        </Button>
      </div>
      <ParticipantDetail
        participant={p}
        tournament={tournament}
        seat={`T${seat.tableNo}-${seat.seatNo}`}
        busy={actions.busy}
        onRun={actions.run}
      />
    </div>
  );
}

/** ≥1024 우측 패널용. */
export function TablesDetailPanel(props: {
  tournament: OpsTournament;
  ctl: SeatController;
  actions: Actions;
}) {
  if (!props.ctl.occupant) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        좌석을 누르면 여기서 이동·비우기·탈락을 바로 처리해요. 빈 칸을 누르면 대기 참가자를
        앉힙니다. 앉은 칸을 우클릭(태블릿은 길게 누르기)하면 메뉴로 바로 처리할 수 있어요.
      </p>
    );
  }
  return <SeatDetail {...props} />;
}
