/**
 * UNIQN Mobile - scheduleGrouping.ts 테스트
 *
 * @description 스케줄 그룹핑 유틸리티 함수들의 단위 테스트
 */

import type { ScheduleEvent, GroupedScheduleEvent } from '@/types';

import {
  isConsecutiveDates,
  formatSingleDate,
  formatDateDisplay,
  formatRolesDisplay,
  groupScheduleEvents,
  filterSchedulesByDate,
  filterSchedulesByStatus,
  countSchedulesByType,
  countUnpaidSchedules,
  isUnpaidCompleted,
  splitSchedulesByToday,
  pickGroupFocusDate,
  resolveSelectedDateForMonth,
} from '../scheduleGrouping';

// ============================================================================
// Test Helpers
// ============================================================================

function createScheduleEvent(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'evt-1',
    type: 'confirmed',
    date: '2025-01-15',
    startTime: null,
    endTime: null,
    jobPostingId: 'job-1',
    jobPostingName: '테스트 공고',
    location: '서울 강남',
    role: 'dealer',
    status: 'not_started',
    sourceCollection: 'workLogs',
    sourceId: 'src-1',
    ...overrides,
  };
}

function createGroupedScheduleEvent(
  overrides: Partial<GroupedScheduleEvent> = {}
): GroupedScheduleEvent {
  return {
    id: 'grouped_app-1',
    type: 'confirmed',
    jobPostingId: 'job-1',
    jobPostingName: '테스트 공고',
    location: '서울 강남',
    dateRange: {
      start: '2025-01-15',
      end: '2025-01-17',
      dates: ['2025-01-15', '2025-01-16', '2025-01-17'],
      totalDays: 3,
      isConsecutive: true,
    },
    roles: ['dealer'],
    timeSlot: '',
    dateStatuses: [
      {
        date: '2025-01-15',
        formattedDate: '1/15(수)',
        status: 'not_started',
        scheduleEventId: 'evt-1',
      },
      {
        date: '2025-01-16',
        formattedDate: '1/16(목)',
        status: 'not_started',
        scheduleEventId: 'evt-2',
      },
      {
        date: '2025-01-17',
        formattedDate: '1/17(금)',
        status: 'not_started',
        scheduleEventId: 'evt-3',
      },
    ],
    originalEvents: [],
    ...overrides,
  };
}

// ============================================================================
// isConsecutiveDates
// ============================================================================

describe('isConsecutiveDates', () => {
  it('빈 배열은 true를 반환한다', () => {
    expect(isConsecutiveDates([])).toBe(true);
  });

  it('단일 날짜는 true를 반환한다', () => {
    expect(isConsecutiveDates(['2025-01-15'])).toBe(true);
  });

  it('연속된 날짜를 정확히 감지한다', () => {
    expect(isConsecutiveDates(['2025-01-15', '2025-01-16', '2025-01-17'])).toBe(true);
  });

  it('비연속 날짜를 정확히 감지한다', () => {
    expect(isConsecutiveDates(['2025-01-15', '2025-01-17'])).toBe(false);
  });

  it('정렬되지 않은 연속 날짜도 올바르게 감지한다', () => {
    expect(isConsecutiveDates(['2025-01-17', '2025-01-15', '2025-01-16'])).toBe(true);
  });

  it('월을 넘어가는 연속 날짜를 감지한다', () => {
    expect(isConsecutiveDates(['2025-01-31', '2025-02-01'])).toBe(true);
  });

  it('연도를 넘어가는 연속 날짜를 감지한다', () => {
    expect(isConsecutiveDates(['2024-12-31', '2025-01-01'])).toBe(true);
  });

  it('이틀 간격 날짜는 false를 반환한다', () => {
    expect(isConsecutiveDates(['2025-01-15', '2025-01-16', '2025-01-18'])).toBe(false);
  });
});

// ============================================================================
// formatSingleDate
// ============================================================================

describe('formatSingleDate', () => {
  it('날짜를 M/D(요일) 형식으로 포맷한다', () => {
    // 2025-01-15 is Wednesday
    expect(formatSingleDate('2025-01-15')).toBe('1/15(수)');
  });

  it('월초 날짜를 올바르게 포맷한다', () => {
    // 2025-02-01 is Saturday
    expect(formatSingleDate('2025-02-01')).toBe('2/1(토)');
  });

  it('12월 31일 날짜를 올바르게 포맷한다', () => {
    // 2025-12-31 is Wednesday
    expect(formatSingleDate('2025-12-31')).toBe('12/31(수)');
  });

  it('일요일 날짜를 올바르게 포맷한다', () => {
    // 2025-01-19 is Sunday
    expect(formatSingleDate('2025-01-19')).toBe('1/19(일)');
  });
});

// ============================================================================
// formatDateDisplay
// ============================================================================

describe('formatDateDisplay', () => {
  it('빈 배열은 빈 문자열을 반환한다', () => {
    expect(formatDateDisplay([])).toBe('');
  });

  it('단일 날짜는 formatSingleDate와 동일한 결과를 반환한다', () => {
    expect(formatDateDisplay(['2025-01-15'])).toBe('1/15(수)');
  });

  it('같은 달 연속 날짜를 올바르게 포맷한다', () => {
    const result = formatDateDisplay(['2025-01-15', '2025-01-16', '2025-01-17']);
    expect(result).toBe('1월 15일(수) ~ 17일(금) (3일)');
  });

  it('다른 달 연속 날짜를 올바르게 포맷한다', () => {
    const result = formatDateDisplay(['2025-01-31', '2025-02-01']);
    expect(result).toBe('1/31(금) ~ 2/1(토) (2일)');
  });

  it('비연속 날짜를 쉼표로 구분한다 (3개 이하)', () => {
    const result = formatDateDisplay(['2025-01-15', '2025-01-17']);
    expect(result).toBe('1/15, 1/17 (2일)');
  });

  it('비연속 날짜 3개를 쉼표로 구분한다', () => {
    const result = formatDateDisplay(['2025-01-15', '2025-01-17', '2025-01-20']);
    expect(result).toBe('1/15, 1/17, 1/20 (3일)');
  });

  it('비연속 날짜 4개 이상은 축약하여 표시한다', () => {
    const result = formatDateDisplay(['2025-01-15', '2025-01-17', '2025-01-20', '2025-01-25']);
    expect(result).toBe('1/15, 1/17 ... 1/25 (4일)');
  });

  it('정렬되지 않은 날짜를 자동 정렬한다', () => {
    const result = formatDateDisplay(['2025-01-17', '2025-01-15', '2025-01-16']);
    expect(result).toBe('1월 15일(수) ~ 17일(금) (3일)');
  });
});

// ============================================================================
// formatRolesDisplay
// ============================================================================

describe('formatRolesDisplay', () => {
  it('빈 배열은 빈 문자열을 반환한다', () => {
    expect(formatRolesDisplay([])).toBe('');
  });

  it('단일 역할을 표시명으로 변환한다', () => {
    const result = formatRolesDisplay(['dealer']);
    expect(result).toBe('딜러');
  });

  it('여러 역할을 쉼표로 구분한다', () => {
    const result = formatRolesDisplay(['dealer', 'floor']);
    expect(result).toBe('딜러, 플로어');
  });

  it('중복 역할을 제거한다', () => {
    const result = formatRolesDisplay(['dealer', 'dealer']);
    expect(result).toBe('딜러');
  });

  it('other 역할에 customRole을 적용한다', () => {
    const result = formatRolesDisplay(['other'], ['조명담당']);
    expect(result).toBe('조명담당');
  });

  it('혼합된 역할 + customRole을 올바르게 포맷한다', () => {
    const result = formatRolesDisplay(['dealer', 'other'], [undefined, '조명담당']);
    expect(result).toBe('딜러, 조명담당');
  });
});

// ============================================================================
// groupScheduleEvents
// ============================================================================

describe('groupScheduleEvents', () => {
  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(groupScheduleEvents([])).toEqual([]);
  });

  it('그룹핑 비활성화 시 원본 배열을 반환한다', () => {
    const events = [createScheduleEvent()];
    const result = groupScheduleEvents(events, { enabled: false });
    expect(result).toEqual(events);
  });

  it('applicationId가 없는 이벤트는 그룹화하지 않는다', () => {
    const events = [
      createScheduleEvent({ id: 'evt-1' }),
      createScheduleEvent({ id: 'evt-2', date: '2025-01-16' }),
    ];
    const result = groupScheduleEvents(events);
    expect(result).toHaveLength(2);
    // 모두 일반 ScheduleEvent (dateRange 없음)
    result.forEach((item) => {
      expect('dateRange' in item).toBe(false);
    });
  });

  it('같은 applicationId의 이벤트들을 그룹화한다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
    ];
    const result = groupScheduleEvents(events);
    expect(result).toHaveLength(1);
    expect('dateRange' in result[0]).toBe(true);

    const grouped = result[0] as GroupedScheduleEvent;
    expect(grouped.dateRange.dates).toEqual(['2025-01-15', '2025-01-16']);
    expect(grouped.dateRange.totalDays).toBe(2);
  });

  it('minGroupSize 미달 시 원본 이벤트를 유지한다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
      }),
    ];
    const result = groupScheduleEvents(events, { minGroupSize: 2 });
    expect(result).toHaveLength(1);
    expect('dateRange' in result[0]).toBe(false);
  });

  it('minGroupSize를 충족하면 그룹화한다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-3',
        date: '2025-01-17',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
    ];
    const result = groupScheduleEvents(events, { minGroupSize: 3 });
    expect(result).toHaveLength(1);
    expect('dateRange' in result[0]).toBe(true);
  });

  it('다른 applicationId는 별도 그룹으로 분리한다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-3',
        date: '2025-01-15',
        applicationId: 'app-2',
        jobPostingId: 'job-2',
        type: 'applied',
        timeSlot: '10:00~18:00',
      }),
      createScheduleEvent({
        id: 'evt-4',
        date: '2025-01-16',
        applicationId: 'app-2',
        jobPostingId: 'job-2',
        type: 'applied',
        timeSlot: '10:00~18:00',
      }),
    ];
    const result = groupScheduleEvents(events);
    expect(result).toHaveLength(2);
    expect(result.every((item) => 'dateRange' in item)).toBe(true);
  });

  it('결과가 최신 날짜순으로 정렬된다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-10',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-11',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-3',
        date: '2025-01-20',
        applicationId: 'app-2',
        jobPostingId: 'job-2',
        type: 'applied',
        timeSlot: '10:00~18:00',
      }),
      createScheduleEvent({
        id: 'evt-4',
        date: '2025-01-21',
        applicationId: 'app-2',
        jobPostingId: 'job-2',
        type: 'applied',
        timeSlot: '10:00~18:00',
      }),
    ];
    const result = groupScheduleEvents(events);
    expect(result).toHaveLength(2);

    // 최신 날짜가 먼저
    const first = result[0] as GroupedScheduleEvent;
    const second = result[1] as GroupedScheduleEvent;
    expect(first.dateRange.start).toBe('2025-01-20');
    expect(second.dateRange.start).toBe('2025-01-10');
  });

  it('timeSlot 구분자 차이("~" vs " - ")로 인한 그룹 분리가 없어야 한다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00 - 02:00',
      }),
    ];
    const result = groupScheduleEvents(events);
    expect(result).toHaveLength(1);
    expect('dateRange' in result[0]).toBe(true);
  });

  it('그룹화된 이벤트의 dateStatuses에 날짜별 상태가 포함된다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
        status: 'checked_in',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
        status: 'not_started',
      }),
    ];
    const result = groupScheduleEvents(events);
    const grouped = result[0] as GroupedScheduleEvent;

    expect(grouped.dateStatuses).toHaveLength(2);
    expect(grouped.dateStatuses[0].date).toBe('2025-01-15');
    expect(grouped.dateStatuses[0].status).toBe('checked_in');
    expect(grouped.dateStatuses[1].date).toBe('2025-01-16');
    expect(grouped.dateStatuses[1].status).toBe('not_started');
  });

  it('그룹화된 이벤트의 roles에 중복 없이 역할이 포함된다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
        role: 'dealer',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
        role: 'dealer',
      }),
    ];
    const result = groupScheduleEvents(events);
    const grouped = result[0] as GroupedScheduleEvent;
    expect(grouped.roles).toEqual(['dealer']);
  });

  it('그룹화된 이벤트에 originalEvents가 포함된다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
      }),
    ];
    const result = groupScheduleEvents(events);
    const grouped = result[0] as GroupedScheduleEvent;
    expect(grouped.originalEvents).toHaveLength(2);
  });

  it('다중 역할 이벤트의 customRoles가 올바르게 매핑된다', () => {
    const events = [
      createScheduleEvent({
        id: 'evt-1',
        date: '2025-01-15',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
        role: 'other',
        customRole: '조명담당',
      }),
      createScheduleEvent({
        id: 'evt-2',
        date: '2025-01-16',
        applicationId: 'app-1',
        jobPostingId: 'job-1',
        type: 'confirmed',
        timeSlot: '19:00~02:00',
        role: 'other',
        customRole: '조명담당',
      }),
    ];
    const result = groupScheduleEvents(events);
    const grouped = result[0] as GroupedScheduleEvent;
    expect(grouped.roles).toEqual(['other']);
    expect(grouped.customRoles).toEqual(['조명담당']);
  });
});

// ============================================================================
// filterSchedulesByDate
// ============================================================================

describe('filterSchedulesByDate', () => {
  it('빈 배열에서 빈 배열을 반환한다', () => {
    expect(filterSchedulesByDate([], '2025-01-15')).toEqual([]);
  });

  it('일반 ScheduleEvent를 날짜로 필터링한다', () => {
    const events = [
      createScheduleEvent({ date: '2025-01-15' }),
      createScheduleEvent({ id: 'evt-2', date: '2025-01-16' }),
    ];
    const result = filterSchedulesByDate(events, '2025-01-15');
    expect(result).toHaveLength(1);
    expect((result[0] as ScheduleEvent).date).toBe('2025-01-15');
  });

  it('GroupedScheduleEvent를 날짜 범위로 필터링한다', () => {
    const grouped = createGroupedScheduleEvent();
    const result = filterSchedulesByDate([grouped], '2025-01-16');
    expect(result).toHaveLength(1);
  });

  it('GroupedScheduleEvent가 해당 날짜를 포함하지 않으면 필터링된다', () => {
    const grouped = createGroupedScheduleEvent();
    const result = filterSchedulesByDate([grouped], '2025-01-20');
    expect(result).toHaveLength(0);
  });

  it('혼합된 이벤트를 올바르게 필터링한다', () => {
    const singleEvent = createScheduleEvent({ date: '2025-01-15' });
    const grouped = createGroupedScheduleEvent(); // 15, 16, 17
    const result = filterSchedulesByDate([singleEvent, grouped], '2025-01-15');
    expect(result).toHaveLength(2);
  });
});

describe('scheduleGrouping invalid date fallbacks', () => {
  it('returns false when consecutive-date input includes invalid values', () => {
    expect(isConsecutiveDates(['2025-01-15', 'invalid-date'])).toBe(false);
  });

  it('returns the raw value for invalid single-date formatting', () => {
    expect(formatSingleDate('invalid-date')).toBe('invalid-date');
  });

  it('returns the raw value for invalid single-date displays', () => {
    expect(formatDateDisplay(['invalid-date'])).toBe('invalid-date');
  });
});

describe('scheduleGrouping undated handling', () => {
  it('formats empty dates as 날짜 미정', () => {
    expect(formatSingleDate('')).toBe('날짜 미정');
  });

  it('formats mixed dated and undated arrays without broken commas', () => {
    expect(formatDateDisplay(['2025-01-15', ''])).toBe('1/15, 날짜 미정 (2일)');
  });

  it('formats all-undated arrays as 날짜 미정 with count', () => {
    expect(formatDateDisplay(['', ''])).toBe('날짜 미정 (2일)');
  });
});

describe('filterSchedulesByStatus', () => {
  const mixed = [
    createScheduleEvent({ id: 'a-1', type: 'applied' }),
    createScheduleEvent({ id: 'c-1', type: 'confirmed' }),
    createGroupedScheduleEvent({ id: 'grouped_app-2', type: 'applied' }),
    createScheduleEvent({ id: 'x-1', type: 'cancelled' }),
  ];

  it("'all'이면 원본 배열을 그대로 반환한다(취소 포함)", () => {
    expect(filterSchedulesByStatus(mixed, 'all')).toBe(mixed);
  });

  it('단일/그룹 이벤트를 가리지 않고 type 일치 항목만 반환한다', () => {
    const applied = filterSchedulesByStatus(mixed, 'applied');
    expect(applied.map((s) => s.id)).toEqual(['a-1', 'grouped_app-2']);
  });

  it('일치 항목이 없으면 빈 배열을 반환한다', () => {
    expect(filterSchedulesByStatus(mixed, 'completed')).toEqual([]);
  });
});

describe('countSchedulesByType', () => {
  it('그룹 1건을 1건으로 집계한다(그룹 내 날짜 수 아님)', () => {
    const counts = countSchedulesByType([
      createScheduleEvent({ id: 'a-1', type: 'applied' }),
      createGroupedScheduleEvent({ id: 'grouped_app-2', type: 'applied' }),
      createScheduleEvent({ id: 'c-1', type: 'confirmed' }),
    ]);

    expect(counts).toEqual({ applied: 2, confirmed: 1, completed: 0, cancelled: 0 });
  });

  it('빈 배열이면 전 타입 0으로 집계한다', () => {
    expect(countSchedulesByType([])).toEqual({
      applied: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    });
  });
});

// ============================================================================
// 시간 축 정렬
// ============================================================================

describe('splitSchedulesByToday', () => {
  const TODAY = '2026-07-27';

  it('오늘 이후는 가까운 순, 지난 근무는 최근 순으로 가른다', () => {
    const schedules = [
      createScheduleEvent({ id: 'a', date: '2026-07-31' }),
      createScheduleEvent({ id: 'b', date: '2026-07-20' }),
      createScheduleEvent({ id: 'c', date: '2026-07-28' }),
      createScheduleEvent({ id: 'd', date: '2026-07-25' }),
    ];

    const { upcoming, past } = splitSchedulesByToday(schedules, TODAY);

    expect(upcoming.map((s) => s.id)).toEqual(['c', 'a']);
    expect(past.map((s) => s.id)).toEqual(['d', 'b']);
  });

  it('오늘 근무는 다가오는 쪽에 넣는다', () => {
    const { upcoming, past } = splitSchedulesByToday(
      [createScheduleEvent({ id: 'today', date: TODAY })],
      TODAY
    );

    expect(upcoming.map((s) => s.id)).toEqual(['today']);
    expect(past).toHaveLength(0);
  });

  it('진행 중인 다중일 그룹은 시작일이 지났어도 다가오는 쪽에 둔다', () => {
    const group = {
      id: 'g1',
      type: 'confirmed',
      dateRange: {
        start: '2026-07-25',
        end: '2026-07-29',
        dates: ['2026-07-25', '2026-07-27', '2026-07-29'],
        totalDays: 3,
      },
    } as unknown as GroupedScheduleEvent;

    const { upcoming, past } = splitSchedulesByToday([group], TODAY);

    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  it('빈 목록은 양쪽 다 비어있다', () => {
    expect(splitSchedulesByToday([], TODAY)).toEqual({ upcoming: [], past: [] });
  });
});

describe('pickGroupFocusDate', () => {
  const TODAY = '2026-07-27';

  // 회귀 방어: originalEvents[0] 폴백은 내림차순 정렬의 '가장 나중' 날짜라
  // 3일짜리 대회가 '3 / 3일'부터 열렸다.
  it('오늘 이후 가장 가까운 근무일을 고른다', () => {
    expect(pickGroupFocusDate(['2026-07-26', '2026-07-28', '2026-07-30'], TODAY)).toBe(
      '2026-07-28'
    );
  });

  it('오늘 근무가 있으면 오늘을 고른다', () => {
    expect(pickGroupFocusDate(['2026-07-25', TODAY, '2026-07-30'], TODAY)).toBe(TODAY);
  });

  it('전부 지난 그룹이면 마지막 근무일을 고른다', () => {
    expect(pickGroupFocusDate(['2026-07-20', '2026-07-22'], TODAY)).toBe('2026-07-22');
  });

  it('날짜가 없으면 null', () => {
    expect(pickGroupFocusDate([], TODAY)).toBeNull();
  });
});

describe('resolveSelectedDateForMonth', () => {
  const TODAY = '2026-07-27';

  it('이동한 달에 오늘이 있으면 오늘을 선택한다', () => {
    expect(resolveSelectedDateForMonth(2026, 7, ['2026-07-03'], TODAY)).toBe(TODAY);
  });

  // 회귀 방어: 월만 바꾸고 selectedDate 를 두면 선택일이 이전 달에 남아
  // 캘린더에 점은 있는데 아래는 비고 선택 표시도 사라졌다.
  it('다른 달로 이동하면 그 달에서 일정이 있는 가장 이른 날을 선택한다', () => {
    expect(
      resolveSelectedDateForMonth(2026, 8, ['2026-07-30', '2026-08-14', '2026-08-03'], TODAY)
    ).toBe('2026-08-03');
  });

  it('그 달에 일정이 없으면 1일을 선택한다', () => {
    expect(resolveSelectedDateForMonth(2026, 9, ['2026-08-03'], TODAY)).toBe('2026-09-01');
  });

  it('한 자리 월도 zero-pad 한다', () => {
    expect(resolveSelectedDateForMonth(2027, 3, [], TODAY)).toBe('2027-03-01');
  });
});

describe('isUnpaidCompleted / filterSchedulesByStatus("unpaid")', () => {
  it('완료가 아니면 미지급이 아니다', () => {
    expect(isUnpaidCompleted(createScheduleEvent({ type: 'confirmed' }))).toBe(false);
  });

  // payrollStatus 가 없으면 곧 '아직 못 받음'이다 — 기본값을 지급 완료로 오해하면 안 된다.
  it('정산 상태가 비어 있으면 미지급으로 본다', () => {
    expect(isUnpaidCompleted(createScheduleEvent({ type: 'completed' }))).toBe(true);
  });

  it('정산 완료 건은 미지급이 아니다', () => {
    expect(
      isUnpaidCompleted(createScheduleEvent({ type: 'completed', payrollStatus: 'completed' }))
    ).toBe(false);
  });

  it('그룹은 한 날짜라도 미정산이면 미지급으로 본다', () => {
    const group = {
      id: 'g1',
      type: 'completed',
      dateRange: { start: '2026-07-01', end: '2026-07-02', dates: [], totalDays: 2 },
      originalEvents: [
        createScheduleEvent({ type: 'completed', payrollStatus: 'completed' }),
        createScheduleEvent({ type: 'completed', payrollStatus: 'pending' }),
      ],
    } as unknown as GroupedScheduleEvent;

    expect(isUnpaidCompleted(group)).toBe(true);
  });

  it('unpaid 필터와 건수 집계가 같은 기준을 쓴다', () => {
    const items = [
      createScheduleEvent({ id: 'a', type: 'completed', payrollStatus: 'completed' }),
      createScheduleEvent({ id: 'b', type: 'completed', payrollStatus: 'pending' }),
      createScheduleEvent({ id: 'c', type: 'confirmed' }),
    ];

    expect(filterSchedulesByStatus(items, 'unpaid').map((s) => s.id)).toEqual(['b']);
    expect(countUnpaidSchedules(items)).toBe(1);
  });
});

describe('그룹 id 충돌 방어', () => {
  // 회귀 방어: id 가 `grouped_${applicationId}` 뿐이라, 한 지원이 '일부 완료 + 일부 예정'으로
  // 갈리면 서로 다른 그룹 2장이 같은 React key 를 가져 카드가 뒤섞였다.
  it('같은 지원이 상태별로 갈려도 그룹 id가 서로 다르다', () => {
    const base = { applicationId: 'app-1', jobPostingId: 'post-1', timeSlot: '18:00~23:00' };
    const events = [
      createScheduleEvent({ ...base, id: 'a', date: '2026-07-01', type: 'completed' }),
      createScheduleEvent({ ...base, id: 'b', date: '2026-07-02', type: 'completed' }),
      createScheduleEvent({ ...base, id: 'c', date: '2026-07-20', type: 'confirmed' }),
      createScheduleEvent({ ...base, id: 'd', date: '2026-07-21', type: 'confirmed' }),
    ];

    const grouped = groupScheduleEvents(events, { enabled: true, minGroupSize: 2 });
    const ids = grouped.map((item) => item.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
