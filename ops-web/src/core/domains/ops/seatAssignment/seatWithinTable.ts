// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/domains/ops/seatAssignment/seatWithinTable.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import type { ReseatPlayer, ReseatSeat, SeatAssignment } from './reseat.types';

/** Fisher-Yates in-place 셔플(주입 rng). */
export function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * 주어진 players를 주어진 seats에 랜덤 1:1 배정.
 * seats를 seatNo 안정정렬 후 셔플 → players를 앞에서부터 매칭.
 * players.length <= seats.length 전제(호출부가 capacity 보장).
 */
export function seatWithinTable(
  players: ReseatPlayer[],
  seats: ReseatSeat[],
  rng: () => number
): SeatAssignment[] {
  const ordered = [...seats].sort((a, b) => a.tableNo - b.tableNo || a.seatNo - b.seatNo);
  shuffleInPlace(ordered, rng);
  return players.map((p, i) => ({ participantId: p.id, seatId: ordered[i].id }));
}
