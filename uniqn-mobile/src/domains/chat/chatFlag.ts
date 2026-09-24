/**
 * chatFlag — 앱 내 채팅 원격 플래그 순수 파서
 *
 * app_config.chat_enabled 의 value 는 `{"enabled": boolean}` 모양이다(버전 게이트 키의
 * `{ios,android,web}` 모양이 아니다). 원격 row 는 신뢰 불가 경계라 방어적으로 파싱하고,
 * null·누락·모양 불일치는 전부 빌드타임 fallback(false)으로 흡수한다 — 서버가 다크인 동안
 * 진입점이 실수로 열리지 않게 하는 fail-closed 장치다. 선례: `src/domains/ops/opsHubFlag.ts`.
 */
import { z } from 'zod';
import { featureFlags } from '@/config/featureFlags';

/** 원격 플래그 value 스키마: 정확히 boolean 인 enabled 필드만 신뢰 */
const flagValueSchema = z.object({
  enabled: z.boolean(),
});

/**
 * 원격 플래그 raw value 를 boolean 으로 정규화.
 *
 * @param raw app_config.value (모양 불명)
 * @param fallback 파싱 실패 시 적용할 값
 */
export function parseChatFlag(raw: unknown, fallback: boolean): boolean {
  const result = flagValueSchema.safeParse(raw);
  if (!result.success) return fallback;
  return result.data.enabled;
}

/** 빌드타임 fallback(`featureFlags.chat_enabled`)을 적용한 최종 판정 */
export function resolveChatEnabled(raw: unknown): boolean {
  return parseChatFlag(raw, featureFlags.chat_enabled);
}
