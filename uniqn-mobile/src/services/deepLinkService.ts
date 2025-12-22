/**
 * UNIQN Mobile - Deep Link 서비스
 *
 * @description 딥링크 URL 파싱, 네비게이션, 알림 연동
 * @version 1.0.0
 *
 * 지원 스킴:
 * - Custom Scheme: uniqn://
 * - Universal Links: https://uniqn.app (TODO: 도메인 설정 후)
 *
 * 딥링크 경로 예시:
 * - uniqn://jobs/:id - 공고 상세
 * - uniqn://schedule/:date - 스케줄
 * - uniqn://notifications - 알림 목록
 * - uniqn://my-applications - 내 지원 내역
 */

import { Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { router } from 'expo-router';
import { logger } from '@/utils/logger';
import { trackEvent } from './analyticsService';
import type { NotificationType } from '@/types/notification';

// ============================================================================
// Constants
// ============================================================================

/** 앱 Custom Scheme */
export const APP_SCHEME = 'uniqn';

/** 웹 도메인 (Universal Links용) */
export const WEB_DOMAIN = 'uniqn.app';

/** 딥링크 경로 접두사 */
const SCHEME_PREFIX = `${APP_SCHEME}://`;
const WEB_PREFIX = `https://${WEB_DOMAIN}`;

// ============================================================================
// Types
// ============================================================================

/**
 * 딥링크 라우트 정의
 */
export type DeepLinkRoute =
  // 공개 라우트
  | { name: 'home' }
  | { name: 'jobs' }
  | { name: 'job'; params: { id: string } }
  // 인증 필요 라우트
  | { name: 'notifications' }
  | { name: 'notification'; params: { id: string } }
  | { name: 'schedule'; params?: { date?: string } }
  | { name: 'my-applications' }
  | { name: 'application'; params: { id: string } }
  | { name: 'profile' }
  // 구인자 라우트
  | { name: 'employer/my-postings' }
  | { name: 'employer/posting'; params: { id: string } }
  | { name: 'employer/applicants'; params: { jobId: string } }
  | { name: 'employer/settlement'; params: { jobId: string } }
  // 설정
  | { name: 'settings' }
  | { name: 'settings/notifications' };

/**
 * 딥링크 파싱 결과
 */
export interface ParsedDeepLink {
  /** 원본 URL */
  url: string;
  /** 경로 */
  path: string;
  /** 쿼리 파라미터 */
  queryParams: Record<string, string>;
  /** 파싱된 라우트 */
  route: DeepLinkRoute | null;
  /** 유효한 딥링크 여부 */
  isValid: boolean;
}

/**
 * 알림 타입별 딥링크 매핑
 */
type NotificationDeepLinkMap = Partial<
  Record<NotificationType, (data?: Record<string, string>) => DeepLinkRoute>
>;

// ============================================================================
// Route Mapping
// ============================================================================

/**
 * 경로 문자열 → 라우트 객체 매핑
 */
function pathToRoute(path: string, params: Record<string, string>): DeepLinkRoute | null {
  // 경로 정규화 (앞뒤 슬래시 제거)
  const normalizedPath = path.replace(/^\/|\/$/g, '');
  const segments = normalizedPath.split('/');

  // 경로별 라우트 매핑
  switch (segments[0]) {
    case '':
    case 'home':
      return { name: 'home' };

    case 'jobs':
      if (segments[1]) {
        return { name: 'job', params: { id: segments[1] } };
      }
      return { name: 'jobs' };

    case 'notifications':
      if (segments[1]) {
        return { name: 'notification', params: { id: segments[1] } };
      }
      return { name: 'notifications' };

    case 'schedule':
      return { name: 'schedule', params: segments[1] ? { date: segments[1] } : undefined };

    case 'my-applications':
      return { name: 'my-applications' };

    case 'application':
    case 'applications':
      if (segments[1]) {
        return { name: 'application', params: { id: segments[1] } };
      }
      return { name: 'my-applications' };

    case 'profile':
      return { name: 'profile' };

    case 'settings':
      if (segments[1] === 'notifications') {
        return { name: 'settings/notifications' };
      }
      return { name: 'settings' };

    case 'employer':
      if (segments[1] === 'my-postings') {
        return { name: 'employer/my-postings' };
      }
      if (segments[1] === 'posting' && segments[2]) {
        return { name: 'employer/posting', params: { id: segments[2] } };
      }
      if (segments[1] === 'applicants' && segments[2]) {
        return { name: 'employer/applicants', params: { jobId: segments[2] } };
      }
      if (segments[1] === 'settlement' && segments[2]) {
        return { name: 'employer/settlement', params: { jobId: segments[2] } };
      }
      return { name: 'employer/my-postings' };

    default:
      // 쿼리 파라미터에서 경로 힌트 찾기
      if (params.jobId) {
        return { name: 'job', params: { id: params.jobId } };
      }
      if (params.applicationId) {
        return { name: 'application', params: { id: params.applicationId } };
      }
      if (params.notificationId) {
        return { name: 'notification', params: { id: params.notificationId } };
      }
      return null;
  }
}

/**
 * 라우트 → Expo Router 경로 변환
 */
function routeToExpoPath(route: DeepLinkRoute): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'jobs':
      return '/jobs';
    case 'job':
      return `/jobs/${route.params.id}`;
    case 'notifications':
      return '/notifications';
    case 'notification':
      return `/notifications/${route.params.id}`;
    case 'schedule':
      return route.params?.date ? `/schedule/${route.params.date}` : '/schedule';
    case 'my-applications':
      return '/my-applications';
    case 'application':
      return `/applications/${route.params.id}`;
    case 'profile':
      return '/profile';
    case 'settings':
      return '/settings';
    case 'settings/notifications':
      return '/settings/notifications';
    case 'employer/my-postings':
      return '/employer/my-postings';
    case 'employer/posting':
      return `/employer/postings/${route.params.id}`;
    case 'employer/applicants':
      return `/employer/applicants/${route.params.jobId}`;
    case 'employer/settlement':
      return `/employer/settlement/${route.params.jobId}`;
    default:
      return '/';
  }
}

// ============================================================================
// Notification → DeepLink Mapping
// ============================================================================

/**
 * 알림 타입별 딥링크 라우트 생성
 */
const NOTIFICATION_DEEP_LINK_MAP: NotificationDeepLinkMap = {
  // 지원 관련 → 지원 상세
  new_application: (data) =>
    data?.applicationId
      ? { name: 'application', params: { id: data.applicationId } }
      : { name: 'employer/my-postings' },
  application_confirmed: (data) =>
    data?.applicationId
      ? { name: 'application', params: { id: data.applicationId } }
      : { name: 'my-applications' },
  application_rejected: (data) =>
    data?.applicationId
      ? { name: 'application', params: { id: data.applicationId } }
      : { name: 'my-applications' },
  application_cancelled: (data) =>
    data?.jobId
      ? { name: 'employer/applicants', params: { jobId: data.jobId } }
      : { name: 'employer/my-postings' },
  confirmation_cancelled: (data) =>
    data?.applicationId
      ? { name: 'application', params: { id: data.applicationId } }
      : { name: 'my-applications' },

  // 출퇴근 관련 → 스케줄
  staff_checked_in: (data) => ({ name: 'schedule', params: data?.date ? { date: data.date } : undefined }),
  staff_checked_out: (data) => ({ name: 'schedule', params: data?.date ? { date: data.date } : undefined }),
  checkin_reminder: (data) => ({ name: 'schedule', params: data?.date ? { date: data.date } : undefined }),
  no_show_alert: (data) => ({ name: 'schedule', params: data?.date ? { date: data.date } : undefined }),
  schedule_change: (data) => ({ name: 'schedule', params: data?.date ? { date: data.date } : undefined }),

  // 정산 관련
  settlement_completed: () => ({ name: 'schedule' }),
  settlement_requested: (data) =>
    data?.jobId
      ? { name: 'employer/settlement', params: { jobId: data.jobId } }
      : { name: 'employer/my-postings' },

  // 공고 관련 → 공고 상세
  job_closing_soon: (data) =>
    data?.jobId ? { name: 'job', params: { id: data.jobId } } : { name: 'jobs' },
  new_job_in_area: (data) =>
    data?.jobId ? { name: 'job', params: { id: data.jobId } } : { name: 'jobs' },
  job_updated: (data) =>
    data?.jobId ? { name: 'job', params: { id: data.jobId } } : { name: 'jobs' },
  job_cancelled: () => ({ name: 'my-applications' }),

  // 시스템 → 알림 목록
  announcement: () => ({ name: 'notifications' }),
  maintenance: () => ({ name: 'notifications' }),
  app_update: () => ({ name: 'notifications' }),

  // 칩 관련 → 프로필
  chips_purchased: () => ({ name: 'profile' }),
  low_chips_warning: () => ({ name: 'profile' }),
  chips_refunded: () => ({ name: 'profile' }),

  // 관리자 → 알림 목록
  inquiry_answered: () => ({ name: 'notifications' }),
  report_resolved: () => ({ name: 'notifications' }),
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 딥링크 URL 파싱
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  try {
    let path = '';
    const queryParams: Record<string, string> = {};

    // URL 파싱
    if (url.startsWith(SCHEME_PREFIX)) {
      // Custom Scheme: uniqn://path?query
      const withoutScheme = url.slice(SCHEME_PREFIX.length);
      const [pathPart, queryPart] = withoutScheme.split('?');
      path = pathPart;

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }
    } else if (url.startsWith(WEB_PREFIX)) {
      // Universal Link: https://uniqn.app/path?query
      const urlObj = new URL(url);
      path = urlObj.pathname;
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
    } else if (url.startsWith('/')) {
      // 상대 경로
      const [pathPart, queryPart] = url.split('?');
      path = pathPart;

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }
    } else {
      // 알 수 없는 형식
      return {
        url,
        path: '',
        queryParams: {},
        route: null,
        isValid: false,
      };
    }

    // 라우트 파싱
    const route = pathToRoute(path, queryParams);

    return {
      url,
      path,
      queryParams,
      route,
      isValid: route !== null,
    };
  } catch (error) {
    logger.error('딥링크 파싱 실패', error as Error, { url });
    return {
      url,
      path: '',
      queryParams: {},
      route: null,
      isValid: false,
    };
  }
}

/**
 * 딥링크로 네비게이션
 */
export async function navigateToDeepLink(url: string): Promise<boolean> {
  const parsed = parseDeepLink(url);

  if (!parsed.isValid || !parsed.route) {
    logger.warn('유효하지 않은 딥링크', { url });
    return false;
  }

  try {
    const expoPath = routeToExpoPath(parsed.route);

    // Analytics 이벤트
    trackEvent('deep_link_navigation', {
      path: parsed.path,
      route_name: parsed.route.name,
    });

    // Expo Router로 네비게이션 (동적 경로는 타입 체크 불가)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(expoPath as any);

    logger.info('딥링크 네비게이션 성공', {
      url,
      route: parsed.route.name,
      expoPath,
    });

    return true;
  } catch (error) {
    logger.error('딥링크 네비게이션 실패', error as Error, { url });
    return false;
  }
}

/**
 * 알림에서 딥링크 라우트 가져오기
 */
export function getRouteFromNotification(
  type: NotificationType,
  data?: Record<string, string>,
  link?: string
): DeepLinkRoute | null {
  // 1. link 필드가 있으면 우선 사용
  if (link) {
    const parsed = parseDeepLink(link);
    if (parsed.isValid && parsed.route) {
      return parsed.route;
    }
  }

  // 2. 알림 타입별 매핑 사용
  const routeGenerator = NOTIFICATION_DEEP_LINK_MAP[type];
  if (routeGenerator) {
    return routeGenerator(data);
  }

  // 3. 기본값: 알림 목록
  return { name: 'notifications' };
}

/**
 * 알림 클릭 시 네비게이션
 */
export async function navigateFromNotification(
  type: NotificationType,
  data?: Record<string, string>,
  link?: string
): Promise<boolean> {
  const route = getRouteFromNotification(type, data, link);

  if (!route) {
    logger.warn('알림에 대한 라우트를 찾을 수 없음', { type });
    return false;
  }

  try {
    const expoPath = routeToExpoPath(route);

    // Analytics 이벤트
    trackEvent('notification_click', {
      notification_type: type,
      route_name: route.name,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(expoPath as any);

    logger.info('알림 네비게이션 성공', { type, route: route.name });
    return true;
  } catch (error) {
    logger.error('알림 네비게이션 실패', error as Error, { type });
    return false;
  }
}

// ============================================================================
// URL Generation
// ============================================================================

/**
 * 딥링크 URL 생성
 */
export function createDeepLink(
  route: DeepLinkRoute,
  options: { useWebUrl?: boolean } = {}
): string {
  const path = routeToExpoPath(route).replace(/^\//, '');
  const prefix = options.useWebUrl ? WEB_PREFIX : SCHEME_PREFIX;
  return `${prefix}${path}`;
}

/**
 * 공고 딥링크 생성
 */
export function createJobDeepLink(jobId: string, useWebUrl = false): string {
  return createDeepLink({ name: 'job', params: { id: jobId } }, { useWebUrl });
}

/**
 * 지원 딥링크 생성
 */
export function createApplicationDeepLink(applicationId: string, useWebUrl = false): string {
  return createDeepLink({ name: 'application', params: { id: applicationId } }, { useWebUrl });
}

/**
 * 스케줄 딥링크 생성
 */
export function createScheduleDeepLink(date?: string, useWebUrl = false): string {
  return createDeepLink({ name: 'schedule', params: date ? { date } : undefined }, { useWebUrl });
}

// ============================================================================
// Linking Setup
// ============================================================================

/**
 * 딥링크 리스너 등록
 *
 * @description 앱이 딥링크로 열릴 때 자동 네비게이션
 * @returns 클린업 함수
 */
export function setupDeepLinkListener(onDeepLink?: (url: string) => void): () => void {
  // 앱이 이미 실행 중일 때 딥링크로 열리는 경우
  const subscription = Linking.addEventListener('url', ({ url }) => {
    logger.info('딥링크 수신', { url });
    onDeepLink?.(url);
    navigateToDeepLink(url);
  });

  // 앱이 딥링크로 처음 열리는 경우 (콜드 스타트)
  Linking.getInitialURL().then((url) => {
    if (url) {
      logger.info('초기 딥링크', { url });
      onDeepLink?.(url);
      // 콜드 스타트 시에는 약간의 지연 후 네비게이션
      setTimeout(() => {
        navigateToDeepLink(url);
      }, 500);
    }
  });

  return () => {
    subscription.remove();
  };
}

/**
 * 앱 초기 딥링크 URL 가져오기
 */
export async function getInitialDeepLink(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL();
    return url;
  } catch (error) {
    logger.error('초기 딥링크 가져오기 실패', error as Error);
    return null;
  }
}

/**
 * 외부 URL 열기
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    logger.warn('URL을 열 수 없음', { url });
    return false;
  } catch (error) {
    logger.error('외부 URL 열기 실패', error as Error, { url });
    return false;
  }
}

// ============================================================================
// Expo Linking Configuration
// ============================================================================

/**
 * Expo Router용 링킹 설정
 *
 * @description app/_layout.tsx에서 사용
 */
export const linkingConfig = {
  prefixes: [
    ExpoLinking.createURL('/'),
    SCHEME_PREFIX.slice(0, -3), // 'uniqn://'에서 '//' 제거
    WEB_PREFIX,
  ],
  config: {
    screens: {
      '(public)': {
        screens: {
          index: '',
          'jobs/index': 'jobs',
          'jobs/[id]': 'jobs/:id',
        },
      },
      '(auth)': {
        screens: {
          login: 'login',
          register: 'register',
          'forgot-password': 'forgot-password',
        },
      },
      '(app)': {
        screens: {
          'notifications/index': 'notifications',
          'notifications/[id]': 'notifications/:id',
          'schedule/index': 'schedule',
          'schedule/[date]': 'schedule/:date',
          'my-applications': 'my-applications',
          'applications/[id]': 'applications/:id',
          profile: 'profile',
          settings: 'settings',
          'settings/notifications': 'settings/notifications',
        },
      },
      '(employer)': {
        screens: {
          'my-postings': 'employer/my-postings',
          'postings/[id]': 'employer/postings/:id',
          'applicants/[jobId]': 'employer/applicants/:jobId',
          'settlement/[jobId]': 'employer/settlement/:jobId',
        },
      },
    },
  },
};

// ============================================================================
// Export
// ============================================================================

export const deepLinkService = {
  // Parsing
  parseDeepLink,

  // Navigation
  navigateToDeepLink,
  navigateFromNotification,
  getRouteFromNotification,

  // URL Generation
  createDeepLink,
  createJobDeepLink,
  createApplicationDeepLink,
  createScheduleDeepLink,

  // Setup
  setupDeepLinkListener,
  getInitialDeepLink,
  openExternalUrl,

  // Config
  linkingConfig,

  // Constants
  APP_SCHEME,
  WEB_DOMAIN,
};

export default deepLinkService;
