/**
 * useRegularDateCounts — 달력 UI용 카운트 쿼리 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRegularDateCounts } from '../useRegularDateCounts';
import { jobPostingRepository } from '@/repositories';

// jest.setup.js의 전역 useQuery 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getRegularDateCounts: jest.fn(),
  },
}));

const mockGetRegularDateCounts = jobPostingRepository.getRegularDateCounts as jest.Mock;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useRegularDateCounts', () => {
  beforeEach(() => {
    mockGetRegularDateCounts.mockReset();
  });

  it('보이는 월 기준 주 단위 확장된 범위로 Repository 호출', async () => {
    // 2026-04-15는 4월(수요일). 4월 1일은 수요일 → startOfWeek(일요일 기준)는 3월 29일.
    // endOfMonth(4월)=4월 30일(목), endOfWeek(일요일 기준) = 5월 2일(토).
    mockGetRegularDateCounts.mockResolvedValueOnce({});
    const wrapper = createWrapper();

    renderHook(() => useRegularDateCounts(new Date('2026-04-15T00:00:00')), {
      wrapper,
    });

    await waitFor(() => {
      expect(mockGetRegularDateCounts).toHaveBeenCalledWith('2026-03-29', '2026-05-02');
    });
  });

  it('data에 카운트 맵이 반환된다', async () => {
    mockGetRegularDateCounts.mockResolvedValueOnce({
      '2026-04-14': 2,
      '2026-04-18': 12,
    });
    const wrapper = createWrapper();

    const { result } = renderHook(() => useRegularDateCounts(new Date('2026-04-15T00:00:00')), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ '2026-04-14': 2, '2026-04-18': 12 });
    });
  });

  it('visibleMonth가 바뀌면 새 범위로 재호출', async () => {
    mockGetRegularDateCounts.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const wrapper = createWrapper();

    const { rerender } = renderHook(({ month }: { month: Date }) => useRegularDateCounts(month), {
      wrapper,
      initialProps: { month: new Date('2026-04-15T00:00:00') },
    });

    await waitFor(() => {
      expect(mockGetRegularDateCounts).toHaveBeenCalledTimes(1);
    });

    rerender({ month: new Date('2026-05-15T00:00:00') });

    await waitFor(() => {
      expect(mockGetRegularDateCounts).toHaveBeenCalledTimes(2);
    });
  });

  it('Repository 에러를 쿼리 에러로 전파', async () => {
    mockGetRegularDateCounts.mockRejectedValueOnce(new Error('RPC failed'));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useRegularDateCounts(new Date('2026-04-15T00:00:00')), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
