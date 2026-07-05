import { z } from 'zod';
import { xssValidation } from '@/utils/security';

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

/**
 * UUID 형식 정규식 refine.
 * Zod v4 `.uuid()`는 RFC 4122 variant 강제라 테스트 픽스처(11111111-…) 거부 —
 * 그룹형 정규식으로 형식만 검사(#220 opsSeat.schema 패턴 재사용).
 */
const uuidLike = z
  .string()
  .refine(
    (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    'UUID 형식이 아니에요.'
  );

/** 1f 상금 정정 입력. amount null = 회수. reason 은 선택 + xssValidation. */
export const prizeCorrectionSchema = z.object({
  participantId: uuidLike,
  amount: z.number().int().min(0).nullable(),
  reason: z
    .string()
    .trim()
    .max(200, '사유는 200자 이내로 입력해 주세요.')
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' })
    .nullable()
    .optional(),
});
export type PrizeCorrectionInput = z.infer<typeof prizeCorrectionSchema>;
