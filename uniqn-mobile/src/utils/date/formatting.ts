import { differenceInDays, format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { DATE } from '@/constants';
import { isValidDate, toDate, type DateInput } from './core';

export function formatDateKorean(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return format(parsed, 'yyyy년 M월 d일', { locale: ko });
}

export function formatDateShort(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return format(parsed, 'M/d');
}

export function formatDateWithDay(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return format(parsed, 'M월 d일 (E)', { locale: ko });
}

export function formatDateTime(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return format(parsed, 'yyyy.MM.dd HH:mm');
}

export function formatTime(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return format(parsed, 'HH:mm');
}

export function formatRelativeDate(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  const diff = differenceInDays(target, today);

  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  if (diff > 0 && diff <= 7) return `${diff}일 후`;
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)}일 전`;

  return formatDateKorean(parsed);
}

export function getWeekdayKo(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return DATE.WEEKDAYS_KO[parsed.getDay()];
}

export function formatDate(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return format(parsed, 'yyyy.MM.dd');
}

export function formatRelativeTime(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return '방금';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;

  return formatDateKorean(parsed);
}

export function formatDateShortWithDay(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '-';
  return format(parsed, 'M/d(E)', { locale: ko });
}

export function formatDateKoreanWithDay(date: DateInput): string {
  const parsed = toDate(date);
  if (!parsed) return '';
  return format(parsed, 'yyyy년 M월 d일 (E)', { locale: ko });
}

export function formatAppliedDate(dateStr?: string | null): string {
  if (!dateStr) return '';

  const parsed = toDate(dateStr);
  if (!parsed || !isValidDate(parsed)) {
    return dateStr;
  }

  return format(parsed, 'M/d(E)', { locale: ko });
}
