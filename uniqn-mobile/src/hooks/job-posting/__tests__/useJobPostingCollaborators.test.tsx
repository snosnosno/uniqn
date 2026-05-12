/**
 * useJobPostingCollaborators / useCollaboratorCandidates unit tests
 *
 * TanStack Query mutation 흐름 + Realtime 구독 + leaveSelf cleanup 검증.
 * RLS 자체는 pg_prove 매트릭스에서 다룸.
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useJobPostingCollaborators,
  useCollaboratorCandidates,
} from '../useJobPostingCollaborators';
import { collaboratorService } from '@/services/jobs/collaboratorService';
import { createRealtimeSubscription } from '@/utils/supabase';

// jest.setup.js 의 전역 useQuery/useMutation 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/services/jobs/collaboratorService', () => ({
  collaboratorService: {
    listForJobPosting: jest.fn(),
    listSharedJobPostings: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    leaveSelf: jest.fn(),
    searchCandidates: jest.fn(),
  },
}));

const mockCreateRealtimeSubscription = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: (...args: unknown[]) => mockCreateRealtimeSubscription(...args),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ success: jest.fn(), error: jest.fn() }),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe('useJobPostingCollaborators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRealtimeSubscription.mockReturnValue(mockUnsubscribe);
  });

  it('jobPostingId 가 있으면 collaborator 목록을 fetch 한다', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([
      {
        id: 'jpc-1',
        jobPostingId: 'jp-1',
        userId: 'u1',
        addedBy: 'owner-1',
        addedAt: '2026-05-12T00:00:00Z',
        displayName: 'collab1',
        email: 'c1@test.local',
        photoUrl: null,
      },
    ]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.collaborators).toHaveLength(1);
    expect(result.current.collaborators[0]?.userId).toBe('u1');
    expect(collaboratorService.listForJobPosting).toHaveBeenCalledWith('jp-1');
  });

  it('jobPostingId 가 undefined 면 fetch / 구독 모두 건너뛴다', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobPostingCollaborators(undefined), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.listForJobPosting).not.toHaveBeenCalled();
    expect(mockCreateRealtimeSubscription).not.toHaveBeenCalled();
    expect(result.current.collaborators).toEqual([]);
  });

  it('jobPostingId 가 있으면 Realtime 구독을 등록한다 (filter=eq.jp-1)', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([]);

    const { Wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper: Wrapper });

    await waitFor(() => expect(mockCreateRealtimeSubscription).toHaveBeenCalledTimes(1));
    expect(mockCreateRealtimeSubscription).toHaveBeenCalledWith(
      'job_posting_collaborators',
      'job_posting_id=eq.jp-1',
      expect.any(Function)
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('add mutation 성공 시 collaboratorService.add 가 올바른 입력으로 호출된다', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([]);
    (collaboratorService.add as jest.Mock).mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.add('user-2');
    });

    expect(collaboratorService.add).toHaveBeenCalledWith({
      jobPostingId: 'jp-1',
      userId: 'user-2',
    });
  });

  it('remove mutation 성공 시 collaboratorService.remove 가 올바른 입력으로 호출된다', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([]);
    (collaboratorService.remove as jest.Mock).mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.remove('user-2');
    });

    expect(collaboratorService.remove).toHaveBeenCalledWith({
      jobPostingId: 'jp-1',
      userId: 'user-2',
    });
  });

  it('leaveSelf 성공 시 collaboratorService.leaveSelf 가 호출되고 cache 가 invalidate/remove 된다', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([]);
    (collaboratorService.leaveSelf as jest.Mock).mockResolvedValue(undefined);

    const { Wrapper, queryClient } = makeWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = jest.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.leaveSelf();
    });

    expect(collaboratorService.leaveSelf).toHaveBeenCalledWith('jp-1');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['jobPostingCollaborators'],
    });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: ['jobPostingCollaborators', 'list', 'jp-1'],
    });
  });

  it('add 실패 시 mutation 이 reject 한다', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([]);
    (collaboratorService.add as jest.Mock).mockRejectedValue(new Error('boom'));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.add('user-2');
      })
    ).rejects.toThrow('boom');
  });
});

describe('useCollaboratorCandidates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRealtimeSubscription.mockReturnValue(mockUnsubscribe);
  });

  it('email query 가 3자 미만이면 fetch 하지 않는다', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCollaboratorCandidates('jp-1', 'ab'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.searchCandidates).not.toHaveBeenCalled();
    expect(result.current.candidates).toEqual([]);
  });

  it('email query 가 trim 후 3자 미만이면 fetch 하지 않는다 (공백 포함)', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCollaboratorCandidates('jp-1', '  ab '), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.searchCandidates).not.toHaveBeenCalled();
  });

  it('jobPostingId 가 undefined 면 fetch 하지 않는다', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCollaboratorCandidates(undefined, 'abc@test'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.searchCandidates).not.toHaveBeenCalled();
  });

  it('email query 3자 이상이면 fetch 한다', async () => {
    (collaboratorService.searchCandidates as jest.Mock).mockResolvedValue([
      {
        userId: 'u1',
        displayName: 'u1',
        email: 'abc@test.local',
        photoUrl: null,
        status: 'addable',
      },
    ]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCollaboratorCandidates('jp-1', 'abc'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(collaboratorService.searchCandidates).toHaveBeenCalledWith({
      jobPostingId: 'jp-1',
      emailQuery: 'abc',
    });
    expect(result.current.candidates[0]?.status).toBe('addable');
  });
});

// silence unused-var warning for re-export
void createRealtimeSubscription;
