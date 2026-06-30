import { seatWithinTable, shuffleInPlace } from '../seatWithinTable';
import type { ReseatSeat, ReseatPlayer } from '../reseat.types';

// 결정적 rng: 시드 시퀀스 반환(테스트 재현)
function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

const seat = (id: string, seatNo: number): ReseatSeat => ({
  id,
  tableId: 't1',
  tableNo: 1,
  seatNo,
  participantId: null,
});
const player = (id: string): ReseatPlayer => ({ id, chips: 1000 });

describe('seatWithinTable', () => {
  it('각 플레이어를 좌석에 1:1 배정한다', () => {
    const players = [player('p1'), player('p2'), player('p3')];
    const seats = [seat('s1', 1), seat('s2', 2), seat('s3', 3)];
    const res = seatWithinTable(players, seats, seqRng([0, 0, 0]));
    expect(res).toHaveLength(3);
    const pids = res.map((a) => a.participantId).sort();
    expect(pids).toEqual(['p1', 'p2', 'p3']);
    const sids = res.map((a) => a.seatId).sort();
    expect(sids).toEqual(['s1', 's2', 's3']); // 모든 좌석 distinct 사용
  });

  it('좌석이 더 많으면 앞에서부터 채우고 나머지는 빈다', () => {
    const players = [player('p1')];
    const seats = [seat('s1', 1), seat('s2', 2)];
    const res = seatWithinTable(players, seats, seqRng([0]));
    expect(res).toHaveLength(1);
    expect(res[0].participantId).toBe('p1');
  });

  it('rng 시퀀스가 같으면 결과가 동일하다(결정성)', () => {
    const players = [player('p1'), player('p2')];
    const seats = [seat('s1', 1), seat('s2', 2)];
    const a = seatWithinTable(players, seats, seqRng([0.9, 0.1]));
    const b = seatWithinTable(players, seats, seqRng([0.9, 0.1]));
    expect(a).toEqual(b);
  });
});
