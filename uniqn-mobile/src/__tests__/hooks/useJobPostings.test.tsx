/**
 * UNIQN Mobile - useJobPostings Hook Tests
 *
 * @description 구인공고 목록 훅 테스트 - 정렬 로직 중심
 * @version 1.0.0
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { JobPostingCard } from '@/types';

// ============================================================================
// Import Hook After Mocks
// ============================================================================

import { useJobPostings } from '@/hooks/useJobPostings';

// ============================================================================
// Supabase Mock
// ============================================================================

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetJobPostings = jest.fn();
const mockConvertToCard = jest.fn((posting) => posting as JobPostingCard);
const mockMatchesPostingDate = jest.fn((job: JobPostingCard, date?: string) => {
  if (!date) return true;

  if (job.dateRequirements?.length) {
    return job.dateRequirements.some((requirement) => requirement.date === date);
  }

  return job.workDate === date;
});
const mockFocusPostingCardToDate = jest.fn((job: JobPostingCard, date?: string) => {
  if (!date || job.workflow?.isFixed || job.scheduleDisplay?.variant === 'legacy') {
    return job;
  }

  const matchingRequirement = job.dateRequirements?.find(
    (requirement) => requirement.date === date
  );
  if (!matchingRequirement) {
    return job;
  }

  return {
    ...job,
    workflow: {
      ...job.workflow,
      usesGroupedDateRanges: false,
    },
    dateRequirements: [matchingRequirement],
    scheduleDisplay: {
      ...job.scheduleDisplay,
      variant: 'dated_requirements',
      dateRequirements: [matchingRequirement],
      dateGroups: [],
    },
    displayContext: {
      focusedDate: date,
      wasGroupedRange: job.workflow?.usesGroupedDateRanges ?? false,
    },
  };
});

jest.mock('@/services', () => ({
  getJobPostings: (...args: unknown[]) => mockGetJobPostings(...args),
  convertToCard: (posting: unknown) => mockConvertToCard(posting),
}));

jest.mock('@/domains/job-posting', () => ({
  buildPostingFacts: (posting: unknown) => posting,
  projectPostingCard: (posting: unknown) => posting,
  matchesPostingDate: (...args: [JobPostingCard, string | undefined]) =>
    mockMatchesPostingDate(...args),
  focusPostingCardToDate: (...args: [JobPostingCard, string | undefined]) =>
    mockFocusPostingCardToDate(...args),
}));

jest.mock('@/utils/queryUtils', () => ({
  stableFilters: (filters: unknown) => filters,
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: true,
    isOffline: false,
    isChecking: false,
    connectionType: 'wifi',
    isInternetReachable: true,
    lastChecked: null,
    details: null,
    checkConnection: jest.fn(),
  }),
}));

jest.mock('@/services/offline/criticalOfflineCache', () => ({
  getCriticalOfflineCache: jest.fn(() => null),
  setCriticalOfflineCache: jest.fn(),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    jobPostings: {
      list: (filters: unknown) => ['jobPostings', 'list', filters],
      all: ['jobPostings'],
      detail: (id: string) => ['jobPostings', 'detail', id],
    },
  },
  queryCachingOptions: {
    jobPostings: {
      staleTime: 0,
      gcTime: 0,
    },
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// Mock job posting data factory
function createMockJobPosting(
  id: string,
  workDate: string,
  dateRequirements?: {
    date: string;
    isGrouped?: boolean;
    timeSlots: { startTime: string }[];
  }[]
): JobPostingCard {
  const defaultRole = { role: 'dealer', count: 1, filled: 0 };
  const normalizedDateRequirements =
    dateRequirements?.map((dr) => ({
      date: dr.date,
      isGrouped: dr.isGrouped,
      timeSlots: dr.timeSlots.map((ts) => ({
        startTime: ts.startTime,
        roles: [defaultRole],
      })),
    })) ?? [];
  const usesGroupedDateRanges = normalizedDateRequirements.some(
    (requirement) => requirement.isGrouped
  );

  return {
    id,
    title: `Test Job ${id}`,
    status: 'active',
    postingType: 'regular',
    workDate,
    timeSlot: '10:00 - 18:00',
    dateRequirements: normalizedDateRequirements,
    location: '서울 강남구',
    roles: ['dealer'],
    workflow: {
      isFixed: false,
      usesGroupedDateRanges,
    },
    scheduleDisplay: {
      variant: normalizedDateRequirements.length
        ? usesGroupedDateRanges
          ? 'grouped_dates'
          : 'dated_requirements'
        : 'legacy',
      workDate,
      timeSlot: '10:00 - 18:00',
      fixed: undefined,
      dateRequirements: normalizedDateRequirements,
      dateGroups: [],
    },
  } as unknown as JobPostingCard;
}

// ============================================================================
// Tests
// ============================================================================

describe('useJobPostings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConvertToCard.mockImplementation((posting) => posting);
    mockMatchesPostingDate.mockClear();
    mockFocusPostingCardToDate.mockClear();
  });

  describe('기본 기능', () => {
    it('공고 목록을 조회한다', async () => {
      const mockData = [
        createMockJobPosting('1', '2025-02-01'),
        createMockJobPosting('2', '2025-02-02'),
      ];

      mockGetJobPostings.mockResolvedValue({
        items: mockData,
        lastDoc: null,
        hasMore: false,
      });

      const { result } = renderHook(() => useJobPostings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.jobs).toHaveLength(2);
    });

    it('enabled=false일 때 조회하지 않는다', async () => {
      const { result } = renderHook(() => useJobPostings({ enabled: false }), {
        wrapper: createWrapper(),
      });

      // 짧은 대기 후 확인
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetJobPostings).not.toHaveBeenCalled();
      expect(result.current.jobs).toHaveLength(0);
    });
  });

  describe('정렬 로직', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    it('미래 날짜가 과거 날짜보다 먼저 정렬된다', async () => {
      const mockData = [
        createMockJobPosting('past', yesterday ?? ''),
        createMockJobPosting('future', tomorrow ?? ''),
      ];

      mockGetJobPostings.mockResolvedValue({
        items: mockData,
        lastDoc: null,
        hasMore: false,
      });

      const { result } = renderHook(() => useJobPostings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.jobs[0]?.id).toBe('future');
      expect(result.current.jobs[1]?.id).toBe('past');
    });

    it('미래 날짜 중에서는 가까운 날짜가 먼저 정렬된다', async () => {
      const mockData = [
        createMockJobPosting('far', nextWeek ?? ''),
        createMockJobPosting('near', tomorrow ?? ''),
        createMockJobPosting('today', today ?? ''),
      ];

      mockGetJobPostings.mockResolvedValue({
        items: mockData,
        lastDoc: null,
        hasMore: false,
      });

      const { result } = renderHook(() => useJobPostings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 오늘 → 내일 → 다음주 순서
      expect(result.current.jobs[0]?.id).toBe('today');
      expect(result.current.jobs[1]?.id).toBe('near');
      expect(result.current.jobs[2]?.id).toBe('far');
    });

    it('dateRequirements가 있으면 가장 빠른 미래 날짜로 정렬한다', async () => {
      const mockData = [
        createMockJobPosting('multi', '', [
          { date: nextWeek ?? '', timeSlots: [{ startTime: '10:00' }] },
          { date: tomorrow ?? '', timeSlots: [{ startTime: '14:00' }] },
        ]),
        createMockJobPosting('single', tomorrow ?? ''),
      ];

      mockGetJobPostings.mockResolvedValue({
        items: mockData,
        lastDoc: null,
        hasMore: false,
      });

      const { result } = renderHook(() => useJobPostings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 둘 다 tomorrow가 가장 빠른 미래 날짜
      // single은 시간 미지정(99:99), multi는 14:00 → multi가 먼저
      expect(result.current.jobs).toHaveLength(2);
    });

    it('시간까지 고려해서 정렬한다', async () => {
      const mockData = [
        createMockJobPosting('late', '', [
          { date: tomorrow ?? '', timeSlots: [{ startTime: '18:00' }] },
        ]),
        createMockJobPosting('early', '', [
          { date: tomorrow ?? '', timeSlots: [{ startTime: '09:00' }] },
        ]),
      ];

      mockGetJobPostings.mockResolvedValue({
        items: mockData,
        lastDoc: null,
        hasMore: false,
      });

      const { result } = renderHook(() => useJobPostings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.jobs[0]?.id).toBe('early');
      expect(result.current.jobs[1]?.id).toBe('late');
    });

    it('selected workDate focuses grouped cards to the chosen date only', async () => {
      const selectedDate = nextWeek ?? '';
      const mockData = [
        createMockJobPosting('grouped', tomorrow ?? '', [
          { date: tomorrow ?? '', isGrouped: true, timeSlots: [{ startTime: '18:00' }] },
          { date: selectedDate, isGrouped: true, timeSlots: [{ startTime: '09:00' }] },
        ]),
        createMockJobPosting('single', selectedDate, [
          { date: selectedDate, timeSlots: [{ startTime: '19:00' }] },
        ]),
        createMockJobPosting('invalid', selectedDate, [
          { date: tomorrow ?? '', timeSlots: [{ startTime: '08:00' }] },
        ]),
      ];

      mockGetJobPostings.mockResolvedValue({
        items: mockData,
        lastDoc: null,
        hasMore: false,
      });

      const { result } = renderHook(
        () => useJobPostings({ filters: { postingType: 'regular', workDate: selectedDate } }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.jobs.map((job) => job.id)).toEqual(['grouped', 'single']);
      expect(result.current.jobs[0]?.dateRequirements).toHaveLength(1);
      expect(result.current.jobs[0]?.dateRequirements[0]?.date).toBe(selectedDate);
      expect(result.current.jobs[0]?.displayContext).toEqual({
        focusedDate: selectedDate,
        wasGroupedRange: true,
      });
      expect(mockMatchesPostingDate).toHaveBeenCalled();
      expect(mockFocusPostingCardToDate).toHaveBeenCalled();
    });
  });

  describe('에러 처리', () => {
    it('API 에러 시 에러 상태를 반환한다', async () => {
      const mockError = new Error('Network error');
      mockGetJobPostings.mockRejectedValue(mockError);

      const { result } = renderHook(() => useJobPostings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});
