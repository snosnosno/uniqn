/**
 * useGridSummary — 운영처 월 그리드 셀맵 훅 테스트
 *
 * 월 from/to 산출 + 요약 RPC + 컨테이너 softTargets 합성(buildGridCells)을 검증한다.
 * 순수 합성 로직 자체는 buildGridCells.test.ts 에서 결정적으로 단위테스트한다.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGridSummary } from '../useGridSummary';
import { jobPostingRepository } from '@/repositories';
import { workScheduleRepository } from '@/repositories/workSchedule';

// jest.setup.js의 전역 useQuery 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getVenueContainerById: jest.fn(),
  },
}));

jest.mock('@/repositories/workSchedule', () => ({
  workScheduleRepository: {
    getVenueGridSummary: jest.fn(),
  },
}));

const mockSummary = workScheduleRepository.getVenueGridSummary as jest.Mock;
const mockContainer = jobPostingRepository.getVenueContainerById as jest.Mock;

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useGridSummary', () => {
  beforeEach(() => {
    mockSummary.mockReset();
    mockContainer.mockReset();
  });

  it('월의 from/to(toDateString)로 요약 RPC + 컨테이너를 조회', async () => {
    mockSummary.mockResolvedValueOnce([]);
    mockContainer.mockResolvedValueOnce(null);

    renderHook(() => useGridSummary('v1', new Date('2026-07-15T00:00:00')), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSummary).toHaveBeenCalledWith('v1', '2026-07-01', '2026-07-31');
    });
    expect(mockContainer).toHaveBeenCalledWith('v1');
  });

  it('요약행 + 컨테이너 softTargets 를 셀맵으로 합성', async () => {
    mockSummary.mockResolvedValueOnce([{ d: '2026-07-10', headcount: 1, jobCount: 2 }]);
    mockContainer.mockResolvedValueOnce({
      id: 'v1',
      name: '강남홀덤',
      workspaceId: 'ws1',
      ownerId: 'o1',
      venueId: 'v1',
      kind: 'dated',
      softTargets: { '2026-07-10': 3, '2026-07-20': 2 },
    });

    const { result } = renderHook(() => useGridSummary('v1', new Date('2026-07-15T00:00:00')), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    const cells = result.current.data as NonNullable<typeof result.current.data>;
    // 배치 1 < 목표 3 → 부족 2
    expect(cells['2026-07-10']).toMatchObject({
      shortage: 2,
      status: 'shortage',
      priorityBadge: { kind: 'shortage', count: 2 },
    });
    // 요약행 없지만 목표 2 인 날 → 부족셀 표면화
    expect(cells['2026-07-20']).toMatchObject({ headcount: 0, shortage: 2, status: 'shortage' });
  });

  it('venueId 가 null 이면 disabled(요약 RPC 미호출)', async () => {
    renderHook(() => useGridSummary(null, new Date('2026-07-15T00:00:00')), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockSummary).not.toHaveBeenCalled();
    expect(mockContainer).not.toHaveBeenCalled();
  });

  it('options.enabled=false 이면 venueId 가 있어도 disabled(플래그 OFF RPC 미호출)', async () => {
    mockSummary.mockResolvedValueOnce([]);
    mockContainer.mockResolvedValueOnce(null);

    renderHook(() => useGridSummary('v1', new Date('2026-07-15T00:00:00'), { enabled: false }), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockSummary).not.toHaveBeenCalled();
    expect(mockContainer).not.toHaveBeenCalled();
  });

  it('Repository 에러를 쿼리 에러로 전파', async () => {
    mockSummary.mockRejectedValueOnce(new Error('RPC failed'));
    mockContainer.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useGridSummary('v1', new Date('2026-07-15T00:00:00')), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
