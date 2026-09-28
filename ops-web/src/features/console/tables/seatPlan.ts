/**
 * 좌석표 파생(순수) — 모바일 TablesTab·RedrawModal 의 계산을 웹 좌석 행렬표용으로 옮겼다.
 * 배정 알고리즘 자체는 동기화 사본(`@/core/domains/ops`)을 그대로 쓴다.
 */
import {
  chipDraft,
  computeWaitlistFill,
  randomDraw,
  type SeatAssignment,
  type WaitlistAssignment,
} from '@/core/domains/ops';
import type { OpsParticipant, OpsSeat, OpsTable } from '@/core/types/ops';

/** 착석 대상 상태 — 모바일 TablesTab SEATABLE. */
const SEATABLE = new Set<string>(['active', 'checked_in']);

export type RedrawMode = 'waitlist_fill' | 'random_draw' | 'chip_draft';

export interface TableRowView {
  table: OpsTable;
  /** 좌석 번호순 */
  seats: OpsSeat[];
  filled: number;
}

/** 테이블 번호순 행 + 좌석 번호순 칸. */
export function buildRows(tables: readonly OpsTable[], seats: readonly OpsSeat[]): TableRowView[] {
  const byTable = new Map<string, OpsSeat[]>();
  for (const s of seats) byTable.set(s.tableId, [...(byTable.get(s.tableId) ?? []), s]);
  return [...tables]
    .sort((a, b) => a.tableNo - b.tableNo)
    .map((table) => {
      const row = [...(byTable.get(table.id) ?? [])].sort((a, b) => a.seatNo - b.seatNo);
      return { table, seats: row, filled: row.filter((s) => s.participantId).length };
    });
}

/** 착석 대기 = 좌석 없는 active/checked_in. */
export function unseatedParticipants(
  participants: readonly OpsParticipant[],
  seats: readonly OpsSeat[]
): OpsParticipant[] {
  const seated = new Set(seats.filter((s) => s.participantId).map((s) => s.participantId));
  return participants.filter((p) => SEATABLE.has(p.status) && !seated.has(p.id));
}

export type RedrawPlan =
  | { mode: 'waitlist_fill'; assignments: WaitlistAssignment[]; insufficient: false }
  | { mode: 'random_draw' | 'chip_draft'; assignments: SeatAssignment[]; insufficient: boolean };

/**
 * 배정 계획 — 모바일 RedrawModal 과 같은 규칙.
 * 빈자리 채움 = 대기 → 적격(open·잠금 없음) 빈 좌석. 전원 재배치 = 보호 테이블(비-open·잠금/피처)
 * 점유자를 뺀 active+checked_in 전원을 적격 좌석에 다시 앉힌다.
 */
export function planRedraw(
  mode: RedrawMode,
  tables: readonly OpsTable[],
  seats: readonly OpsSeat[],
  participants: readonly OpsParticipant[],
  rng: () => number = Math.random
): RedrawPlan {
  const plainTables = tables.map((t) => ({ id: t.id, status: t.status, lockType: t.lockType }));
  const plainSeats = seats.map((s) => ({
    id: s.id,
    tableId: s.tableId,
    tableNo: s.tableNo,
    seatNo: s.seatNo,
    participantId: s.participantId ?? null,
  }));
  if (mode === 'waitlist_fill') {
    const assignments = computeWaitlistFill({
      tables: plainTables,
      seats: plainSeats,
      unseatedParticipantIds: unseatedParticipants(participants, seats).map((p) => p.id),
    });
    return { mode, assignments, insufficient: false };
  }
  const eligible = new Set(
    tables.filter((t) => t.status === 'open' && t.lockType === 'none').map((t) => t.id)
  );
  const protectedIds = new Set(
    seats.filter((s) => s.participantId && !eligible.has(s.tableId)).map((s) => s.participantId)
  );
  const players = participants
    .filter((p) => SEATABLE.has(p.status) && !protectedIds.has(p.id))
    .map((p) => ({ id: p.id, chips: p.chips }));
  if (players.length === 0) return { mode, assignments: [], insufficient: false };
  const input = { tables: plainTables, seats: plainSeats, players, rng };
  const result = mode === 'random_draw' ? randomDraw(input) : chipDraft(input);
  return result.ok
    ? { mode, assignments: result.assignments, insufficient: false }
    : { mode, assignments: [], insufficient: true };
}

export const LOCK_LABEL: Record<OpsTable['lockType'], string> = {
  none: '없음',
  locked: '잠금',
  feature: '피처',
};
export const STATUS_LABEL: Record<OpsTable['status'], string> = {
  open: '오픈',
  standby: '대기',
  closed: '마감',
};

/** "T5-2" · "5-2" · "5 2" → [5, 2]. 형식이 아니면 null. */
export function parseSeatLabel(raw: string): [number, number] | null {
  const m = raw.trim().match(/^t?\s*(\d{1,3})\s*[-·.\s]\s*(\d{1,2})$/i);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** 배정 계산 입력의 지문 — 미리보기 뒤 이 값이 바뀌면 계획이 낡은 것이다. */
export function planFingerprint(
  tables: readonly OpsTable[],
  seats: readonly OpsSeat[],
  participants: readonly OpsParticipant[]
): string {
  const t = tables.map((x) => `${x.id}:${x.status}:${x.lockType}`).sort();
  const s = seats.map((x) => `${x.id}:${x.participantId ?? ''}`).sort();
  const p = participants.map((x) => `${x.id}:${x.status}`).sort();
  return `${t.join(',')}|${s.join(',')}|${p.join(',')}`;
}
