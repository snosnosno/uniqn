/**
 * useSharedJobPostings unit tests
 *
 * 익명 가드 + Realtime 구독 + RLS 격리 후 렌더링 검증.
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSharedJobPostings } from '../useSharedJobPostings';
import { collaboratorService } from '@/services/jobs/collaboratorService';
import { useAuthStore } from '@/stores/authStore';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/jobs/collaboratorService', () => ({
  collaboratorService: { listSharedJobPostings: jest.fn() },
}));

const mockCreateRealtimeSubscription = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: (...args: unknown[]) => mockCreateRealtimeSubscription(...args),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe('useSharedJobPostings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRealtimeSubscription.mockReturnValue(mockUnsubscribe);
  });

  it('userId 가 있으면 shared postings 를 fetch 한다', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { uid: 'user-1' } });
    (collaboratorService.listSharedJobPostings as jest.Mock).mockResolvedValue([
      {
        jobPostingId: 'jp-1',
        jobPostingTitle: '공유 공고',
        workspaceId: 'ws-1',
        workspaceName: 'WS',
        addedAt: '2026-05-12T00:00:00Z',
      },
    ]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSharedJobPostings(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.sharedPostings).toHaveLength(1));
    expect(result.current.sharedPostings[0]?.jobPostingId).toBe('jp-1');
    expect(collaboratorService.listSharedJobPostings).toHaveBeenCalled();
  });

  it('익명 (user null) 이면 fetch / 구독 모두 건너뛴다', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSharedJobPostings(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.listSharedJobPostings).not.toHaveBeenCalled();
    expect(mockCreateRealtimeSubscription).not.toHaveBeenCalled();
    expect(result.current.sharedPostings).toEqual([]);
  });

  it('userId 가 있으면 Realtime 구독을 등록한다 (filter=user_id=eq.user-1)', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { uid: 'user-1' } });
    (collaboratorService.listSharedJobPostings as jest.Mock).mockResolvedValue([]);

    const { Wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useSharedJobPostings(), { wrapper: Wrapper });

    await waitFor(() => expect(mockCreateRealtimeSubscription).toHaveBeenCalledTimes(1));
    expect(mockCreateRealtimeSubscription).toHaveBeenCalledWith(
      'job_posting_collaborators',
      'user_id=eq.user-1',
      expect.any(Function)
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('빈 응답 시 빈 배열을 반환한다', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { uid: 'user-1' } });
    (collaboratorService.listSharedJobPostings as jest.Mock).mockResolvedValue([]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSharedJobPostings(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sharedPostings).toEqual([]);
  });
});
