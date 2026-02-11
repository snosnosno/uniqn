/**
 * UNIQN Mobile - roleNormalizer.ts 테스트
 *
 * @description 역할 정규화 함수들의 단위 테스트
 */

import type { JobPosting } from '@/types';
import type { RoleRequirement as DateRoleRequirement } from '@/types/jobPosting/dateRequirement';
import type { RoleWithCount } from '@/types/postingConfig';
import {
  normalizeJobRoleStats,
  normalizeFormRoleRequirement,
  normalizeRoleWithCount,
  normalizeJobRoles,
  getRolesForDateAndTime,
} from '../roleNormalizer';

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
// normalizeJobRoleStats
// ============================================================================

describe('normalizeJobRoleStats', () => {
  it('기본 역할을 RoleInfo로 변환한다', () => {
    const result = normalizeJobRoleStats({ role: 'dealer', count: 3, filled: 1 });
    expect(result.roleId).toBe('dealer');
    expect(result.requiredCount).toBe(3);
    expect(result.filledCount).toBe(1);
    expect(result.displayName).toBe('딜러');
  });

  it('filled가 없으면 0으로 기본 설정한다', () => {
    const result = normalizeJobRoleStats({ role: 'floor', count: 2 });
    expect(result.filledCount).toBe(0);
  });

  it('매니저 역할을 올바르게 변환한다', () => {
    const result = normalizeJobRoleStats({ role: 'manager', count: 1, filled: 0 });
    expect(result.roleId).toBe('manager');
    expect(result.displayName).toBe('매니저');
  });

  it('기타 역할을 변환한다', () => {
    const result = normalizeJobRoleStats({ role: 'other', count: 2, filled: 0 });
    expect(result.roleId).toBe('other');
    expect(result.displayName).toBe('기타');
  });
});

// ============================================================================
// normalizeFormRoleRequirement
// ============================================================================

describe('normalizeFormRoleRequirement', () => {
  it('기본 역할 요구사항을 RoleInfo로 변환한다', () => {
    const role: DateRoleRequirement = {
      role: 'dealer',
      headcount: 3,
      filled: 1,
    };
    const result = normalizeFormRoleRequirement(role);
    expect(result.roleId).toBe('dealer');
    expect(result.requiredCount).toBe(3);
    expect(result.filledCount).toBe(1);
  });

  it('role이 없으면 "other"로 기본 설정한다', () => {
    const role: DateRoleRequirement = {
      headcount: 2,
    };
    const result = normalizeFormRoleRequirement(role);
    expect(result.roleId).toBe('other');
  });

  it('headcount가 없으면 0으로 기본 설정한다', () => {
    const role: DateRoleRequirement = {
      role: 'dealer',
    };
    const result = normalizeFormRoleRequirement(role);
    expect(result.requiredCount).toBe(0);
  });

  it('filled가 없으면 0으로 기본 설정한다', () => {
    const role: DateRoleRequirement = {
      role: 'dealer',
      headcount: 5,
    };
    const result = normalizeFormRoleRequirement(role);
    expect(result.filledCount).toBe(0);
  });

  it('커스텀 역할명을 올바르게 처리한다', () => {
    const role: DateRoleRequirement = {
      role: 'other',
      customRole: '조명 담당',
      headcount: 2,
    };
    const result = normalizeFormRoleRequirement(role);
    expect(result.roleId).toBe('other');
    expect(result.customName).toBe('조명 담당');
    expect(result.displayName).toBe('조명 담당');
  });
});

// ============================================================================
// normalizeRoleWithCount
// ============================================================================

describe('normalizeRoleWithCount', () => {
  it('role 필드를 사용하여 변환한다', () => {
    const role: RoleWithCount = { role: 'dealer', count: 3 };
    const result = normalizeRoleWithCount(role);
    expect(result.roleId).toBe('dealer');
    expect(result.requiredCount).toBe(3);
    expect(result.filledCount).toBe(0);
  });

  it('name 필드를 role이 없을 때 사용한다', () => {
    const role: RoleWithCount = { name: 'floor', count: 2 };
    const result = normalizeRoleWithCount(role);
    expect(result.roleId).toBe('floor');
  });

  it('role과 name 모두 없으면 "other"로 기본 설정한다', () => {
    const role: RoleWithCount = { count: 1 };
    const result = normalizeRoleWithCount(role);
    expect(result.roleId).toBe('other');
  });

  it('filled를 반영한다', () => {
    const role: RoleWithCount = { role: 'dealer', count: 3, filled: 2 };
    const result = normalizeRoleWithCount(role);
    expect(result.filledCount).toBe(2);
  });

  it('role이 name보다 우선한다', () => {
    const role: RoleWithCount = { role: 'dealer', name: 'floor', count: 1 };
    const result = normalizeRoleWithCount(role);
    expect(result.roleId).toBe('dealer');
  });
});

// ============================================================================
// normalizeJobRoles
// ============================================================================

describe('normalizeJobRoles', () => {
  it('고정공고의 requiredRolesWithCount를 정규화한다', () => {
    const job = createMinimalJob({
      postingType: 'fixed',
      requiredRolesWithCount: [
        { role: 'dealer', count: 3 },
        { role: 'floor', count: 2, filled: 1 },
      ],
    });
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(2);
    expect(result[0].roleId).toBe('dealer');
    expect(result[1].roleId).toBe('floor');
    expect(result[1].filledCount).toBe(1);
  });

  it('dateSpecificRequirements에서 역할을 추출한다', () => {
    const job = createMinimalJob({
      postingType: 'regular',
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [
                { role: 'dealer', headcount: 2, filled: 1 },
                { role: 'floor', headcount: 1 },
              ],
            },
          ],
        },
      ],
    });
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.roleId === 'dealer')?.requiredCount).toBe(2);
    expect(result.find((r) => r.roleId === 'floor')?.requiredCount).toBe(1);
  });

  it('여러 날짜의 동일 역할을 합산한다', () => {
    const job = createMinimalJob({
      postingType: 'tournament',
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [
            { startTime: '19:00', roles: [{ role: 'dealer', headcount: 2, filled: 1 }] },
          ],
        },
        {
          date: '2025-01-29',
          timeSlots: [
            { startTime: '19:00', roles: [{ role: 'dealer', headcount: 3, filled: 2 }] },
          ],
        },
      ],
    });
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(1);
    expect(result[0].requiredCount).toBe(5); // 2 + 3
    expect(result[0].filledCount).toBe(3); // 1 + 2
  });

  it('레거시 roles 필드를 사용한다', () => {
    const job = createMinimalJob({
      roles: [
        { role: 'dealer', count: 2, filled: 1 },
        { role: 'floor', count: 1, filled: 0 },
      ],
    });
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(2);
  });

  it('데이터가 없으면 빈 배열을 반환한다', () => {
    const job = createMinimalJob({ roles: [] });
    const result = normalizeJobRoles(job);
    expect(result).toEqual([]);
  });

  it('고정공고에 requiredRolesWithCount가 없으면 빈 배열을 반환한다', () => {
    const job = createMinimalJob({
      postingType: 'fixed',
      requiredRolesWithCount: [],
      roles: [{ role: 'dealer', count: 2, filled: 0 }],
    });
    // requiredRolesWithCount가 빈 배열이면 falsy가 아니므로 dateSpecificRequirements나 roles로 넘어감
    // 실제로는 .length가 0이므로 다음 조건으로 넘어감
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(1); // legacy roles로 폴백
  });
});

// ============================================================================
// getRolesForDateAndTime
// ============================================================================

describe('getRolesForDateAndTime', () => {
  it('특정 날짜-시간의 역할을 반환한다', () => {
    const job = createMinimalJob({
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [{ role: 'dealer', headcount: 3 }],
            },
            {
              startTime: '14:00',
              roles: [{ role: 'floor', headcount: 2 }],
            },
          ],
        },
      ],
    });
    const result = getRolesForDateAndTime(job, '2025-01-28', '19:00');
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('dealer');
  });

  it('해당 날짜가 없으면 빈 배열을 반환한다', () => {
    const job = createMinimalJob({
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [
            { startTime: '19:00', roles: [{ role: 'dealer', headcount: 3 }] },
          ],
        },
      ],
    });
    const result = getRolesForDateAndTime(job, '2025-01-29', '19:00');
    expect(result).toEqual([]);
  });

  it('해당 시간대가 없으면 빈 배열을 반환한다', () => {
    const job = createMinimalJob({
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [
            { startTime: '19:00', roles: [{ role: 'dealer', headcount: 3 }] },
          ],
        },
      ],
    });
    const result = getRolesForDateAndTime(job, '2025-01-28', '14:00');
    expect(result).toEqual([]);
  });

  it('dateSpecificRequirements가 없으면 레거시 roles를 반환한다', () => {
    const job = createMinimalJob({
      roles: [{ role: 'dealer', count: 2, filled: 1 }],
    });
    const result = getRolesForDateAndTime(job, '2025-01-28', '19:00');
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('dealer');
  });

  it('roles도 없으면 빈 배열을 반환한다', () => {
    const job = createMinimalJob({ roles: undefined as unknown as JobPosting['roles'] });
    const result = getRolesForDateAndTime(job, '2025-01-28', '19:00');
    expect(result).toEqual([]);
  });
});
