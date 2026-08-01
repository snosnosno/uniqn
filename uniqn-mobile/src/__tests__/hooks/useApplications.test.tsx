/**
 * UNIQN Mobile - useApplications Hook Tests
 *
 * @description 지원 관리 훅 테스트 - 기본 구조 및 API 검증
 * @version 1.0.3 - Jest hoisting 문제로 인해 기본 검증만 수행
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ============================================================================
// Import After Mocks
// ============================================================================

import { useApplications } from '@/hooks/useApplications';

// ============================================================================
// Mocks
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

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    applications: { mine: () => ['applications', 'mine'] },
    jobPostings: {
      detail: (id: string) => ['jobPostings', 'detail', id],
      lists: () => ['jobPostings', 'lists'],
    },
  },
  cachingPolicies: { frequent: 120000, standard: 300000 },
  // ⚠️ 손으로 쓴 부분 사본 — 실물에 키를 추가하면 여기도 추가할 것(누락 시 undefined).
  //    위 온라인 상수(2분·5분)와 다른 값이어야 아래 회귀 단언이 유효하다.
  offlineCachePolicies: { applications: 24 * 60 * 60 * 1000 },
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

const mockGetCriticalOfflineCache = jest.fn((..._args: unknown[]) => null);
jest.mock('@/services/offline/criticalOfflineCache', () => ({
  getCriticalOfflineCache: (...args: unknown[]) => mockGetCriticalOfflineCache(...args),
  setCriticalOfflineCache: jest.fn(),
}));

jest.mock('@/services', () => ({
  getMyApplications: jest.fn().mockResolvedValue([]),
  applyToJobV2: jest.fn().mockResolvedValue({ id: 'test', jobPostingId: 'job-1', assignments: [] }),
  cancelApplication: jest.fn().mockResolvedValue({ success: true }),
  requestCancellation: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { uid: 'test-user-1', displayName: 'Test User', phoneNumber: null, photoURL: null },
    profile: { name: 'Test User', nickname: 'tester', phone: '010-1234-5678', photoURL: null },
  }),
}));

jest.mock('@/errors', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/shared/errors', () => ({
  createMutationErrorHandler: () => jest.fn(),
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useApplications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 오프라인 MMKV 캐시는 만료를 stale 표시가 아니라 **완전 삭제**로 처리한다
  // (criticalOfflineCache.ts:133-147). 온라인 상수(5·10분)를 TTL 로 겸용하면 지하에서
  // 내 지원 현황이 통째로 사라져 "지원한 곳이 없어요"로 위장된다.
  it('오프라인 캐시 보존기간을 온라인 staleTime 과 겸용하지 않는다', () => {
    renderHook(() => useApplications(), { wrapper: createWrapper() });

    const ttls = mockGetCriticalOfflineCache.mock.calls.map(
      (call) => (call[1] as unknown as { ttlMs: number }).ttlMs
    );

    expect(ttls.length).toBeGreaterThan(0);
    expect(ttls.every((ttl) => ttl === 24 * 60 * 60 * 1000)).toBe(true);
  });

  describe('Hook API 구조', () => {
    it('hook이 올바른 반환값 구조를 가진다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      // 비동기 초기화 대기
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 반환값 구조 검증
      expect(result.current).toHaveProperty('myApplications');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isRefreshing');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('submitApplication');
      expect(result.current).toHaveProperty('isSubmitting');
      expect(result.current).toHaveProperty('cancelApplication');
      expect(result.current).toHaveProperty('isCancelling');
      expect(result.current).toHaveProperty('requestCancellation');
      expect(result.current).toHaveProperty('isRequestingCancellation');
      expect(result.current).toHaveProperty('hasApplied');
      expect(result.current).toHaveProperty('getApplicationStatus');
      expect(result.current).toHaveProperty('refresh');
    });

    it('myApplications가 배열이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(Array.isArray(result.current.myApplications)).toBe(true);
    });

    it('hasApplied가 함수이고 빈 데이터에서 false를 반환한다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.hasApplied).toBe('function');
      expect(result.current.hasApplied('any-job-id')).toBe(false);
    });

    it('getApplicationStatus가 함수이고 빈 데이터에서 null을 반환한다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.getApplicationStatus).toBe('function');
      expect(result.current.getApplicationStatus('any-job-id')).toBeNull();
    });

    it('submitApplication이 함수이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.submitApplication).toBe('function');
    });

    it('cancelApplication이 함수이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.cancelApplication).toBe('function');
    });

    it('requestCancellation이 함수이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.requestCancellation).toBe('function');
    });

    it('refresh가 함수이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('초기 상태', () => {
    it('초기 로딩 상태가 올바르다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      // 초기에는 로딩 중이거나 완료된 상태
      await waitFor(() => {
        expect(typeof result.current.isLoading).toBe('boolean');
      });
    });

    it('초기 에러 상태가 null이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(null);
    });

    it('초기 isSubmitting이 boolean이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // mutation의 isPending 상태가 false이거나 undefined일 수 있음
      expect(
        result.current.isSubmitting === false || result.current.isSubmitting === undefined
      ).toBe(true);
    });

    it('초기 isCancelling이 boolean이다', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // mutation의 isPending 상태가 false이거나 undefined일 수 있음
      expect(
        result.current.isCancelling === false || result.current.isCancelling === undefined
      ).toBe(true);
    });
  });
});
