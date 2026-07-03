/**
 * useSetVenueSoftTargetBulk — 운영처 soft-target 벌크 쓰기 변이 훅 테스트
 *
 * 같은 요일 반복 적용 시 단건 훅을 N번 호출하면 무효화가 폭주하므로, 벌크 훅은 서비스에
 * 벌크 위임 후 onSuccess 에서 weeklyGrid.all 을 **정확히 1회만** invalidate 한다.
 * 검증: (1) 서비스 setVenueSoftTargetBulk 에 변수 그대로 위임, (2) 무효화 정확히 1회,
 * (3) 서비스 에러를 변이 에러로 전파(토스트는 호출부 책임).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useSetVenueSoftTargetBulk } from '../useSetVenueSoftTargetBulk';
import { setVenueSoftTargetBulk } from '@/services/weeklyGrid/gridWriteService';

// jest.setup.js의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

// 훅 단위 테스트 — 서비스 경계만 목(레포/RPC 는 서비스 테스트 소관).
jest.mock('@/services/weeklyGrid/gridWriteService', () => ({
  setVenueSoftTargetBulk: jest.fn(),
}));

const mockBulk = setVenueSoftTargetBulk as jest.Mock;

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

describe('useSetVenueSoftTargetBulk', () => {
  beforeEach(() => mockBulk.mockReset());

  it('변이 변수를 서비스 setVenueSoftTargetBulk 에 그대로 위임', async () => {
    mockBulk.mockResolvedValueOnce(undefined);
    const client = createClient();

    const { result } = renderHook(() => useSetVenueSoftTargetBulk(), {
      wrapper: createWrapper(client),
    });

    const dates = ['2026-07-03', '2026-07-10', '2026-07-17'];
    await act(async () => {
      await result.current.mutateAsync({ venueId: 'v1', dates, count: 3 });
    });

    expect(mockBulk).toHaveBeenCalledWith('v1', dates, 3);
  });

  it('성공 시 weeklyGrid.all 을 정확히 1회만 invalidate(단건 반복 대비 무효화 폭주 방지)', async () => {
    mockBulk.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSetVenueSoftTargetBulk(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        venueId: 'v1',
        dates: ['2026-07-03', '2026-07-10', '2026-07-17', '2026-07-24', '2026-07-31'],
        count: 2,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.weeklyGrid.all });
  });

  it('서비스 에러를 변이 에러로 전파(토스트는 호출부 책임)', async () => {
    mockBulk.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    const client = createClient();

    const { result } = renderHook(() => useSetVenueSoftTargetBulk(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ venueId: 'v1', dates: ['2026-07-03'], count: 1 })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
