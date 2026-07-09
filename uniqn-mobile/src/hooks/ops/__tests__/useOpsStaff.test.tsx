/**
 * useOpsStaff — ops 스태프 로스터 읽기 훅 테스트(Realtime 구독 포함).
 * useOpsParticipants 문형 복제(읽기는 Repository 직접 + 'ops_staff' 구독→invalidate).
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useOpsStaff } from '../useOpsStaff';
import { opsStaffRepository } from '@/repositories/ops';
import type { OpsStaff } from '@/types/ops';

// jest.setup.js 의 전역 useQuery 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories/ops', () => ({
  opsStaffRepository: { listByTournament: jest.fn() },
}));

const mockCreateRealtimeSubscription = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: (...args: unknown[]) => mockCreateRealtimeSubscription(...args),
}));

const mockList = opsStaffRepository.listByTournament as jest.Mock;

const STAFF: OpsStaff = {
  id: 'os1',
  tournamentId: 't1',
  staffId: 's1',
  role: 'dealer',
  customRole: null,
  staffName: '홍길동',
  staffNickname: '길동이',
  source: 'snapshot_import',
  sourceWorkLogId: 'wl1',
  createdAt: '2026-07-07T00:00:00Z',
};

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useOpsStaff', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockCreateRealtimeSubscription.mockReset();
    mockUnsubscribe.mockReset();
    mockCreateRealtimeSubscription.mockReturnValue(mockUnsubscribe);
  });

  it('tournamentId 로 로스터를 조회한다(성공 경로)', async () => {
    mockList.mockResolvedValueOnce([STAFF]);

    const { result } = renderHook(() => useOpsStaff('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual([STAFF]));
    expect(mockList).toHaveBeenCalledWith('t1');
  });

  it('tournamentId 가 undefined 면 조회를 건너뛴다(disabled)', async () => {
    renderHook(() => useOpsStaff(undefined), { wrapper: createWrapper() });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockList).not.toHaveBeenCalled();
  });

  it("'ops_staff' 테이블 Realtime 구독을 tournament_id 필터로 등록한다", async () => {
    mockList.mockResolvedValueOnce([]);

    renderHook(() => useOpsStaff('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(mockCreateRealtimeSubscription).toHaveBeenCalledTimes(1));
    expect(mockCreateRealtimeSubscription).toHaveBeenCalledWith(
      'ops_staff',
      'tournament_id=eq.t1',
      expect.any(Function)
    );
  });

  it('unmount 시 구독을 해제한다(cleanup)', async () => {
    mockList.mockResolvedValueOnce([]);

    const { unmount } = renderHook(() => useOpsStaff('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(mockCreateRealtimeSubscription).toHaveBeenCalledTimes(1));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('Repository 에러를 쿼리 에러로 전파', async () => {
    mockList.mockRejectedValueOnce(new Error('RPC failed'));

    const { result } = renderHook(() => useOpsStaff('t1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('queryKeys.ops.staff', () => {
  it('tournamentId 스코프 키를 생성한다', () => {
    expect(queryKeys.ops.staff('t1')).toEqual(['ops', 'staff', 't1']);
  });
});
