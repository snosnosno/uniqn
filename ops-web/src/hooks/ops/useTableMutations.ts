/**
 * W5 — 테이블·좌석 변이. 모바일 useOpsMutations(useAddTable~useReseatParticipants) 대응 —
 * 무효화 범위·토스트 문구는 모바일과 같다. 좌석 이동·배정·비우기는 낙관적 반영(DESIGN.md: 상태 변경 0ms).
 */
import type { SeatAssignment, WaitlistAssignment } from '@/core/domains/ops';
import * as opsSeatService from '@/core/services/ops/opsSeatService';
import * as opsTableService from '@/core/services/ops/opsTableService';
import type { OpsSeat, OpsTable, OpsTableLockType, OpsTableStatus } from '@/core/types/ops';
import { opsKeys } from './keys';
import { useOpsMutation } from './opsMutation';

export interface AddTableInput {
  seatCount: number;
  name?: string;
  lockType: OpsTableLockType;
  priority?: number;
}

export function useAddTable(id: string) {
  return useOpsMutation({
    op: 'ops.addTable',
    run: (input: AddTableInput, actor) =>
      opsTableService.addTable({ ...input, tournamentId: id }, actor),
    invalidate: [opsKeys.tables(id), opsKeys.seats(id), opsKeys.events(id)],
    success: () => '테이블을 추가했습니다',
  });
}

/**
 * 테이블 캐시에서 한 테이블만 바꾼 새 배열(원본 불변). 설정 대화상자의 즉시 저장 3종(잠금·상태·우선순위)은
 * 낙관적으로 반영한다 — 누르는 순간 값이 바뀌어야 성공 후 재조회 전 틈에 같은 값을 또 보내지 않는다
 * (리뷰: Enter 를 누르고 있으면 ops_close_table 이 한 번 더 나가 table_closed 이벤트가 중복).
 */
const withTable = (
  tables: OpsTable[] | undefined,
  tableId: string,
  patch: Partial<Pick<OpsTable, 'lockType' | 'status' | 'priority'>>
): OpsTable[] | undefined => tables?.map((t) => (t.id === tableId ? { ...t, ...patch } : t));

export function useSetTableLock(id: string) {
  return useOpsMutation({
    op: 'ops.setTableLock',
    run: (v: { tableId: string; lockType: OpsTableLockType }, actor) =>
      opsTableService.setLock(v.tableId, actor, v.lockType),
    invalidate: [opsKeys.tables(id), opsKeys.events(id)],
    optimistic: {
      key: opsKeys.tables(id),
      update: (data: OpsTable[] | undefined, v) =>
        withTable(data, v.tableId, { lockType: v.lockType }),
    },
    success: () => '테이블 잠금을 변경했습니다',
  });
}

export function useSetTablePriority(id: string) {
  return useOpsMutation({
    op: 'ops.setTablePriority',
    run: (v: { tableId: string; priority: number | null }, actor) =>
      opsTableService.setPriority(v.tableId, actor, v.priority),
    invalidate: [opsKeys.tables(id), opsKeys.events(id)],
    optimistic: {
      key: opsKeys.tables(id),
      update: (data: OpsTable[] | undefined, v) =>
        withTable(data, v.tableId, { priority: v.priority }),
    },
    success: () => '테이블 우선순위를 변경했습니다',
  });
}

export function useCloseTable(id: string) {
  return useOpsMutation({
    op: 'ops.closeTable',
    run: (v: { tableId: string; status: OpsTableStatus }, actor) =>
      opsTableService.closeTable(v.tableId, actor, v.status),
    invalidate: [opsKeys.tables(id), opsKeys.seats(id), opsKeys.events(id)],
    optimistic: {
      key: opsKeys.tables(id),
      update: (data: OpsTable[] | undefined, v) => withTable(data, v.tableId, { status: v.status }),
    },
    success: () => '테이블 상태를 변경했습니다',
  });
}

/** 좌석 캐시에서 participantId 를 옮긴 새 배열(원본 불변). */
const withSeat = (
  seats: OpsSeat[] | undefined,
  patch: Record<string, string | null>
): OpsSeat[] | undefined =>
  seats?.map((s) => (s.id in patch ? { ...s, participantId: patch[s.id] } : s));

export function useAssignSeat(id: string) {
  return useOpsMutation<{ seatId: string; participantId: string }, void, OpsSeat[]>({
    op: 'ops.assignSeat',
    run: (v, actor) => opsSeatService.assignSeat(v.seatId, v.participantId, actor),
    invalidate: [opsKeys.seats(id), opsKeys.participants(id), opsKeys.events(id)],
    success: () => '좌석을 배정했습니다',
    optimistic: {
      key: opsKeys.seats(id),
      update: (seats, v) => withSeat(seats, { [v.seatId]: v.participantId }),
    },
  });
}

export function useMoveSeat(id: string) {
  return useOpsMutation<{ fromSeatId: string; toSeatId: string }, void, OpsSeat[]>({
    op: 'ops.moveSeat',
    run: (v, actor) => opsSeatService.moveSeat(v.fromSeatId, v.toSeatId, actor),
    invalidate: [opsKeys.seats(id), opsKeys.participants(id), opsKeys.events(id)],
    success: () => '좌석을 이동했습니다',
    optimistic: {
      key: opsKeys.seats(id),
      update: (seats, v) => {
        const pid = seats?.find((s) => s.id === v.fromSeatId)?.participantId ?? null;
        return withSeat(seats, { [v.fromSeatId]: null, [v.toSeatId]: pid });
      },
    },
  });
}

export function useFreeSeat(id: string) {
  return useOpsMutation<string, void, OpsSeat[]>({
    op: 'ops.freeSeat',
    run: (seatId, actor) => opsSeatService.freeSeat(seatId, actor),
    invalidate: [opsKeys.seats(id), opsKeys.participants(id), opsKeys.events(id)],
    success: () => '좌석을 비웠습니다',
    optimistic: {
      key: opsKeys.seats(id),
      update: (seats, seatId) => withSeat(seats, { [seatId]: null }),
    },
  });
}

export function useRedrawWaitlistFill(id: string) {
  return useOpsMutation({
    op: 'ops.redrawWaitlistFill',
    run: (assignments: WaitlistAssignment[], actor) =>
      opsSeatService.redrawWaitlistFill(id, actor, assignments),
    invalidate: [opsKeys.seats(id), opsKeys.participants(id), opsKeys.events(id)],
    success: (r) => `${r.moved}명 좌석 배정 완료`,
  });
}

export function useReseatParticipants(id: string) {
  return useOpsMutation({
    op: 'ops.reseatParticipants',
    run: (v: { assignments: SeatAssignment[]; mode: 'random_draw' | 'chip_draft' }, actor) =>
      opsSeatService.reseatParticipants(id, actor, v.assignments, v.mode),
    invalidate: [
      opsKeys.seats(id),
      opsKeys.participants(id),
      opsKeys.liveStats(id),
      opsKeys.events(id),
    ],
    success: (r) => `${r.moved}명 재배치 완료`,
  });
}
