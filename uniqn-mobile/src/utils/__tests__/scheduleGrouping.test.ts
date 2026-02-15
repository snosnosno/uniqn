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
  calculateGroupedStats,
  extractAllDatesForCalendar,
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

// ============================================================================
// calculateGroupedStats
// ============================================================================

describe('calculateGroupedStats', () => {
  it('빈 배열에서 모든 값이 0인 통계를 반환한다', () => {
    const stats = calculateGroupedStats([]);
    expect(stats).toEqual({
      totalEvents: 0,
      appliedCount: 0,
      confirmedCount: 0,
      completedCount: 0,
      groupedCount: 0,
    });
  });

  it('일반 ScheduleEvent의 통계를 올바르게 계산한다', () => {
    const events = [
      createScheduleEvent({ type: 'applied' }),
      createScheduleEvent({ id: 'evt-2', type: 'confirmed' }),
      createScheduleEvent({ id: 'evt-3', type: 'completed' }),
    ];
    const stats = calculateGroupedStats(events);
    expect(stats.totalEvents).toBe(3);
    expect(stats.appliedCount).toBe(1);
    expect(stats.confirmedCount).toBe(1);
    expect(stats.completedCount).toBe(1);
    expect(stats.groupedCount).toBe(0);
  });

  it('GroupedScheduleEvent의 통계를 totalDays 기반으로 계산한다', () => {
    const grouped = createGroupedScheduleEvent({
      type: 'confirmed',
      dateRange: {
        start: '2025-01-15',
        end: '2025-01-17',
        dates: ['2025-01-15', '2025-01-16', '2025-01-17'],
        totalDays: 3,
        isConsecutive: true,
      },
    });
    const stats = calculateGroupedStats([grouped]);
    expect(stats.totalEvents).toBe(3);
    expect(stats.confirmedCount).toBe(3);
    expect(stats.groupedCount).toBe(1);
  });

  it('혼합된 이벤트의 통계를 올바르게 합산한다', () => {
    const singleEvent = createScheduleEvent({ type: 'applied' });
    const grouped = createGroupedScheduleEvent({
      type: 'confirmed',
      dateRange: {
        start: '2025-01-15',
        end: '2025-01-16',
        dates: ['2025-01-15', '2025-01-16'],
        totalDays: 2,
        isConsecutive: true,
      },
    });
    const stats = calculateGroupedStats([singleEvent, grouped]);
    expect(stats.totalEvents).toBe(3);
    expect(stats.appliedCount).toBe(1);
    expect(stats.confirmedCount).toBe(2);
    expect(stats.groupedCount).toBe(1);
  });

  it('cancelled 타입은 어떤 카운트에도 포함되지 않는다', () => {
    const events = [createScheduleEvent({ type: 'cancelled' })];
    const stats = calculateGroupedStats(events);
    expect(stats.totalEvents).toBe(1);
    expect(stats.appliedCount).toBe(0);
    expect(stats.confirmedCount).toBe(0);
    expect(stats.completedCount).toBe(0);
  });
});

// ============================================================================
// extractAllDatesForCalendar
// ============================================================================

describe('extractAllDatesForCalendar', () => {
  it('빈 배열에서 빈 배열을 반환한다', () => {
    expect(extractAllDatesForCalendar([])).toEqual([]);
  });

  it('일반 ScheduleEvent에서 날짜를 추출한다', () => {
    const event = createScheduleEvent({
      date: '2025-01-15',
      type: 'confirmed',
      status: 'checked_in',
    });
    const result = extractAllDatesForCalendar([event]);
    expect(result).toEqual([{ date: '2025-01-15', type: 'confirmed', status: 'checked_in' }]);
  });

  it('GroupedScheduleEvent에서 모든 날짜를 개별적으로 추출한다', () => {
    const grouped = createGroupedScheduleEvent({
      type: 'confirmed',
    });
    const result = extractAllDatesForCalendar([grouped]);
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2025-01-15');
    expect(result[1].date).toBe('2025-01-16');
    expect(result[2].date).toBe('2025-01-17');
    expect(result.every((r) => r.type === 'confirmed')).toBe(true);
  });

  it('혼합된 이벤트에서 모든 날짜를 추출한다', () => {
    const singleEvent = createScheduleEvent({
      date: '2025-01-20',
      type: 'applied',
      status: 'not_started',
    });
    const grouped = createGroupedScheduleEvent({
      type: 'confirmed',
    });
    const result = extractAllDatesForCalendar([singleEvent, grouped]);
    expect(result).toHaveLength(4); // 1 single + 3 grouped
  });

  it('GroupedScheduleEvent의 dateStatuses에서 각 날짜별 status를 올바르게 추출한다', () => {
    const grouped = createGroupedScheduleEvent({
      type: 'confirmed',
      dateStatuses: [
        {
          date: '2025-01-15',
          formattedDate: '1/15(수)',
          status: 'checked_in',
          scheduleEventId: 'e1',
        },
        {
          date: '2025-01-16',
          formattedDate: '1/16(목)',
          status: 'checked_out',
          scheduleEventId: 'e2',
        },
        {
          date: '2025-01-17',
          formattedDate: '1/17(금)',
          status: 'not_started',
          scheduleEventId: 'e3',
        },
      ],
    });
    const result = extractAllDatesForCalendar([grouped]);
    expect(result[0].status).toBe('checked_in');
    expect(result[1].status).toBe('checked_out');
    expect(result[2].status).toBe('not_started');
  });
});
