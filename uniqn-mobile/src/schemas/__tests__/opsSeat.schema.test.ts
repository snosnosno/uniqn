import { addTableSchema, moveSeatSchema, redrawWaitlistFillSchema } from '@/schemas/opsSeat.schema';

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
