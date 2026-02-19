/**
 * UNIQN Mobile - scheduleNormalizer.ts 테스트
 *
 * @description 일정 정규화 함수들의 단위 테스트
 */

import type { JobPosting } from '@/types';

import {
  normalizeJobSchedule,
  isFixedJobPosting,
  hasDatedRequirements,
  isLegacyJobPosting,
} from '../scheduleNormalizer';

// ============================================================================
// Helpers
// ============================================================================

function createMinimalJob(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    title: '테스트 공고',
    status: 'active',
    location: { district: '강남구' },
    workDate: '2025-01-28',
    timeSlot: '18:00~02:00',
    roles: [],
    totalPositions: 0,
    filledPositions: 0,
    ownerId: 'owner-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as JobPosting;
}

// ============================================================================
// isFixedJobPosting
// ============================================================================

describe('isFixedJobPosting', () => {
  it('fixed 타입 공고는 true를 반환한다', () => {
    const job = createMinimalJob({ postingType: 'fixed' });
    expect(isFixedJobPosting(job)).toBe(true);
  });

  it('regular 타입 공고는 false를 반환한다', () => {
    const job = createMinimalJob({ postingType: 'regular' });
    expect(isFixedJobPosting(job)).toBe(false);
  });

  it('tournament 타입 공고는 false를 반환한다', () => {
    const job = createMinimalJob({ postingType: 'tournament' });
    expect(isFixedJobPosting(job)).toBe(false);
  });

  it('urgent 타입 공고는 false를 반환한다', () => {
    const job = createMinimalJob({ postingType: 'urgent' });
    expect(isFixedJobPosting(job)).toBe(false);
  });

  it('postingType이 없는 공고는 false를 반환한다', () => {
    const job = createMinimalJob();
    expect(isFixedJobPosting(job)).toBe(false);
  });
});

// ============================================================================
// hasDatedRequirements
// ============================================================================

describe('hasDatedRequirements', () => {
  it('dateSpecificRequirements가 있으면 true를 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'regular',
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 2 }] }],
        },
      ],
    });
    expect(hasDatedRequirements(job)).toBe(true);
  });

  it('dateSpecificRequirements가 빈 배열이면 false를 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'regular',
      dateSpecificRequirements: [],
    });
    expect(hasDatedRequirements(job)).toBe(false);
  });

  it('fixed 타입은 항상 false를 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'fixed',
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 2 }] }],
        },
      ],
    });
    expect(hasDatedRequirements(job)).toBe(false);
  });

  it('dateSpecificRequirements가 undefined이면 false를 반환한다', () => {
    const job = createMinimalJob({ postingType: 'regular' });
    expect(hasDatedRequirements(job)).toBe(false);
  });
});

// ============================================================================
// isLegacyJobPosting
// ============================================================================

describe('isLegacyJobPosting', () => {
  it('workDate만 있고 dateSpecificRequirements가 없으면 true를 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'regular',
      workDate: '2025-01-28',
    });
    expect(isLegacyJobPosting(job)).toBe(true);
  });

  it('dateSpecificRequirements가 있으면 false를 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'regular',
      workDate: '2025-01-28',
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 2 }] }],
        },
      ],
    });
    expect(isLegacyJobPosting(job)).toBe(false);
  });

  it('fixed 타입은 항상 false를 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'fixed',
      workDate: '2025-01-28',
    });
    expect(isLegacyJobPosting(job)).toBe(false);
  });

  it('workDate가 없으면 false를 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'regular',
      workDate: '',
    });
    expect(isLegacyJobPosting(job)).toBe(false);
  });
});

// ============================================================================
// normalizeJobSchedule
// ============================================================================

describe('normalizeJobSchedule', () => {
  describe('고정 공고 (fixed)', () => {
    it('고정 공고를 fixed 타입으로 정규화한다', () => {
      const job = createMinimalJob({
        postingType: 'fixed',
        daysPerWeek: 5,
        timeSlot: '19:00~02:00',
        requiredRolesWithCount: [{ role: 'dealer', count: 3, filled: 1 }],
      });
      const result = normalizeJobSchedule(job);
      expect(result.type).toBe('fixed');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('fixed');
    });

    it('고정 공고의 daysPerWeek을 반영한다', () => {
      const job = createMinimalJob({
        postingType: 'fixed',
        daysPerWeek: 3,
        requiredRolesWithCount: [{ role: 'dealer', count: 2 }],
      });
      const result = normalizeJobSchedule(job);
      const fixedItem = result.items[0];
      if (fixedItem.type === 'fixed') {
        expect(fixedItem.daysPerWeek).toBe(3);
      }
    });

    it('고정 공고의 역할을 포함한다', () => {
      const job = createMinimalJob({
        postingType: 'fixed',
        requiredRolesWithCount: [
          { role: 'dealer', count: 3, filled: 1 },
          { role: 'floor', count: 2 },
        ],
      });
      const result = normalizeJobSchedule(job);
      const fixedItem = result.items[0];
      if (fixedItem.type === 'fixed') {
        expect(fixedItem.roles).toHaveLength(2);
      }
    });

    it('timeSlot에서 startTime을 추출한다', () => {
      const job = createMinimalJob({
        postingType: 'fixed',
        timeSlot: '19:00~02:00',
        requiredRolesWithCount: [{ role: 'dealer', count: 2 }],
      });
      const result = normalizeJobSchedule(job);
      const fixedItem = result.items[0];
      if (fixedItem.type === 'fixed') {
        expect(fixedItem.startTime).toBe('19:00');
      }
    });

    it('isStartTimeNegotiable이 반영된다', () => {
      const job = createMinimalJob({
        postingType: 'fixed',
        isStartTimeNegotiable: true,
        requiredRolesWithCount: [{ role: 'dealer', count: 2 }],
      });
      const result = normalizeJobSchedule(job);
      const fixedItem = result.items[0];
      if (fixedItem.type === 'fixed') {
        expect(fixedItem.isStartTimeNegotiable).toBe(true);
      }
    });
  });

  describe('날짜별 요구사항이 있는 공고', () => {
    it('dateSpecificRequirements를 dated 타입으로 정규화한다', () => {
      const job = createMinimalJob({
        postingType: 'tournament',
        dateSpecificRequirements: [
          {
            date: '2025-01-28',
            timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 3 }] }],
          },
          {
            date: '2025-01-29',
            timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 3 }] }],
          },
        ],
      });
      const result = normalizeJobSchedule(job);
      expect(result.type).toBe('dated');
      expect(result.items).toHaveLength(2);
    });

    it('날짜별 timeSlots를 정규화한다', () => {
      const job = createMinimalJob({
        postingType: 'regular',
        dateSpecificRequirements: [
          {
            date: '2025-01-28',
            timeSlots: [
              { startTime: '14:00', roles: [{ role: 'dealer', headcount: 2 }] },
              { startTime: '19:00', roles: [{ role: 'floor', headcount: 1 }] },
            ],
          },
        ],
      });
      const result = normalizeJobSchedule(job);
      expect(result.items).toHaveLength(1);
      const datedItem = result.items[0];
      if (datedItem.type === 'dated') {
        expect(datedItem.timeSlots).toHaveLength(2);
      }
    });
  });

  describe('레거시 공고', () => {
    it('workDate를 dated 타입으로 정규화한다', () => {
      const job = createMinimalJob({
        workDate: '2025-01-28',
        timeSlot: '18:00~02:00',
        roles: [{ role: 'dealer', count: 2, filled: 0 }],
      });
      const result = normalizeJobSchedule(job);
      expect(result.type).toBe('dated');
      expect(result.items).toHaveLength(1);
      const datedItem = result.items[0];
      if (datedItem.type === 'dated') {
        expect(datedItem.date).toBe('2025-01-28');
        expect(datedItem.timeSlots).toHaveLength(1);
      }
    });

    it('레거시 roles를 timeSlot 안에 포함한다', () => {
      const job = createMinimalJob({
        workDate: '2025-01-28',
        timeSlot: '18:00~02:00',
        roles: [
          { role: 'dealer', count: 3, filled: 0 },
          { role: 'floor', count: 2, filled: 0 },
        ],
      });
      const result = normalizeJobSchedule(job);
      const datedItem = result.items[0];
      if (datedItem.type === 'dated') {
        expect(datedItem.timeSlots[0].roles).toHaveLength(2);
      }
    });
  });

  describe('데이터 없는 공고', () => {
    it('workDate가 없으면 빈 dated 목록을 반환한다', () => {
      const job = createMinimalJob({
        workDate: '',
        roles: [],
      });
      const result = normalizeJobSchedule(job);
      expect(result.type).toBe('dated');
      expect(result.items).toEqual([]);
    });
  });
});
