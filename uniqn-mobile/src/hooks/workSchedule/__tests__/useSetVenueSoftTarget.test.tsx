/**
 * useSetVenueSoftTarget — 운영처 soft-target 쓰기 변이 훅 테스트
 *
 * 변이 성공 시 (1) 레포에 변수를 그대로 위임하는지, (2) workSchedule 관련 쿼리를 일괄
 * invalidate 하는지(useGridSummary/컨테이너 재조회 트리거)를 검증한다. 토스트는 호출부 책임이라
 * 훅에서 검증하지 않는다(mutation only).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useSetVenueSoftTarget } from '../useSetVenueSoftTarget';
import { workScheduleRepository } from '@/repositories/workSchedule';

// jest.setup.js의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories/workSchedule', () => ({
  workScheduleRepository: {
    setVenueSoftTarget: jest.fn(),
  },
}));

const mockSet = workScheduleRepository.setVenueSoftTarget as jest.Mock;

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useSetVenueSoftTarget', () => {
  beforeEach(() => mockSet.mockReset());

  it('변이 변수를 레포 setVenueSoftTarget 에 그대로 위임', async () => {
    mockSet.mockResolvedValueOnce(undefined);
    const client = createClient();

    const { result } = renderHook(() => useSetVenueSoftTarget(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ venueId: 'v1', date: '2026-07-05', count: 3 });
    });

    expect(mockSet).toHaveBeenCalledWith('v1', '2026-07-05', 3);
  });

  it('성공 시 workSchedule 관련 쿼리를 일괄 invalidate', async () => {
    mockSet.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSetVenueSoftTarget(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ venueId: 'v1', date: '2026-07-05', count: 3 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workSchedule.all });
  });

  it('레포 에러를 변이 에러로 전파(토스트는 호출부 책임)', async () => {
    mockSet.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    const client = createClient();

    const { result } = renderHook(() => useSetVenueSoftTarget(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ venueId: 'v1', date: '2026-07-05', count: 1 })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
