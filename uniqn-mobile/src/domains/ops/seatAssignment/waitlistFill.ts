/** 대기채움(waitlist-fill) 좌석 배정 — 순수함수. 빈좌석(open·unlocked)에 미착석 참가자 균형 배분. */
export interface WaitlistFillSeat {
  id: string;
  tableId: string;
  tableNo: number;
  seatNo: number;
  participantId: string | null;
}
export interface WaitlistFillTable {
  id: string;
  status: 'open' | 'closed' | 'standby';
  lockType: 'none' | 'locked' | 'feature';
}
export interface WaitlistFillInput {
  tables: readonly WaitlistFillTable[];
  seats: readonly WaitlistFillSeat[];
  unseatedParticipantIds: readonly string[];
}
export interface WaitlistAssignment {
  seatId: string;
  participantId: string;
  expected: string | null;
}

export function computeWaitlistFill(input: WaitlistFillInput): WaitlistAssignment[] {
  const eligibleTableIds = new Set(
    input.tables.filter((t) => t.status === 'open' && t.lockType === 'none').map((t) => t.id)
  );
  // 테이블별 현재 점유 수.
  const occupancy = new Map<string, number>();
  for (const s of input.seats) {
    if (s.participantId) occupancy.set(s.tableId, (occupancy.get(s.tableId) ?? 0) + 1);
  }
  // 빈좌석(적격 테이블).
  const emptySeats = input.seats
    .filter((s) => !s.participantId && eligibleTableIds.has(s.tableId))
    .map((s) => ({ ...s }));

  const assignments: WaitlistAssignment[] = [];
  const working = occupancy; // 배정하며 점유 카운트 증가.
  for (const participantId of input.unseatedParticipantIds) {
    // 점유 적은 테이블의 빈좌석 우선 → (table_no, seat_no) 안정 정렬.
    const next = emptySeats
      .filter((s) => !assignments.some((a) => a.seatId === s.id))
      .sort((a, b) => {
        const oa = working.get(a.tableId) ?? 0;
        const ob = working.get(b.tableId) ?? 0;
        if (oa !== ob) return oa - ob;
        if (a.tableNo !== b.tableNo) return a.tableNo - b.tableNo;
        return a.seatNo - b.seatNo;
      })[0];
    if (!next) break; // 빈좌석 소진.
    assignments.push({ seatId: next.id, participantId, expected: null });
    working.set(next.tableId, (working.get(next.tableId) ?? 0) + 1);
  }
  return assignments;
}
