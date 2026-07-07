/**
 * useOpsTournamentsForPosting — 공고→ops 대회 브릿지(N:1) 훅 테스트.
 * 1e Task 9 — 단수 useOpsTournamentForPosting(브릿지 1건)을 목록형으로 교체.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOpsTournamentsForPosting } from '../useOpsTournaments';
import { opsTournamentRepository } from '@/repositories/ops';
import type { OpsTournament } from '@/types/ops';

// jest.setup.js 의 전역 useQuery 모킹을 실제 구현으로 복원
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories/ops', () => ({
  opsTournamentRepository: { listByPosting: jest.fn() },
}));

jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: jest.fn(() => jest.fn()),
}));

const mockListByPosting = opsTournamentRepository.listByPosting as jest.Mock;

const TOURNAMENT: OpsTournament = {
  id: 't1',
  ownerId: 'owner1',
  jobPostingId: 'posting-1',
  name: '수요 딥스택',
  venue: null,
  eventDate: null,
  gameType: 'NLH',
  status: 'upcoming',
  seatsPerTable: 9,
  startingChips: 30000,
  color: null,
  buyInChips: 30000,
  rebuyChips: 30000,
  addonChips: 20000,
  buyInCost: 50000,
  feeCost: 5000,
  rebuyCost: 50000,
  addonCost: 30000,
  bountyCost: null,
  registrationOpen: true,
  autoSeatOnRegister: false,
  reentryAllowed: false,
  maxReentries: null,
  monitorToken: null,
  nextEntrySeq: 1,
  createdAt: '2026-07-07T00:00:00Z',
  updatedAt: '2026-07-07T00:00:00Z',
};

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useOpsTournamentsForPosting', () => {
  beforeEach(() => {
    mockListByPosting.mockReset();
  });

  it('jobPostingId 로 연결된 대회 목록을 조회한다(N건)', async () => {
    mockListByPosting.mockResolvedValueOnce([TOURNAMENT]);

    const { result } = renderHook(() => useOpsTournamentsForPosting('posting-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.opsTournaments).toEqual([TOURNAMENT]));
    expect(mockListByPosting).toHaveBeenCalledWith('posting-1');
  });

  it('jobPostingId 가 undefined 면 조회를 건너뛰고 빈 배열을 반환한다(disabled)', async () => {
    const { result } = renderHook(() => useOpsTournamentsForPosting(undefined), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockListByPosting).not.toHaveBeenCalled();
    expect(result.current.opsTournaments).toEqual([]);
  });

  it('연결된 대회가 없으면 빈 배열을 반환한다(null-safe)', async () => {
    mockListByPosting.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useOpsTournamentsForPosting('posting-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.opsTournaments).toEqual([]);
  });
});
