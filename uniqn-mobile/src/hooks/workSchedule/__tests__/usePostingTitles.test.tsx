/**
 * usePostingTitles — 근무표 출처 칩 공고 제목 조회 훅 테스트
 *
 * 🔑 이 파일이 지키는 계약은 **캐시 키의 접두사**다.
 *
 * 공고를 수정하면 `useUpdateJobPosting` 이 `queryKeys.workSchedule.all` 접두사를 무효화한다
 * (`src/hooks/useJobManagement.ts` onSuccess · 그쪽 단언은 `useJobManagement.test.ts` 의
 * '공고 라이프사이클 → 근무표 캐시 무효화'). 출처 칩 제목이 그 무효화를 받는 유일한 이유는
 * 이 훅의 쿼리 키가 `['workSchedule', 'postingTitles', ...]` 로 **그 접두사 아래에 있기 때문**이다.
 *
 * ⚠️ 키를 `queryKeys.jobPostings.*` 같은 다른 트리로 옮기면 무효화가 닿지 않는다. 그런데
 *    화면은 멀쩡히 렌더되고 칩도 그려진다 — 제목만 최대 10분(`cachingPolicies.standard`)
 *    옛것으로 남는다. **실패가 무음이라** 구조 단언이 아니라 실제 재조회로 잠근다.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePostingTitles } from '../usePostingTitles';
import { queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';

// jest.setup.js의 전역 useQuery 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getByIdBatch: jest.fn(),
  },
}));

const mockGetByIdBatch = jobPostingRepository.getByIdBatch as jest.Mock;

function createHarness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

describe('usePostingTitles', () => {
  beforeEach(() => {
    mockGetByIdBatch.mockReset();
  });

  it('id 순서가 달라도 같은 캐시를 쓴다(정렬된 id 로 조회)', async () => {
    mockGetByIdBatch.mockResolvedValue([{ id: 'a', title: '토요일 딜러 4명' }]);
    const { Wrapper } = createHarness();

    const { result } = renderHook(() => usePostingTitles(['b', 'a']), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.get('a')).toBe('토요일 딜러 4명'));
    expect(mockGetByIdBatch).toHaveBeenCalledWith(['a', 'b']);
  });

  it('조회 중·실패에도 빈 Map 을 돌려줘 사람 줄 렌더를 막지 않는다', async () => {
    mockGetByIdBatch.mockRejectedValue(new Error('network'));
    const { Wrapper } = createHarness();

    const { result } = renderHook(() => usePostingTitles(['a']), { wrapper: Wrapper });

    expect(result.current.size).toBe(0); // 조회 중
    await waitFor(() => expect(mockGetByIdBatch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.size).toBe(0)); // 실패 후
  });

  it('id 가 없으면 조회하지 않는다', () => {
    const { Wrapper } = createHarness();

    const { result } = renderHook(() => usePostingTitles([]), { wrapper: Wrapper });

    expect(mockGetByIdBatch).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it('🔴 회귀 — workSchedule 접두사 무효화가 제목을 다시 읽는다(공고 수정 반영 경로)', async () => {
    mockGetByIdBatch
      .mockResolvedValueOnce([{ id: 'a', title: '토요일 딜러 4명' }])
      .mockResolvedValueOnce([{ id: 'a', title: '토요일 딜러 6명' }]);
    const { client, Wrapper } = createHarness();

    const { result } = renderHook(() => usePostingTitles(['a']), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.get('a')).toBe('토요일 딜러 4명'));

    // useUpdateJobPosting 의 onSuccess 가 실제로 쓰는 키 — 상수를 복제하지 않고 그대로 가져온다.
    await client.invalidateQueries({ queryKey: queryKeys.workSchedule.all });

    await waitFor(() => expect(result.current.get('a')).toBe('토요일 딜러 6명'));
    expect(mockGetByIdBatch).toHaveBeenCalledTimes(2);
  });
});
