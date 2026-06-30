import { z } from 'zod';

/** 상금 구조 입력 — rank>0, amount>=1, rank 중복 금지. */
export const prizeRowSchema = z.object({
  rank: z.number().int().positive(),
  amount: z.number().int().positive(),
});

export const prizeStructureSchema = z
  .array(prizeRowSchema)
  .refine((rows) => new Set(rows.map((r) => r.rank)).size === rows.length, {
    message: '중복된 순위가 있어요.',
  });

export type PrizeStructureInput = z.infer<typeof prizeStructureSchema>;
