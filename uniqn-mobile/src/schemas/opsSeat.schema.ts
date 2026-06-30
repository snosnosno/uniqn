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

/** 전원 재배치 모드 enum(랜덤/칩 드래프트). */
export const reseatModeSchema = z.enum(['random_draw', 'chip_draft']);
export type ReseatMode = z.infer<typeof reseatModeSchema>;

/**
 * UUID 형식 정규식 refine.
 * Zod v4 `.uuid()`는 RFC 4122 variant 강제라 테스트 픽스처(11111111-…) 거부 —
 * 그룹형 정규식으로 형식만 검사하되 RFC 4122 variant는 강제하지 않는다.
 * ⚠️ `/^[0-9a-f-]{36}$/i` 는 대시만 36개도 통과시키므로 사용 금지.
 */
const uuidLike = z
  .string()
  .refine(
    (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    'UUID 형식이 아니에요.'
  );

/** 전원 재배치 배정 목록: 참가자·좌석 각 중복 금지, 최소 1건.
 * participantId·seatId 는 UUID 형식 정규식 refine(그룹형, RFC 4122 variant 비강제). */
export const reseatAssignmentsSchema = z
  .array(z.object({ participantId: uuidLike, seatId: uuidLike }))
  .min(1)
  .refine((arr) => new Set(arr.map((x) => x.participantId)).size === arr.length, {
    message: '참가자가 중복됐어요.',
  })
  .refine((arr) => new Set(arr.map((x) => x.seatId)).size === arr.length, {
    message: '좌석이 중복됐어요.',
  });
export type ReseatAssignmentsForm = z.infer<typeof reseatAssignmentsSchema>;

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
