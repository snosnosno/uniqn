/**
 * 좌석 컨트롤러 — 행렬표·상세 패널(≥1024)·시트(<1024)·단축키가 같은 상태를 쓴다(usePlayerActions 와 같은 구조).
 * 선택(점유 좌석) → 이동 모드(M) → 빈 칸 클릭 또는 "T5-2" 입력으로 이동. 빈 칸 클릭(이동 모드 아님) → 배정.
 */
import { useState } from 'react';
import type { OpsParticipant, OpsSeat, OpsTable, OpsTournament } from '@/core/types/ops';
import { useAssignSeat, useFreeSeat, useMoveSeat } from '@/hooks/ops/useTableMutations';
import {
  AddTableDialog,
  AssignSeatDialog,
  RedrawDialog,
  TableSettingsDialog,
} from './TableDialogs';
import { parseSeatLabel, type RedrawMode } from './seatPlan';

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
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [moveFromId, setMoveFromId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<OpsSeat | null>(null);
  const [settingsFor, setSettingsFor] = useState<OpsTable | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [redrawMode, setRedrawMode] = useState<RedrawMode | null>(null);

  const selectedSeat = o.seats.find((s) => s.id === selectedSeatId) ?? null;
  const occupant = selectedSeat?.participantId
    ? (o.participants.find((p) => p.id === selectedSeat.participantId) ?? null)
    : null;
  const moveFrom = o.seats.find((s) => s.id === moveFromId) ?? null;
  const busy = assign.isPending || move.isPending || free.isPending;

  const moveTo = (target: OpsSeat): boolean => {
    if (!moveFrom || target.participantId || target.id === moveFrom.id || busy) return false;
    move.mutate({ fromSeatId: moveFrom.id, toSeatId: target.id });
    setMoveFromId(null);
    setSelectedSeatId(target.id);
    return true;
  };

  /** 좌석 칸 클릭 — 이동 모드면 이동, 점유면 선택(다시 누르면 해제), 빈 칸이면 배정. */
  const pressSeat = (seat: OpsSeat) => {
    if (moveFrom) {
      moveTo(seat);
      return;
    }
    if (seat.participantId) setSelectedSeatId(seat.id === selectedSeatId ? null : seat.id);
    else setAssignTarget(seat);
  };

  /** 이동 모드에서 좌석 라벨 입력 — 성공이면 null, 아니면 안내 문구. */
  const moveToLabel = (raw: string): string | null => {
    const parsed = parseSeatLabel(raw);
    if (!parsed) return 'T5-2 처럼 테이블-좌석 번호로 입력하세요';
    const target = o.seats.find((s) => s.tableNo === parsed[0] && s.seatNo === parsed[1]);
    if (!target) return `T${parsed[0]}-${parsed[1]} 좌석이 없어요`;
    if (target.participantId) return `T${parsed[0]}-${parsed[1]} 은 이미 자리가 차 있어요`;
    return moveTo(target) ? null : '이동할 수 없는 좌석이에요';
  };

  const dialogs = (
    <>
      <AssignSeatDialog
        target={assignTarget}
        participants={o.participants}
        seats={o.seats}
        onClose={() => setAssignTarget(null)}
        onPick={(participantId) => {
          if (!assignTarget) return;
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
    pressSeat,
    moveToLabel,
    clearSelection: () => {
      setSelectedSeatId(null);
      setMoveFromId(null);
    },
    startMove: () => selectedSeat?.participantId && setMoveFromId(selectedSeat.id),
    cancelMove: () => setMoveFromId(null),
    freeSelected: () => {
      if (!selectedSeat?.participantId || busy) return;
      free.mutate(selectedSeat.id);
      setSelectedSeatId(null);
    },
    openTable: (t: OpsTable) => setSettingsFor(t),
    openAdd: () => setAddOpen(true),
    openRedraw: (mode: RedrawMode) => setRedrawMode(mode),
    dialogs,
  };
}

export type SeatController = ReturnType<typeof useSeatController>;
