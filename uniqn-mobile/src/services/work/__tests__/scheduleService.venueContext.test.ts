/**
 * scheduleService — 컨테이너 2차 해소(지점 표시 정보 + 역할 단가) 회귀 스위트
 *
 * 근무표 직접배치 work_log 는 job_posting_id 가 지점 컨테이너를 가리키는데, 스태프는 RLS 로
 * 컨테이너를 직접 못 읽는다. 그래서 SECDEF RPC 2종이 유일 경로다:
 *   - get_my_venue_contexts       → 지점명·장소 (지점당 1행 보장)
 *   - get_my_venue_role_salaries  → 역할별 단가 (CROSS JOIN LATERAL — 단가표가 비면 0행)
 *
 * 이 스위트가 지키는 것은 **부분 실패 내성**이다. 두 RPC 중 하나가 죽어도 나머지는 살아야 하고,
 * 행 집합이 서로 달라도(단가 미설정 지점은 salaries 에만 없다) 누락이 생기면 안 된다.
 * 그래서 서비스는 두 결과의 **키 합집합**으로 순회한다 — 한쪽만 기준으로 삼으면 조용히 샌다.
 */
import type { WorkLog } from '@/types';

import { getMySchedules } from '../scheduleService';
import { logger } from '@/utils/logger';

// 반환형을 명시한다 — 빈 배열 리터럴에서 추론시키면 Promise<never[]> 로 굳어
// mockImplementation 에 실제 픽스처를 넣는 순간 tsc 가 거부한다.
const mockGetByIdBatch = jest.fn((..._args: unknown[]): Promise<unknown[]> => Promise.resolve([]));
const mockGetMyVenueRoleSalaries = jest.fn((..._args: unknown[]) => Promise.resolve(new Map()));
const mockGetMyVenueContexts = jest.fn((..._args: unknown[]) => Promise.resolve(new Map()));
const mockGetByStaffIdWithFilters = jest.fn(
  (..._args: unknown[]): Promise<WorkLog[]> => Promise.resolve([])
);

jest.mock('@/repositories', () => ({
  workLogRepository: {
    getByStaffIdWithFilters: (...args: unknown[]) => mockGetByStaffIdWithFilters(...args),
    getById: jest.fn(),
    subscribeByStaffId: jest.fn(),
  },
  applicationRepository: {
    getByApplicantIdWithStatuses: jest.fn(() => Promise.resolve([])),
    subscribeByApplicantIdWithStatuses: jest.fn(),
  },
  jobPostingRepository: {
    getById: jest.fn(),
    getByIdBatch: (...args: unknown[]) => mockGetByIdBatch(...args),
    getMyVenueRoleSalaries: (...args: unknown[]) => mockGetMyVenueRoleSalaries(...args),
    getMyVenueContexts: (...args: unknown[]) => mockGetMyVenueContexts(...args),
  },
}));

// 변환은 실물을 쓴다 — 이 스위트의 관심사가 "어떤 컨텍스트가 실려 나가는가" 이기 때문이다.
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const CONTAINER_ID = 'venue-1';

const containerWorkLog = {
  id: 'wl-1',
  jobPostingId: CONTAINER_ID,
  staffId: 'staff-1',
  date: '2026-08-01',
  role: 'dealer',
  status: 'scheduled',
  timeSlot: '19:00',
} as unknown as WorkLog;

const venueContext = {
  title: '홀덤펍 강남점',
  location: { name: '강남역 2번 출구' },
  contactPhone: '02-123-4567',
  description: '역삼역 도보 2분',
  ownerName: '김사장',
};

const roleSalaries = [{ role: 'dealer', salary: { type: 'hourly' as const, amount: 20000 } }];

async function firstSchedule() {
  const result = await getMySchedules('staff-1');
  return result.schedules[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetByIdBatch.mockImplementation(() => Promise.resolve([]));
  mockGetByStaffIdWithFilters.mockImplementation(() => Promise.resolve([containerWorkLog]));
  mockGetMyVenueContexts.mockImplementation(() => Promise.resolve(new Map()));
  mockGetMyVenueRoleSalaries.mockImplementation(() => Promise.resolve(new Map()));
});

describe('컨테이너 2차 해소 — 두 RPC 조합 4가지', () => {
  it('둘 다 성공: 지점명·장소가 실리고 급여도 지점 단가로 계산된다', async () => {
    mockGetMyVenueContexts.mockImplementation(() =>
      Promise.resolve(new Map([[CONTAINER_ID, venueContext]]))
    );
    mockGetMyVenueRoleSalaries.mockImplementation(() =>
      Promise.resolve(new Map([[CONTAINER_ID, roleSalaries]]))
    );

    const schedule = await firstSchedule();
    expect(schedule?.jobPostingName).toBe('홀덤펍 강남점');
    expect(schedule?.location).toBe('강남역 2번 출구');
  });

  // 🔴 이 RPC 를 별도로 만든 이유. salaries 는 LATERAL 이라 단가표가 비면 0행이라서,
  //    salaries 만 기준으로 순회하면 단가 미설정 신규 지점은 이름조차 못 받는다.
  it('단가표가 비어 있어도(salaries 0행) 지점명·장소는 실린다', async () => {
    mockGetMyVenueContexts.mockImplementation(() =>
      Promise.resolve(new Map([[CONTAINER_ID, venueContext]]))
    );

    const schedule = await firstSchedule();
    expect(schedule?.jobPostingName).toBe('홀덤펍 강남점');
    expect(schedule?.location).toBe('강남역 2번 출구');
  });

  // 회귀 방어: 표시 정보 RPC 가 죽어도 종전(#6) 동작 — 단가 주입 — 은 살아 있어야 한다.
  it('contexts 만 실패: 종전대로 이벤트로 폴백하되 단가 해소는 유지된다', async () => {
    mockGetMyVenueContexts.mockImplementation(() => Promise.reject(new Error('rpc down')));
    mockGetMyVenueRoleSalaries.mockImplementation(() =>
      Promise.resolve(new Map([[CONTAINER_ID, roleSalaries]]))
    );

    const schedule = await firstSchedule();
    expect(schedule?.jobPostingName).toBe('이벤트');
    expect(logger.warn).toHaveBeenCalledWith(
      '지점 표시 정보 조회 실패 — 지점명 폴백 유지',
      expect.anything()
    );
  });

  it('salaries 만 실패: 지점명·장소는 보이고 급여만 기본 단가로 폴백한다', async () => {
    mockGetMyVenueContexts.mockImplementation(() =>
      Promise.resolve(new Map([[CONTAINER_ID, venueContext]]))
    );
    mockGetMyVenueRoleSalaries.mockImplementation(() => Promise.reject(new Error('rpc down')));

    const schedule = await firstSchedule();
    expect(schedule?.jobPostingName).toBe('홀덤펍 강남점');
    expect(logger.warn).toHaveBeenCalledWith(
      '컨테이너 역할 단가 2차 해소 실패 — 기본 단가 폴백 유지',
      expect.anything()
    );
  });

  it('둘 다 실패: 종전 폴백(이벤트/빈 장소)으로 내려가고 예외는 새어 나가지 않는다', async () => {
    mockGetMyVenueContexts.mockImplementation(() => Promise.reject(new Error('rpc down')));
    mockGetMyVenueRoleSalaries.mockImplementation(() => Promise.reject(new Error('rpc down')));

    const schedule = await firstSchedule();
    expect(schedule?.jobPostingName).toBe('이벤트');
    expect(schedule?.location).toBe('');
  });

  it('컨테이너가 없으면 두 RPC 를 아예 호출하지 않는다(불필요한 왕복 금지)', async () => {
    // 일반 공고로 해소되는 경우 — compensation 은 getPostingSettlementContext 가 반드시 읽는다.
    mockGetByIdBatch.mockImplementation(() =>
      Promise.resolve([
        {
          id: CONTAINER_ID,
          title: '일반 공고',
          location: { name: '서울' },
          status: 'active',
          schedule: { requirements: [] },
          roleCatalog: [],
          compensation: { allowances: [], defaultSalary: { type: 'hourly', amount: 15000 } },
        },
      ])
    );

    await getMySchedules('staff-1');
    expect(mockGetMyVenueContexts).not.toHaveBeenCalled();
    expect(mockGetMyVenueRoleSalaries).not.toHaveBeenCalled();
  });
});
