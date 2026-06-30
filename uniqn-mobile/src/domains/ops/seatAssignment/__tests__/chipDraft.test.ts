import { chipDraft } from '../chipDraft';
import type { ReseatInput, ReseatTable, ReseatSeat, ReseatPlayer } from '../reseat.types';

function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}
const tbl = (id: string): ReseatTable => ({ id, status: 'open', lockType: 'none' });
const seat = (id: string, tableId: string, tableNo: number, seatNo: number): ReseatSeat => ({
  id,
  tableId,
  tableNo,
  seatNo,
  participantId: null,
});
const player = (id: string, chips: number): ReseatPlayer => ({ id, chips });

// 칩 합 계산 헬퍼: 배정 결과 → 테이블별 칩 합
function tableChipTotals(
  input: ReseatInput,
  assignments: { participantId: string; seatId: string }[]
): number[] {
  const seatToTable = new Map(input.seats.map((s) => [s.id, s.tableId]));
  const chips = new Map(input.players.map((p) => [p.id, p.chips]));
  const totals = new Map<string, number>();
  for (const a of assignments) {
    const t = seatToTable.get(a.seatId)!;
    totals.set(t, (totals.get(t) ?? 0) + (chips.get(a.participantId) ?? 0));
  }
  return [...totals.values()];
}

describe('chipDraft', () => {
  it('스네이크로 테이블 칩 합을 균형있게 분배', () => {
    // 2테이블 각 2석, 4명(칩 4000/3000/2000/1000) → 스네이크: t1[4000,1000]=5000, t2[3000,2000]=5000
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [
        seat('s1', 't1', 1, 1),
        seat('s2', 't1', 1, 2),
        seat('s3', 't2', 2, 1),
        seat('s4', 't2', 2, 2),
      ],
      players: [player('a', 4000), player('b', 3000), player('c', 2000), player('d', 1000)],
      rng: seqRng([0, 0, 0, 0]),
    };
    const res = chipDraft(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.assignments).toHaveLength(4);
      const totals = tableChipTotals(input, res.assignments).sort((x, y) => x - y);
      expect(totals).toEqual([5000, 5000]); // 완전 균형
    }
  });

  it('칩 동점은 id 오름차순 tie-break(결정성)', () => {
    // z(1000)와 a(1000)는 동점: id asc 정렬 시 'a' < 'z' → a가 스네이크 첫 순번(idx=0, t1) 배정
    // rng는 테이블 내 좌석이 1개라 셔플 루프 미실행 → seqRng([0]) 결정적
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't2', 2, 1)],
      players: [player('z', 1000), player('a', 1000)],
      rng: seqRng([0]),
    };
    const res = chipDraft(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // id asc tie-break 결과: 'a'가 첫 테이블(t1)의 s1에 배정돼야 함
      const aAssignment = res.assignments.find((x) => x.participantId === 'a');
      expect(aAssignment?.seatId).toBe('s1');
    }
  });

  it('인원>적격좌석이면 INSUFFICIENT_SEATS', () => {
    const input: ReseatInput = {
      tables: [tbl('t1')],
      seats: [seat('s1', 't1', 1, 1)],
      players: [player('a', 1000), player('b', 500)],
      rng: seqRng([0]),
    };
    expect(chipDraft(input)).toEqual({
      ok: false,
      reason: 'INSUFFICIENT_SEATS',
      available: 1,
      required: 2,
    });
  });

  it('전원 distinct 좌석 배정', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't1', 1, 2), seat('s3', 't2', 2, 1)],
      players: [player('a', 3000), player('b', 2000), player('c', 1000)],
      rng: seqRng([0.4, 0.4, 0.4]),
    };
    const res = chipDraft(input);
    expect(res.ok).toBe(true);
    if (res.ok) expect(new Set(res.assignments.map((a) => a.seatId)).size).toBe(3);
  });
});
