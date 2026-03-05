/**
 * UNIQN Mobile - Deep Link 서비스
 *
 * @description 딥링크 URL 파싱, 네비게이션, 알림 연동
 * @version 2.0.0
 *
 * v2.0 변경사항:
 * - Shared 모듈 기반 SSOT (RouteRegistry, RouteMapper)
 * - 29개 알림 타입 전체 매핑 (NotificationRouteMap)
 * - 중복 코드 제거 (executeNavigation)
 * - 존재하지 않는 라우트 제거/폴백
 * - 매직 넘버 상수화
 *
 * 지원 스킴:
 * - Custom Scheme: uniqn:// (현재 활성)
 * - Universal Links: https://uniqn.app (도메인 설정 후 활성화)
 */

import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { logger } from '@/utils/logger';
import { trackEvent } from './analyticsService';
import { toError } from '@/errors';

// Shared 모듈에서 import
import {
  RouteMapper,
  NOTIFICATION_ROUTE_MAP,
  type DeepLinkRoute,
  type ParsedDeepLink,
  type NavigationContext,
} from '@/shared/deeplink';

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

/** 콜드 스타트 네비게이션 재시도 간격 (ms) */
const COLD_START_RETRY_INTERVAL_MS = 100;
/** 콜드 스타트 네비게이션 최대 재시도 횟수 (100ms * 50 = 최대 5초) */
const COLD_START_MAX_RETRIES = 50;

/**
 * 안전한 알림 링크 패턴
 * - 상대 경로만 허용 (/)로 시작
 * - 영문, 숫자, 하이픈, 언더스코어, 슬래시만 허용
 * - 외부 URL, javascript:, data: 등 차단
 */
const SAFE_LINK_PATTERN = /^\/[a-zA-Z0-9\-_/]*$/;

// ============================================================================
// Re-export Types
// ============================================================================

export type { DeepLinkRoute, ParsedDeepLink };

// ============================================================================
// Security Functions
// ============================================================================

/**
 * 알림 링크 유효성 검증
 *
 * @description 외부 URL, javascript:, data: 등 위험한 링크를 차단
 * @param link - 검증할 링크
 * @returns 유효한 링크면 그대로 반환, 위험하면 undefined
 */
export function validateNotificationLink(link?: string): string | undefined {
  if (!link) return undefined;

  // 빈 문자열 처리
  const trimmedLink = link.trim();
  if (trimmedLink.length === 0) return undefined;

  // 안전한 패턴 검사 (상대 경로만 허용)
  if (!SAFE_LINK_PATTERN.test(trimmedLink)) {
    logger.warn('위험한 알림 링크 차단', {
      link: trimmedLink.substring(0, 50), // 로깅 시 길이 제한
      reason: 'pattern_mismatch',
    });
    return undefined;
  }

  return trimmedLink;
}

// ============================================================================
// Route Parsing
// ============================================================================

/**
 * 경로 문자열 → 라우트 객체 매핑
 *
 * @description v2.0: 실제 존재하는 라우트만 반환
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
      // v2.0: 개별 알림 상세 화면 없음, 목록으로 이동
      return { name: 'notifications' };

    case 'schedule':
      // v2.0: 날짜별 스케줄 라우트 없음, 탭으로 이동
      return { name: 'schedule' };

    case 'profile':
      return { name: 'profile' };

    case 'settings':
      // v2.0: settings/notifications 라우트 없음
      return { name: 'settings' };

    case 'support':
      return { name: 'support' };

    case 'notices':
      return { name: 'notices' };

    case 'employer':
      if (segments[1] === 'my-postings' || segments[1] === 'postings') {
        if (segments[2]) {
          // employer/postings/:id, employer/my-postings/:id
          return { name: 'employer/posting', params: { id: segments[2] } };
        }
        return { name: 'employer/my-postings' };
      }
      if (segments[1] === 'applicants' && segments[2]) {
        return { name: 'employer/applicants', params: { jobId: segments[2] } };
      }
      if (segments[1] === 'settlement' && segments[2]) {
        return { name: 'employer/settlement', params: { jobId: segments[2] } };
      }
      return { name: 'employer/my-postings' };

    case 'admin':
      if (segments[1] === 'reports') {
        if (segments[2]) {
          return { name: 'admin/report', params: { id: segments[2] } };
        }
        return { name: 'admin/reports' };
      }
      if (segments[1] === 'inquiries') {
        if (segments[2]) {
          return { name: 'admin/inquiry', params: { id: segments[2] } };
        }
        return { name: 'admin/inquiries' };
      }
      if (segments[1] === 'tournaments') {
        return { name: 'admin/tournaments' };
      }
      return { name: 'admin/dashboard' };

    default:
      // 쿼리 파라미터에서 경로 힌트 찾기
      if (params.jobId || params.jobPostingId) {
        return { name: 'job', params: { id: params.jobId || params.jobPostingId } };
      }
      if (params.notificationId) {
        // v2.0: 알림 상세 없음, 목록으로 이동
        return { name: 'notifications' };
      }
      return null;
  }
}

// ============================================================================
// Core Navigation (중복 코드 제거)
// ============================================================================

/**
 * 통합 네비게이션 함수 (내부용)
 *
 * @description navigateToDeepLink와 navigateFromNotification의 공통 로직
 */
/** 네비게이션 재시도 대기 시간 (ms) */
const NAVIGATION_RETRY_DELAY_MS = 300;

/** 폴백 네비게이션 경로 */
const FALLBACK_ROUTE = '/(app)/notifications';

async function executeNavigation(
  route: DeepLinkRoute,
  context: NavigationContext
): Promise<boolean> {
  const expoPath = RouteMapper.toExpoPath(route);

  // Analytics 이벤트
  trackEvent(context.source === 'deeplink' ? 'deep_link_navigation' : 'notification_click', {
    route_name: route.name,
    ...(context.type && { notification_type: context.type }),
    ...(context.url && { path: context.url }),
  });

  // 1차 시도
  try {
    router.push(expoPath);

    logger.info(`${context.source} 네비게이션 성공`, {
      route: route.name,
      expoPath,
    });

    return true;
  } catch (firstError) {
    logger.warn(`${context.source} 네비게이션 1차 실패, 재시도 대기`, {
      route: route.name,
      error: toError(firstError).message,
    });
  }

  // 2차 시도 (300ms 후 재시도)
  await new Promise((resolve) => setTimeout(resolve, NAVIGATION_RETRY_DELAY_MS));

  try {
    router.push(expoPath);

    logger.info(`${context.source} 네비게이션 재시도 성공`, {
      route: route.name,
      expoPath,
    });

    return true;
  } catch (retryError) {
    logger.error(`${context.source} 네비게이션 재시도 실패, 폴백`, toError(retryError), {
      route: route.name,
    });
  }

  // 폴백: 알림 목록으로 이동
  try {
    router.replace(FALLBACK_ROUTE);

    trackEvent('notification_navigation_fallback', {
      original_route: route.name,
      source: context.source,
    });

    logger.info(`${context.source} 네비게이션 폴백 성공`, {
      originalRoute: route.name,
      fallbackRoute: FALLBACK_ROUTE,
    });

    return true;
  } catch (fallbackError) {
    logger.error(`${context.source} 네비게이션 폴백도 실패`, toError(fallbackError));
    return false;
  }
}

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
    logger.error('딥링크 파싱 실패', toError(error), { url });
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

  return executeNavigation(parsed.route, { source: 'deeplink', url });
}

/**
 * 알림에서 딥링크 라우트 가져오기
 */
export function getRouteFromNotification(
  type: NotificationType,
  data?: Record<string, string>,
  link?: string
): DeepLinkRoute | null {
  // 1. link 필드가 있으면 검증 후 사용
  const validatedLink = validateNotificationLink(link);
  if (validatedLink) {
    const parsed = parseDeepLink(validatedLink);
    if (parsed.isValid && parsed.route) {
      return parsed.route;
    }
  }

  // 2. 알림 타입별 매핑 사용 (29개 전체 커버)
  const routeGenerator = NOTIFICATION_ROUTE_MAP[type];
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

  return executeNavigation(route, { source: 'notification', type });
}

// ============================================================================
// URL Generation
// ============================================================================

/**
 * 딥링크 URL 생성
 *
 * @description Expo Router 그룹 경로 (app), (tabs) 등을 제거하여 클린 URL 생성
 */
export function createDeepLink(
  route: DeepLinkRoute,
  options: { useWebUrl?: boolean } = {}
): string {
  const expoPath = RouteMapper.toExpoPath(route);
  // 라우트 그룹 제거: /(app)/(tabs)/schedule → /schedule
  // 빈 경로 폴백: /(app)/(tabs) → home
  const cleanPath = expoPath.replace(/\/\([^)]+\)/g, '').replace(/^\//, '') || 'home';
  const prefix = options.useWebUrl ? WEB_PREFIX : SCHEME_PREFIX;
  return `${prefix}${cleanPath}`;
}

/**
 * 공고 딥링크 생성
 */
export function createJobDeepLink(jobId: string, useWebUrl = false): string {
  return createDeepLink({ name: 'job', params: { id: jobId } }, { useWebUrl });
}

// ============================================================================
// Web URL Filtering
// ============================================================================

/**
 * 웹 플랫폼에서 루트 URL인지 확인
 *
 * @description 웹에서 `https://uniqn.app/` 같은 루트 URL은 일반 페이지 로드이지
 * 의도적인 딥링크가 아님. 이를 딥링크로 처리하면 인증 가드와 충돌하여 무한 루프 발생.
 */
function isWebRootUrl(url: string): boolean {
  if (Platform.OS !== 'web') return false;

  try {
    const urlObj = new URL(url);
    // 루트 경로(/ 또는 빈 경로)이고 의미 있는 쿼리 파라미터가 없는 경우
    const isRootPath = urlObj.pathname === '/' || urlObj.pathname === '';
    const hasNoParams = urlObj.searchParams.toString() === '';
    return isRootPath && hasNoParams;
  } catch {
    return false;
  }
}

// ============================================================================
// Cold Start Navigation Helper
// ============================================================================

/**
 * 네비게이션 준비 완료 시까지 대기 후 콜백 실행
 *
 * @description 콜드 스타트 시 Expo Router가 완전히 마운트되기를 기다림.
 * router.canGoBack()이 에러 없이 호출되면 준비된 것으로 판단.
 * 최대 COLD_START_MAX_RETRIES회 재시도 후 강제 실행.
 */
export function waitForNavigationReady(callback: () => void, retryCount = 0): void {
  if (retryCount >= COLD_START_MAX_RETRIES) {
    logger.warn('콜드 스타트 네비게이션: 최대 대기 초과, 강제 실행', {
      retries: retryCount,
      totalWaitMs: retryCount * COLD_START_RETRY_INTERVAL_MS,
    });
    callback();
    return;
  }

  try {
    router.canGoBack();
    setTimeout(callback, COLD_START_RETRY_INTERVAL_MS);
  } catch {
    setTimeout(() => {
      waitForNavigationReady(callback, retryCount + 1);
    }, COLD_START_RETRY_INTERVAL_MS);
  }
}

/**
 * 네비게이션 준비 완료 시까지 대기 (Promise 버전)
 *
 * @description 콜드 스타트 시 알림 터치 등에서 await로 사용
 */
export function waitForNavigationReadyAsync(): Promise<void> {
  return new Promise((resolve) => {
    waitForNavigationReady(() => resolve());
  });
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
    // 웹에서 루트 URL은 일반 페이지 로드이므로 딥링크로 처리하지 않음
    if (isWebRootUrl(url)) return;

    logger.info('딥링크 수신', { url });
    onDeepLink?.(url);
    navigateToDeepLink(url);
  });

  // 앱이 딥링크로 처음 열리는 경우 (콜드 스타트)
  Linking.getInitialURL().then((url) => {
    // 웹에서 루트 URL은 일반 페이지 로드이므로 딥링크로 처리하지 않음
    if (!url || isWebRootUrl(url)) return;

    logger.info('초기 딥링크', { url });
    onDeepLink?.(url);
    // 콜드 스타트 시 네비게이션 준비까지 대기 후 실행
    waitForNavigationReady(() => {
      navigateToDeepLink(url);
    });
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
    logger.error('초기 딥링크 가져오기 실패', toError(error));
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
    logger.error('외부 URL 열기 실패', toError(error), { url });
    return false;
  }
}

// ============================================================================
// Export
// ============================================================================

export const deepLinkService = {
  // Security
  validateNotificationLink,

  // Parsing
  parseDeepLink,

  // Navigation
  navigateToDeepLink,
  navigateFromNotification,
  getRouteFromNotification,

  // URL Generation
  createDeepLink,
  createJobDeepLink,

  // Cold Start
  waitForNavigationReady,
  waitForNavigationReadyAsync,

  // Setup
  setupDeepLinkListener,
  getInitialDeepLink,
  openExternalUrl,

  // Constants
  APP_SCHEME,
  WEB_DOMAIN,
};

export default deepLinkService;
