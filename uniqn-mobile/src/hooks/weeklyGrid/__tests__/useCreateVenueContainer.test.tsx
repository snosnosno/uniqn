/**
 * useCreateVenueContainer — 운영처 컨테이너 생성 변이 훅 테스트
 *
 * (1) 이름을 kind='dated' 로 레포 getOrCreateVenueContainer 에 위임,
 * (2) 성공 시 weeklyGrid 쿼리 일괄 invalidate, (3) workspaceId 부재 시 레포 미호출+에러.
 * 토스트는 호출부 책임이라 훅에서 검증하지 않는다(mutation only).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';
import { useCreateVenueContainer } from '../useCreateVenueContainer';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  jobPostingRepository: { getOrCreateVenueContainer: jest.fn() },
}));

// gridWriteService 가 모듈 로드 시 import 하는 sibling 레포 — 실제 supabase 체인 로드 회피용 스텁.
jest.mock('@/repositories/weeklyGrid', () => ({ weeklyGridRepository: {} }));

const mockCreate = jobPostingRepository.getOrCreateVenueContainer as jest.Mock;

const FAKE_VENUE = {
  id: 'venue-1',
  name: '강남 홀덤펍',
  workspaceId: 'ws-1',
  ownerId: 'owner-1',
  venueId: 'venue-1',
  kind: 'dated',
  softTargets: {},
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

describe('useCreateVenueContainer', () => {
  beforeEach(() => mockCreate.mockReset());

  it('이름을 kind=dated 로 레포에 위임', async () => {
    mockCreate.mockResolvedValueOnce(FAKE_VENUE);
    const client = createClient();
    const { result } = renderHook(() => useCreateVenueContainer('ws-1'), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('강남 홀덤펍');
    });

    expect(mockCreate).toHaveBeenCalledWith('ws-1', { name: '강남 홀덤펍', kind: 'dated' });
  });

  it('성공 시 weeklyGrid 관련 쿼리를 일괄 invalidate', async () => {
    mockCreate.mockResolvedValueOnce(FAKE_VENUE);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateVenueContainer('ws-1'), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('강남 홀덤펍');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.weeklyGrid.all });
  });

  it('workspaceId 부재 시 레포 미호출 + 에러', async () => {
    const client = createClient();
    const { result } = renderHook(() => useCreateVenueContainer(undefined), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('강남 홀덤펍').catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
