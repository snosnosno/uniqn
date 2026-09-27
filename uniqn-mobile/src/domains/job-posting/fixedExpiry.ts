/**
 * 고정 공고 게시 기간(7일) — 연장·재오픈·만료 임박 판정의 단일 규칙.
 *
 * 🔑 만료는 서버 크론 `expire-fixed-postings`(매시 11분)가 `fixed_config.expiresAt` 을 보고 닫는다.
 *    그래서 **다시 여는 쪽은 반드시 expiresAt 을 새로 잡아야 한다.** 상태만 active 로 돌리면
 *    만료 시각은 과거 그대로라 1시간 안에 다시 닫힌다(2026-09-27 발견한 재오픈 결함).
 *
 * 연장은 "지금부터 7일"이다 — 남은 기간을 쌓지 않는다. 방치 공고를 막으려는 7일 만료의 취지상
 * 한 번 누를 때마다 딱 한 주씩만 살아 있게 한다.
 */

import { toDate } from '@/utils/date';
import { FIXED_POSTING_DURATION_DAYS } from './serialization';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

/** 이 시간 안에 만료되면 '임박' — 서버 D-1 알림 창(fn_notify_fixed_postings_expiring)과 같은 값 */
export const FIXED_EXPIRY_SOON_HOURS = 24;

/** DB `fixed_config` jsonb 형태 — 날짜는 ISO 문자열로 저장된다 */
export interface StoredFixedConfig {
  durationDays: typeof FIXED_POSTING_DURATION_DAYS;
  createdAt: string;
  expiresAt: string;
}

interface FixedConfigLike {
  durationDays?: unknown;
  createdAt?: unknown;
  expiresAt?: unknown;
}

/** 연장·재오픈 후 저장할 fixed_config — 생성 시각은 보존하고 만료만 지금부터 7일 뒤로 */
export function buildExtendedFixedConfig(
  current: FixedConfigLike | null | undefined,
  now: Date = new Date()
): StoredFixedConfig {
  const createdAt = toDate(current?.createdAt) ?? now;

  return {
    ...(current ?? {}),
    durationDays: FIXED_POSTING_DURATION_DAYS,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(now.getTime() + FIXED_POSTING_DURATION_DAYS * DAY_IN_MS).toISOString(),
  } as StoredFixedConfig;
}

export interface FixedExpiryInfo {
  expiresAt: Date;
  isExpired: boolean;
  /** 만료 전이고 FIXED_EXPIRY_SOON_HOURS 안 */
  isSoon: boolean;
  /** 남은 일수(올림). 지났으면 0 */
  remainingDays: number;
}

export function describeFixedExpiry(
  expiresAtRaw: unknown,
  now: Date = new Date()
): FixedExpiryInfo | null {
  const expiresAt = toDate(expiresAtRaw);
  if (!expiresAt) return null;

  const remainingMs = expiresAt.getTime() - now.getTime();
  const isExpired = remainingMs <= 0;

  return {
    expiresAt,
    isExpired,
    isSoon: !isExpired && remainingMs <= FIXED_EXPIRY_SOON_HOURS * HOUR_IN_MS,
    remainingDays: isExpired ? 0 : Math.ceil(remainingMs / DAY_IN_MS),
  };
}
