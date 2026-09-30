import { useEffect, useMemo, useState } from 'react';
import { Plus, Shuffle, UsersRound } from 'lucide-react';
import { cn } from 'cn';
import { LoadError, Loading } from '@/components/ops/LoadState';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { OpsParticipant, OpsSeat, OpsTournament } from '@/core/types/ops';
import { useHotkeyMap } from '@/lib/useHotkey';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { fmt } from '../format';
import { participantActions } from '../participantActions';
import { ACTION_KEYS } from '../players/helpers';
import type { usePlayerActions } from '../players/usePlayerActions';
import {
  LOCK_LABEL,
  STATUS_LABEL,
  buildRows,
  unseatedParticipants,
  type TableRowView,
} from './seatPlan';
import { SeatDetail } from './SeatDetail';
import type { SeatController } from './useSeatController';

type Actions = ReturnType<typeof usePlayerActions>;

/**
 * 테이블 — 좌석 행렬표(시안 A 승인 2026-09-28): 테이블=행, 좌석=열. 한 화면에 전체 좌석·칩, 빈자리는 점선.
 * 단축키: W 빈자리 채우기 · M 이동 · Esc 이동 취소 · R/A/C/X/E 참가자 액션(선택 좌석).
 */
export function TablesTab({
  tournament,
  loading,
  loadError,
  onRetry,
  tables,
  participants,
  staffNameOf,
  seats,
  ctl,
  actions,
}: {
  tournament: OpsTournament;
  loading: boolean;
  loadError: unknown;
  onRetry: () => void;
  tables: Parameters<typeof buildRows>[0];
  seats: OpsSeat[];
  participants: OpsParticipant[];
  staffNameOf: (staffId: string) => string | null;
  ctl: SeatController;
  actions: Actions;
}) {
  const wide = useMediaQuery('(min-width: 1024px)');
  const phone = !useMediaQuery('(min-width: 640px)');
  const rows = useMemo(() => buildRows(tables, seats), [tables, seats]);
  const byId = useMemo(() => new Map(participants.map((p) => [p.id, p] as const)), [participants]);
  const waiting = unseatedParticipants(participants, seats).length;
  const emptySeats = rows.reduce((n, r) => n + r.seats.length - r.filled, 0);
  const maxSeats = Math.max(0, ...rows.map((r) => r.seats.length));
  // 좌석이 realtime 으로 비면(다른 운영자가 비움) 선택도 풀린 것으로 본다
  const selected = ctl.occupant ? ctl.selectedSeat : null;
  // 다른 탭으로 가면 이동 모드를 끝낸다(돌아왔을 때 이동바가 되살아나지 않게)
  const { cancelMove } = ctl;
  useEffect(() => cancelMove, [cancelMove]);

  const keyed: Record<string, () => void> = { KeyW: () => ctl.openRedraw('waitlist_fill') };
  if (ctl.moveFrom) keyed.Escape = ctl.cancelMove;
  if (selected && ctl.occupant && !ctl.busy && !actions.busy) {
    keyed.KeyM = ctl.startMove;
    const allowed = participantActions(ctl.occupant, tournament);
    for (const [action, key] of Object.entries(ACTION_KEYS)) {
      if (allowed.includes(action as never)) {
        const p = ctl.occupant;
        keyed[`Key${key}`] = () => actions.run(action as never, p);
      }
    }
  }
  useHotkeyMap(keyed);

  const detail = selected ? (
    <SeatDetail tournament={tournament} ctl={ctl} actions={actions} />
  ) : null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button size="lg" onClick={() => ctl.openRedraw('waitlist_fill')}>
          <UsersRound /> 빈자리 채우기 <Kbd>W</Kbd>
        </Button>
        <Button variant="outline" className="h-11" onClick={() => ctl.openRedraw('random_draw')}>
          <Shuffle /> 랜덤 재배치
        </Button>
        <Button variant="outline" className="h-11" onClick={() => ctl.openRedraw('chip_draft')}>
          칩 드래프트
        </Button>
        <Button variant="outline" className="h-11" onClick={ctl.openAdd}>
          <Plus /> 테이블
        </Button>
        <span className="label ml-auto">
          대기 <b className="num text-foreground">{waiting}</b>명 · 빈 좌석{' '}
          <b className="num text-foreground">{emptySeats}</b>
        </span>
      </div>

      {ctl.moveFrom ? (
        <MoveBar ctl={ctl} name={byId.get(ctl.moveFrom.participantId ?? '')?.name ?? ''} />
      ) : null}

      {loadError && rows.length === 0 ? (
        <LoadError title="테이블을 불러오지 못했어요" error={loadError} onRetry={onRetry} />
      ) : loading ? (
        <Loading label="테이블을 불러오는 중…" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="font-semibold">아직 테이블이 없습니다</p>
          <p className="max-w-md text-sm text-muted-foreground">
            참가자 등록 전에 테이블을 먼저 추가하세요. 테이블이 없으면 등록한 참가자가 착석 대기로
            쌓이고 플레이 중 통계에 잡히지 않습니다.
          </p>
          <Button size="lg" onClick={ctl.openAdd}>
            <Plus /> 테이블 추가
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            // 1280(상세 패널 포함)에서 9석 테이블이 스크롤 없이 들어가는 폭 — 칸 최소 58px
            style={{ minWidth: 128 + maxSeats * 62 + 48 }}
          >
            <thead>
              <tr className="label border-b text-left [&>th]:px-2 [&>th]:py-2">
                <th className="w-14">테이블</th>
                <th className="w-[72px]">딜러</th>
                {Array.from({ length: maxSeats }, (_, i) => (
                  <th key={i} className="text-center">
                    {i + 1}
                  </th>
                ))}
                <th className="w-12 text-right">착석</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <MatrixRow
                  key={r.table.id}
                  row={r}
                  maxSeats={maxSeats}
                  byId={byId}
                  staffNameOf={staffNameOf}
                  ctl={ctl}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!wide ? (
        // 이동 모드에선 시트를 닫아 행렬표의 빈 칸을 누를 수 있게 한다(리뷰 W5 HIGH — 시트가 표를 가렸다)
        <Sheet
          open={selected !== null && !ctl.moveFrom}
          onOpenChange={(open) => !open && !ctl.moveFrom && ctl.clearSelection()}
        >
          <SheetContent
            side={phone ? 'bottom' : 'right'}
            className={phone ? 'max-h-[85dvh] overflow-auto' : 'w-full overflow-auto sm:max-w-sm'}
          >
            <SheetTitle className="sr-only">좌석 상세</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

function MoveBar({ ctl, name }: { ctl: SeatController; name: string }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(ctl.moveToLabel(value));
      }}
    >
      <span>
        <b>{name}</b> 이동 — 빈 칸을 누르거나 좌석 입력
      </span>
      <input
        autoFocus
        aria-label="이동할 좌석(T5-2)"
        placeholder="T5-2"
        value={value}
        onChange={(e) => (setValue(e.target.value), setError(null))}
        // 입력칸에선 전역 단축키가 꺼지므로 Esc 는 여기서 직접 받는다
        onKeyDown={(e) => e.key === 'Escape' && ctl.cancelMove()}
        className="num h-11 w-24 rounded-lg border border-input bg-background px-2 dark:bg-input/30"
      />
      <Button type="submit" variant="outline" className="h-11">
        이동
      </Button>
      <Button type="button" variant="ghost" className="h-11" onClick={ctl.cancelMove}>
        취소 <Kbd>Esc</Kbd>
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

function MatrixRow({
  row,
  maxSeats,
  byId,
  staffNameOf,
  ctl,
}: {
  row: TableRowView;
  maxSeats: number;
  byId: Map<string, OpsParticipant>;
  staffNameOf: (staffId: string) => string | null;
  ctl: SeatController;
}) {
  const t = row.table;
  const flags = [
    t.lockType !== 'none' ? LOCK_LABEL[t.lockType] : null,
    t.status !== 'open' ? STATUS_LABEL[t.status] : null,
  ].filter(Boolean);
  return (
    <tr className="h-16 border-b">
      <td className="px-2">
        <button
          type="button"
          aria-label={`T${t.tableNo} 설정`}
          onClick={() => ctl.openTable(t)}
          className="flex min-h-11 flex-col items-start justify-center text-left hover:underline"
        >
          <b className="num text-lg">T{t.tableNo}</b>
          {flags.length ? <span className="text-xs text-warning">{flags.join('·')}</span> : null}
        </button>
      </td>
      <td className="truncate px-2 text-xs text-muted-foreground">
        {t.assignedStaffId ? (staffNameOf(t.assignedStaffId) ?? '외부 스태프') : '—'}
      </td>
      {Array.from({ length: maxSeats }, (_, i) => {
        const seat = row.seats[i];
        return (
          <td key={i} className="p-0.5">
            {seat ? (
              <SeatCell
                seat={seat}
                occupant={seat.participantId ? byId.get(seat.participantId) : undefined}
                ctl={ctl}
              />
            ) : null}
          </td>
        );
      })}
      <td className="num px-2 text-right">
        {row.filled}/{row.seats.length}
      </td>
    </tr>
  );
}

function SeatCell({
  seat,
  occupant,
  ctl,
}: {
  seat: OpsSeat;
  occupant?: OpsParticipant;
  ctl: SeatController;
}) {
  const selected = ctl.selectedSeat?.id === seat.id;
  const isSource = ctl.moveFrom?.id === seat.id;
  const target = !!ctl.moveFrom && ctl.canSeat(seat);
  const label = `T${seat.tableNo}-${seat.seatNo}`;
  return (
    <button
      type="button"
      data-seat={label}
      aria-pressed={seat.participantId ? selected : undefined}
      aria-label={occupant ? `${label} ${occupant.name}` : `${label} 빈 좌석`}
      onClick={() => ctl.pressSeat(seat)}
      className={cn(
        'flex h-14 w-full min-w-[58px] flex-col items-center justify-center border px-1 text-xs',
        selected || isSource
          ? 'border-primary bg-primary font-bold text-primary-foreground'
          : seat.participantId
            ? 'bg-card hover:bg-muted'
            : target
              ? 'border-dashed border-primary text-primary hover:bg-muted'
              : 'border-dashed text-muted-foreground hover:bg-muted'
      )}
    >
      {seat.participantId ? (
        <>
          <span className="w-full truncate text-center font-semibold">
            {occupant?.name ?? '점유'}
          </span>
          <span className="num text-[10px] opacity-75">{occupant ? fmt(occupant.chips) : ''}</span>
        </>
      ) : (
        <span aria-hidden>+</span>
      )}
    </button>
  );
}
