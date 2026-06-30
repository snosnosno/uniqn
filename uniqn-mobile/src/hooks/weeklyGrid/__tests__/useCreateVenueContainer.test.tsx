/**
 * useCreateVenueContainer — 운영처 컨테이너 생성 변이 훅 테스트
 *
 * (1) 이름을 kind='dated' 로 레포 getOrCreateVenueContainer 에 위임,
 * (2) 성공 시 weeklyGrid 쿼리 일괄 invalidate, (3) workspaceId 부재 시 레포 미호출+에러.
 * (4) 성공 시 컨테이너 목록 캐시에 낙관적 시드(N→N+1 자동선택 바운스 방지).
 * 토스트는 호출부 책임이라 훅에서 검증하지 않는다(mutation only).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';
import type { VenueContainer } from '@/domains/weeklyGrid';
import { useCreateVenueContainer } from '../useCreateVenueContainer';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  jobPostingRepository: { getOrCreateVenueContainer: jest.fn() },
}));

// gridWriteService 가 모듈 로드 시 import 하는 sibling 레포 — 실제 supabase 체인 로드 회피용 스텁.
jest.mock('@/repositories/weeklyGrid', () => ({ weeklyGridRepository: {} }));

const mockCreate = jobPostingRepository.getOrCreateVenueContainer as jest.Mock;

const FAKE_VENUE: VenueContainer = {
  id: 'venue-1',
  name: '강남 홀덤펍',
  workspaceId: 'ws-1',
  ownerId: 'owner-1',
  venueId: 'venue-1',
  kind: 'dated',
  softTargets: {},
};

/** 낙관적 시드 시나리오: 이미 캐시에 있는 기존 컨테이너 */
const EXISTING_VENUE: VenueContainer = {
  id: 'venue-existing',
  name: '기존 홀덤펍',
  workspaceId: 'ws-1',
  ownerId: null,
  venueId: 'venue-existing',
  kind: 'dated',
  softTargets: {},
};

/** 낙관적 시드 시나리오: 신규 생성되는 컨테이너 */
const NEW_VENUE: VenueContainer = {
  id: 'venue-new',
  name: '신규 홀덤펍',
  workspaceId: 'ws-1',
  ownerId: null,
  venueId: 'venue-new',
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

  it('성공 시 기존 컨테이너 목록에 새 컨테이너를 낙관적으로 시드 (N→N+1 자동선택 유지)', async () => {
    // RED 전제: 훅 onSuccess 가 setQueryData 낙관적 시드를 하지 않으면
    // invalidate 는 비동기라 동기 시점엔 NEW_VENUE 가 캐시에 없어 이 테스트가 실패한다.
    mockCreate.mockResolvedValueOnce(NEW_VENUE);
    const client = createClient();
    // 기존 컨테이너 1개 사전 시드 (N≥1 시나리오)
    client.setQueryData(queryKeys.weeklyGrid.containers('ws-1'), [EXISTING_VENUE]);

    const { result } = renderHook(() => useCreateVenueContainer('ws-1'), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('신규 홀덤펍');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<VenueContainer[]>(queryKeys.weeklyGrid.containers('ws-1'));
    // 기존 + 신규 둘 다 존재해야 화면의 자기-치유 effect 가 신규 선택을 유지할 수 있다.
    expect(cached?.some((c) => c.id === NEW_VENUE.id)).toBe(true);
    expect(cached?.some((c) => c.id === EXISTING_VENUE.id)).toBe(true);
    expect(cached?.length).toBe(2);
  });

  it('낙관적 시드 멱등: 새 컨테이너가 이미 캐시에 있으면 중복 추가 안함', async () => {
    mockCreate.mockResolvedValueOnce(NEW_VENUE);
    const client = createClient();
    // 이미 NEW_VENUE 가 캐시에 있는 상태(예: 다른 경로로 미리 채워진 경우)
    client.setQueryData(queryKeys.weeklyGrid.containers('ws-1'), [EXISTING_VENUE, NEW_VENUE]);

    const { result } = renderHook(() => useCreateVenueContainer('ws-1'), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('신규 홀덤펍');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = client.getQueryData<VenueContainer[]>(queryKeys.weeklyGrid.containers('ws-1'));
    // 중복 추가 없이 길이 유지
    expect(cached?.length).toBe(2);
  });
});
