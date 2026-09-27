// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/domains/ops/seatAssignment/randomDraw.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { ReseatInput, ReseatResult, ReseatSeat } from './reseat.types';
import { seatWithinTable } from './seatWithinTable';

/** open·unlocked 테이블에 속한 좌석만 적격(점유/빈 무관 — 전원 재배치). */
export function eligibleSeats(input: ReseatInput): ReseatSeat[] {
  const okTables = new Set(
    input.tables.filter((t) => t.status === 'open' && t.lockType === 'none').map((t) => t.id)
  );
  return input.seats.filter((s) => okTables.has(s.tableId));
}

export function randomDraw(input: ReseatInput): ReseatResult {
  const seats = eligibleSeats(input);
  if (input.players.length > seats.length) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_SEATS',
      available: seats.length,
      required: input.players.length,
    };
  }
  return { ok: true, assignments: seatWithinTable(input.players, seats, input.rng) };
}
