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

function createMinimalJobLegacy(overrides: Partial<JobPosting> = {}): JobPosting {
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
void createMinimalJobLegacy;

type LegacyDateRequirement = {
  date: string;
  timeSlots: {
    startTime?: string;
    roles: {
      role?: string;
      customRole?: string;
      headcount?: number;
      filled?: number;
    }[];
  }[];
};

type LegacyRoleRequirement = {
  role?: string;
  customRole?: string;
  count: number;
  filled?: number;
};

type TestJobOverrides = Partial<JobPosting> & {
  dateSpecificRequirements?: LegacyDateRequirement[];
  requiredRolesWithCount?: LegacyRoleRequirement[];
  roles?: LegacyRoleRequirement[];
  timeSlot?: string;
};

function createMinimalJob(overrides: TestJobOverrides = {}): JobPosting {
  const workDate =
    overrides.workDate ?? overrides.dateSpecificRequirements?.[0]?.date ?? '2025-01-28';
  const datedRequirements = (overrides.dateSpecificRequirements ?? []).map((requirement) => ({
    date: requirement.date,
    timeSlots: requirement.timeSlots.map((slot, slotIndex) => ({
      id: `slot-${slotIndex}`,
      startTime: slot.startTime,
      roles: slot.roles.map((role, roleIndex) => ({
        id: `role-${roleIndex}`,
        role: role.role ?? 'dealer',
        customRole: role.customRole,
        count: role.headcount ?? 0,
        filled: role.filled ?? 0,
      })),
    })),
  }));

  const fixedRoles = (overrides.requiredRolesWithCount ?? []).map((role) => ({
    role: role.role ?? ('dealer' as const),
    customRole: role.customRole,
    count: role.count,
    filled: role.filled ?? 0,
  }));

  const schedule =
    overrides.postingType === 'fixed'
      ? {
          kind: 'fixed' as const,
          requirements: [
            {
              date: null as null,
              timeSlots: [
                {
                  id: 'slot-fixed-0',
                  startTime: undefined as string | undefined,
                  isTimeToBeAnnounced: false,
                  roles: fixedRoles,
                },
              ],
            },
          ],
        }
      : {
          kind: 'dated' as const,
          primaryDate: workDate,
          allDates: datedRequirements.map((requirement) => requirement.date),
          requirements: datedRequirements,
        };

  const roleCatalogSource =
    overrides.requiredRolesWithCount ??
    overrides.dateSpecificRequirements?.flatMap((requirement) =>
      requirement.timeSlots.flatMap((slot) =>
        slot.roles.map((role) => ({
          role: role.role ?? 'dealer',
          customRole: role.customRole,
        }))
      )
    ) ??
    [];

  return {
    id: 'job-1',
    schemaVersion: 3,
    title: 'Test Posting',
    status: 'active',
    location: overrides.location ?? { name: 'Gangnam', district: 'Seoul' },
    workDate,
    /*
    title: '?뚯뒪??怨듦퀬',
    status: 'active',
    location: overrides.location ?? { name: '媛뺣궓援?, district: '媛뺣궓援? },
    workDate,
    */
    totalPositions: overrides.totalPositions ?? 0,
    filledPositions: overrides.filledPositions ?? 0,
    ownerId: overrides.ownerId ?? 'owner-1',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    schedule,
    roleCatalog: roleCatalogSource.map((role) => ({
      role: role.role ?? 'dealer',
      customRole: role.customRole,
    })),
    compensation: overrides.compensation ?? { mode: 'shared' },
    questions: overrides.questions ?? { items: [] },
    postingType: overrides.postingType,
  } as JobPosting;
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
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 2, filled: 1 }] }],
        },
        {
          date: '2025-01-29',
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 3, filled: 2 }] }],
        },
      ],
    });
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(1);
    expect(result[0].requiredCount).toBe(5); // 2 + 3
    expect(result[0].filledCount).toBe(3); // 1 + 2
  });

  it('customRole이 다르면 other 역할도 별도로 집계한다', () => {
    const job = createMinimalJob({
      postingType: 'tournament',
      dateSpecificRequirements: [
        {
          date: '2025-01-28',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [{ role: 'other', customRole: '조명 담당', headcount: 2, filled: 1 }],
            },
          ],
        },
        {
          date: '2025-01-29',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [{ role: 'other', customRole: '사회자', headcount: 3, filled: 2 }],
            },
          ],
        },
      ],
    });
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(2);
    expect(result.find((role) => role.customName === '조명 담당')?.requiredCount).toBe(2);
    expect(result.find((role) => role.customName === '사회자')?.requiredCount).toBe(3);
  });

  it('레거시 roles 필드만 있으면 빈 배열을 반환한다 (폴백 제거됨)', () => {
    const job = createMinimalJob({
      roles: [
        { role: 'dealer', count: 2, filled: 1 },
        { role: 'floor', count: 1, filled: 0 },
      ],
    });
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(0);
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
    // requiredRolesWithCount가 빈 배열이면 falsy가 아니므로 dateSpecificRequirements로 넘어감
    // roles 폴백이 제거되었으므로 빈 배열 반환
    const result = normalizeJobRoles(job);
    expect(result).toHaveLength(0);
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
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 3 }] }],
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
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', headcount: 3 }] }],
        },
      ],
    });
    const result = getRolesForDateAndTime(job, '2025-01-28', '14:00');
    expect(result).toEqual([]);
  });

  it('dateSpecificRequirements가 없으면 빈 배열을 반환한다', () => {
    const job = createMinimalJob({
      roles: [{ role: 'dealer', count: 2, filled: 1 }],
    });
    const result = getRolesForDateAndTime(job, '2025-01-28', '19:00');
    expect(result).toEqual([]);
  });

  it('roles도 없으면 빈 배열을 반환한다', () => {
    const job = createMinimalJob({ roles: undefined });
    const result = getRolesForDateAndTime(job, '2025-01-28', '19:00');
    expect(result).toEqual([]);
  });
});
