/**
 * weeklyGridFlag — 주간 그리드 원격 플래그 순수 파서
 *
 * app_config.weekly_grid_enabled 의 value 는 `{"enabled": boolean}` 모양이다.
 * 원격 row 는 신뢰 불가 경계(외부 데이터)이므로 방어적으로 파싱한다.
 * null/누락/잘못된 모양/타입 불일치는 전부 빌드타임 fallback 으로 흡수한다.
 */
import { z } from 'zod';

/** 원격 플래그 value 스키마: 정확히 boolean 인 enabled 필드만 신뢰. */
const flagValueSchema = z.object({
  enabled: z.boolean(),
});

/**
 * 원격 플래그 raw value 를 boolean 으로 정규화.
 *
 * @param raw app_config.value (모양 불명, unknown). null/undefined/객체 무엇이든 허용.
 * @param fallback 파싱 실패 시 적용할 빌드타임 기본값.
 * @returns enabled 가 boolean 으로 검증되면 그 값, 아니면 fallback.
 */
export function parseWeeklyGridFlag(raw: unknown, fallback: boolean): boolean {
  const result = flagValueSchema.safeParse(raw);
  if (!result.success) return fallback;
  return result.data.enabled;
}
