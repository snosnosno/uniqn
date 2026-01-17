/**
 * UNIQN Mobile - 날짜 유틸리티
 *
 * @description 날짜/시간 처리 유틸리티 함수들
 * @version 1.0.0
 */

import { format, parseISO, isToday, isPast, isFuture, differenceInDays, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { DATE } from '@/constants';

/**
 * Date 또는 Timestamp를 Date로 변환
 */
export const toDate = (value: Date | Timestamp | string | undefined | null): Date | null => {
  if (!value) return null;

  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string') {
    const parsed = parseISO(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

/**
 * ISO 날짜 문자열 생성 (YYYY-MM-DD)
 */
export const toISODateString = (date: Date | null): string | null => {
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
};

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
export const getTodayString = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};

/**
 * 한국식 날짜 포맷 (2025년 1월 28일)
 */
export const formatDateKorean = (date: Date | string | null): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';
  return format(d, 'yyyy년 M월 d일', { locale: ko });
};

/**
 * 짧은 날짜 포맷 (1/28)
 */
export const formatDateShort = (date: Date | string | null): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';
  return format(d, 'M/d');
};

/**
 * 요일 포함 날짜 포맷 (1월 28일 (화))
 */
export const formatDateWithDay = (date: Date | string | null): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';
  return format(d, 'M월 d일 (E)', { locale: ko });
};

/**
 * 전체 날짜/시간 포맷 (2025.01.28 18:00)
 */
export const formatDateTime = (date: Date | Timestamp | string | null): string => {
  const d = toDate(date);
  if (!d) return '';
  return format(d, 'yyyy.MM.dd HH:mm');
};

/**
 * 시간만 포맷 (18:00)
 */
export const formatTime = (date: Date | Timestamp | string | null): string => {
  const d = toDate(date);
  if (!d) return '';
  return format(d, 'HH:mm');
};

/**
 * 상대적 날짜 표시 (오늘, 내일, 어제, N일 전/후)
 */
export const formatRelativeDate = (date: Date | string | null): string => {
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
};

/**
 * 요일 가져오기 (한글)
 */
export const getWeekdayKo = (date: Date | string | null): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d) return '';
  return DATE.WEEKDAYS_KO[d.getDay()];
};

/**
 * 날짜 체크 유틸리티
 */
export const dateChecks = {
  isToday: (date: Date | string | null): boolean => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return d ? isToday(d) : false;
  },

  isPast: (date: Date | string | null): boolean => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return d ? isPast(d) : false;
  },

  isFuture: (date: Date | string | null): boolean => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return d ? isFuture(d) : false;
  },

  isWithinDays: (date: Date | string | null, days: number): boolean => {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!d) return false;

    const today = new Date();
    const futureDate = addDays(today, days);

    return d >= today && d <= futureDate;
  },
};

/**
 * 날짜 범위 생성 (YYYY-MM-DD 배열)
 */
export const getDateRange = (start: Date, end: Date): string[] => {
  const dates: string[] = [];
  let current = new Date(start);

  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }

  return dates;
};

/**
 * 이번 달 시작/끝 날짜
 */
export const getMonthRange = (
  date: Date = new Date()
): {
  start: string;
  end: string;
} => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
};

/**
 * 근무 시간 문자열 파싱 (예: "18:00 - 02:00" 또는 "18:00~02:00")
 */
export const parseTimeSlot = (
  timeSlot: string
): {
  start: string;
  end: string;
} | null => {
  const match = timeSlot.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;

  return {
    start: match[1],
    end: match[2],
  };
};

/**
 * timeSlot 문자열에서 시작/종료 시간을 Date 객체로 추출
 *
 * @param timeSlot "09:00-18:00" 또는 "09:00 - 18:00" 형식
 * @param dateStr 날짜 (YYYY-MM-DD)
 * @returns { startTime: Date | null, endTime: Date | null }
 */
export const parseTimeSlotToDate = (
  timeSlot: string | null | undefined,
  dateStr: string
): { startTime: Date | null; endTime: Date | null } => {
  if (!timeSlot || !dateStr) return { startTime: null, endTime: null };

  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return { startTime: null, endTime: null };

  const startTime = new Date(`${dateStr}T${parsed.start}:00`);
  let endTime = new Date(`${dateStr}T${parsed.end}:00`);

  // 자정을 넘어가는 경우 (예: 18:00-02:00)
  if (endTime < startTime) {
    endTime = addDays(endTime, 1);
  }

  // 유효하지 않은 날짜 체크
  if (isNaN(startTime.getTime())) return { startTime: null, endTime: null };
  if (isNaN(endTime.getTime())) return { startTime, endTime: null };

  return { startTime, endTime };
};

/**
 * 근무 시간 계산 (분 단위)
 */
export const calculateWorkDuration = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // 자정을 넘어가는 경우
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
};

/**
 * 분을 시간:분 형식으로 변환
 */
export const minutesToHoursMinutes = (
  minutes: number
): {
  hours: number;
  minutes: number;
  display: string;
} => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return {
    hours,
    minutes: mins,
    display: mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`,
  };
};

/**
 * 기본 날짜 포맷 (2025.01.28)
 */
export const formatDate = (date: Date | Timestamp | string | null): string => {
  const d = toDate(date);
  if (!d) return '';
  return format(d, 'yyyy.MM.dd');
};

/**
 * 상대적 시간 표시 (방금, N분 전, N시간 전, N일 전)
 *
 * @description 알림, 채팅 등에서 시간을 상대적으로 표시
 */
export const formatRelativeTime = (date: Date | Timestamp | string | null): string => {
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
};

/**
 * 짧은 날짜 + 요일 포맷 (1/28(화))
 *
 * @description JobCard 등에서 간략하게 날짜를 표시할 때 사용
 */
export const formatDateShortWithDay = (date: Date | string | null): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || isNaN(d.getTime())) return '-';
  return format(d, 'M/d(E)', { locale: ko });
};

/**
 * 전체 한글 날짜 + 요일 (2025년 1월 28일 (화))
 *
 * @description JobDetail 등에서 상세 날짜를 표시할 때 사용
 */
export const formatDateKoreanWithDay = (date: Date | string | null): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!d || isNaN(d.getTime())) return '';
  return format(d, 'yyyy년 M월 d일 (E)', { locale: ko });
};
