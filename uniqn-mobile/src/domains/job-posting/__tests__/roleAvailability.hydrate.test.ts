/**
 * S3 — 역할별 remaining 실카운트 hydrate 회귀 테스트.
 *
 * @description aggregateRoleFilledFromSubmap(순수 합산)과 selectPostingRoleAvailability의
 * filledByRole 주입 유/무 분기를 고정한다. 지원(apply) 게이트는 옵션을 주입하지 않아
 * 기존 dead counter 동작이 보존됨을 함께 확인.
 */
import type { JobPosting } from '@/types';
import {
  aggregateRoleFilledFromSubmap,
  selectPostingRoleAvailability,
} from '@/domains/job-posting';

function createDatedPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: '역할 실카운트 테스트',
    status: 'active',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    workDate: '2026-07-20',
    workDates: ['2026-07-20'],
    totalPositions: 3,
    filledPositions: 0,
    location: {
      name: 'Seoul',
      district: 'Gangnam',
      detailedAddress: '101',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-07-20',
      allDates: ['2026-07-20'],
      requirements: [
        {
          date: '2026-07-20',
          timeSlots: [
            {
              id: 'slot-1',
              startTime: '14:00',
              roles: [
                { id: 'dealer-1', role: 'dealer', count: 2 },
                { id: 'other-1', role: 'other', customRole: '플로어장', count: 1 },
              ],
            },
          ],
        },
      ],
    },
    roleCatalog: [
      { role: 'dealer', salary: { type: 'hourly', amount: 12000 } },
      { role: 'other', customRole: '플로어장', salary: { type: 'hourly', amount: 15000 } },
    ],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
    },
    questions: {
      items: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('aggregateRoleFilledFromSubmap', () => {
  it('undefined/빈 서브맵은 빈 객체를 반환한다', () => {
    expect(aggregateRoleFilledFromSubmap(undefined)).toEqual({});
    expect(aggregateRoleFilledFromSubmap(new Map())).toEqual({});
  });

  it('여러 날짜·슬롯의 같은 역할을 역할키별로 합산한다', () => {
    const submap = new Map<string, number>([
      ['2026-07-20__14:00__dealer', 1],
      ['2026-07-21__14:00__dealer', 2],
      ['2026-07-20__20:00__dealer', 1],
    ]);

    expect(aggregateRoleFilledFromSubmap(submap)).toEqual({ dealer: 4 });
  });

  it('other 커스텀 역할키(other:<custom>)의 접두를 보존해 합산한다', () => {
    const submap = new Map<string, number>([
      ['2026-07-20__14:00__dealer', 2],
      ['2026-07-20__14:00__other:플로어장', 1],
      ['2026-07-21__14:00__other:플로어장', 1],
    ]);

    expect(aggregateRoleFilledFromSubmap(submap)).toEqual({
      dealer: 2,
      'other:플로어장': 2,
    });
  });

  it('세그먼트가 부족한 잘못된 키는 무시한다', () => {
    const submap = new Map<string, number>([
      ['broken-key', 5],
      ['2026-07-20__14:00__dealer', 3],
    ]);

    expect(aggregateRoleFilledFromSubmap(submap)).toEqual({ dealer: 3 });
  });
});

describe('selectPostingRoleAvailability hydrate 분기', () => {
  it('filledByRole 미주입 시 dead counter(filled=0)로 전 역할 여유를 유지한다', () => {
    const posting = createDatedPosting();
    const availability = selectPostingRoleAvailability(posting);

    expect(availability.hasAvailableRoles).toBe(true);
    expect(availability.items).toHaveLength(2);
    availability.items.forEach((item) => {
      expect(item.filled).toBe(0);
      expect(item.remaining).toBe(item.count);
      expect(item.isAvailable).toBe(true);
    });
  });

  it('filledByRole 주입 시 실확정 수로 remaining/isAvailable을 계산한다', () => {
    const posting = createDatedPosting();
    const availability = selectPostingRoleAvailability(posting, {
      filledByRole: { dealer: 2, 'other:플로어장': 0 },
    });

    const dealer = availability.items.find((item) => item.role === 'dealer');
    const floor = availability.items.find((item) => item.role === 'other');

    expect(dealer).toMatchObject({ count: 2, filled: 2, remaining: 0, isAvailable: false });
    expect(floor).toMatchObject({ count: 1, filled: 0, remaining: 1, isAvailable: true });
    expect(availability.filledCount).toBe(2);
    expect(availability.remainingCount).toBe(1);
    expect(availability.hasAvailableRoles).toBe(true);
  });

  it('부분 hydrate — 조회 키에 없는 역할은 0으로 채워 여유로 남긴다', () => {
    const posting = createDatedPosting();
    const availability = selectPostingRoleAvailability(posting, {
      filledByRole: { dealer: 2 },
    });

    const floor = availability.items.find((item) => item.role === 'other');
    expect(floor).toMatchObject({ filled: 0, remaining: 1, isAvailable: true });
  });

  it('bare other(customRole 없음)도 DB 키(other:)로 정합 조회한다', () => {
    // DB `_posting_role_key` 는 bare other 를 'other:'(콜론 포함)로 내므로 조회 키도 콜론 형식이어야 한다
    const posting = createDatedPosting({
      schedule: {
        kind: 'dated',
        primaryDate: '2026-07-20',
        allDates: ['2026-07-20'],
        requirements: [
          {
            date: '2026-07-20',
            timeSlots: [
              {
                id: 'slot-1',
                startTime: '14:00',
                roles: [{ id: 'other-bare', role: 'other', count: 1 }],
              },
            ],
          },
        ],
      },
    });

    const availability = selectPostingRoleAvailability(posting, {
      filledByRole: { 'other:': 1 },
    });

    expect(availability.items[0]).toMatchObject({ filled: 1, remaining: 0, isAvailable: false });
  });

  it('모든 역할이 마감이면 hasAvailableRoles가 false가 된다', () => {
    const posting = createDatedPosting();
    const availability = selectPostingRoleAvailability(posting, {
      filledByRole: { dealer: 2, 'other:플로어장': 1 },
    });

    expect(availability.hasAvailableRoles).toBe(false);
    expect(availability.availableItems).toHaveLength(0);
  });
});
