import type { ReseatInput, ReseatResult, ReseatSeat, SeatAssignment } from './reseat.types';
import { eligibleSeats } from './randomDraw';
import { seatWithinTable } from './seatWithinTable';

/**
 * 1단계: chips 내림차순(동점 id asc) 정렬 → 적격 테이블에 스네이크 분배(capacity=빈 적격좌석 수, 찬 테이블 스킵).
 * 2단계: 각 테이블 버킷 → seatWithinTable(랜덤 좌석).
 */
export function chipDraft(input: ReseatInput): ReseatResult {
  const seats = eligibleSeats(input);
  if (input.players.length > seats.length) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_SEATS',
      available: seats.length,
      required: input.players.length,
    };
  }

  // 테이블별 적격 좌석 그룹(tableNo asc 안정 순서)
  const seatsByTable = new Map<string, ReseatSeat[]>();
  const tableOrder: string[] = [];
  for (const s of [...seats].sort((a, b) => a.tableNo - b.tableNo || a.seatNo - b.seatNo)) {
    if (!seatsByTable.has(s.tableId)) {
      seatsByTable.set(s.tableId, []);
      tableOrder.push(s.tableId);
    }
    seatsByTable.get(s.tableId)!.push(s);
  }

  // 1단계: 스네이크 버킷
  const sorted = [...input.players].sort(
    (a, b) => b.chips - a.chips || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const buckets = new Map<string, typeof sorted>(tableOrder.map((t) => [t, []]));
  const capacity = new Map(tableOrder.map((t) => [t, seatsByTable.get(t)!.length]));
  let dir = 1;
  let idx = 0;
  for (const p of sorted) {
    // capacity 남은 테이블을 만날 때까지 스네이크 진행
    let guard = 0;
    while (buckets.get(tableOrder[idx])!.length >= capacity.get(tableOrder[idx])!) {
      idx += dir;
      if (idx >= tableOrder.length) {
        dir = -1;
        idx = tableOrder.length - 1;
      } else if (idx < 0) {
        dir = 1;
        idx = 0;
      }
      if (++guard > tableOrder.length * 2) {
        // 이론상 도달 불가(capacity 사전검증 통과)지만 방어적 에러 반환
        return {
          ok: false,
          reason: 'INSUFFICIENT_SEATS',
          available: seats.length,
          required: input.players.length,
        };
      }
    }
    buckets.get(tableOrder[idx])!.push(p);
    // 다음 플레이어를 위해 한 칸 진행(스네이크)
    idx += dir;
    if (idx >= tableOrder.length) {
      dir = -1;
      idx = tableOrder.length - 1;
    } else if (idx < 0) {
      dir = 1;
      idx = 0;
    }
  }

  // 2단계: 테이블 내 랜덤 좌석
  const assignments: SeatAssignment[] = [];
  for (const t of tableOrder) {
    const bp = buckets.get(t)!;
    if (bp.length === 0) continue;
    assignments.push(...seatWithinTable(bp, seatsByTable.get(t)!, input.rng));
  }
  return { ok: true, assignments };
}
