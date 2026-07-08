import { prizeCorrectionSchema, prizeStructureSchema } from '@/schemas/opsPrize.schema';

describe('prizeStructureSchema', () => {
  it('정상 통과', () => {
    expect(prizeStructureSchema.safeParse([{ rank: 1, amount: 100 }]).success).toBe(true);
  });

  it('중복 rank 거부', () => {
    expect(
      prizeStructureSchema.safeParse([
        { rank: 1, amount: 100 },
        { rank: 1, amount: 50 },
      ]).success
    ).toBe(false);
  });

  it('amount 0 거부', () => {
    expect(prizeStructureSchema.safeParse([{ rank: 1, amount: 0 }]).success).toBe(false);
  });
});

const VALID_ID = '11111111-1111-1111-1111-111111111111';

describe('prizeCorrectionSchema', () => {
  it('정상: 금액 설정/회수(null)/사유 생략', () => {
    expect(
      prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: 50000 }).success
    ).toBe(true);
    expect(
      prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: null, reason: '실격' })
        .success
    ).toBe(true);
  });
  it('거부: 음수·소수·201자·xss·비-uuid', () => {
    expect(prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: -1 }).success).toBe(
      false
    );
    expect(prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: 1.5 }).success).toBe(
      false
    );
    expect(
      prizeCorrectionSchema.safeParse({
        participantId: VALID_ID,
        amount: 0,
        reason: '가'.repeat(201),
      }).success
    ).toBe(false);
    expect(
      prizeCorrectionSchema.safeParse({ participantId: VALID_ID, amount: 0, reason: '<script>x' })
        .success
    ).toBe(false);
    expect(prizeCorrectionSchema.safeParse({ participantId: 'not-uuid', amount: 0 }).success).toBe(
      false
    );
  });
});
