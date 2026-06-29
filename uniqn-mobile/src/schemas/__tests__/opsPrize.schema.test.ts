import { prizeStructureSchema } from '@/schemas/opsPrize.schema';

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
