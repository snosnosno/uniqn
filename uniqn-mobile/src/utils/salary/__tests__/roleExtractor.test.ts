/**
 * roleExtractor 테스트
 *
 * @description 공고 폼 데이터에서 역할 정보를 추출하는 유틸리티 테스트
 * - extractRolesFromPosting: 공고 타입별 역할 추출
 * - syncRolesWithExtracted: 추출된 역할과 기존 역할 동기화
 */

import { extractRolesFromPosting, syncRolesWithExtracted } from '../roleExtractor';
import type { ExtractedRole } from '../roleExtractor';
import type { FormRoleWithCount } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Mocks
// ============================================================================

// RoleResolver mock
jest.mock('@/shared/role', () => ({
  RoleResolver: {
    toDisplayName: jest.fn((name: string) => {
      const map: Record<string, string> = {
        dealer: '딜러',
        floor: '플로어',
        serving: '서빙',
        manager: '매니저',
        other: '기타',
      };
      return map[name] ?? name;
    }),
    toKey: jest.fn((name: string) => {
      const map: Record<string, string> = {
        딜러: 'dealer',
        플로어: 'floor',
        서빙: 'serving',
        매니저: 'manager',
        dealer: 'dealer',
        floor: 'floor',
        serving: 'serving',
        manager: 'manager',
        other: 'other',
      };
      return map[name] ?? name;
    }),
  },
}));

// ============================================================================
// extractRolesFromPosting
// ============================================================================

describe('extractRolesFromPosting', () => {
  describe('fixed 타입', () => {
    it('roles 배열을 직접 ExtractedRole로 변환한다', () => {
      const roles: FormRoleWithCount[] = [
        { name: '딜러', count: 3, salary: { type: 'hourly', amount: 15000 } },
        { name: '서빙', count: 2, salary: { type: 'daily', amount: 100000 } },
      ];

      const result = extractRolesFromPosting('fixed', roles);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: 'dealer',
        displayName: '딜러',
        count: 3,
        isCustom: false,
        existingSalary: { type: 'hourly', amount: 15000 },
      });
      expect(result[1]).toEqual({
        key: 'serving',
        displayName: '서빙',
        count: 2,
        isCustom: false,
        existingSalary: { type: 'daily', amount: 100000 },
      });
    });

    it('isCustom이 true인 역할을 보존한다', () => {
      const roles: FormRoleWithCount[] = [{ name: '조명담당', count: 1, isCustom: true }];

      const result = extractRolesFromPosting('fixed', roles);
      expect(result[0]!.isCustom).toBe(true);
    });

    it('빈 roles 배열이면 빈 배열을 반환한다', () => {
      const result = extractRolesFromPosting('fixed', []);
      expect(result).toEqual([]);
    });
  });

  describe('regular/urgent/tournament 타입', () => {
    it('dateSpecificRequirements에서 역할을 추출한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [
            {
              roles: [
                { role: 'dealer', headcount: 3 },
                { role: 'floor', headcount: 2 },
              ],
            },
          ],
        },
      ];

      const result = extractRolesFromPosting('regular', [], dateReqs);
      expect(result).toHaveLength(2);
      expect(result[0]!.key).toBe('dealer');
      expect(result[0]!.count).toBe(3);
      expect(result[1]!.key).toBe('floor');
      expect(result[1]!.count).toBe(2);
    });

    it('같은 역할이 여러 날짜/타임슬롯에 있으면 인원을 합산한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [{ role: 'dealer', headcount: 3 }] }],
        },
        {
          date: '2025-01-11',
          timeSlots: [{ roles: [{ role: 'dealer', headcount: 2 }] }],
        },
      ];

      const result = extractRolesFromPosting('regular', [], dateReqs);
      expect(result).toHaveLength(1);
      expect(result[0]!.key).toBe('dealer');
      expect(result[0]!.count).toBe(5);
    });

    it('커스텀 역할 (other + customRole)을 올바르게 추출한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [
            {
              roles: [{ role: 'other', customRole: '조명담당', headcount: 2 }],
            },
          ],
        },
      ];

      const result = extractRolesFromPosting('regular', [], dateReqs);
      expect(result).toHaveLength(1);
      expect(result[0]!.key).toBe('조명담당');
      expect(result[0]!.displayName).toBe('조명담당');
      expect(result[0]!.isCustom).toBe(true);
    });

    it('dateSpecificRequirements가 undefined이면 빈 배열을 반환한다', () => {
      const result = extractRolesFromPosting('regular', [], undefined);
      expect(result).toEqual([]);
    });

    it('빈 dateSpecificRequirements이면 빈 배열을 반환한다', () => {
      const result = extractRolesFromPosting('regular', [], []);
      expect(result).toEqual([]);
    });

    it('역할이 없는 타임슬롯은 무시한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [] }],
        },
      ];

      const result = extractRolesFromPosting('regular', [], dateReqs);
      expect(result).toEqual([]);
    });

    it('headcount가 undefined이면 0으로 취급한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [{ role: 'dealer' }] }],
        },
      ];

      const result = extractRolesFromPosting('regular', [], dateReqs);
      expect(result[0]!.count).toBe(0);
    });

    it('role이 undefined이면 dealer를 기본값으로 사용한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [{ headcount: 2 }] }],
        },
      ];

      const result = extractRolesFromPosting('regular', [], dateReqs);
      expect(result[0]!.key).toBe('dealer');
    });

    it('기존 급여 정보를 보존한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [
            {
              roles: [
                {
                  role: 'dealer',
                  headcount: 2,
                  salary: { type: 'hourly', amount: 15000 },
                },
              ],
            },
          ],
        },
      ];

      const result = extractRolesFromPosting('regular', [], dateReqs);
      expect(result[0]!.existingSalary).toEqual({ type: 'hourly', amount: 15000 });
    });

    it('urgent 타입도 dateSpecificRequirements에서 추출한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [{ role: 'dealer', headcount: 1 }] }],
        },
      ];

      const result = extractRolesFromPosting('urgent', [], dateReqs);
      expect(result).toHaveLength(1);
    });

    it('tournament 타입도 dateSpecificRequirements에서 추출한다', () => {
      const dateReqs: DateSpecificRequirement[] = [
        {
          date: '2025-01-10',
          timeSlots: [{ roles: [{ role: 'dealer', headcount: 5 }] }],
        },
      ];

      const result = extractRolesFromPosting('tournament', [], dateReqs);
      expect(result).toHaveLength(1);
      expect(result[0]!.count).toBe(5);
    });
  });
});

// ============================================================================
// syncRolesWithExtracted
// ============================================================================

describe('syncRolesWithExtracted', () => {
  it('변경이 없으면 null을 반환한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [{ name: '딜러', count: 3 }];

    const result = syncRolesWithExtracted(extracted, existing, false);
    expect(result).toBeNull();
  });

  it('새로운 역할이 추가되면 동기화된 배열을 반환한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
      { key: 'floor', displayName: '플로어', count: 2, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [{ name: '딜러', count: 3 }];

    const result = syncRolesWithExtracted(extracted, existing, false);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![1]!.name).toBe('플로어');
    expect(result![1]!.count).toBe(2);
  });

  it('삭제된 역할을 제거한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [
      { name: '딜러', count: 3 },
      { name: '플로어', count: 2 },
    ];

    const result = syncRolesWithExtracted(extracted, existing, false);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]!.name).toBe('딜러');
  });

  it('인원 변경을 감지하여 업데이트한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 5, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [{ name: '딜러', count: 3 }];

    const result = syncRolesWithExtracted(extracted, existing, false);
    expect(result).not.toBeNull();
    expect(result![0]!.count).toBe(5);
  });

  it('새 역할에 기존 급여 정보를 적용한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
      {
        key: 'floor',
        displayName: '플로어',
        count: 2,
        isCustom: false,
        existingSalary: { type: 'hourly', amount: 12000 },
      },
    ];
    const existing: FormRoleWithCount[] = [{ name: '딜러', count: 3 }];

    const result = syncRolesWithExtracted(extracted, existing, false);
    expect(result![1]!.salary).toEqual({ type: 'hourly', amount: 12000 });
  });

  it('useSameSalary=true일 때 첫 역할 급여를 새 역할에 복사한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
      { key: 'floor', displayName: '플로어', count: 2, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [
      { name: '딜러', count: 3, salary: { type: 'hourly', amount: 15000 } },
    ];

    const result = syncRolesWithExtracted(extracted, existing, true);
    expect(result![1]!.salary).toEqual({ type: 'hourly', amount: 15000 });
  });

  it('useSameSalary=false일 때 기본 급여를 설정한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
      { key: 'floor', displayName: '플로어', count: 2, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [
      { name: '딜러', count: 3, salary: { type: 'hourly', amount: 15000 } },
    ];

    const result = syncRolesWithExtracted(extracted, existing, false);
    expect(result![1]!.salary).toEqual({ type: 'hourly', amount: 0 });
  });

  it('existingSalary가 있으면 useSameSalary보다 우선한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
      {
        key: 'floor',
        displayName: '플로어',
        count: 2,
        isCustom: false,
        existingSalary: { type: 'daily', amount: 100000 },
      },
    ];
    const existing: FormRoleWithCount[] = [
      { name: '딜러', count: 3, salary: { type: 'hourly', amount: 15000 } },
    ];

    const result = syncRolesWithExtracted(extracted, existing, true);
    expect(result![1]!.salary).toEqual({ type: 'daily', amount: 100000 });
  });

  it('커스텀 역할의 isCustom 플래그를 보존한다', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
      { key: '조명담당', displayName: '조명담당', count: 1, isCustom: true },
    ];
    const existing: FormRoleWithCount[] = [{ name: '딜러', count: 3 }];

    const result = syncRolesWithExtracted(extracted, existing, false);
    expect(result![1]!.isCustom).toBe(true);
  });
});
