/**
 * 날짜 포맷팅 유틸리티
 *
 * @description 다양한 날짜 표시 형식 변환 함수들
 * @version 1.0.0
 */

import { format, parseISO, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { toDate } from './core';
import { DATE } from '@/constants';

/**
 * 한국식 날짜 포맷 (2025년 1월 28일)
 *
 * @description Firestore Timestamp, Date, string 모두 지원
 */
export function formatDateKorean(date: Date | Timestamp | string | null): string {
  const d = toDate(date);
  if (!d) return '';
  return format(d, 'yyyy년 M월 d일', { locale: ko });
}

/**
 * 짧은 날짜 포맷 (1/28)
 */
export function formatDateShort(date: Date | string | null): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';
  return format(d, 'M/d');
}

/**
 * 요일 포함 날짜 포맷 (1월 28일 (화))
 */
export function formatDateWithDay(date: Date | string | null): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';
  return format(d, 'M월 d일 (E)', { locale: ko });
}

/**
 * 전체 날짜/시간 포맷 (2025.01.28 18:00)
 */
export function formatDateTime(date: Date | Timestamp | string | null): string {
  const d = toDate(date);
  if (!d) return '';
  return format(d, 'yyyy.MM.dd HH:mm');
}

/**
 * 시간만 포맷 (18:00)
 */
export function formatTime(date: Date | Timestamp | string | null): string {
  const d = toDate(date);
  if (!d) return '';
  return format(d, 'HH:mm');
}

/**
 * 상대적 날짜 표시 (오늘, 내일, 어제, N일 전/후)
 */
export function formatRelativeDate(date: Date | string | null): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  const diff = differenceInDays(target, today);

  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  if (diff > 0 && diff <= 7) return `${diff}일 후`;
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)}일 전`;

  return formatDateKorean(d);
}

/**
 * 요일 가져오기 (한글)
 */
export function getWeekdayKo(date: Date | string | null): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';
  return DATE.WEEKDAYS_KO[d.getDay()];
}

/**
 * 기본 날짜 포맷 (2025.01.28)
 */
export function formatDate(date: Date | Timestamp | string | null): string {
  const d = toDate(date);
  if (!d) return '';
  return format(d, 'yyyy.MM.dd');
}

/**
 * 상대적 시간 표시 (방금, N분 전, N시간 전, N일 전)
 *
 * @description 알림, 채팅 등에서 시간을 상대적으로 표시
 */
export function formatRelativeTime(date: Date | Timestamp | string | null): string {
  const d = toDate(date);
  if (!d) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return '방금';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;

  return formatDateKorean(d);
}

/**
 * 짧은 날짜 + 요일 포맷 (1/28(화))
 *
 * @description JobCard 등에서 간략하게 날짜를 표시할 때 사용
 */
export function formatDateShortWithDay(date: Date | string | null): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || isNaN(d.getTime())) return '-';
  return format(d, 'M/d(E)', { locale: ko });
}

/**
 * 전체 한글 날짜 + 요일 (2025년 1월 28일 (화))
 *
 * @description JobDetail 등에서 상세 날짜를 표시할 때 사용
 */
export function formatDateKoreanWithDay(date: Date | string | null): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || isNaN(d.getTime())) return '';
  return format(d, 'yyyy년 M월 d일 (E)', { locale: ko });
}
