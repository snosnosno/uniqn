import { computeWaitlistFill } from '../waitlistFill';

const seat = (
  id: string,
  tableId: string,
  tableNo: number,
  seatNo: number,
  participantId: string | null
) => ({ id, tableId, tableNo, seatNo, participantId });
const table = (
  id: string,
  status: 'open' | 'closed' | 'standby',
  lockType: 'none' | 'locked' | 'feature'
) => ({ id, status, lockType });

describe('computeWaitlistFill', () => {
  it('빈좌석에 미착석 참가자를 배분하고 expected=null', () => {
    const result = computeWaitlistFill({
      tables: [table('t1', 'open', 'none')],
      seats: [seat('s1', 't1', 1, 1, null), seat('s2', 't1', 1, 2, 'p-existing')],
      unseatedParticipantIds: ['p-new'],
    });
    expect(result).toEqual([{ seatId: 's1', participantId: 'p-new', expected: null }]);
  });

  it('locked/standby/closed 테이블 좌석은 제외', () => {
    const result = computeWaitlistFill({
      tables: [
        table('t1', 'open', 'locked'),
        table('t2', 'standby', 'none'),
        table('t3', 'open', 'none'),
      ],
      seats: [
        seat('s1', 't1', 1, 1, null),
        seat('s2', 't2', 2, 1, null),
        seat('s3', 't3', 3, 1, null),
      ],
      unseatedParticipantIds: ['p-new'],
    });
    expect(result).toEqual([{ seatId: 's3', participantId: 'p-new', expected: null }]);
  });

  it('빈좌석보다 참가자가 많으면 좌석 수만큼만 배정', () => {
    const result = computeWaitlistFill({
      tables: [table('t1', 'open', 'none')],
      seats: [seat('s1', 't1', 1, 1, null)],
      unseatedParticipantIds: ['p1', 'p2'],
    });
    expect(result).toHaveLength(1);
  });

  it('테이블 균형 — 인원 적은 테이블 우선', () => {
    const result = computeWaitlistFill({
      tables: [table('t1', 'open', 'none'), table('t2', 'open', 'none')],
      seats: [
        seat('a1', 't1', 1, 1, 'x'),
        seat('a2', 't1', 1, 2, null),
        seat('b1', 't2', 2, 1, null),
        seat('b2', 't2', 2, 2, null),
      ],
      unseatedParticipantIds: ['p1'],
    });
    // t2(0명) 가 t1(1명)보다 비어있으므로 t2 먼저.
    expect(result[0].seatId).toBe('b1');
  });
});
