/**
 * 날짜/시간 포맷 — impeccable v2 §19
 *
 * 스펙 요약:
 * - 상대 시간(≤7일): `formatRelative(date)` → "3시간 전" / "2일 전"
 * - 절대 날짜(>7일): `formatShortDate(date)` → "4월 13일"
 * - ISO: `formatISODate(date)` → "2026-04-13"
 * - 시각: `formatTimeOfDay(date)` → "오후 2시 30분"
 *
 * 기존 `src/utils/date/formatting.ts` 의 도메인 특화 함수(formatDateKorean,
 * formatDateWithDay 등)는 그대로 유지 — 본 모듈은 canonical 진입점.
 */

import { differenceInCalendarDays, format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

const RELATIVE_WINDOW_DAYS = 7;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

type DateLike = Date | string | number;

function toDate(value: DateLike): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 7일 이내면 상대 시간, 그 이후는 "M월 D일".
 * 미래 날짜(now 보다 뒤)는 절대 표기로 fallback.
 */
export function formatRelative(value: DateLike, now: Date = new Date()): string {
  const target = toDate(value);
  if (!target) return '';

  const diffMs = now.getTime() - target.getTime();

  // 미래 시각 → 절대 포맷으로 fallback
  if (diffMs < 0) return formatShortDate(target);

  // 7일 경과(캘린더 일 기준) → 절대 포맷
  const diffDays = differenceInCalendarDays(now, target);
  if (diffDays > RELATIVE_WINDOW_DAYS) return formatShortDate(target);

  const minutes = Math.floor(diffMs / MS_PER_MINUTE);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(diffMs / MS_PER_HOUR);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(diffMs / MS_PER_DAY);
  return `${days}일 전`;
}

/** "M월 D일" (짧은 한글, 연도 생략). */
export function formatShortDate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return '';
  return format(d, 'M월 d일', { locale: ko });
}

/** "YYYY-MM-DD" ISO 8601 날짜부. */
export function formatISODate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return '';
  return format(d, 'yyyy-MM-dd');
}

/**
 * "오전/오후 H시 MM분". 자정은 "오전 12시 00분", 정오는 "오후 12시 00분".
 */
export function formatTimeOfDay(value: DateLike): string {
  const d = toDate(value);
  if (!d) return '';
  const hour24 = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, '0');
  const period = hour24 < 12 ? '오전' : '오후';
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${period} ${hour12}시 ${minute}분`;
}
