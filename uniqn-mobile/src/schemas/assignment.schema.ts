import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: '날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)',
});

export const durationTypeSchema = z.enum(['single', 'consecutive', 'multi'], {
  error: '올바른 기간 타입이 아닙니다',
});

export const durationSchema = z.object({
  type: durationTypeSchema,
  startDate: dateSchema,
  endDate: dateSchema.optional(),
});
