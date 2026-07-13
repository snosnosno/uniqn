/**
 * WeeklyStaffWidget 집계 로직 (순수 함수 — 테스트 대상)
 *
 * 데이터 소스: 전역 확정 인원 맵 `${postingId}__${date}__${slot}__${role}`
 * (usePostingFilledCounts → get_posting_filled_counts RPC, work_logs.date 기준).
 * 요일별 확정 인원은 이 전역맵의 date 세그먼트로 합산하고,
 * capacity(정원)는 활성 공고의 totalPositions 합으로 계산한다.
 */
import { toDateString } from '@/utils/date';
import type { JobPosting } from '@/types/jobPosting';

export type DayKey = '월' | '화' | '수' | '목' | '금' | '토' | '일';

interface DaySlot {
  confirmed: number;
  capacity: number;
}

export type WeeklySummary = Record<DayKey, DaySlot>;

export const DAY_KEYS: DayKey[] = ['월', '화', '수', '목', '금', '토', '일'];

const EMPTY_WEEK_SUMMARY: WeeklySummary = DAY_KEYS.reduce(
  (acc, day) => ({ ...acc, [day]: { confirmed: 0, capacity: 0 } }),
  {} as WeeklySummary
);

/** 이번 주(월~일)의 요일별 날짜 문자열(YYYY-MM-DD). */
export function getWeekDates(): Record<DayKey, string> {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  return DAY_KEYS.reduce(
    (acc, day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { ...acc, [day]: toDateString(d) };
    },
    {} as Record<DayKey, string>
  );
}

/**
 * 전역 확정 인원 맵에서 날짜별 확정 인원 합계를 만든다.
 *
 * 키 `${postingId}__${date}__${slot}__${role}` 을 `__` 로 분해해 date(2번째 세그먼트)를
 * 추출, 슬롯·역할·공고를 가로질러 같은 날짜의 confirmed 를 모두 합산한다.
 * postingId(UUID)·date(YYYY-MM-DD)에는 `__` 가 없어 2번째 세그먼트가 항상 date 다.
 *
 * ⚠️ fixed(주간반복) 공고는 date 세그먼트가 'FIXED_SCHEDULE' 리터럴이라(work_logs.date)
 * 실제 요일 날짜와 매칭되지 않는다 → 주간 위젯에서는 특정 요일에 귀속되지 않는다.
 * 이는 capacity 계산(workDate/workDates 매칭, dated 공고 기준)과 동일한 경계로 의도된 동작.
 */
export function aggregateConfirmedByDate(
  all: Map<string, number> | undefined
): Map<string, number> {
  const byDate = new Map<string, number>();
  if (!all || all.size === 0) return byDate;

  for (const [key, count] of all) {
    const parts = key.split('__');
    if (parts.length < 2) continue;
    const date = parts[1];
    if (!date) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + count);
  }

  return byDate;
}

/**
 * 요일별 { confirmed, capacity } 요약 생성.
 * - capacity: 해당 날짜에 걸린 활성 공고의 totalPositions 합.
 * - confirmed: 전역맵에서 집계한 날짜별 확정 인원(공고 전체 합산 — top-N 캡 없음).
 */
export function buildWeeklySummary(
  postings: JobPosting[],
  weekDates: Record<DayKey, string>,
  confirmedByDate: Map<string, number>
): WeeklySummary {
  const summary: WeeklySummary = { ...EMPTY_WEEK_SUMMARY };

  DAY_KEYS.forEach((day) => {
    const date = weekDates[day];
    let totalCapacity = 0;

    postings.forEach((posting) => {
      const isOnDate = posting.workDate === date || (posting.workDates ?? []).includes(date);
      if (!isOnDate) return;
      totalCapacity += posting.totalPositions ?? 0;
    });

    // ⚠️ confirmed(분자)는 전역맵 date 세그먼트 합산, capacity(분모)는 workDate/workDates 매칭
    // 공고의 totalPositions 합 — 스코프가 달라 work_logs 날짜가 공고 일정과 어긋나면 "4/3" 같은
    // 초과 표기가 가능하다. 서버가 일정을 강제하므로 정상 데이터에선 발생하지 않으며,
    // 발생 시 데이터 드리프트 신호로 그대로 노출한다(숨기지 않음).
    summary[day] = { confirmed: confirmedByDate.get(date) ?? 0, capacity: totalCapacity };
  });

  return summary;
}
