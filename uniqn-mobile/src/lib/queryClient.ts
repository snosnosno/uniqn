/**
 * UNIQN Mobile - React Query 설정
 *
 * @description Query Client 설정 및 Query Keys 중앙 관리
 * @version 1.0.0
 *
 * TODO [출시 전]: 오프라인 지원 설정 (onlineManager)
 * TODO [출시 전]: 네트워크 재연결 시 자동 리페치 최적화
 * TODO [출시 전]: 글로벌 에러 핸들러에서 토스트 알림 연동
 */

import { QueryClient } from '@tanstack/react-query';
import { logger } from '@/utils/logger';

// ============================================================================
// Query Client 설정
// ============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5분 동안 데이터를 fresh로 간주
      staleTime: 5 * 60 * 1000,
      // 10분 동안 캐시 유지 (garbage collection time)
      gcTime: 10 * 60 * 1000,
      // 실패 시 2회 재시도
      retry: 2,
      // 창 포커스 시 리페치 비활성화 (모바일에서는 불필요)
      refetchOnWindowFocus: false,
      // 재연결 시 리페치
      refetchOnReconnect: true,
    },
    mutations: {
      // 뮤테이션 실패 시 재시도하지 않음
      retry: false,
      onError: (error) => {
        logger.error('Mutation error', error instanceof Error ? error : undefined);
      },
    },
  },
});

// ============================================================================
// Query Keys - 중앙 관리
// ============================================================================

/**
 * 모든 Query Key를 중앙에서 관리
 * 일관된 키 패턴으로 캐시 무효화 용이
 */
export const queryKeys = {
  // 사용자
  user: {
    all: ['user'] as const,
    current: () => [...queryKeys.user.all, 'current'] as const,
    profile: (uid: string) => [...queryKeys.user.all, 'profile', uid] as const,
  },

  // 구인공고
  jobPostings: {
    all: ['jobPostings'] as const,
    lists: () => [...queryKeys.jobPostings.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.jobPostings.all, 'list', filters] as const,
    details: () => [...queryKeys.jobPostings.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobPostings.all, 'detail', id] as const,
    mine: () => [...queryKeys.jobPostings.all, 'mine'] as const,
  },

  // 지원서
  applications: {
    all: ['applications'] as const,
    lists: () => [...queryKeys.applications.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.applications.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.applications.all, 'detail', id] as const,
    mine: () => [...queryKeys.applications.all, 'mine'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.applications.all, 'byJobPosting', jobPostingId] as const,
  },

  // 스케줄
  schedules: {
    all: ['schedules'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.schedules.all, 'list', filters] as const,
    mine: () => [...queryKeys.schedules.all, 'mine'] as const,
    byDate: (date: string) => [...queryKeys.schedules.all, 'byDate', date] as const,
    byMonth: (year: number, month: number) =>
      [...queryKeys.schedules.all, 'byMonth', year, month] as const,
  },

  // 근무 기록
  workLogs: {
    all: ['workLogs'] as const,
    mine: () => [...queryKeys.workLogs.all, 'mine'] as const,
    byDate: (date: string) => [...queryKeys.workLogs.all, 'byDate', date] as const,
    bySchedule: (scheduleId: string) =>
      [...queryKeys.workLogs.all, 'bySchedule', scheduleId] as const,
  },

  // 알림
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
    unread: () => [...queryKeys.notifications.all, 'unread'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unreadCount'] as const,
  },

  // 설정
  settings: {
    all: ['settings'] as const,
    user: () => [...queryKeys.settings.all, 'user'] as const,
    notification: () => [...queryKeys.settings.all, 'notification'] as const,
  },

  // ============================================================================
  // 구인자용 Query Keys (Employer)
  // ============================================================================

  // 공고 관리 (구인자)
  jobManagement: {
    all: ['jobManagement'] as const,
    myPostings: () => [...queryKeys.jobManagement.all, 'myPostings'] as const,
    stats: () => [...queryKeys.jobManagement.all, 'stats'] as const,
    draft: () => [...queryKeys.jobManagement.all, 'draft'] as const,
  },

  // 지원자 관리 (구인자)
  applicantManagement: {
    all: ['applicantManagement'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'byJobPosting', jobPostingId] as const,
    stats: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'stats', jobPostingId] as const,
  },

  // 정산 관리 (구인자)
  settlement: {
    all: ['settlement'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.settlement.all, 'byJobPosting', jobPostingId] as const,
    summary: (jobPostingId: string) =>
      [...queryKeys.settlement.all, 'summary', jobPostingId] as const,
    mySummary: () => [...queryKeys.settlement.all, 'mySummary'] as const,
    calculation: (workLogId: string) =>
      [...queryKeys.settlement.all, 'calculation', workLogId] as const,
  },
} as const;

// ============================================================================
// 캐싱 정책
// ============================================================================

/**
 * 데이터 특성에 따른 staleTime 정책
 */
export const cachingPolicies = {
  /** 실시간 데이터 - 항상 fresh 체크 */
  realtime: 0,
  /** 자주 변경되는 데이터 - 2분 */
  frequent: 2 * 60 * 1000,
  /** 보통 빈도 - 5분 (기본값) */
  standard: 5 * 60 * 1000,
  /** 드물게 변경 - 30분 */
  stable: 30 * 60 * 1000,
  /** 오프라인 우선 - 무제한 */
  offlineFirst: Infinity,
} as const;

// ============================================================================
// 캐시 무효화 유틸리티
// ============================================================================

/**
 * 특정 쿼리 그룹 무효화
 */
export const invalidateQueries = {
  jobPostings: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all }),
  applications: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
  schedules: () => queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
  workLogs: () => queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all }),
  notifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  user: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.all }),
  all: () => queryClient.invalidateQueries(),
};

export default queryClient;
