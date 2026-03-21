import { extractRolesFromPosting, syncRolesWithExtracted } from '../roleExtractor';
import type { ExtractedRole } from '../roleExtractor';
import type { FormRoleWithCount } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

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

describe('extractRolesFromPosting', () => {
  it('returns fixed roles directly', () => {
    const roles: FormRoleWithCount[] = [
      { name: '딜러', count: 3, salary: { type: 'hourly', amount: 15000 } },
      { name: '서빙', count: 2, salary: { type: 'daily', amount: 100000 } },
    ];

    expect(extractRolesFromPosting('fixed', roles)).toEqual([
      {
        key: 'dealer',
        displayName: '딜러',
        count: 3,
        isCustom: false,
        existingSalary: { type: 'hourly', amount: 15000 },
      },
      {
        key: 'serving',
        displayName: '서빙',
        count: 2,
        isCustom: false,
        existingSalary: { type: 'daily', amount: 100000 },
      },
    ]);
  });

  it('uses the first populated dated requirement as the seed source', () => {
    const requirements: DateSpecificRequirement[] = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{ role: 'dealer', headcount: 2 }] }],
      },
      {
        date: '2025-01-11',
        timeSlots: [{ roles: [{ role: 'dealer', headcount: 5 }] }],
      },
    ];

    expect(extractRolesFromPosting('regular', [], requirements)).toEqual([
      {
        key: 'dealer',
        displayName: '딜러',
        count: 2,
        isCustom: false,
        existingSalary: undefined,
      },
    ]);
  });

  it('aggregates multiple time slots inside the same seed date', () => {
    const requirements: DateSpecificRequirement[] = [
      {
        date: '2025-01-10',
        timeSlots: [
          { roles: [{ role: 'dealer', headcount: 2 }] },
          {
            roles: [
              { role: 'dealer', headcount: 1 },
              { role: 'floor', headcount: 3 },
            ],
          },
        ],
      },
      {
        date: '2025-01-11',
        timeSlots: [{ roles: [{ role: 'dealer', headcount: 9 }] }],
      },
    ];

    expect(extractRolesFromPosting('regular', [], requirements)).toEqual([
      {
        key: 'dealer',
        displayName: '딜러',
        count: 3,
        isCustom: false,
        existingSalary: undefined,
      },
      {
        key: 'floor',
        displayName: '플로어',
        count: 3,
        isCustom: false,
        existingSalary: undefined,
      },
    ]);
  });

  it('keeps roles that only exist on later dates without inflating seed counts', () => {
    const requirements: DateSpecificRequirement[] = [
      {
        date: '2025-01-10',
        timeSlots: [{ roles: [{ role: 'dealer', headcount: 2 }] }],
      },
      {
        date: '2025-01-11',
        timeSlots: [
          {
            roles: [
              { role: 'dealer', headcount: 9 },
              {
                role: 'other',
                customRole: '조명',
                headcount: 1,
                salary: { type: 'daily', amount: 95000 },
              },
            ],
          },
        ],
      },
    ];

    expect(extractRolesFromPosting('regular', [], requirements)).toEqual([
      {
        key: 'dealer',
        displayName: '딜러',
        count: 2,
        isCustom: false,
        existingSalary: undefined,
      },
      {
        key: '조명',
        displayName: '조명',
        count: 1,
        isCustom: true,
        existingSalary: { type: 'daily', amount: 95000 },
      },
    ]);
  });

  it('preserves custom roles and salary from the seed requirement', () => {
    const requirements: DateSpecificRequirement[] = [
      {
        date: '2025-01-10',
        timeSlots: [
          {
            roles: [
              {
                role: 'other',
                customRole: '조명',
                headcount: 2,
                salary: { type: 'daily', amount: 90000 },
              },
            ],
          },
        ],
      },
    ];

    expect(extractRolesFromPosting('regular', [], requirements)).toEqual([
      {
        key: '조명',
        displayName: '조명',
        count: 2,
        isCustom: true,
        existingSalary: { type: 'daily', amount: 90000 },
      },
    ]);
  });

  it('returns an empty array when there is no populated dated requirement', () => {
    expect(extractRolesFromPosting('regular', [], [])).toEqual([]);
    expect(extractRolesFromPosting('regular', [], undefined)).toEqual([]);
  });
});

describe('syncRolesWithExtracted', () => {
  it('returns null when nothing changed', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [{ name: '딜러', count: 3 }];

    expect(syncRolesWithExtracted(extracted, existing, false)).toBeNull();
  });

  it('adds new roles and copies existing salary when requested', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 3, isCustom: false },
      { key: 'floor', displayName: '플로어', count: 2, isCustom: false },
    ];
    const existing: FormRoleWithCount[] = [
      { name: '딜러', count: 3, salary: { type: 'hourly', amount: 15000 } },
    ];

    expect(syncRolesWithExtracted(extracted, existing, true)).toEqual([
      { name: '딜러', count: 3, salary: { type: 'hourly', amount: 15000 } },
      {
        name: '플로어',
        count: 2,
        isCustom: false,
        salary: { type: 'hourly', amount: 15000 },
      },
    ]);
  });

  it('updates counts and preserves explicit extracted salary', () => {
    const extracted: ExtractedRole[] = [
      { key: 'dealer', displayName: '딜러', count: 5, isCustom: false },
      {
        key: '조명',
        displayName: '조명',
        count: 1,
        isCustom: true,
        existingSalary: { type: 'daily', amount: 100000 },
      },
    ];
    const existing: FormRoleWithCount[] = [{ name: '딜러', count: 3 }];

    expect(syncRolesWithExtracted(extracted, existing, false)).toEqual([
      { name: '딜러', count: 5 },
      {
        name: '조명',
        count: 1,
        isCustom: true,
        salary: { type: 'daily', amount: 100000 },
      },
    ]);
  });
});
