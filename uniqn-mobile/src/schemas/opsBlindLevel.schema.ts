/**
 * ops 블라인드 레벨 입력 스키마 (Zod). 1c.
 * 텍스트 입력 없음 → xss refine 불요(숫자/불리언 검증만).
 * DB CHECK(small_blind>=0 AND big_blind>=0 AND ante>=0 AND duration_sec>0) 와 정합.
 * Service 경계(opsBlindLevelService.setLevels)에서 safeParse.
 */
import { z } from 'zod';

const intMin0 = z.number().int().min(0);

/** 단일 블라인드 레벨 입력(앱 camelCase). Repository 가 snake_case jsonb 로 변환해 RPC 전달. */
export const opsBlindLevelSchema = z.object({
  level: intMin0,
  smallBlind: intMin0,
  bigBlind: intMin0,
  ante: intMin0,
  durationSec: z.number().int().positive({ message: '레벨 시간(초)은 0보다 커야 합니다' }),
  isBreak: z.boolean(),
});
export type OpsBlindLevelInput = z.infer<typeof opsBlindLevelSchema>;

/** 블라인드 레벨 개수 상한(클라 가드). 서버 상한은 없어 UX 폭주 방지용 — 프리셋 저장·전체교체 공용. */
export const OPS_BLIND_LEVELS_MAX = 100;

/** 블라인드 구조 전체(최소 1레벨·최대 100레벨). ops_set_blind_levels 전체교체 입력. */
export const opsBlindLevelsSchema = z
  .array(opsBlindLevelSchema)
  .min(1, { message: '블라인드 레벨을 1개 이상 입력해주세요' })
  .max(OPS_BLIND_LEVELS_MAX, {
    message: `블라인드 레벨은 최대 ${OPS_BLIND_LEVELS_MAX}개까지 입력할 수 있습니다`,
  });
export type OpsBlindLevelsInput = z.infer<typeof opsBlindLevelsSchema>;
