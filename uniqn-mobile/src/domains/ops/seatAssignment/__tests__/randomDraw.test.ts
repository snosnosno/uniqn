import { randomDraw, eligibleSeats } from '../randomDraw';
import type { ReseatInput, ReseatTable, ReseatSeat, ReseatPlayer } from '../reseat.types';

function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}
const tbl = (
  id: string,
  status: ReseatTable['status'] = 'open',
  lockType: ReseatTable['lockType'] = 'none'
): ReseatTable => ({ id, status, lockType });
const seat = (
  id: string,
  tableId: string,
  tableNo: number,
  seatNo: number,
  pid: string | null = null
): ReseatSeat => ({ id, tableId, tableNo, seatNo, participantId: pid });
const player = (id: string): ReseatPlayer => ({ id, chips: 1000 });

describe('eligibleSeats', () => {
  it('open·unlocked 테이블 좌석만 적격', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2', 'closed'), tbl('t3', 'open', 'locked'), tbl('t4', 'standby')],
      seats: [
        seat('s1', 't1', 1, 1),
        seat('s2', 't2', 2, 1),
        seat('s3', 't3', 3, 1),
        seat('s4', 't4', 4, 1),
      ],
      players: [],
      rng: seqRng([0]),
    };
    expect(eligibleSeats(input).map((s) => s.id)).toEqual(['s1']);
  });
});

describe('randomDraw', () => {
  it('전원을 적격 좌석에 배정(좌석≥인원)', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't1', 1, 2), seat('s3', 't2', 2, 1)],
      players: [player('p1'), player('p2')],
      rng: seqRng([0.5, 0.5, 0.5]),
    };
    const res = randomDraw(input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.assignments).toHaveLength(2);
      expect(new Set(res.assignments.map((a) => a.seatId)).size).toBe(2); // 좌석 distinct
      expect(res.assignments.map((a) => a.participantId).sort()).toEqual(['p1', 'p2']);
      // 적격 좌석(s1,s2,s3)에만 배정
      res.assignments.forEach((a) => expect(['s1', 's2', 's3']).toContain(a.seatId));
    }
  });

  it('인원>적격좌석이면 INSUFFICIENT_SEATS', () => {
    const input: ReseatInput = {
      tables: [tbl('t1')],
      seats: [seat('s1', 't1', 1, 1)],
      players: [player('p1'), player('p2')],
      rng: seqRng([0]),
    };
    const res = randomDraw(input);
    expect(res).toEqual({ ok: false, reason: 'INSUFFICIENT_SEATS', available: 1, required: 2 });
  });

  it('잠긴/닫힌 테이블 좌석엔 배정 안 함', () => {
    const input: ReseatInput = {
      tables: [tbl('t1'), tbl('t2', 'open', 'locked')],
      seats: [seat('s1', 't1', 1, 1), seat('s2', 't2', 2, 1)],
      players: [player('p1')],
      rng: seqRng([0]),
    };
    const res = randomDraw(input);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.assignments[0].seatId).toBe('s1');
  });
});
