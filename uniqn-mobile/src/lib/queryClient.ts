/**
 * UNIQN Mobile - React Query 설정
 *
 * @description Query Client 설정 및 Query Keys 중앙 관리
 * @version 1.2.0
 *
 * 기능:
 * - 전역 에러 핸들링 (QueryCache, MutationCache)
 * - 재시도 가능 에러 자동 재시도
 * - 토큰 만료 시 자동 처리
 * - 카테고리별 재시도 조건 설정
 * - 오프라인 지원 (onlineManager + NetInfo)
 */

import { QueryClient, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '@/utils/logger';
import { normalizeError, isRetryableError, requiresReauthentication } from '@/errors';

// ============================================================================
// 오프라인 지원
// ============================================================================

/**
 * 네트워크 상태 리스너 초기화
 *
 * @description React Query의 onlineManager와 네트워크 상태를 연동하여
 * 오프라인/온라인 상태에 따라 자동으로 쿼리 동작을 조절합니다.
 *
 * 웹 환경에서는 navigator.onLine을 사용하고,
 * 네이티브 환경에서는 @react-native-community/netinfo 패키지가 설치된 경우 활용합니다.
 *
 * @returns 리스너 해제 함수
 *
 * @example
 * ```tsx
 * // App.tsx에서 초기화
 * useEffect(() => {
 *   const unsubscribe = initializeQueryListeners();
 *   return () => unsubscribe();
 * }, []);
 * ```
 */
export function initializeQueryListeners(): () => void {
  const subscriptions: (() => void)[] = [];

  // 웹 환경: navigator.onLine 사용
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const handleOnline = () => {
      onlineManager.setOnline(true);
      logger.info('네트워크 상태 변경: 온라인');
    };
    const handleOffline = () => {
      onlineManager.setOnline(false);
      logger.info('네트워크 상태 변경: 오프라인');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 초기 상태 설정
    onlineManager.setOnline(navigator.onLine);

    subscriptions.push(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  }

  // 네이티브 환경: NetInfo 연동
  if (Platform.OS !== 'web') {
    // NetInfo 구독 - 네트워크 상태 변경 시 onlineManager 업데이트
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      onlineManager.setOnline(isOnline);
      logger.info('네트워크 상태 변경 (NetInfo)', {
        isOnline,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });
    subscriptions.push(unsubscribeNetInfo);

    // 앱 상태 변경 시 리페치 트리거
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        logger.debug('앱 포그라운드 전환, 쿼리 리페치 트리거');
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    subscriptions.push(() => appStateSubscription.remove());
  }

  logger.info('Query 네트워크 리스너 초기화', { platform: Platform.OS });

  // 모든 구독 해제 함수 반환
  return () => {
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
}

// ============================================================================
// 재시도 로직
// ============================================================================

/**
 * 쿼리/뮤테이션 재시도 판별 함수
 * 카테고리별로 재시도 가능 여부 결정
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // 최대 3회 재시도
  if (failureCount >= 3) return false;

  // 에러 정규화
  const appError = normalizeError(error);

  // 인증 관련 에러는 재시도하지 않음 (재로그인 필요)
  if (requiresReauthentication(appError)) return false;

  // 권한 에러는 재시도 의미 없음
  if (appError.category === 'permission') return false;

  // 검증 에러는 재시도 의미 없음
  if (appError.category === 'validation') return false;

  // 비즈니스 에러는 재시도 의미 없음 (이미 지원함, 정원 초과 등)
  if (appError.category === 'business') return false;

  // 그 외 재시도 가능 에러인지 확인
  return isRetryableError(appError);
}

/**
 * 재시도 딜레이 계산 (지수 백오프 + 지터)
 */
function getRetryDelay(attemptIndex: number): number {
  const baseDelay = 1000; // 1초
  const maxDelay = 30000; // 최대 30초
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0~30% 지터
  return exponentialDelay + jitter;
}

// ============================================================================
// Query/Mutation Cache 에러 핸들러
// ============================================================================

/**
 * QueryCache 설정 - 쿼리 에러 전역 처리
 */
const queryCache = new QueryCache({
  onError: (error, query) => {
    const appError = normalizeError(error);

    // 에러 로깅
    logger.error('Query error', appError, {
      queryKey: query.queryKey,
      errorCode: appError.code,
      errorCategory: appError.category,
    });

    // 토큰 만료 시 처리 (인증 상태 초기화는 AuthStore에서 처리)
    if (requiresReauthentication(appError)) {
      logger.warn('Authentication required', {
        errorCode: appError.code,
      });
      // 인증 관련 처리는 useAuth 훅 또는 AuthStore에서 감지
    }
  },
});

/**
 * MutationCache 설정 - 뮤테이션 에러 전역 처리
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    const appError = normalizeError(error);

    // 에러 로깅
    logger.error('Mutation error', appError, {
      mutationKey: mutation.options.mutationKey,
      errorCode: appError.code,
      errorCategory: appError.category,
    });

    // 토큰 만료 시 처리
    if (requiresReauthentication(appError)) {
      logger.warn('Authentication required for mutation', {
        errorCode: appError.code,
      });
    }
  },
});

// ============================================================================
// Query Client 설정
// ============================================================================

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      // 5분 동안 데이터를 fresh로 간주
      staleTime: 5 * 60 * 1000,
      // 5분 동안 캐시 유지 (모바일 메모리 최적화)
      gcTime: 5 * 60 * 1000,
      // 카테고리별 재시도 조건
      retry: shouldRetry,
      // 지수 백오프 + 지터 딜레이
      retryDelay: getRetryDelay,
      // 창 포커스 시 리페치 비활성화 (모바일에서는 불필요)
      refetchOnWindowFocus: false,
      // 재연결 시 리페치
      refetchOnReconnect: true,
      // 오프라인 우선: 오프라인 시 캐시된 데이터 반환, 온라인 복귀 시 백그라운드 리페치
      networkMode: 'offlineFirst',
    },
    mutations: {
      // 뮤테이션은 기본적으로 재시도하지 않음 (중복 생성 방지)
      retry: false,
      // 오프라인 시 뮤테이션 대기 후 온라인 복귀 시 실행
      networkMode: 'offlineFirst',
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
    profileBatch: (userIds: string[]) =>
      [...queryKeys.user.all, 'profileBatch', userIds.sort().join(',')] as const,
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
    search: (term: string) => [...queryKeys.jobPostings.all, 'search', term] as const,
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
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    // P2 아키텍처: 제네릭 타입으로 NotificationFilter 등 다양한 필터 지원
    list: <T extends object>(filters: T) =>
      [...queryKeys.notifications.all, 'list', filters] as const,
    unread: () => [...queryKeys.notifications.all, 'unread'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unreadCount'] as const,
    // P2 아키텍처: Query Keys 중앙 관리 확장
    settings: () => [...queryKeys.notifications.all, 'settings'] as const,
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
  },

  // 공고 템플릿 (구인자)
  templates: {
    all: ['templates'] as const,
    list: () => [...queryKeys.templates.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.templates.all, 'detail', id] as const,
  },

  // 지원자 관리 (구인자)
  applicantManagement: {
    all: ['applicantManagement'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'byJobPosting', jobPostingId] as const,
    stats: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'stats', jobPostingId] as const,
    cancellationRequests: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'cancellationRequests', jobPostingId] as const,
    /** 스태프 변환 가능 여부 (Phase 8 추가) */
    canConvertToStaff: (applicationId: string) =>
      [...queryKeys.applicantManagement.all, 'canConvertToStaff', applicationId] as const,
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

  // 확정 스태프 관리 (구인자)
  confirmedStaff: {
    all: ['confirmedStaff'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.confirmedStaff.all, 'byJobPosting', jobPostingId] as const,
    byDate: (jobPostingId: string, date: string) =>
      [...queryKeys.confirmedStaff.all, 'byDate', jobPostingId, date] as const,
    detail: (workLogId: string) => [...queryKeys.confirmedStaff.all, 'detail', workLogId] as const,
    grouped: (jobPostingId: string) =>
      [...queryKeys.confirmedStaff.all, 'grouped', jobPostingId] as const,
  },

  // 이벤트 QR (구인자 - 현장 출퇴근)
  eventQR: {
    all: ['eventQR'] as const,
    current: (jobPostingId: string, date: string, action: 'checkIn' | 'checkOut') =>
      [...queryKeys.eventQR.all, 'current', jobPostingId, date, action] as const,
    history: (jobPostingId: string) => [...queryKeys.eventQR.all, 'history', jobPostingId] as const,
  },

  // 신고 관리 (구인자)
  reports: {
    all: ['reports'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.reports.all, 'byJobPosting', jobPostingId] as const,
    byStaff: (staffId: string) => [...queryKeys.reports.all, 'byStaff', staffId] as const,
    detail: (reportId: string) => [...queryKeys.reports.all, 'detail', reportId] as const,
    myReports: () => [...queryKeys.reports.all, 'myReports'] as const,
  },

  // ============================================================================
  // 관리자용 Query Keys (Admin)
  // ============================================================================

  // 관리자 대시보드
  admin: {
    all: ['admin'] as const,
    dashboard: () => [...queryKeys.admin.all, 'dashboard'] as const,
    users: (filters: Record<string, unknown>) =>
      [...queryKeys.admin.all, 'users', filters] as const,
    userDetail: (userId: string) => [...queryKeys.admin.all, 'userDetail', userId] as const,
    metrics: () => [...queryKeys.admin.all, 'metrics'] as const,
  },

  // 대회공고 승인 관리
  tournaments: {
    all: ['tournaments'] as const,
    pending: () => [...queryKeys.tournaments.all, 'pending'] as const,
    approved: () => [...queryKeys.tournaments.all, 'approved'] as const,
    rejected: () => [...queryKeys.tournaments.all, 'rejected'] as const,
    detail: (id: string) => [...queryKeys.tournaments.all, 'detail', id] as const,
    myPending: () => [...queryKeys.tournaments.all, 'myPending'] as const,
  },

  // 공지사항
  announcements: {
    all: ['announcements'] as const,
    /** 발행된 공지 목록 (사용자용) */
    published: (filters?: Record<string, unknown>) =>
      [...queryKeys.announcements.all, 'published', filters] as const,
    /** 전체 공지 목록 (관리자용) */
    adminList: (filters?: Record<string, unknown>) =>
      [...queryKeys.announcements.all, 'admin', filters] as const,
    /** 공지 상세 */
    detail: (id: string) => [...queryKeys.announcements.all, 'detail', id] as const,
    /** 읽지 않은 공지 수 */
    unreadCount: () => [...queryKeys.announcements.all, 'unreadCount'] as const,
  },

  // 문의 (Inquiry)
  inquiries: {
    all: ['inquiries'] as const,
    /** 내 문의 목록 */
    mine: (userId?: string) => [...queryKeys.inquiries.all, 'mine', userId] as const,
    /** 전체 문의 목록 (관리자) */
    adminList: (filters?: Record<string, unknown>) =>
      [...queryKeys.inquiries.all, 'admin', filters] as const,
    /** 문의 상세 */
    detail: (id: string) => [...queryKeys.inquiries.all, 'detail', id] as const,
    /** 미답변 문의 수 */
    unansweredCount: () => [...queryKeys.inquiries.all, 'unansweredCount'] as const,
    /** FAQ */
    faq: (category?: string) => [...queryKeys.inquiries.all, 'faq', category] as const,
  },
  // 리뷰/평가 (버블)
  reviews: {
    all: ['reviews'] as const,
    byWorkLog: (workLogId: string) => [...queryKeys.reviews.all, 'byWorkLog', workLogId] as const,
    myGiven: () => [...queryKeys.reviews.all, 'myGiven'] as const,
    myReceived: () => [...queryKeys.reviews.all, 'myReceived'] as const,
    bubbleScore: (userId: string) => [...queryKeys.reviews.all, 'bubbleScore', userId] as const,
    eligibility: (workLogId: string) => [...queryKeys.reviews.all, 'eligibility', workLogId] as const,
    pending: () => [...queryKeys.reviews.all, 'pending'] as const,
  },

  // 인앱 메시지
  inAppMessages: {
    all: ['inAppMessages'] as const,
    active: () => [...queryKeys.inAppMessages.all, 'active'] as const,
  },
} as const;

// ============================================================================
// 캐싱 정책
// ============================================================================

/**
 * 데이터 특성에 따른 staleTime 정책
 *
 * @description 각 쿼리별 적절한 staleTime 선택 가이드:
 * - realtime: 정산, 근무기록 등 실시간 동기화 필수 데이터
 * - frequent: 스케줄 등 자주 변경될 수 있는 데이터
 * - standard: 공고 목록 등 보통 빈도의 데이터
 * - stable: 설정, 프로필 등 드물게 변경되는 데이터
 * - offlineFirst: 오프라인 우선 접근이 필요한 데이터
 */
export const cachingPolicies = {
  /** 실시간 데이터 - 30초 (settlement, workLogs) - 완전 realtime 대신 짧은 캐시 */
  realtime: 30 * 1000,
  /** 준실시간 - 2분 (notifications) - FCM 보완용 폴링 캐시 */
  nearRealtime: 2 * 60 * 1000,
  /** 자주 변경되는 데이터 - 5분 (schedules) - 네트워크 비용 절감 */
  frequent: 5 * 60 * 1000,
  /** 보통 빈도 - 10분 (기본값: jobPostings, applications) */
  standard: 10 * 60 * 1000,
  /** 드물게 변경 - 60분 (settings, user profile) */
  stable: 60 * 60 * 1000,
  /** 오프라인 우선 - 무제한 */
  offlineFirst: Infinity,
} as const;

/**
 * 쿼리 키별 권장 캐싱 정책 매핑
 *
 * @description 각 쿼리 도메인별 권장 staleTime/gcTime 설정
 * 훅에서 useQuery 호출 시 이 설정을 참조하여 일관된 캐싱 적용
 *
 * @example
 * ```typescript
 * // useSchedules.ts
 * const { data } = useQuery({
 *   queryKey: queryKeys.schedules.mine(),
 *   queryFn: fetchSchedules,
 *   staleTime: queryCachingOptions.schedules.staleTime,
 *   gcTime: queryCachingOptions.schedules.gcTime,
 * });
 * ```
 */
export const queryCachingOptions = {
  /** 스케줄 - 5분 (네트워크 비용 최적화) */
  schedules: {
    staleTime: cachingPolicies.frequent,
    gcTime: 15 * 60 * 1000, // 15분
  },
  /** 정산 - 30초 (금액 정확성 중요하지만 과도한 리페치 방지) */
  settlement: {
    staleTime: cachingPolicies.realtime,
    gcTime: 5 * 60 * 1000, // 5분
  },
  /** 근무기록 - 30초 (출퇴근 상태는 짧은 캐시 사용) */
  workLogs: {
    staleTime: cachingPolicies.realtime,
    gcTime: 5 * 60 * 1000, // 5분
  },
  /** 공고 목록 - 10분 */
  jobPostings: {
    staleTime: cachingPolicies.standard,
    gcTime: 10 * 60 * 1000, // 10분
  },
  /** 지원서 - 10분 */
  applications: {
    staleTime: cachingPolicies.standard,
    gcTime: 10 * 60 * 1000, // 10분
  },
  /** 알림 - 2분 (실시간 구독과 별개로 폴링 캐시) */
  notifications: {
    staleTime: cachingPolicies.nearRealtime,
    gcTime: 10 * 60 * 1000, // 10분
  },
  /** 확정 스태프 - 5분 */
  confirmedStaff: {
    staleTime: cachingPolicies.frequent,
    gcTime: 15 * 60 * 1000, // 15분
  },
  /** 사용자 설정 - 60분 */
  settings: {
    staleTime: cachingPolicies.stable,
    gcTime: 2 * 60 * 60 * 1000, // 2시간
  },
  /** 사용자 프로필 - 60분 */
  user: {
    staleTime: cachingPolicies.stable,
    gcTime: 2 * 60 * 60 * 1000, // 2시간
  },
  /** 리뷰/평가 - 10분 */
  reviews: {
    staleTime: cachingPolicies.standard,
    gcTime: 15 * 60 * 1000, // 15분
  },
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
  confirmedStaff: () => queryClient.invalidateQueries({ queryKey: queryKeys.confirmedStaff.all }),
  eventQR: () => queryClient.invalidateQueries({ queryKey: queryKeys.eventQR.all }),
  reports: () => queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
  settlement: () => queryClient.invalidateQueries({ queryKey: queryKeys.settlement.all }),
  /** 스태프 관리 관련 모든 쿼리 무효화 (스태프 + 정산 + 근무기록) */
  staffManagement: (jobPostingId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.confirmedStaff.byJobPosting(jobPostingId),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
  },
  /** 대회공고 승인 관련 모든 쿼리 무효화 */
  tournaments: () => queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all }),
  /** 대회공고 승인 후 관련 데이터 무효화 (대회공고 + 구인공고 목록) */
  tournamentApproval: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all });
  },
  /** 공지사항 관련 모든 쿼리 무효화 */
  announcements: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),
  /** 리뷰/평가 관련 모든 쿼리 무효화 */
  reviews: () => queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
  all: () => queryClient.invalidateQueries(),
};

// ============================================================================
// 관계 기반 캐시 무효화
// ============================================================================

/**
 * 데이터 관계 그래프
 *
 * 특정 데이터가 변경될 때 함께 무효화해야 하는 관련 데이터를 정의
 * - workLogs 변경 → schedules도 갱신 필요 (스케줄은 workLogs 데이터 포함)
 * - applications 변경 → schedules도 갱신 필요 (지원 상태가 스케줄에 표시)
 */
export const invalidationGraph: Record<string, string[]> = {
  workLogs: ['schedules'],
  applications: ['schedules'],
};

/**
 * 관계 데이터를 함께 무효화하는 헬퍼 함수
 *
 * @example
 * // workLogs 변경 시 schedules도 함께 무효화
 * await invalidateRelated('workLogs');
 */
/** 인자 없이 호출 가능한 무효화 함수 타입 */
type NoArgInvalidator = () => void | Promise<void>;

export async function invalidateRelated(primaryKey: keyof typeof invalidationGraph): Promise<void> {
  // 주 데이터 무효화 (invalidationGraph 키는 모두 인자 없는 함수)
  const primaryInvalidate = invalidateQueries[primaryKey as keyof typeof invalidateQueries] as
    | NoArgInvalidator
    | undefined;
  if (typeof primaryInvalidate === 'function') {
    await primaryInvalidate();
  }

  // 관련 데이터 무효화
  const relatedKeys = invalidationGraph[primaryKey] || [];
  for (const relatedKey of relatedKeys) {
    const relatedInvalidate = invalidateQueries[relatedKey as keyof typeof invalidateQueries] as
      | NoArgInvalidator
      | undefined;
    if (typeof relatedInvalidate === 'function') {
      await relatedInvalidate();
    }
  }
}

export default queryClient;
