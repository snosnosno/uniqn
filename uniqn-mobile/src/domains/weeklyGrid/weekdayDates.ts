/**
 * weekdayDates — 이번 달 같은 요일 날짜 산출(P1-5 soft-target 요일 반복 적용).
 *
 * 선택한 날짜와 같은 요일이 그 달 안에서 반복되는 모든 날짜를 YYYY-MM-DD 오름차순으로 반환한다.
 * "매주 금요일 목표 5명"처럼 요일 단위 반복 배치를 한 번에 설정할 때 대상 날짜 목록으로 쓴다.
 *
 * 로컬 시간 기준으로 계산한다(getDay·toDateString 모두 로컬) — TZ 드리프트 없음.
 * 날짜 산출은 date-fns addDays 로 새 Date 를 만들어 진행(원본 Date 불변 유지).
 */
import { addDays } from 'date-fns';
import { toDateString } from '@/utils/date';

/**
 * 입력일이 속한 달에서 같은 요일의 모든 날짜(YYYY-MM-DD 오름차순).
 * 달 경계 밖(전달·다음달)은 제외한다. 시각 성분은 무시하고 날짜(요일)만 사용.
 */
export function getSameWeekdayDatesInMonth(date: Date): string[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const weekday = date.getDay();

  // 그 달 1일에서 같은 요일이 처음 등장하는 날(0~6일 이내)로 시작점을 맞춘다.
  const firstOfMonth = new Date(year, month, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;

  const dates: string[] = [];
  let cursor = addDays(firstOfMonth, offset);
  while (cursor.getMonth() === month) {
    dates.push(toDateString(cursor));
    cursor = addDays(cursor, 7); // 새 Date 반환 — 커서 재할당만, 원본 불변.
  }
  return dates;
}
