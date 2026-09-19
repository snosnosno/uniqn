/**
 * ops 대회 입력 스키마 (Zod + XSS). enum 은 Constants SSOT 파생.
 * Service 경계에서 safeParse — 모든 사용자 문자열은 xssValidation refine 필수.
 */
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { isOpsEventDate } from '@/domains/ops/opsEventDate';
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

/**
 * 대회 날짜 — 'YYYY-MM-DD' 실재 달력 날짜만. **create/update 가 이 한 상수를 공유한다.**
 *
 * 이전에는 양쪽 모두 `z.string().optional()` 이라 "7/1" 이 저장에 성공했고, '이어서 운영'
 * 카드의 정확 문자열 비교가 영영 실패했다(에러 없는 조용한 실패). 두 자리에 각각 적으면
 * 한쪽만 고쳐 반쪽이 되므로 상수로 묶는다.
 * ⚠️ 빈 문자열은 통과하지 않는다 — "날짜 없음"은 `undefined` 로 보낼 것.
 */
const opsEventDateSchema = z
  .string()
  .trim()
  .refine(isOpsEventDate, { message: '날짜는 YYYY-MM-DD 형식이어야 합니다' })
  .optional();

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
  eventDate: opsEventDateSchema,
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
  eventDate: opsEventDateSchema,
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
