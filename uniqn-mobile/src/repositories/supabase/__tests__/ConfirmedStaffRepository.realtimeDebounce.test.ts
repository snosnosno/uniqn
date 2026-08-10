/**
 * realtime 구독이 행 변경마다 전체 재조회를 하지 않는가 (감사 realtime-02)
 *
 * @description 구독 콜백은 **행 하나당 한 번** 온다. 이 리포지토리는 그때마다
 *   `getByJobPostingId` 로 전체 목록을 다시 읽었기 때문에, 근무표 일괄 수정처럼
 *   한 번의 사용자 행동이 N 개 행을 건드리면 그대로 N 회의 전체 조회로 증폭됐다.
 *
 *   여기서 고정하는 계약은 두 가지다:
 *   1. 창 안의 버스트는 **초기 1회 + 리딩 1회 + 트레일링 1회** 로 접힌다(N 에 무관).
 *   2. 구독 해제 시 대기 중이던 트레일링은 **버려진다** — 안 그러면 이미 화면을 떠난
 *      소비자에게 갱신이 한 번 더 도착한다.
 *
 * 🔗 병합 창 자체의 의미론은 `src/utils/__tests__/debounce.test.ts` 가 본다.
 *    이 파일은 **배선**만 본다.
 */

import { SupabaseConfirmedStaffRepository } from '../ConfirmedStaffRepository';

type RealtimeHandler = (payload: unknown) => void;

let capturedHandler: RealtimeHandler | null = null;
const mockUnsubscribe = jest.fn();
const mockCreateRealtimeSubscription = jest.fn(
  (_table: string, _filter: string | undefined, handler: RealtimeHandler) => {
    capturedHandler = handler;
    return mockUnsubscribe;
  }
);

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/react-native', () => ({ __esModule: true, addBreadcrumb: jest.fn() }));

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    createRealtimeSubscription: (...args: unknown[]) =>
      mockCreateRealtimeSubscription(...(args as [string, string | undefined, RealtimeHandler])),
  };
});

describe('subscribeByJobPostingId — realtime 재조회 병합 배선', () => {
  let repository: SupabaseConfirmedStaffRepository;
  let getSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    capturedHandler = null;
    mockUnsubscribe.mockClear();
    mockCreateRealtimeSubscription.mockClear();

    repository = new SupabaseConfirmedStaffRepository();
    getSpy = jest
      .spyOn(repository, 'getByJobPostingId')
      .mockResolvedValue([] as unknown as Awaited<ReturnType<typeof repository.getByJobPostingId>>);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    getSpy.mockRestore();
  });

  it('구독 즉시 초기 1회를 조회한다 (빈 화면 탈출 계약 유지)', () => {
    repository.subscribeByJobPostingId('job-1', { onUpdate: jest.fn() });

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledWith('job-1');
  });

  it('버스트 20건이 전체 재조회 20회가 아니라 2회로 접힌다', () => {
    repository.subscribeByJobPostingId('job-1', { onUpdate: jest.fn() });
    getSpy.mockClear(); // 초기 1회는 계약이므로 제외하고 변경분만 센다

    for (let i = 0; i < 20; i += 1) {
      capturedHandler?.({ eventType: 'UPDATE' });
    }

    // 리딩 1회만 나간 상태 — 나머지 19건은 창에 접혀 있다
    expect(getSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(300);

    // 트레일링 1회로 마감. 예전 구현이라면 여기서 20 이었다.
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('고립된 변경 1건은 지연 없이 즉시 반영된다 (실시간성 유지)', () => {
    repository.subscribeByJobPostingId('job-1', { onUpdate: jest.fn() });
    getSpy.mockClear();

    capturedHandler?.({ eventType: 'INSERT' });

    // 타이머를 진행시키기 전에 이미 조회가 나갔다 = 디바운스가 실시간성을 깎지 않는다
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('구독 해제 시 대기 중이던 트레일링 재조회를 버린다', () => {
    const unsubscribe = repository.subscribeByJobPostingId('job-1', { onUpdate: jest.fn() });
    getSpy.mockClear();

    capturedHandler?.({ eventType: 'UPDATE' });
    capturedHandler?.({ eventType: 'UPDATE' }); // 트레일링 예약됨
    expect(getSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
    jest.advanceTimersByTime(1000);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
