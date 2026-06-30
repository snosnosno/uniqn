import {
  addTableSchema,
  moveSeatSchema,
  redrawWaitlistFillSchema,
  reseatAssignmentsSchema,
  reseatModeSchema,
} from '@/schemas/opsSeat.schema';

describe('addTableSchema', () => {
  it('유효 입력 통과', () => {
    expect(
      addTableSchema.safeParse({ tournamentId: 'a', seatCount: 9, lockType: 'none' }).success
    ).toBe(true);
  });
  it('seatCount 범위 밖 거부', () => {
    expect(
      addTableSchema.safeParse({ tournamentId: 'a', seatCount: 99, lockType: 'none' }).success
    ).toBe(false);
  });
  it('name XSS 거부', () => {
    expect(
      addTableSchema.safeParse({
        tournamentId: 'a',
        seatCount: 9,
        lockType: 'none',
        name: '<script>x',
      }).success
    ).toBe(false);
  });
});

describe('moveSeatSchema', () => {
  it('동일 좌석 거부', () => {
    expect(moveSeatSchema.safeParse({ fromSeatId: 's1', toSeatId: 's1' }).success).toBe(false);
  });
});

describe('reseat 스키마', () => {
  const a = (pid: string, sid: string) => ({ participantId: pid, seatId: sid });
  it('정상 배정 통과', () => {
    expect(
      reseatAssignmentsSchema.safeParse([
        a('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
      ]).success
    ).toBe(true);
  });
  it('빈 배열 거부', () => {
    expect(reseatAssignmentsSchema.safeParse([]).success).toBe(false);
  });
  it('참가자 중복 거부', () => {
    const p = '11111111-1111-1111-1111-111111111111';
    expect(
      reseatAssignmentsSchema.safeParse([
        a(p, '22222222-2222-2222-2222-222222222222'),
        a(p, '33333333-3333-3333-3333-333333333333'),
      ]).success
    ).toBe(false);
  });
  it('좌석 중복 거부', () => {
    const s = '22222222-2222-2222-2222-222222222222';
    expect(
      reseatAssignmentsSchema.safeParse([
        a('11111111-1111-1111-1111-111111111111', s),
        a('44444444-4444-4444-4444-444444444444', s),
      ]).success
    ).toBe(false);
  });
  it('mode enum', () => {
    expect(reseatModeSchema.safeParse('random_draw').success).toBe(true);
    expect(reseatModeSchema.safeParse('chip_draft').success).toBe(true);
    expect(reseatModeSchema.safeParse('bogus').success).toBe(false);
  });
});

describe('redrawWaitlistFillSchema', () => {
  it('빈 assignments 배열 거부 (min(1))', () => {
    expect(
      redrawWaitlistFillSchema.safeParse({ tournamentId: 't1', assignments: [] }).success
    ).toBe(false);
  });

  it('expected: null 포함 단일 항목 통과', () => {
    expect(
      redrawWaitlistFillSchema.safeParse({
        tournamentId: 't1',
        assignments: [{ seatId: 's1', participantId: 'p1', expected: null }],
      }).success
    ).toBe(true);
  });

  it('expected: uuid 문자열 포함 단일 항목 통과', () => {
    expect(
      redrawWaitlistFillSchema.safeParse({
        tournamentId: 't1',
        assignments: [
          {
            seatId: 's1',
            participantId: 'p1',
            expected: '550e8400-e29b-41d4-a716-446655440000',
          },
        ],
      }).success
    ).toBe(true);
  });
});
