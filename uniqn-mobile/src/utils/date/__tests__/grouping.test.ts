/**
 * UNIQN Mobile - date/grouping.ts 테스트
 *
 * @description 날짜 그룹화 유틸리티 함수들의 단위 테스트
 */

import type { DateSpecificRequirement, TimeSlot } from '@/types/jobPosting/dateRequirement';

import {
  areDatesConsecutive,
  areAllDatesConsecutive,
  groupConsecutiveDates,
  formatDateRange,
  getDayCount,
  formatDateRangeWithCount,
  groupRequirementsToDateRanges,
  expandDateRangeToRequirements,
  expandAllDateRangesToRequirements,
  isSingleDate,
  getDateListFromRange,
} from '../grouping';
import type { DateRangeGroup } from '../grouping';

// ============================================================================
// Helpers
// ============================================================================

function createTimeSlot(overrides: Partial<TimeSlot> = {}): TimeSlot {
  return {
    startTime: '19:00',
    roles: [{ role: 'dealer', headcount: 2 }],
    ...overrides,
  };
}

function createDateRequirement(
  date: string,
  timeSlots: TimeSlot[] = [createTimeSlot()],
  isGrouped = true
): DateSpecificRequirement {
  return {
    date,
    timeSlots,
    isGrouped,
  };
}

function createDateRangeGroup(overrides: Partial<DateRangeGroup> = {}): DateRangeGroup {
  return {
    id: 'test-id',
    startDate: '2025-01-15',
    endDate: '2025-01-17',
    timeSlots: [createTimeSlot()],
    ...overrides,
  };
}

// ============================================================================
// areDatesConsecutive
// ============================================================================

describe('areDatesConsecutive', () => {
  it('연속된 날짜는 true를 반환한다', () => {
    expect(areDatesConsecutive('2025-01-15', '2025-01-16')).toBe(true);
  });

  it('역방향 연속 날짜도 true를 반환한다', () => {
    expect(areDatesConsecutive('2025-01-16', '2025-01-15')).toBe(true);
  });

  it('비연속 날짜는 false를 반환한다', () => {
    expect(areDatesConsecutive('2025-01-15', '2025-01-17')).toBe(false);
  });

  it('같은 날짜는 false를 반환한다', () => {
    expect(areDatesConsecutive('2025-01-15', '2025-01-15')).toBe(false);
  });

  it('월을 넘어가는 연속 날짜를 감지한다', () => {
    expect(areDatesConsecutive('2025-01-31', '2025-02-01')).toBe(true);
  });

  it('연도를 넘어가는 연속 날짜를 감지한다', () => {
    expect(areDatesConsecutive('2024-12-31', '2025-01-01')).toBe(true);
  });

  it('윤년 2/28 -> 2/29를 감지한다', () => {
    expect(areDatesConsecutive('2024-02-28', '2024-02-29')).toBe(true);
  });

  it('빈 문자열은 false를 반환한다', () => {
    expect(areDatesConsecutive('', '2025-01-15')).toBe(false);
    expect(areDatesConsecutive('2025-01-15', '')).toBe(false);
  });
});

// ============================================================================
// areAllDatesConsecutive
// ============================================================================

describe('areAllDatesConsecutive', () => {
  it('빈 배열은 true를 반환한다', () => {
    expect(areAllDatesConsecutive([])).toBe(true);
  });

  it('단일 날짜는 true를 반환한다', () => {
    expect(areAllDatesConsecutive(['2025-01-15'])).toBe(true);
  });

  it('연속된 날짜 배열은 true를 반환한다', () => {
    expect(areAllDatesConsecutive(['2025-01-15', '2025-01-16', '2025-01-17'])).toBe(true);
  });

  it('비연속 날짜가 포함되면 false를 반환한다', () => {
    expect(areAllDatesConsecutive(['2025-01-15', '2025-01-17'])).toBe(false);
  });

  it('정렬되지 않은 연속 날짜도 true를 반환한다', () => {
    expect(areAllDatesConsecutive(['2025-01-17', '2025-01-15', '2025-01-16'])).toBe(true);
  });

  it('중간에 빈 날짜가 있으면 false를 반환한다', () => {
    expect(areAllDatesConsecutive(['2025-01-15', '2025-01-16', '2025-01-18'])).toBe(false);
  });
});

// ============================================================================
// groupConsecutiveDates
// ============================================================================

describe('groupConsecutiveDates', () => {
  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(groupConsecutiveDates([])).toEqual([]);
  });

  it('단일 날짜는 단일 그룹을 반환한다', () => {
    expect(groupConsecutiveDates(['2025-01-15'])).toEqual([['2025-01-15']]);
  });

  it('연속 날짜를 하나의 그룹으로 묶는다', () => {
    const result = groupConsecutiveDates(['2025-01-15', '2025-01-16', '2025-01-17']);
    expect(result).toEqual([['2025-01-15', '2025-01-16', '2025-01-17']]);
  });

  it('비연속 날짜를 별도 그룹으로 분리한다', () => {
    const result = groupConsecutiveDates(['2025-01-15', '2025-01-16', '2025-01-20']);
    expect(result).toEqual([['2025-01-15', '2025-01-16'], ['2025-01-20']]);
  });

  it('정렬되지 않은 날짜를 자동 정렬하여 그룹화한다', () => {
    const result = groupConsecutiveDates(['2025-01-20', '2025-01-15', '2025-01-16']);
    expect(result).toEqual([['2025-01-15', '2025-01-16'], ['2025-01-20']]);
  });

  it('여러 개의 연속 그룹을 올바르게 분리한다', () => {
    const result = groupConsecutiveDates([
      '2025-01-10',
      '2025-01-11',
      '2025-01-15',
      '2025-01-16',
      '2025-01-17',
      '2025-01-25',
    ]);
    expect(result).toEqual([
      ['2025-01-10', '2025-01-11'],
      ['2025-01-15', '2025-01-16', '2025-01-17'],
      ['2025-01-25'],
    ]);
  });

  it('모든 날짜가 비연속이면 각각 독립 그룹이 된다', () => {
    const result = groupConsecutiveDates(['2025-01-10', '2025-01-15', '2025-01-20']);
    expect(result).toEqual([['2025-01-10'], ['2025-01-15'], ['2025-01-20']]);
  });
});

// ============================================================================
// formatDateRange
// ============================================================================

describe('formatDateRange', () => {
  it('단일 날짜는 한 날짜만 포맷한다', () => {
    const result = formatDateRange('2025-01-17', '2025-01-17');
    // 2025-01-17 is Friday
    expect(result).toBe('1/17(금)');
  });

  it('날짜 범위를 ~ 형식으로 포맷한다', () => {
    const result = formatDateRange('2025-01-17', '2025-01-19');
    expect(result).toBe('1/17(금) ~ 1/19(일)');
  });

  it('빈 시작 날짜는 빈 문자열을 반환한다', () => {
    expect(formatDateRange('', '2025-01-19')).toBe('');
  });

  it('유효하지 않은 종료 날짜일 때 시작 날짜만 표시한다', () => {
    const result = formatDateRange('2025-01-17', '');
    // parseDateString('') returns null, so it falls through to single format
    expect(result).toBe('1/17(금)');
  });
});

// ============================================================================
// getDayCount
// ============================================================================

describe('getDayCount', () => {
  it('같은 날짜는 1일을 반환한다', () => {
    expect(getDayCount('2025-01-17', '2025-01-17')).toBe(1);
  });

  it('연속 2일의 차이를 올바르게 계산한다', () => {
    expect(getDayCount('2025-01-17', '2025-01-18')).toBe(2);
  });

  it('3일 범위를 올바르게 계산한다', () => {
    expect(getDayCount('2025-01-17', '2025-01-19')).toBe(3);
  });

  it('월을 넘어가는 범위를 올바르게 계산한다', () => {
    expect(getDayCount('2025-01-30', '2025-02-02')).toBe(4);
  });

  it('유효하지 않은 날짜는 1을 반환한다', () => {
    expect(getDayCount('', '2025-01-17')).toBe(1);
    expect(getDayCount('2025-01-17', '')).toBe(1);
  });
});

// ============================================================================
// formatDateRangeWithCount
// ============================================================================

describe('formatDateRangeWithCount', () => {
  it('단일 날짜는 일수 없이 포맷한다', () => {
    const result = formatDateRangeWithCount('2025-01-17', '2025-01-17');
    expect(result).toBe('1/17(금)');
    expect(result).not.toContain('일)');
  });

  it('2일 이상 범위에 일수를 포함한다', () => {
    const result = formatDateRangeWithCount('2025-01-17', '2025-01-19');
    expect(result).toContain('1/17(금) ~ 1/19(일)');
    expect(result).toContain('(3일)');
  });
});

// ============================================================================
// groupRequirementsToDateRanges
// ============================================================================

describe('groupRequirementsToDateRanges', () => {
  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(groupRequirementsToDateRanges([])).toEqual([]);
  });

  it('단일 요구사항은 단일 그룹을 반환한다', () => {
    const requirements = [createDateRequirement('2025-01-15')];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe('2025-01-15');
    expect(result[0].endDate).toBe('2025-01-15');
  });

  it('isGrouped + 연속 날짜 + 동일 timeSlots를 하나의 그룹으로 묶는다', () => {
    const sharedTimeSlots = [createTimeSlot()];
    const requirements = [
      createDateRequirement('2025-01-15', sharedTimeSlots, true),
      createDateRequirement('2025-01-16', sharedTimeSlots, true),
      createDateRequirement('2025-01-17', sharedTimeSlots, true),
    ];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe('2025-01-15');
    expect(result[0].endDate).toBe('2025-01-17');
  });

  it('isGrouped=false인 날짜는 별도 그룹으로 분리한다', () => {
    const sharedTimeSlots = [createTimeSlot()];
    const requirements = [
      createDateRequirement('2025-01-15', sharedTimeSlots, true),
      createDateRequirement('2025-01-16', sharedTimeSlots, false),
    ];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(2);
  });

  it('다른 timeSlots를 가진 연속 날짜는 별도 그룹으로 분리한다', () => {
    const timeSlotsA = [createTimeSlot({ startTime: '19:00' })];
    const timeSlotsB = [createTimeSlot({ startTime: '10:00' })];
    const requirements = [
      createDateRequirement('2025-01-15', timeSlotsA, true),
      createDateRequirement('2025-01-16', timeSlotsB, true),
    ];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(2);
  });

  it('비연속 날짜는 별도 그룹으로 분리한다', () => {
    const sharedTimeSlots = [createTimeSlot()];
    const requirements = [
      createDateRequirement('2025-01-15', sharedTimeSlots, true),
      createDateRequirement('2025-01-20', sharedTimeSlots, true),
    ];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(2);
  });

  it('정렬되지 않은 요구사항을 날짜순으로 정렬하여 그룹화한다', () => {
    const sharedTimeSlots = [createTimeSlot()];
    const requirements = [
      createDateRequirement('2025-01-17', sharedTimeSlots, true),
      createDateRequirement('2025-01-15', sharedTimeSlots, true),
      createDateRequirement('2025-01-16', sharedTimeSlots, true),
    ];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(1);
    expect(result[0].startDate).toBe('2025-01-15');
    expect(result[0].endDate).toBe('2025-01-17');
  });

  it('역할 구성이 다른 timeSlots는 별도 그룹으로 분리한다', () => {
    const timeSlotsA = [
      createTimeSlot({
        startTime: '19:00',
        roles: [{ role: 'dealer', headcount: 2 }],
      }),
    ];
    const timeSlotsB = [
      createTimeSlot({
        startTime: '19:00',
        roles: [{ role: 'dealer', headcount: 3 }],
      }),
    ];
    const requirements = [
      createDateRequirement('2025-01-15', timeSlotsA, true),
      createDateRequirement('2025-01-16', timeSlotsB, true),
    ];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(2);
  });

  it('혼합된 연속/비연속 패턴을 올바르게 그룹화한다', () => {
    const ts = [createTimeSlot()];
    const requirements = [
      createDateRequirement('2025-01-15', ts, true),
      createDateRequirement('2025-01-16', ts, true),
      createDateRequirement('2025-01-20', ts, true),
      createDateRequirement('2025-01-21', ts, true),
      createDateRequirement('2025-01-22', ts, true),
    ];
    const result = groupRequirementsToDateRanges(requirements);
    expect(result).toHaveLength(2);
    expect(result[0].startDate).toBe('2025-01-15');
    expect(result[0].endDate).toBe('2025-01-16');
    expect(result[1].startDate).toBe('2025-01-20');
    expect(result[1].endDate).toBe('2025-01-22');
  });
});

// ============================================================================
// expandDateRangeToRequirements
// ============================================================================

describe('expandDateRangeToRequirements', () => {
  it('단일 날짜 범위는 1개의 요구사항을 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-15',
    });
    const result = expandDateRangeToRequirements(group);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-01-15');
  });

  it('3일 범위를 3개의 개별 요구사항으로 확장한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-17',
    });
    const result = expandDateRangeToRequirements(group);
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2025-01-15');
    expect(result[1].date).toBe('2025-01-16');
    expect(result[2].date).toBe('2025-01-17');
  });

  it('확장된 각 요구사항에 timeSlots가 포함된다', () => {
    const timeSlots = [createTimeSlot({ startTime: '19:00' })];
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-16',
      timeSlots,
    });
    const result = expandDateRangeToRequirements(group);
    expect(result).toHaveLength(2);
    expect(result[0].timeSlots[0].startTime).toBe('19:00');
    expect(result[1].timeSlots[0].startTime).toBe('19:00');
  });

  it('확장된 timeSlots가 깊은 복사된다 (원본 변경 방지)', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-16',
    });
    const result = expandDateRangeToRequirements(group);
    // 원본 timeSlots와 확장된 timeSlots가 동일 참조가 아님을 확인
    expect(result[0].timeSlots).not.toBe(group.timeSlots);
    expect(result[1].timeSlots).not.toBe(group.timeSlots);
    // 각 날짜의 timeSlot 객체도 동일 참조가 아님을 확인
    expect(result[0].timeSlots[0]).not.toBe(result[1].timeSlots[0]);
    // 내용은 동일해야 함 (startTime 등)
    expect(result[0].timeSlots[0].startTime).toBe(result[1].timeSlots[0].startTime);
  });

  it('빈 startDate는 빈 배열을 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '',
      endDate: '2025-01-15',
    });
    const result = expandDateRangeToRequirements(group);
    expect(result).toEqual([]);
  });

  it('유효하지 않은 endDate는 startDate만 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '',
    });
    const result = expandDateRangeToRequirements(group);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-01-15');
  });

  it('월을 넘어가는 범위를 올바르게 확장한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-30',
      endDate: '2025-02-02',
    });
    const result = expandDateRangeToRequirements(group);
    expect(result).toHaveLength(4);
    expect(result[0].date).toBe('2025-01-30');
    expect(result[1].date).toBe('2025-01-31');
    expect(result[2].date).toBe('2025-02-01');
    expect(result[3].date).toBe('2025-02-02');
  });
});

// ============================================================================
// expandAllDateRangesToRequirements
// ============================================================================

describe('expandAllDateRangesToRequirements', () => {
  it('빈 배열은 빈 배열을 반환한다', () => {
    expect(expandAllDateRangesToRequirements([])).toEqual([]);
  });

  it('여러 그룹을 하나의 배열로 확장한다', () => {
    const groups = [
      createDateRangeGroup({ startDate: '2025-01-15', endDate: '2025-01-16' }),
      createDateRangeGroup({ startDate: '2025-01-20', endDate: '2025-01-20' }),
    ];
    const result = expandAllDateRangesToRequirements(groups);
    expect(result).toHaveLength(3); // 2 + 1
  });
});

// ============================================================================
// isSingleDate
// ============================================================================

describe('isSingleDate', () => {
  it('startDate === endDate이면 true를 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-15',
    });
    expect(isSingleDate(group)).toBe(true);
  });

  it('startDate !== endDate이면 false를 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-17',
    });
    expect(isSingleDate(group)).toBe(false);
  });
});

// ============================================================================
// getDateListFromRange
// ============================================================================

describe('getDateListFromRange', () => {
  it('단일 날짜 범위는 1개의 날짜를 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-15',
    });
    expect(getDateListFromRange(group)).toEqual(['2025-01-15']);
  });

  it('3일 범위는 3개의 날짜 목록을 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-15',
      endDate: '2025-01-17',
    });
    expect(getDateListFromRange(group)).toEqual(['2025-01-15', '2025-01-16', '2025-01-17']);
  });

  it('유효하지 않은 startDate는 빈 배열을 반환한다', () => {
    const group = createDateRangeGroup({
      startDate: '',
      endDate: '2025-01-17',
    });
    expect(getDateListFromRange(group)).toEqual([]);
  });

  it('월을 넘어가는 범위의 날짜 목록을 올바르게 생성한다', () => {
    const group = createDateRangeGroup({
      startDate: '2025-01-30',
      endDate: '2025-02-01',
    });
    expect(getDateListFromRange(group)).toEqual(['2025-01-30', '2025-01-31', '2025-02-01']);
  });
});
