/**
 * ops 대회 입력 스키마 (Zod + XSS). enum 은 Constants SSOT 파생.
 * Service 경계에서 safeParse — 모든 사용자 문자열은 xssValidation refine 필수.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { Constants } from '@/types/supabase';

export const opsTournamentStatusSchema = z.enum(Constants.public.Enums.ops_tournament_status);
export type OpsTournamentStatusSchema = z.infer<typeof opsTournamentStatusSchema>;

const opsTournamentNameSchema = z
  .string({ error: '대회 이름을 입력해주세요' })
  .trim()
  .min(1, { message: '대회 이름을 입력해주세요' })
  .max(100, { message: '대회 이름은 100자를 초과할 수 없습니다' })
  .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' });

const optionalXssText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(xssValidation, { message: '특수문자가 포함될 수 없습니다' })
    .optional();

const intMin0 = z.number().int().min(0);

/** 칩·정산 비용 설정 (prizePool 산정에 사용). */
export const opsCostConfigSchema = z.object({
  buyInChips: intMin0,
  rebuyChips: intMin0,
  addonChips: intMin0,
  buyInCost: intMin0,
  feeCost: intMin0,
  rebuyCost: intMin0,
  addonCost: intMin0,
  // 바운티(선택): null = 비-바운티. 값 검증 계층(비-strict z.object 라 누락해도 게이트는 안 깨짐).
  bountyCost: z.number().int().min(0).nullable(),
});
export type OpsCostConfigData = z.infer<typeof opsCostConfigSchema>;

export const createOpsTournamentSchema = z.object({
  name: opsTournamentNameSchema,
  venue: optionalXssText(100),
  eventDate: z.string().optional(),
  gameType: z.string().trim().min(1).max(20),
  jobPostingId: z.string().uuid().optional(),
  startingChips: intMin0,
  seatsPerTable: z.number().int().min(2).max(11),
  config: opsCostConfigSchema,
});
export type CreateOpsTournamentData = z.infer<typeof createOpsTournamentSchema>;

export const updateOpsTournamentSchema = z.object({
  name: opsTournamentNameSchema.optional(),
  venue: optionalXssText(100),
  eventDate: z.string().optional(),
  gameType: z.string().trim().min(1).max(20).optional(),
  startingChips: intMin0.optional(),
  seatsPerTable: z.number().int().min(2).max(11).optional(),
  color: optionalXssText(20),
  buyInChips: intMin0.optional(),
  rebuyChips: intMin0.optional(),
  addonChips: intMin0.optional(),
  buyInCost: intMin0.optional(),
  feeCost: intMin0.optional(),
  rebuyCost: intMin0.optional(),
  addonCost: intMin0.optional(),
});
export type UpdateOpsTournamentData = z.infer<typeof updateOpsTournamentSchema>;
