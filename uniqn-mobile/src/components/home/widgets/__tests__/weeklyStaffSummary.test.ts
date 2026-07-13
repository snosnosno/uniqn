import {
  aggregateConfirmedByDate,
  buildWeeklySummary,
  getWeekDates,
  DAY_KEYS,
} from '@/components/home/widgets/weeklyStaffSummary';
import type { DayKey } from '@/components/home/widgets/weeklyStaffSummary';
import type { JobPosting } from '@/types/jobPosting';

/**
 * S4 회귀 방어: WeeklyStaffWidget 이 활성 공고 상위 3건만 slice 후 공고별 getConfirmedStaff 를
 * 반복 호출(N+1)하던 구조 → 전역 확정 인원 맵(usePostingFilledCounts) 배치 1회 + date 세그먼트
 * 합산으로 전환. 4번째 이후 공고의 확정 인원이 조용히 누락되던 과소집계를 막는다.
 */

function makePosting(overrides: Partial<JobPosting>): JobPosting {
  return { id: 'jp', totalPositions: 0, ...overrides } as JobPosting;
}

describe('aggregateConfirmedByDate — 전역맵 date 파싱', () => {
  it('빈 맵/undefined 는 빈 맵을 반환한다', () => {
    expect(aggregateConfirmedByDate(undefined).size).toBe(0);
    expect(aggregateConfirmedByDate(new Map()).size).toBe(0);
  });

  it('키 `${postingId}__${date}__${slot}__${role}` 에서 2번째 세그먼트(date)를 파싱한다', () => {
    const global = new Map<string, number>([['jp-1__2026-07-20__14:00__dealer', 3]]);
    const byDate = aggregateConfirmedByDate(global);
    expect(byDate.get('2026-07-20')).toBe(3);
    expect(byDate.size).toBe(1);
  });

  it('같은 날짜의 서로 다른 슬롯·역할·공고를 모두 합산한다', () => {
    const global = new Map<string, number>([
      ['jp-1__2026-07-20__14:00__dealer', 2],
      ['jp-1__2026-07-20__19:00__floor', 1],
      ['jp-2__2026-07-20__14:00__other:VIP', 4], // 다른 공고, 커스텀 역할
      ['jp-1__2026-07-21__14:00__dealer', 5], // 다른 날짜는 분리
    ]);
    const byDate = aggregateConfirmedByDate(global);
    expect(byDate.get('2026-07-20')).toBe(7); // 2 + 1 + 4
    expect(byDate.get('2026-07-21')).toBe(5);
  });

  it('fixed(주간반복) 공고의 date 세그먼트 FIXED_SCHEDULE 는 자체 버킷으로 분리된다', () => {
    const global = new Map<string, number>([
      ['jp-1__FIXED_SCHEDULE__19:00__dealer', 6],
      ['jp-1__2026-07-20__19:00__dealer', 2],
    ]);
    const byDate = aggregateConfirmedByDate(global);
    // 실제 요일 날짜와 매칭되지 않는 리터럴 — dated 공고 집계를 오염시키지 않는다
    expect(byDate.get('FIXED_SCHEDULE')).toBe(6);
    expect(byDate.get('2026-07-20')).toBe(2);
  });

  it('세그먼트가 2개 미만인 비정상 키는 건너뛴다', () => {
    const global = new Map<string, number>([['broken', 9]]);
    expect(aggregateConfirmedByDate(global).size).toBe(0);
  });
});

describe('buildWeeklySummary — top-3 캡 제거 과소집계 회귀', () => {
  it('활성 공고 4건 이상일 때 4번째 공고의 확정 인원도 합산된다', () => {
    const weekDates = {
      월: '2026-07-13',
      화: '2026-07-14',
      수: '2026-07-15',
      목: '2026-07-16',
      금: '2026-07-17',
      토: '2026-07-18',
      일: '2026-07-19',
    } as Record<DayKey, string>;

    // 활성 공고 4건 — 각기 다른 요일에 걸림. 4번째(목)가 이전 slice(0,3)에서 누락되던 대상.
    const postings = [
      makePosting({ id: 'jp-1', workDate: '2026-07-13', totalPositions: 3 }),
      makePosting({ id: 'jp-2', workDate: '2026-07-14', totalPositions: 2 }),
      makePosting({ id: 'jp-3', workDate: '2026-07-15', totalPositions: 4 }),
      makePosting({ id: 'jp-4', workDate: '2026-07-16', totalPositions: 5 }),
    ];

    // 전역맵은 4개 공고 전체를 포함(배치 1회) — jp-4(목)의 확정도 존재
    const global = new Map<string, number>([
      ['jp-1__2026-07-13__14:00__dealer', 1],
      ['jp-2__2026-07-14__14:00__dealer', 2],
      ['jp-3__2026-07-15__14:00__dealer', 3],
      ['jp-4__2026-07-16__14:00__dealer', 4], // ← 과거엔 누락되던 4번째 공고
    ]);

    const summary = buildWeeklySummary(postings, weekDates, aggregateConfirmedByDate(global));

    expect(summary.목).toEqual({ confirmed: 4, capacity: 5 }); // 4번째 공고 확정 반영
    expect(summary.수).toEqual({ confirmed: 3, capacity: 4 });
    expect(summary.화).toEqual({ confirmed: 2, capacity: 2 });
    expect(summary.월).toEqual({ confirmed: 1, capacity: 3 });
  });

  it('capacity 는 해당 날짜에 걸린 공고들의 totalPositions 합이다(workDates 포함)', () => {
    const weekDates = getWeekDates();
    const monday = weekDates.월;
    const postings = [
      makePosting({ id: 'jp-1', workDates: [monday], totalPositions: 3 }),
      makePosting({ id: 'jp-2', workDate: monday, totalPositions: 2 }),
    ];
    const summary = buildWeeklySummary(postings, weekDates, new Map());
    expect(summary.월.capacity).toBe(5);
    expect(summary.월.confirmed).toBe(0);
  });

  it('해당 요일에 공고가 없으면 capacity·confirmed 모두 0', () => {
    const weekDates = getWeekDates();
    const summary = buildWeeklySummary([], weekDates, new Map([['9999-01-01', 5]]));
    DAY_KEYS.forEach((day) => {
      expect(summary[day]).toEqual({ confirmed: 0, capacity: 0 });
    });
  });
});

describe('getWeekDates', () => {
  it('월~일 7개 요일 키를 반환하고 각 날짜는 YYYY-MM-DD 형식이다', () => {
    const dates = getWeekDates();
    expect(Object.keys(dates).sort()).toEqual([...DAY_KEYS].sort());
    DAY_KEYS.forEach((day) => {
      expect(dates[day]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
