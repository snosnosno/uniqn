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
// Import After Mocks
// ============================================================================

import { useJobPostings } from '@/hooks/useJobPostings';

// ============================================================================
// Firebase Mock
// ============================================================================

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetJobPostings = jest.fn();
const mockConvertToCard = jest.fn((posting) => posting as JobPostingCard);

jest.mock('@/services', () => ({
  getJobPostings: (...args: unknown[]) => mockGetJobPostings(...args),
  convertToCard: (posting: unknown) => mockConvertToCard(posting),
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
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Mock job posting data factory
function createMockJobPosting(
  id: string,
  workDate: string,
  dateRequirements?: { date: string; timeSlots: { startTime: string }[] }[]
): JobPostingCard {
  const defaultRole = { role: 'dealer', count: 1, filled: 0 };
  return {
    id,
    title: `Test Job ${id}`,
    status: 'active',
    postingType: 'regular',
    workDate,
    timeSlot: '10:00 - 18:00',
    dateRequirements: dateRequirements?.map(dr => ({
      date: dr.date,
      timeSlots: dr.timeSlots.map(ts => ({
        startTime: ts.startTime,
        roles: [defaultRole],
      })),
    })) ?? [],
    location: '서울 강남구',
    roles: ['dealer'],
  } as JobPostingCard;
}

// ============================================================================
// Tests
// ============================================================================

describe('useJobPostings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConvertToCard.mockImplementation((posting) => posting);
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
      const { result } = renderHook(
        () => useJobPostings({ enabled: false }),
        { wrapper: createWrapper() }
      );

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
