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
