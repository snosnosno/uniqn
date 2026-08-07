import { act, renderHook } from '@testing-library/react-native';
import { ERROR_CODES } from '@/errors/AppError';
import type { JobPosting } from '@/types';

import { useJobDetail } from '@/hooks/useJobDetail';

const mockGetCriticalOfflineCache = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRefetch = jest.fn();
const mockRemoveCriticalOfflineCache = jest.fn();
const mockSetCriticalOfflineCache = jest.fn();
const mockUseQuery = jest.fn();
const mockSubscribeToJobPosting = jest.fn();
const mockSetQueryData = jest.fn();
let mockUser: { uid: string } | null = { uid: 'user-1' };

// ⚠️ queryClient 는 **동일 객체**를 돌려줘야 한다. 렌더마다 새 객체를 주면 realtime 구독
//    effect 의 deps 가 매번 바뀌어 구독이 재생성되고, 그때 realtimeError 가 초기화되어
//    "구독 에러가 남지 않는다"는 거짓 통과가 난다(실물 useQueryClient 는 안정된 인스턴스).
const mockQueryClient = {
  invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  setQueryData: (...args: unknown[]) => mockSetQueryData(...args),
};

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: Record<string, unknown>) => mockUseQuery(options),
  useQueryClient: () => mockQueryClient,
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: true,
    isOffline: false,
    isChecking: false,
    connectionType: 'wifi',
    isInternetReachable: true,
    lastChecked: null,
    details: null,
    checkConnection: jest.fn(),
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: { uid: string } | null }) => unknown) => {
    const state = { user: mockUser };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/services', () => ({
  getJobPostingById: jest.fn(),
  subscribeToJobPosting: (...args: unknown[]) => mockSubscribeToJobPosting(...args),
}));

jest.mock('@/services/offline/criticalOfflineCache', () => ({
  getCriticalOfflineCache: (...args: unknown[]) => mockGetCriticalOfflineCache(...args),
  removeCriticalOfflineCache: (...args: unknown[]) => mockRemoveCriticalOfflineCache(...args),
  setCriticalOfflineCache: (...args: unknown[]) => mockSetCriticalOfflineCache(...args),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    jobPostings: {
      detail: (id: string) => ['jobPostings', 'detail', id],
    },
  },
  cachingPolicies: {
    standard: 300000,
  },
  // ⚠️ 손으로 쓴 부분 사본 — 실물에 키를 추가하면 여기도 추가할 것(누락 시 undefined).
  //    위 온라인 상수(5분)와 다른 값이어야 아래 회귀 단언이 유효하다.
  offlineCachePolicies: {
    jobDetail: 24 * 60 * 60 * 1000,
  },
}));

function createMockJobPosting(id: string): JobPosting {
  return {
    id,
    title: `Job ${id}`,
    status: 'active',
    postingType: 'regular',
    workDate: '2025-02-01',
    timeSlot: '10:00 - 18:00',
    location: 'Seoul',
    roles: ['dealer'],
  } as unknown as JobPosting;
}

describe('useJobDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'user-1' };
    mockUseQuery.mockReturnValue({
      data: null,
      isFetched: true,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  // 오프라인 MMKV 캐시는 만료를 stale 표시가 아니라 **완전 삭제**로 처리한다
  // (criticalOfflineCache.ts:133-147). 온라인 상수(5분)를 TTL 로 겸용하면 지하에서
  // 목록은 보이는데 상세만 비어 이동이 막힌 것처럼 보인다.
  it('오프라인 캐시 보존기간을 온라인 staleTime 과 겸용하지 않는다', () => {
    renderHook(() => useJobDetail('job-1'));

    const ttls = mockGetCriticalOfflineCache.mock.calls.map(
      (call) => (call[1] as { ttlMs: number }).ttlMs
    );

    expect(ttls.length).toBeGreaterThan(0);
    expect(ttls.every((ttl) => ttl === 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('does not fall back to cached data when the live query resolves to null', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });

    const { result } = renderHook(() => useJobDetail('job-1'));

    expect(result.current.job).toBeNull();
  });

  it('removes stale cached detail when the live query resolves to null', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });

    renderHook(() => useJobDetail('job-1'));

    expect(mockRemoveCriticalOfflineCache).toHaveBeenCalledWith('jobPostings:detail:user-1:job-1');
  });

  it('removes stale cached detail when the live query fails with a permission error', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });
    mockUseQuery.mockReturnValue({
      data: undefined,
      isFetched: true,
      isLoading: false,
      isRefetching: false,
      error: {
        __isAppError: true,
        code: ERROR_CODES.INFRA_PERMISSION_DENIED,
        category: 'permission',
      },
      refetch: mockRefetch,
    });

    renderHook(() => useJobDetail('job-1'));

    expect(mockRemoveCriticalOfflineCache).toHaveBeenCalledWith('jobPostings:detail:user-1:job-1');
  });

  it('keeps cached detail when the live query fails with a retryable network error', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });
    mockUseQuery.mockReturnValue({
      data: undefined,
      isFetched: true,
      isLoading: false,
      isRefetching: false,
      error: {
        __isAppError: true,
        code: 'E1004',
        category: 'network',
      },
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useJobDetail('job-1'));

    expect(mockRemoveCriticalOfflineCache).not.toHaveBeenCalled();
    expect(result.current.job).toBeNull();
  });

  it('uses a user-scoped query key so account switches do not reuse prior memory cache', () => {
    mockGetCriticalOfflineCache.mockReturnValue(null);
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const userScope = options.queryKey[3];

      if (userScope === 'user-1') {
        return {
          data: createMockJobPosting('user-1-job'),
          isFetched: true,
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: mockRefetch,
        };
      }

      return {
        data: undefined,
        isFetched: false,
        isLoading: true,
        isRefetching: false,
        error: null,
        refetch: mockRefetch,
      };
    });

    const firstRender = renderHook(() => useJobDetail('job-1'));

    expect(firstRender.result.current.job?.id).toBe('user-1-job');
    expect(mockUseQuery).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        queryKey: ['jobPostings', 'detail', 'job-1', 'user-1'],
      })
    );

    mockUser = { uid: 'user-2' };

    const secondRender = renderHook(() => useJobDetail('job-1'));

    expect(secondRender.result.current.job).toBeNull();
    expect(secondRender.result.current.isLoading).toBe(true);
    expect(mockUseQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        queryKey: ['jobPostings', 'detail', 'job-1', 'user-2'],
      })
    );
  });
});

// realtime 구독 에러는 구독 effect 가 다시 뜰 때만 초기화됐다 — 성공 갱신도, 화면이 '다시 시도'로
// 배선한 refresh() 도 지우지 못했다. 이 화면들은 error 를 그대로 에러 화면 조건으로 쓰므로,
// 한 번 튄 구독 에러가 캐시된 공고 위에 영구 에러 화면을 씌우고 재시도가 거짓말이 된다(감사 A4).
describe('useJobDetail realtime 구독 에러의 수명', () => {
  const subscriptionFailure = new Error('구독 초기 조회 실패');

  function renderRealtimeHook() {
    let handlers: {
      onUpdate: (job: JobPosting | null) => void;
      onError: (error: Error) => void;
    } = { onUpdate: () => {}, onError: () => {} };

    mockSubscribeToJobPosting.mockImplementation((_id: string, callbacks: typeof handlers) => {
      handlers = callbacks;
      return () => {};
    });

    const rendered = renderHook(() => useJobDetail('job-1', { realtime: true }));
    return { ...rendered, getHandlers: () => handlers };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'user-1' };
    mockUseQuery.mockReturnValue({
      data: createMockJobPosting('job-1'),
      isFetched: true,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('구독 에러를 error 로 올린다', () => {
    const { result, getHandlers } = renderRealtimeHook();

    act(() => getHandlers().onError(subscriptionFailure));

    expect(result.current.error).toBe(subscriptionFailure);
  });

  it('구독이 성공 갱신을 보내면 남아 있던 구독 에러를 지운다', () => {
    const { result, getHandlers } = renderRealtimeHook();

    act(() => getHandlers().onError(subscriptionFailure));
    act(() => getHandlers().onUpdate(createMockJobPosting('job-1')));

    expect(result.current.error).toBeNull();
  });

  it('refresh() 는 남아 있던 구독 에러를 지운다 — 재시도가 거짓말이 되지 않도록', async () => {
    const { result, getHandlers } = renderRealtimeHook();

    act(() => getHandlers().onError(subscriptionFailure));
    expect(result.current.error).toBe(subscriptionFailure);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
  });

  it('구독이 다시 실패하면 error 를 다시 올린다 — 지속 실패를 감추지 않는다', async () => {
    const { result, getHandlers } = renderRealtimeHook();

    act(() => getHandlers().onError(subscriptionFailure));
    await act(async () => {
      await result.current.refresh();
    });

    const secondFailure = new Error('구독 재실패');
    act(() => getHandlers().onError(secondFailure));

    expect(result.current.error).toBe(secondFailure);
  });
});
