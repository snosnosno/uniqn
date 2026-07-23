/**
 * useOpsBlindPresets — 블라인드 프리셋 목록 읽기 훅 테스트(계획 B Task 5).
 * 읽기는 Repository(opsBlindPresetRepository.listMine) 직접 호출 — RLS owner 스코프 자동 필터.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { opsBlindPresetRepository } from '@/repositories/ops';
import { useOpsBlindPresets } from '../useOpsBlindPresets';

// jest.setup.js 의 전역 useQuery 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories/ops', () => ({
  opsBlindPresetRepository: { listMine: jest.fn() },
}));

const mockListMine = opsBlindPresetRepository.listMine as jest.Mock;

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useOpsBlindPresets', () => {
  beforeEach(() => {
    mockListMine.mockReset();
  });

  it('내 프리셋 목록 조회', async () => {
    mockListMine.mockResolvedValueOnce([
      { id: 'x', ownerId: 'A', name: '기본 30레벨', levels: [], createdAt: '2026-07-23' },
    ]);

    const { result } = renderHook(() => useOpsBlindPresets(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.presets).toHaveLength(1));
    expect(result.current.presets[0].name).toBe('기본 30레벨');
  });

  it('로딩 중에는 빈 목록을 반환한다', async () => {
    mockListMine.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useOpsBlindPresets(), { wrapper: createWrapper() });

    expect(result.current.presets).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
