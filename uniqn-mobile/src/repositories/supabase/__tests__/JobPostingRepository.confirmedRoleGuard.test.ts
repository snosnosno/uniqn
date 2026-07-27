/**
 * updateWithTransaction — 확정 스태프 보호 가드의 **범위** 고정.
 *
 * @description 옛 계약은 확정자가 1명이라도 있으면 schedule·roleCatalog 변경 전체를 막았다.
 *   그 넓은 잠금은 근거가 없었다(실측): total_positions·capacity_full 전이는 DB 트리거가
 *   자동 재계산하고, 기존 work_logs 는 date/time_slot/role 사본을 들고 있어 편집 영향을 받지
 *   않으며, 변경 통지도 트리거가 보낸다. 반면 정산은 JIT 라 **확정자가 배정된 역할이 스케줄에서
 *   사라지면** 단가표 매칭이 실패해 기본 단가로 조용히 떨어진다 — 지금은 그 한 축만 막는다.
 *
 *   이 스위트는 "막아야 할 것"보다 **"막지 말아야 할 것"**을 주로 고정한다. 잠금이 다시 넓어지면
 *   증원·날짜 추가가 조용히 저장되지 않는 회귀가 나기 때문이다.
 */
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { ERROR_CODES } from '@/errors/AppError';
import type { PostingSchedule, UpdateJobPostingInput } from '@/types';

const mockUpdate = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (...a: unknown[]) => {
        mockUpdate(...a);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    }),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

const mockLoadMutate = jest.fn();
const mockLoadRoleKeys = jest.fn();
jest.mock('../JobPostingRepositoryHelpers', () => ({
  ...jest.requireActual('../JobPostingRepositoryHelpers'),
  loadAndVerifyMutateAccess: (...args: unknown[]) => mockLoadMutate(...args),
  loadActiveWorkLogRoleKeys: (...args: unknown[]) => mockLoadRoleKeys(...args),
  // 직렬화 결과의 canonical 검증은 이 스위트의 관심사가 아니다(가드 범위만 본다).
  assertCanonical: (doc: unknown) => doc,
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const POSTING = '55555555-5555-4555-8555-555555555555';

/** 딜러 2명 1슬롯짜리 기존 공고. */
const currentSchedule: PostingSchedule = {
  kind: 'dated',
  primaryDate: '2026-08-01',
  allDates: ['2026-08-01'],
  requirements: [
    {
      date: '2026-08-01',
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
    },
  ],
};

function currentPosting() {
  return {
    id: POSTING,
    ownerId: OWNER,
    ownerName: 'Owner',
    postingType: 'regular',
    title: '주말 딜러 구합니다',
    status: 'active',
    location: { name: '강남' },
    schedule: currentSchedule,
    roleCatalog: [{ role: 'dealer' }],
    compensation: { mode: 'shared' },
    questions: { items: [] },
    filledPositions: 2,
    totalPositions: 2,
    viewCount: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

/** currentSchedule 을 변형한 새 스케줄 — 헬퍼로 만들어 각 케이스의 차이만 드러낸다. */
function scheduleWith(
  roles: { role: string; count: number; customRole?: string }[],
  dates: string[] = ['2026-08-01']
): PostingSchedule {
  return {
    kind: 'dated',
    primaryDate: dates[0]!,
    allDates: dates,
    requirements: dates.map((date) => ({
      date,
      timeSlots: [{ startTime: '19:00', roles }],
    })),
  } as PostingSchedule;
}

beforeEach(() => {
  mockUpdate.mockClear();
  mockLoadMutate.mockReset();
  mockLoadMutate.mockResolvedValue(currentPosting());
  mockLoadRoleKeys.mockReset();
  // 확정 근무 2건 모두 dealer.
  mockLoadRoleKeys.mockResolvedValue(new Set(['dealer']));
});

describe('확정 스태프가 있어도 허용되는 편집', () => {
  const repo = new SupabaseJobPostingRepository();

  it.each([
    ['인원 증원(2 → 5)', { schedule: scheduleWith([{ role: 'dealer', count: 5 }]) }],
    [
      '날짜 추가',
      { schedule: scheduleWith([{ role: 'dealer', count: 2 }], ['2026-08-01', '2026-08-02']) },
    ],
    [
      '역할 추가(딜러 유지 + 플로어 신설)',
      {
        schedule: scheduleWith([
          { role: 'dealer', count: 2 },
          { role: 'floor', count: 1 },
        ]),
        roleCatalog: [{ role: 'dealer' }, { role: 'floor' }],
      },
    ],
    ['인원 감축(2 → 1, 역할은 유지)', { schedule: scheduleWith([{ role: 'dealer', count: 1 }]) }],
  ])('%s 은 저장된다', async (_label, patch) => {
    await repo.updateWithTransaction(POSTING, patch as UpdateJobPostingInput, OWNER);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('스케줄을 건드리지 않는 수정은 work_logs 조회조차 하지 않는다', async () => {
    await repo.updateWithTransaction(POSTING, { title: '제목만 변경' }, OWNER);
    expect(mockLoadRoleKeys).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('확정 근무가 없으면 역할을 통째로 갈아치워도 저장된다', async () => {
    mockLoadRoleKeys.mockResolvedValue(new Set<string>());
    await repo.updateWithTransaction(
      POSTING,
      { schedule: scheduleWith([{ role: 'serving', count: 3 }]) } as UpdateJobPostingInput,
      OWNER
    );
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('확정 스태프가 배정된 역할의 소멸만 차단', () => {
  const repo = new SupabaseJobPostingRepository();

  it('dealer 확정이 있는데 스케줄에서 dealer 를 빼면 거부한다', async () => {
    await expect(
      repo.updateWithTransaction(
        POSTING,
        { schedule: scheduleWith([{ role: 'floor', count: 2 }]) } as UpdateJobPostingInput,
        OWNER
      )
    ).rejects.toMatchObject({ code: ERROR_CODES.BUSINESS_INVALID_STATE });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('커스텀 역할(other)도 customRole 키로 판정한다', async () => {
    // 정산 단가표 매칭(getRoleSalaryFromRoles)이 other 를 customRole 로 해소하므로 가드도 같은 키를 쓴다.
    mockLoadRoleKeys.mockResolvedValue(new Set(['바텐더']));
    await expect(
      repo.updateWithTransaction(
        POSTING,
        {
          schedule: scheduleWith([{ role: 'other', count: 1, customRole: '주차요원' }]),
        } as UpdateJobPostingInput,
        OWNER
      )
    ).rejects.toMatchObject({ code: ERROR_CODES.BUSINESS_INVALID_STATE });

    mockUpdate.mockClear();
    await repo.updateWithTransaction(
      POSTING,
      {
        schedule: scheduleWith([{ role: 'other', count: 1, customRole: '바텐더' }]),
      } as UpdateJobPostingInput,
      OWNER
    );
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('거부 메시지에 사라진 역할의 한글 표시명이 들어간다', async () => {
    await expect(
      repo.updateWithTransaction(
        POSTING,
        { schedule: scheduleWith([{ role: 'floor', count: 2 }]) } as UpdateJobPostingInput,
        OWNER
      )
    ).rejects.toMatchObject({ userMessage: expect.stringContaining('딜러') });
  });
});
