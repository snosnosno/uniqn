import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

/** 근태 시각 표기 — 모바일 StaffAttendanceSheet formatTs 와 같다('M월 d일 HH:mm', 없으면 '기록 없음'). */
export function formatTs(ts: string | null): string {
  if (!ts) return '기록 없음';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '기록 없음' : format(d, 'M월 d일 HH:mm', { locale: ko });
}
