/**
 * 고정 공고 게시 기간(7일) — 만료 임박 판정의 단일 규칙(표시용).
 *
 * 🔑 만료는 서버가 `fixed_config.expiresAt` 을 서버 now() 로 판정한다 — BEFORE UPDATE 트리거
 *    `tr_fixed_posting_expired`(같은 UPDATE 에서 즉시)와 크론 `expire-fixed-postings`(매시 11분).
 *    그래서 연장·재오픈의 새 만료 시각은 **앱이 계산하지 않고** RPC `renew_fixed_posting` 이
 *    서버 시각으로 잡는다(마이그 20260927110000). 기기 시계가 느린 폰에서 앱이 계산하면 새 만료가
 *    이미 과거라 트리거가 그 자리에서 공고를 닫는다.
 *
 * 연장은 "지금부터 7일"이다 — 남은 기간을 쌓지 않는다(방치 공고 방지라는 7일 만료의 취지).
 */

import { toDate } from '@/utils/date';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

/** 이 시간 안에 만료되면 '임박' — 서버 알림 창(fn_notify_fixed_postings_expiring)과 같은 값 */
export const FIXED_EXPIRY_SOON_HOURS = 24;

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
