/**
 * 좌석 컨트롤러 — 행렬표·상세 패널(≥1024)·시트(<1024)·단축키가 같은 상태를 쓴다(usePlayerActions 와 같은 구조).
 * 선택(점유 좌석) → 이동 모드(M) → 빈 칸 클릭 또는 "T5-2" 입력으로 이동. 빈 칸 클릭(이동 모드 아님) → 배정.
 *
 * 🔑 선택·이동은 **좌석 + 그 순간 앉아 있던 참가자**로 기억한다(리뷰 W5 HIGH). 좌석 id 만 들면 다른 운영자가
 * 그 자리에 다른 사람을 앉혔을 때 선택이 새 사람을 가리켜, 확인 없는 단축키(R·A)가 엉뚱한 사람에게 기록된다.
 * 앉은 사람이 바뀌면 선택·이동은 풀린 것으로 본다(모바일은 누른 시점의 참가자 스냅샷을 든다).
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { OpsParticipant, OpsSeat, OpsTable, OpsTournament } from '@/core/types/ops';
import { useAssignSeat, useFreeSeat, useMoveSeat } from '@/hooks/ops/useTableMutations';
import {
  AddTableDialog,
  AssignSeatDialog,
  RedrawDialog,
  TableSettingsDialog,
} from './TableDialogs';
import { parseSeatLabel, type RedrawMode } from './seatPlan';

/** 좌석 + 그 순간의 참가자. */
interface Pin {
  seatId: string;
  participantId: string;
}

/** 기억한 좌석에 지금도 같은 사람이 앉아 있을 때만 그 좌석(아니면 선택이 풀린 것). */
function resolvePin(seats: readonly OpsSeat[], pin: Pin | null): OpsSeat | null {
  if (!pin) return null;
  const seat = seats.find((s) => s.id === pin.seatId);
  return seat && seat.participantId === pin.participantId ? seat : null;
}

interface Options {
  tournament: OpsTournament;
  tables: OpsTable[];
  seats: OpsSeat[];
  participants: OpsParticipant[];
}

export function useSeatController(o: Options) {
  const id = o.tournament.id;
  const assign = useAssignSeat(id);
  const move = useMoveSeat(id);
  const free = useFreeSeat(id);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [moveFromPin, setMoveFromPin] = useState<Pin | null>(null);
  const [assignTarget, setAssignTarget] = useState<OpsSeat | null>(null);
  const [settingsFor, setSettingsFor] = useState<OpsTable | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [redrawMode, setRedrawMode] = useState<RedrawMode | null>(null);

  const selectedSeat = resolvePin(o.seats, selected);
  const occupant = selectedSeat
    ? (o.participants.find((p) => p.id === selectedSeat.participantId) ?? null)
    : null;
  const moveFrom = resolvePin(o.seats, moveFromPin);
  const busy = assign.isPending || move.isPending || free.isPending;
  const openTableIds = new Set(o.tables.filter((t) => t.status === 'open').map((t) => t.id));
  /** 앉힐 수 있는 칸 — 비어 있고 오픈 테이블(서버가 TABLE_NOT_OPEN 으로 거절하기 전에 막는다). */
  const canSeat = (seat: OpsSeat) => !seat.participantId && openTableIds.has(seat.tableId);

  /** 이동 — 성공이면 null, 아니면 안내 문구. */
  const moveTo = (target: OpsSeat): string | null => {
    if (!moveFrom?.participantId || busy) return '지금은 이동할 수 없어요';
    if (target.id === moveFrom.id) return '다른 빈 좌석을 고르세요';
    if (target.participantId) return `T${target.tableNo}-${target.seatNo} 은 이미 자리가 차 있어요`;
    if (!canSeat(target)) return '오픈 테이블에만 앉힐 수 있어요';
    move.mutate({ fromSeatId: moveFrom.id, toSeatId: target.id });
    setMoveFromPin(null);
    setSelected({ seatId: target.id, participantId: moveFrom.participantId });
    return null;
  };

  /** 좌석 칸 클릭 — 이동 모드면 이동, 점유면 선택(다시 누르면 해제), 빈 칸이면 배정. */
  const pressSeat = (seat: OpsSeat) => {
    if (moveFrom) {
      const problem = moveTo(seat);
      if (problem) toast.warning(problem);
      return;
    }
    if (seat.participantId) {
      setSelected(
        seat.id === selectedSeat?.id ? null : { seatId: seat.id, participantId: seat.participantId }
      );
    } else if (canSeat(seat)) setAssignTarget(seat);
    else toast.warning('오픈 테이블에만 앉힐 수 있어요');
  };
  const cancelMove = useCallback(() => setMoveFromPin(null), []);

  /** 이동 모드에서 좌석 라벨 입력 — 성공이면 null, 아니면 안내 문구. */
  const moveToLabel = (raw: string): string | null => {
    const parsed = parseSeatLabel(raw);
    if (!parsed) return 'T5-2 처럼 테이블-좌석 번호로 입력하세요';
    const target = o.seats.find((s) => s.tableNo === parsed[0] && s.seatNo === parsed[1]);
    if (!target) return `T${parsed[0]}-${parsed[1]} 좌석이 없어요`;
    return moveTo(target);
  };

  const dialogs = (
    <>
      <AssignSeatDialog
        target={assignTarget}
        participants={o.participants}
        seats={o.seats}
        onClose={() => setAssignTarget(null)}
        onPick={(participantId) => {
          if (!assignTarget || busy) return;
          assign.mutate({ seatId: assignTarget.id, participantId });
          setAssignTarget(null);
        }}
      />
      {settingsFor ? (
        <TableSettingsDialog
          key={settingsFor.id}
          tournamentId={id}
          table={o.tables.find((t) => t.id === settingsFor.id) ?? settingsFor}
          onClose={() => setSettingsFor(null)}
        />
      ) : null}
      {addOpen ? <AddTableDialog tournamentId={id} onClose={() => setAddOpen(false)} /> : null}
      {redrawMode ? (
        <RedrawDialog
          key={redrawMode}
          tournamentId={id}
          mode={redrawMode}
          tables={o.tables}
          seats={o.seats}
          participants={o.participants}
          onClose={() => setRedrawMode(null)}
        />
      ) : null}
    </>
  );

  return {
    selectedSeat,
    occupant,
    moveFrom,
    busy,
    canSeat,
    pressSeat,
    moveToLabel,
    clearSelection: () => {
      setSelected(null);
      setMoveFromPin(null);
    },
    startMove: () => selected && selectedSeat && setMoveFromPin(selected),
    cancelMove,
    freeSelected: () => {
      if (!selectedSeat || busy) return;
      free.mutate(selectedSeat.id);
      setSelected(null);
    },
    openTable: (t: OpsTable) => setSettingsFor(t),
    openAdd: () => setAddOpen(true),
    openRedraw: (mode: RedrawMode) => setRedrawMode(mode),
    dialogs,
  };
}

export type SeatController = ReturnType<typeof useSeatController>;
