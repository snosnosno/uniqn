/**
 * useUpdateSlot — 배치 슬롯 편집 변이 훅 테스트
 *
 * (1) 변이 입력을 Service(gridWriteService.updateSlot)에 그대로 위임하는지,
 * (2) 성공 시 workSchedule prefix **와 applications prefix 를 둘 다** 무효화하는지,
 * (3) 서비스 에러를 변이 에러로 전파하는지 검증한다. 토스트는 호출부 책임(mutation only).
 *
 * 🔑 (2)의 applications 무효화가 이 파일의 존재 이유다. 저장이 서버 RPC 로 바뀌면서 이 변이는
 *    `work_logs` 뿐 아니라 `applications.assignments[]` 도 갱신한다 — 무효화를 빠뜨리면
 *    지원자 목록·상세가 옛 배정 시각/역할을 그대로 보여준다(전환 전에는 없던 신규 stale 경로).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useUpdateSlot } from '../useUpdateSlot';
import { updateSlot } from '@/services/workSchedule/gridWriteService';

// jest.setup.js의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/workSchedule/gridWriteService', () => ({
  updateSlot: jest.fn(),
}));

const mockUpdate = updateSlot as jest.Mock;

const VARS = { workLogId: 'wl-1', input: { startTime: '19:00', memo: '홀 담당' } };

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

describe('useUpdateSlot', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  it('변이 변수를 gridWriteService.updateSlot 에 그대로 위임', async () => {
    mockUpdate.mockResolvedValueOnce(undefined);
    const client = createClient();

    const { result } = renderHook(() => useUpdateSlot(), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync(VARS);
    });

    expect(mockUpdate).toHaveBeenCalledWith(VARS.workLogId, VARS.input);
  });

  it('성공 시 workSchedule 과 applications 를 둘 다 무효화한다', async () => {
    mockUpdate.mockResolvedValueOnce(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateSlot(), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync(VARS);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workSchedule.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.applications.all });
  });

  it('서비스 에러를 변이 에러로 전파(토스트는 호출부 책임)', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    const client = createClient();

    const { result } = renderHook(() => useUpdateSlot(), { wrapper: createWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync(VARS).catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
