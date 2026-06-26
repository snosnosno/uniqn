/**
 * ops 좌석/테이블 입력 스키마 (Zod + XSS).
 * Service 경계에서 safeParse — 모든 사용자 문자열은 xssValidation refine 필수.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { Constants } from '@/types/supabase';

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(xssValidation, { message: '허용되지 않는 문자가 포함되어 있습니다' })
    .refine((v) => !/</.test(v), { message: '허용되지 않는 문자가 포함되어 있습니다' });

export const addTableSchema = z.object({
  tournamentId: z.string().min(1),
  seatCount: z.number().int().min(1).max(11),
  name: safeText(50).optional(),
  lockType: z.enum(Constants.public.Enums.ops_table_lock_type),
  priority: z.number().int().optional(),
});
export type AddTableForm = z.infer<typeof addTableSchema>;

export const moveSeatSchema = z
  .object({ fromSeatId: z.string().min(1), toSeatId: z.string().min(1) })
  .refine((v) => v.fromSeatId !== v.toSeatId, { message: '같은 좌석으로 이동할 수 없습니다' });
export type MoveSeatForm = z.infer<typeof moveSeatSchema>;

export const redrawWaitlistFillSchema = z.object({
  tournamentId: z.string().min(1),
  assignments: z
    .array(
      z.object({
        seatId: z.string().min(1),
        participantId: z.string().min(1),
        expected: z.string().nullable(),
      })
    )
    .min(1),
});
export type RedrawWaitlistFillForm = z.infer<typeof redrawWaitlistFillSchema>;
