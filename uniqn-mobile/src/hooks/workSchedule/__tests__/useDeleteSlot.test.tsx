/**
 * useDeleteSlot — 배치 슬롯 빼기 변이 훅 테스트
 *
 * (1) 변이 입력을 Service(gridWriteService.deleteSlot)에 그대로 위임하는지,
 * (2) 성공 시 workSchedule prefix 무효화 + 스태프관리/공고 무효화 헬퍼를 호출하는지,
 * (3) 서비스 에러를 변이 에러로 전파하는지 검증한다. 토스트는 호출부 책임(mutation only).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys, invalidateQueries } from '@/lib/queryClient';
import { useDeleteSlot } from '../useDeleteSlot';
import { deleteSlot } from '@/services/workSchedule/gridWriteService';

// jest.setup.js의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/workSchedule/gridWriteService', () => ({
  deleteSlot: jest.fn(),
}));

const mockDelete = deleteSlot as jest.Mock;

const INPUT = {
  workLogId: 'wl-1',
  jobPostingId: 'jp-1',
  staffId: 'staff-1',
  date: '2026-07-05',
};

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

describe('useDeleteSlot', () => {
  let staffManagementSpy: jest.SpyInstance;
  let jobPostingsSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDelete.mockReset();
    // 전역 queryClient 헬퍼는 실행 부작용 없이 호출 여부만 검증
    staffManagementSpy = jest
      .spyOn(invalidateQueries, 'staffManagement')
      .mockImplementation(() => {});
    jobPostingsSpy = jest
      .spyOn(invalidateQueries, 'jobPostings')
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    staffManagementSpy.mockRestore();
    jobPostingsSpy.mockRestore();
  });

  it('변이 입력을 gridWriteService.deleteSlot 에 그대로 위임', async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const client = createClient();

    const { result } = renderHook(() => useDeleteSlot(), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    expect(mockDelete).toHaveBeenCalledWith(INPUT);
  });

  it('성공 시 workSchedule 일괄 무효화 + 스태프관리/공고 무효화 헬퍼 호출', async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteSlot(), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync(INPUT);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workSchedule.all });
    expect(staffManagementSpy).toHaveBeenCalledWith('jp-1');
    expect(jobPostingsSpy).toHaveBeenCalled();
  });

  it('서비스 에러를 변이 에러로 전파(토스트는 호출부 책임)', async () => {
    mockDelete.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    const client = createClient();

    const { result } = renderHook(() => useDeleteSlot(), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync(INPUT).catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
