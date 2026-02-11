/**
 * dateUtils (job-posting) 테스트
 *
 * @description 구인공고 날짜 관련 유틸리티 테스트
 * - getTodayDateString
 * - formatDateGroup
 * - formatDateRangeDisplay
 * - isDuplicateRole
 * - clampHeadcount
 * - isValidTimeFormat
 * - isValidDateFormat
 * - convertTournamentDatesToDateRequirements
 * - convertDateRequirementsToTournamentDates
 * - calculateTotalFromDateReqs
 * - calculateFilledFromDateReqs
 * - isFullyClosed
 * - getClosingStatus
 */

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/utils/date/core', () => ({
  toISODateString: jest.fn((date: Date | null) => {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }),
  generateId: jest.fn(() => 'mock-id'),
}));

jest.mock('@/utils/date/formatting', () => ({
  formatDateWithDay: jest.fn((date: string) => {
    // Simplified mock: just return a consistent format
    if (!date) return '';
    const parts = date.split('-');
    if (parts.length !== 3) return '';
    const month = parseInt(parts[1]!, 10);
    const day = parseInt(parts[2]!, 10);
    return `${month}월 ${day}일 (요일)`;
  }),
}));

jest.mock('@/utils/date/grouping', () => ({
  groupConsecutiveDates: jest.fn((dates: string[]) => {
    // Simple mock: treat each date as its own group
    if (dates.length === 0) return [];
    if (dates.length === 1) return [[dates[0]]];

    // Actually group consecutive dates
    const sorted = [...dates].sort();
    const groups: string[][] = [];
    let current: string[] = [sorted[0]!];

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]!);
      const curr = new Date(sorted[i]!);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        current.push(sorted[i]!);
      } else {
        groups.push(current);
        current = [sorted[i]!];
      }
    }
    groups.push(current);
    return groups;
  }),
}));

jest.mock('@/utils/date/validation', () => ({
  isDuplicateDate: jest.fn((dates: string[], newDate: string) => dates.includes(newDate)),
  validateDateCount: jest.fn(),
  isWithinUrgentDateLimit: jest.fn(),
  parseDate: jest.fn(),
  getDateAfterDays: jest.fn(),
}));

jest.mock('@/utils/date/ranges', () => ({
  generateDateRange: jest.fn(),
  sortDates: jest.fn((dates: string[]) => [...dates].sort()),
}));

import {
  getTodayDateString,
  formatDateGroup,
  formatDateRangeDisplay,
  isDuplicateRole,
  clampHeadcount,
  isValidTimeFormat,
  isValidDateFormat,
  convertTournamentDatesToDateRequirements,
  convertDateRequirementsToTournamentDates,
  calculateTotalFromDateReqs,
  calculateFilledFromDateReqs,
  isFullyClosed,
  getClosingStatus,
} from '../dateUtils';

// ============================================================================
// getTodayDateString
// ============================================================================

describe('getTodayDateString', () => {
  it('오늘 날짜를 yyyy-MM-dd 형식으로 반환한다', () => {
    const result = getTodayDateString();
    // Should be in format YYYY-MM-DD
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('빈 문자열이 아닌 값을 반환한다', () => {
    const result = getTodayDateString();
    expect(result.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// formatDateGroup
// ============================================================================

describe('formatDateGroup', () => {
  it('빈 배열이면 빈 문자열을 반환한다', () => {
    expect(formatDateGroup([])).toBe('');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDateGroup(null as any)).toBe('');
  });

  it('단일 날짜면 포맷된 날짜를 반환한다', () => {
    const result = formatDateGroup(['2025-01-15']);
    expect(result).toBe('1월 15일 (요일)');
  });

  it('여러 날짜면 범위로 표시한다', () => {
    const result = formatDateGroup(['2025-01-15', '2025-01-16']);
    expect(result).toBe('1월 15일 (요일) ~ 1월 16일 (요일)');
  });

  it('첫 번째 날짜가 빈 문자열이면 빈 문자열을 반환한다', () => {
    // firstDate is undefined if array has empty string
    const result = formatDateGroup(['']);
    // formatDateWithDay returns '' for empty string
    expect(result).toBe('');
  });
});

// ============================================================================
// formatDateRangeDisplay
// ============================================================================

describe('formatDateRangeDisplay', () => {
  it('빈 배열이면 빈 문자열을 반환한다', () => {
    expect(formatDateRangeDisplay([])).toBe('');
  });

  it('null이면 빈 문자열을 반환한다', () => {
    expect(formatDateRangeDisplay(null as any)).toBe('');
  });

  it('단일 날짜면 해당 날짜를 반환한다', () => {
    const result = formatDateRangeDisplay(['2025-01-15']);
    expect(result).toBe('1월 15일 (요일)');
  });

  it('연속 날짜면 범위로 표시하고 일수를 포함한다', () => {
    const result = formatDateRangeDisplay(['2025-01-15', '2025-01-16']);
    expect(result).toContain('~');
    expect(result).toContain('(2일)');
  });

  it('비연속 날짜면 쉼표로 구분한다', () => {
    const result = formatDateRangeDisplay(['2025-01-15', '2025-01-18']);
    expect(result).toContain(',');
    expect(result).toContain('(2일)');
  });

  it('날짜를 정렬하여 처리한다', () => {
    const result = formatDateRangeDisplay(['2025-01-18', '2025-01-15']);
    expect(result).toContain('(2일)');
  });
});

// ============================================================================
// isDuplicateRole
// ============================================================================

describe('isDuplicateRole', () => {
  it('같은 역할이 있으면 true', () => {
    const existing = [{ role: 'dealer' }, { role: 'floor' }];
    expect(isDuplicateRole(existing, 'dealer')).toBe(true);
  });

  it('같은 역할이 없으면 false', () => {
    const existing = [{ role: 'dealer' }, { role: 'floor' }];
    expect(isDuplicateRole(existing, 'serving')).toBe(false);
  });

  it('currentIndex와 같은 인덱스는 건너뛴다', () => {
    const existing = [{ role: 'dealer' }, { role: 'floor' }];
    expect(isDuplicateRole(existing, 'dealer', 0)).toBe(false);
  });

  it('커스텀 역할 (other + customRole) 매칭', () => {
    const existing = [{ role: 'other', customRole: '조명담당' }];
    expect(isDuplicateRole(existing, '조명담당')).toBe(true);
  });

  it('빈 배열이면 false', () => {
    expect(isDuplicateRole([], 'dealer')).toBe(false);
  });
});

// ============================================================================
// clampHeadcount
// ============================================================================

describe('clampHeadcount', () => {
  it('정상 범위 내 값은 그대로 반환한다', () => {
    expect(clampHeadcount(5)).toBe(5);
    expect(clampHeadcount(1)).toBe(1);
    expect(clampHeadcount(200)).toBe(200);
  });

  it('0이면 1로 보정한다', () => {
    expect(clampHeadcount(0)).toBe(1);
  });

  it('음수면 1로 보정한다', () => {
    expect(clampHeadcount(-10)).toBe(1);
  });

  it('200 초과면 200으로 보정한다', () => {
    expect(clampHeadcount(300)).toBe(200);
  });

  it('소수점은 내림한다', () => {
    expect(clampHeadcount(3.7)).toBe(3);
    expect(clampHeadcount(1.9)).toBe(1);
  });
});

// ============================================================================
// isValidTimeFormat
// ============================================================================

describe('isValidTimeFormat', () => {
  it('유효한 시간 형식을 인식한다', () => {
    expect(isValidTimeFormat('00:00')).toBe(true);
    expect(isValidTimeFormat('09:30')).toBe(true);
    expect(isValidTimeFormat('12:00')).toBe(true);
    expect(isValidTimeFormat('23:59')).toBe(true);
  });

  it('유효하지 않은 시간 형식을 거부한다', () => {
    expect(isValidTimeFormat('24:00')).toBe(false);
    expect(isValidTimeFormat('25:00')).toBe(false);
    expect(isValidTimeFormat('12:60')).toBe(false);
    expect(isValidTimeFormat('9:30')).toBe(false);  // single digit hour
    expect(isValidTimeFormat('abc')).toBe(false);
    expect(isValidTimeFormat('')).toBe(false);
    expect(isValidTimeFormat('12:00:00')).toBe(false);
  });
});

// ============================================================================
// isValidDateFormat
// ============================================================================

describe('isValidDateFormat', () => {
  it('유효한 날짜 형식을 인식한다', () => {
    expect(isValidDateFormat('2025-01-15')).toBe(true);
    expect(isValidDateFormat('2025-12-31')).toBe(true);
    expect(isValidDateFormat('1999-01-01')).toBe(true);
  });

  it('유효하지 않은 날짜 형식을 거부한다', () => {
    expect(isValidDateFormat('2025-1-15')).toBe(false);
    expect(isValidDateFormat('2025/01/15')).toBe(false);
    expect(isValidDateFormat('01-15-2025')).toBe(false);
    expect(isValidDateFormat('abc')).toBe(false);
    expect(isValidDateFormat('')).toBe(false);
  });
});

// ============================================================================
// convertTournamentDatesToDateRequirements
// ============================================================================

describe('convertTournamentDatesToDateRequirements', () => {
  it('토너먼트 날짜를 DateSpecificRequirement로 변환한다', () => {
    const tournamentDates = [
      { day: 1, date: '2025-01-10', startTime: '19:00' },
      { day: 2, date: '2025-01-11', startTime: '14:00' },
    ];

    const result = convertTournamentDatesToDateRequirements(tournamentDates);

    expect(result).toHaveLength(2);
    expect(result[0]!.date).toBe('2025-01-10');
    expect(result[0]!.timeSlots).toHaveLength(1);
    expect(result[0]!.timeSlots[0]!.startTime).toBe('19:00');
    expect(result[0]!.timeSlots[0]!.isTimeToBeAnnounced).toBe(false);
    expect(result[0]!.timeSlots[0]!.roles).toHaveLength(1);
    expect(result[0]!.timeSlots[0]!.roles[0]!.role).toBe('dealer');
    expect(result[0]!.timeSlots[0]!.roles[0]!.headcount).toBe(1);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    const result = convertTournamentDatesToDateRequirements([]);
    expect(result).toEqual([]);
  });

  it('각 변환된 항목에 고유 ID가 있다', () => {
    const tournamentDates = [
      { day: 1, date: '2025-01-10', startTime: '19:00' },
    ];

    const result = convertTournamentDatesToDateRequirements(tournamentDates);
    expect(result[0]!.timeSlots[0]!.id).toBe('mock-id');
    expect(result[0]!.timeSlots[0]!.roles[0]!.id).toBe('mock-id');
  });
});

// ============================================================================
// convertDateRequirementsToTournamentDates
// ============================================================================

describe('convertDateRequirementsToTournamentDates', () => {
  it('문자열 날짜를 변환한다', () => {
    const dateReqs = [
      {
        date: '2025-01-10',
        timeSlots: [{ startTime: '19:00' }],
      },
    ];

    const result = convertDateRequirementsToTournamentDates(dateReqs);

    expect(result).toHaveLength(1);
    expect(result[0]!.day).toBe(1);
    expect(result[0]!.date).toBe('2025-01-10');
    expect(result[0]!.startTime).toBe('19:00');
  });

  it('toDate 메서드가 있는 Timestamp 객체를 변환한다', () => {
    const dateReqs = [
      {
        date: { toDate: () => new Date('2025-01-10T00:00:00') },
        timeSlots: [{ startTime: '14:00' }],
      },
    ];

    const result = convertDateRequirementsToTournamentDates(dateReqs);
    expect(result[0]!.date).toBe('2025-01-10');
  });

  it('seconds 필드가 있는 Timestamp 객체를 변환한다', () => {
    const dateReqs = [
      {
        date: { seconds: new Date('2025-06-15T00:00:00Z').getTime() / 1000 },
        timeSlots: [{ startTime: '09:00' }],
      },
    ];

    const result = convertDateRequirementsToTournamentDates(dateReqs);
    expect(result[0]!.date).toBe('2025-06-15');
  });

  it('day는 1부터 순차적으로 증가한다', () => {
    const dateReqs = [
      { date: '2025-01-10', timeSlots: [{ startTime: '19:00' }] },
      { date: '2025-01-11', timeSlots: [{ startTime: '14:00' }] },
      { date: '2025-01-12', timeSlots: [{ startTime: '10:00' }] },
    ];

    const result = convertDateRequirementsToTournamentDates(dateReqs);
    expect(result[0]!.day).toBe(1);
    expect(result[1]!.day).toBe(2);
    expect(result[2]!.day).toBe(3);
  });

  it('timeSlots가 비어있으면 기본 시간 09:00을 사용한다', () => {
    const dateReqs = [
      { date: '2025-01-10', timeSlots: [] },
    ];

    const result = convertDateRequirementsToTournamentDates(dateReqs);
    expect(result[0]!.startTime).toBe('09:00');
  });
});

// ============================================================================
// calculateTotalFromDateReqs
// ============================================================================

describe('calculateTotalFromDateReqs', () => {
  it('모든 역할의 headcount 합계를 반환한다', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [
          {
            roles: [
              { headcount: 3 },
              { headcount: 2 },
            ],
          },
        ],
      },
    ];

    expect(calculateTotalFromDateReqs(reqs)).toBe(5);
  });

  it('여러 날짜의 합산을 계산한다', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{ headcount: 3 }] }],
      },
      {
        date: '2025-01-11',
        timeSlots: [{ roles: [{ headcount: 2 }] }],
      },
    ];

    expect(calculateTotalFromDateReqs(reqs)).toBe(5);
  });

  it('여러 타임슬롯의 합산을 계산한다', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [
          { roles: [{ headcount: 2 }] },
          { roles: [{ headcount: 3 }] },
        ],
      },
    ];

    expect(calculateTotalFromDateReqs(reqs)).toBe(5);
  });

  it('headcount가 undefined이면 0으로 취급한다', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{}] }],
      },
    ];

    expect(calculateTotalFromDateReqs(reqs)).toBe(0);
  });

  it('undefined이면 0을 반환한다', () => {
    expect(calculateTotalFromDateReqs(undefined)).toBe(0);
  });

  it('빈 배열이면 0을 반환한다', () => {
    expect(calculateTotalFromDateReqs([])).toBe(0);
  });
});

// ============================================================================
// calculateFilledFromDateReqs
// ============================================================================

describe('calculateFilledFromDateReqs', () => {
  it('모든 역할의 filled 합계를 반환한다', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [
          {
            roles: [
              { filled: 2 },
              { filled: 1 },
            ],
          },
        ],
      },
    ];

    expect(calculateFilledFromDateReqs(reqs)).toBe(3);
  });

  it('filled가 undefined이면 0으로 취급한다', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{}] }],
      },
    ];

    expect(calculateFilledFromDateReqs(reqs)).toBe(0);
  });

  it('undefined이면 0을 반환한다', () => {
    expect(calculateFilledFromDateReqs(undefined)).toBe(0);
  });

  it('빈 배열이면 0을 반환한다', () => {
    expect(calculateFilledFromDateReqs([])).toBe(0);
  });
});

// ============================================================================
// isFullyClosed
// ============================================================================

describe('isFullyClosed', () => {
  it('filled >= total이면 true', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{ headcount: 3, filled: 3 }] }],
      },
    ];

    expect(isFullyClosed(reqs)).toBe(true);
  });

  it('filled < total이면 false', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{ headcount: 3, filled: 1 }] }],
      },
    ];

    expect(isFullyClosed(reqs)).toBe(false);
  });

  it('total이 0이면 false', () => {
    const reqs = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{ headcount: 0, filled: 0 }] }],
      },
    ];

    expect(isFullyClosed(reqs)).toBe(false);
  });

  it('undefined이면 false', () => {
    expect(isFullyClosed(undefined)).toBe(false);
  });
});

// ============================================================================
// getClosingStatus
// ============================================================================

describe('getClosingStatus', () => {
  it('dateSpecificRequirements가 있으면 해당 기준으로 계산한다', () => {
    const jobData = {
      dateSpecificRequirements: [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [{ headcount: 5, filled: 3 }] }],
        },
      ],
    };

    const result = getClosingStatus(jobData);
    expect(result.total).toBe(5);
    expect(result.filled).toBe(3);
    expect(result.isClosed).toBe(false);
  });

  it('dateSpecificRequirements가 가득 찼으면 isClosed: true', () => {
    const jobData = {
      dateSpecificRequirements: [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [{ headcount: 3, filled: 3 }] }],
        },
      ],
    };

    const result = getClosingStatus(jobData);
    expect(result.isClosed).toBe(true);
  });

  it('dateSpecificRequirements가 없으면 레거시 필드를 사용한다', () => {
    const jobData = {
      totalPositions: 10,
      filledPositions: 7,
    };

    const result = getClosingStatus(jobData);
    expect(result.total).toBe(10);
    expect(result.filled).toBe(7);
    expect(result.isClosed).toBe(false);
  });

  it('레거시 필드가 가득 찼으면 isClosed: true', () => {
    const jobData = {
      totalPositions: 5,
      filledPositions: 5,
    };

    const result = getClosingStatus(jobData);
    expect(result.isClosed).toBe(true);
  });

  it('모든 필드가 없으면 기본값 0을 사용한다', () => {
    const result = getClosingStatus({});
    expect(result.total).toBe(0);
    expect(result.filled).toBe(0);
    expect(result.isClosed).toBe(false);
  });

  it('dateSpecificRequirements가 빈 배열이면 레거시 필드를 사용한다', () => {
    const jobData = {
      dateSpecificRequirements: [],
      totalPositions: 5,
      filledPositions: 2,
    };

    const result = getClosingStatus(jobData);
    expect(result.total).toBe(5);
    expect(result.filled).toBe(2);
  });
});
