/**
 * ops 참가자 입력 스키마 (Zod + XSS). enum 은 Constants SSOT 파생.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { Constants } from '@/types/supabase';

export const opsParticipantStatusSchema = z.enum(Constants.public.Enums.ops_participant_status);
export type OpsParticipantStatusSchema = z.infer<typeof opsParticipantStatusSchema>;

const participantNameSchema = z
  .string({ error: '참가자 이름을 입력해주세요' })
  .trim()
  .min(1, { message: '참가자 이름을 입력해주세요' })
  .max(50, { message: '이름은 50자를 초과할 수 없습니다' })
  .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

const optionalXssText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' })
    .optional();

/** 워크인 등록 입력 (1a). */
export const registerParticipantSchema = z.object({
  tournamentId: z.string().uuid({ message: '올바른 대회 ID 가 아닙니다' }),
  name: participantNameSchema,
  nationality: optionalXssText(40),
  phone: optionalXssText(30),
  buyInAmount: z.number().int().min(0).optional(),
});
export type RegisterParticipantData = z.infer<typeof registerParticipantSchema>;

/**
 * 결함① 칩 카운트 수동 입력. 서버(ops_set_participant_chips) 의 1~20억 범위와 동일 경계.
 * 0 을 막는 이유: 0칩 active 참가자는 live_stats 의 playing/average_stack 을 오염시킨다 —
 * 탈락은 순위·좌석해제·상금을 원자로 처리하는 ops_bust_participant 전용 경로다.
 * 숫자 필드라 xssValidation 대상이 아니다.
 */
export const chipCountSchema = z.object({
  participantId: z.string().uuid({ message: '올바른 참가자 ID 가 아닙니다' }),
  chips: z
    .number({ error: '칩 수량을 입력해주세요' })
    .int({ message: '칩은 정수로 입력해주세요' })
    .min(1, { message: '칩은 1 이상이어야 해요. 칩이 0이면 탈락 처리를 사용해주세요.' })
    .max(2_000_000_000, { message: '칩은 20억을 초과할 수 없습니다' }),
});
export type ChipCountInput = z.infer<typeof chipCountSchema>;

/**
 * 결함②: 노쇼 표시/취소. `noShow` 를 boolean 으로 **필수**로 받는다 —
 * 서버도 NULL 을 접지만, 누락된 채 왕복하면 "성공했는데 아무 일도 없음"이 된다.
 */
export const noShowSchema = z.object({
  participantId: z.string().uuid({ message: '올바른 참가자 ID 가 아닙니다' }),
  noShow: z.boolean({ error: '노쇼 여부를 지정해주세요' }),
});
export type NoShowInput = z.infer<typeof noShowSchema>;

/**
 * 결함③: 참가자 등록 정보 정정.
 * ⚠️ nationality/phone 의 빈 문자열은 **지우기**로 정규화한다(`''` → null) — 서버도 같은 규칙이라
 *    두 계층이 갈라지지 않는다. `undefined` 도 null 과 같게 취급한다(폼이 전체 값을 보내므로
 *    "미전달"과 "지우기"를 구분할 필요가 없고, 구분하려면 센티널이 필요한데 센티널이 함정이 된다).
 * XSS 는 클라·서버 양쪽에서 본다 — ops_participants 에는 트리거 계층이 없어 서버 재판정이 필수다.
 */
export const participantUpdateSchema = z.object({
  participantId: z.string().uuid({ message: '올바른 참가자 ID 가 아닙니다' }),
  name: z
    .string({ error: '이름을 입력해주세요' })
    .trim()
    .min(1, { message: '이름을 입력해주세요' })
    .max(100, { message: '이름은 100자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' }),
  nationality: z
    .string()
    .trim()
    .max(50, { message: '국적은 50자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' })
    .nullish()
    .transform((v) => (v ? v : null)),
  phone: z
    .string()
    .trim()
    .max(30, { message: '연락처는 30자를 초과할 수 없습니다' })
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' })
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type ParticipantUpdateInput = z.input<typeof participantUpdateSchema>;
