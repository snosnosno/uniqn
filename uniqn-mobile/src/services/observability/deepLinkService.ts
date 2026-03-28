import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { logger } from '@/utils/logger';
import { trackEvent } from './analyticsService';
import { toError } from '@/errors';
import {
  RouteMapper,
  NOTIFICATION_ROUTE_MAP,
  type DeepLinkRoute,
  type ParsedDeepLink,
  type NavigationContext,
} from '@/shared/deeplink';
import type { NotificationType } from '@/types/notification';

export const APP_SCHEME = 'uniqn';
export const WEB_DOMAIN = 'uniqn.app';

const SCHEME_PREFIX = `${APP_SCHEME}://`;
const WEB_PREFIX = `https://${WEB_DOMAIN}/`;

const COLD_START_RETRY_INTERVAL_MS = 100;
const COLD_START_MAX_RETRIES = 50;
const NAVIGATION_RETRY_DELAY_MS = 300;
const FALLBACK_ROUTE = '/(app)/notifications';

const SAFE_LINK_PATTERN = /^\/[a-zA-Z0-9\-_/]*$/;

export type { DeepLinkRoute, ParsedDeepLink };

export function validateNotificationLink(link?: string): string | undefined {
  if (!link) return undefined;

  const trimmedLink = link.trim();
  if (trimmedLink.length === 0) return undefined;

  if (!SAFE_LINK_PATTERN.test(trimmedLink)) {
    logger.warn('위험한 알림 링크 차단', {
      link: trimmedLink.substring(0, 50),
      reason: 'pattern_mismatch',
    });
    return undefined;
  }

  return trimmedLink;
}

function pathToRoute(path: string, params: Record<string, string>): DeepLinkRoute | null {
  const normalizedPath = path.replace(/^\/|\/$/g, '');
  const segments = normalizedPath ? normalizedPath.split('/') : [''];
  const [root, second, third, fourth] = segments;

  switch (root) {
    case '':
    case 'home':
      return { name: 'home' };

    case 'jobs':
      return second ? { name: 'job', params: { id: second } } : { name: 'jobs' };

    case 'login':
      return { name: 'login' };

    case 'signup':
      return { name: 'signup' };

    case 'forgot-password':
      return { name: 'forgot-password' };

    case 'notifications':
      return { name: 'notifications' };

    case 'schedule':
      return { name: 'schedule' };

    case 'my-applications':
    case 'my-settlements':
    case 'applications':
      return { name: 'schedule' };

    case 'profile':
      return { name: 'profile' };

    case 'settings':
      switch (second) {
        case undefined:
          return { name: 'settings' };
        case 'profile':
          return { name: 'settings/profile' };
        case 'change-password':
          return { name: 'settings/change-password' };
        case 'delete-account':
          return { name: 'settings/delete-account' };
        case 'privacy':
          return { name: 'settings/privacy' };
        case 'terms':
          return { name: 'settings/terms' };
        case 'employer-terms':
          return { name: 'settings/employer-terms' };
        case 'liability-waiver':
          return { name: 'settings/liability-waiver' };
        case 'my-data':
          return { name: 'settings/my-data' };
        case 'business-info':
          return { name: 'settings/business-info' };
        case 'about':
        case 'notifications':
          return { name: 'settings' };
        default:
          return null;
      }

    case 'support':
      switch (second) {
        case undefined:
          return { name: 'support' };
        case 'faq':
          return { name: 'support/faq' };
        case 'create-inquiry':
          return { name: 'support/create-inquiry' };
        case 'my-inquiries':
          return { name: 'support/my-inquiries' };
        case 'inquiry':
          return third ? { name: 'support/inquiry', params: { id: third } } : null;
        case 'inquiries':
          return third
            ? { name: 'support/inquiry', params: { id: third } }
            : { name: 'support/my-inquiries' };
        case 'reports':
          return { name: 'notifications' };
        default:
          return null;
      }

    case 'notices':
      return second ? { name: 'notice', params: { id: second } } : { name: 'notices' };

    case 'announcements':
      if (second === 'create') {
        return { name: 'admin/announcement-create' };
      }
      if (second && third === 'edit') {
        return { name: 'admin/announcement-edit', params: { id: second } };
      }
      return second ? { name: 'notice', params: { id: second } } : { name: 'notices' };

    case 'reviews':
      return !second || second === 'pending'
        ? { name: 'reviews/pending' }
        : { name: 'reviews/detail', params: { workLogId: second } };

    case 'my-postings':
      if (second === 'create') {
        return { name: 'employer/posting-create' };
      }
      if (second) {
        if (third === 'edit') {
          return { name: 'employer/posting-edit', params: { id: second } };
        }
        if (third === 'applicants') {
          return { name: 'employer/applicants', params: { jobId: second } };
        }
        if (third === 'settlement' || third === 'settlements') {
          return { name: 'employer/settlement', params: { jobId: second } };
        }
        return { name: 'employer/posting', params: { id: second } };
      }
      return { name: 'employer/my-postings' };

    case 'employer':
      if (second === 'my-postings' || second === 'postings') {
        if (third === 'create') {
          return { name: 'employer/posting-create' };
        }
        if (third) {
          if (fourth === 'edit') {
            return { name: 'employer/posting-edit', params: { id: third } };
          }
          if (fourth === 'applicants' || fourth === 'attendance') {
            return { name: 'employer/applicants', params: { jobId: third } };
          }
          if (fourth === 'settlement' || fourth === 'settlements') {
            return { name: 'employer/settlement', params: { jobId: third } };
          }
          return { name: 'employer/posting', params: { id: third } };
        }
        return { name: 'employer/my-postings' };
      }
      if (second === 'applicants' && third) {
        return { name: 'employer/applicants', params: { jobId: third } };
      }
      if (second === 'settlement' && third) {
        return { name: 'employer/settlement', params: { jobId: third } };
      }
      return { name: 'employer/my-postings' };

    case 'users':
      return second ? { name: 'admin/user', params: { id: second } } : { name: 'admin/users' };

    case 'stats':
      return { name: 'admin/stats' };

    case 'reports':
      return second ? { name: 'admin/report', params: { id: second } } : { name: 'admin/reports' };

    case 'inquiries':
      return second
        ? { name: 'admin/inquiry', params: { id: second } }
        : { name: 'admin/inquiries' };

    case 'tournaments':
      return { name: 'admin/tournaments' };

    case 'admin':
      switch (second) {
        case undefined:
        case 'dashboard':
          return { name: 'admin/dashboard' };
        case 'users':
          return third ? { name: 'admin/user', params: { id: third } } : { name: 'admin/users' };
        case 'stats':
          return { name: 'admin/stats' };
        case 'reports':
          return third
            ? { name: 'admin/report', params: { id: third } }
            : { name: 'admin/reports' };
        case 'announcements':
          if (third === 'create') {
            return { name: 'admin/announcement-create' };
          }
          if (third && fourth === 'edit') {
            return { name: 'admin/announcement-edit', params: { id: third } };
          }
          return third
            ? { name: 'admin/announcement', params: { id: third } }
            : { name: 'admin/announcements' };
        case 'inquiries':
          return third
            ? { name: 'admin/inquiry', params: { id: third } }
            : { name: 'admin/inquiries' };
        case 'tournaments':
          return { name: 'admin/tournaments' };
        default:
          return null;
      }

    default:
      if (params.jobId || params.jobPostingId) {
        return { name: 'job', params: { id: params.jobId || params.jobPostingId } };
      }
      if (params.notificationId) {
        return { name: 'notifications' };
      }
      return null;
  }
}

function getCurrentWebOrigin(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    return window.location.origin;
  } catch {
    return null;
  }
}

function isSupportedWebUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname === WEB_DOMAIN || urlObj.hostname.endsWith(`.${WEB_DOMAIN}`)) {
      return true;
    }

    const currentOrigin = getCurrentWebOrigin();
    return currentOrigin !== null && urlObj.origin === currentOrigin;
  } catch {
    return false;
  }
}

function getCurrentWebRoute(): DeepLinkRoute | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  try {
    const queryParams: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    return pathToRoute(window.location.pathname, queryParams);
  } catch {
    return null;
  }
}

function routesAreEqual(left: DeepLinkRoute, right: DeepLinkRoute): boolean {
  if (left.name !== right.name) {
    return false;
  }

  const leftParams = 'params' in left ? left.params : undefined;
  const rightParams = 'params' in right ? right.params : undefined;

  if (!leftParams && !rightParams) {
    return true;
  }

  if (!leftParams || !rightParams) {
    return false;
  }

  const leftRecord = leftParams as Record<string, string>;
  const rightRecord = rightParams as Record<string, string>;
  const leftEntries = Object.entries(leftRecord);
  const rightEntries = Object.entries(rightRecord);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value]) => rightRecord[key] === value);
}

function shouldSkipWebNavigation(route: DeepLinkRoute): boolean {
  const currentRoute = getCurrentWebRoute();
  return currentRoute !== null && routesAreEqual(currentRoute, route);
}

async function executeNavigation(
  route: DeepLinkRoute,
  context: NavigationContext
): Promise<boolean> {
  if (shouldSkipWebNavigation(route)) {
    logger.info('현재 웹 라우트와 동일하여 딥링크 이동을 건너뜀', {
      route: route.name,
      source: context.source,
    });
    return true;
  }

  const expoPath = RouteMapper.toExpoPath(route);

  trackEvent(context.source === 'deeplink' ? 'deep_link_navigation' : 'notification_click', {
    route_name: route.name,
    ...(context.type && { notification_type: context.type }),
    ...(context.url && { path: context.url }),
  });

  try {
    await router.push(expoPath);

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

  await new Promise((resolve) => setTimeout(resolve, NAVIGATION_RETRY_DELAY_MS));

  try {
    await router.push(expoPath);

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

  try {
    await router.replace(FALLBACK_ROUTE);

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

export function parseDeepLink(url: string): ParsedDeepLink {
  try {
    let path = '';
    const queryParams: Record<string, string> = {};

    if (url.startsWith(SCHEME_PREFIX)) {
      const withoutScheme = url.slice(SCHEME_PREFIX.length);
      const [pathPart, queryPart] = withoutScheme.split('?');
      path = pathPart;

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }
    } else if (url.startsWith(WEB_PREFIX) || isSupportedWebUrl(url)) {
      const urlObj = new URL(url);
      path = urlObj.pathname;
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
    } else if (url.startsWith('/')) {
      const [pathPart, queryPart] = url.split('?');
      path = pathPart;

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
      }
    } else {
      return {
        url,
        path: '',
        queryParams: {},
        route: null,
        isValid: false,
      };
    }

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

export async function navigateToDeepLink(url: string): Promise<boolean> {
  const parsed = parseDeepLink(url);

  if (!parsed.isValid || !parsed.route) {
    logger.warn('유효하지 않은 딥링크', { url });
    return false;
  }

  return executeNavigation(parsed.route, { source: 'deeplink', url });
}

export function getRouteFromNotification(
  type: NotificationType,
  data?: Record<string, string>,
  link?: string
): DeepLinkRoute | null {
  const validatedLink = validateNotificationLink(link);
  if (validatedLink) {
    const parsed = parseDeepLink(validatedLink);
    if (parsed.isValid && parsed.route) {
      return parsed.route;
    }
  }

  const routeGenerator = NOTIFICATION_ROUTE_MAP[type];
  if (routeGenerator) {
    return routeGenerator(data);
  }

  return { name: 'notifications' };
}

export async function navigateFromNotification(
  type: NotificationType,
  data?: Record<string, string>,
  link?: string
): Promise<boolean> {
  const route = getRouteFromNotification(type, data, link);

  if (!route) {
    logger.warn('알림 타입에 대한 라우트를 찾을 수 없음', { type });
    return false;
  }

  return executeNavigation(route, { source: 'notification', type });
}

function toExternalPath(route: DeepLinkRoute): string {
  switch (route.name) {
    case 'home':
      return 'home';
    case 'jobs':
      return 'jobs';
    case 'job':
      return `jobs/${route.params.id}`;
    case 'login':
      return 'login';
    case 'signup':
      return 'signup';
    case 'forgot-password':
      return 'forgot-password';
    case 'notifications':
      return 'notifications';
    case 'schedule':
      return 'schedule';
    case 'profile':
      return 'profile';
    case 'settings':
      return 'settings';
    case 'settings/profile':
      return 'settings/profile';
    case 'settings/change-password':
      return 'settings/change-password';
    case 'settings/delete-account':
      return 'settings/delete-account';
    case 'settings/privacy':
      return 'settings/privacy';
    case 'settings/terms':
      return 'settings/terms';
    case 'settings/employer-terms':
      return 'settings/employer-terms';
    case 'settings/liability-waiver':
      return 'settings/liability-waiver';
    case 'settings/my-data':
      return 'settings/my-data';
    case 'settings/business-info':
      return 'settings/business-info';
    case 'support':
      return 'support';
    case 'support/faq':
      return 'support/faq';
    case 'support/create-inquiry':
      return 'support/create-inquiry';
    case 'support/my-inquiries':
      return 'support/my-inquiries';
    case 'support/inquiry':
      return `support/inquiry/${route.params.id}`;
    case 'notices':
      return 'notices';
    case 'notice':
      return `notices/${route.params.id}`;
    case 'employer/my-postings':
      return 'employer/my-postings';
    case 'employer/posting-create':
      return 'employer/my-postings/create';
    case 'employer/posting':
      return `employer/my-postings/${route.params.id}`;
    case 'employer/posting-edit':
      return `employer/my-postings/${route.params.id}/edit`;
    case 'employer/applicants':
      return `employer/applicants/${route.params.jobId}`;
    case 'employer/settlement':
      return `employer/settlement/${route.params.jobId}`;
    case 'admin/dashboard':
      return 'admin';
    case 'admin/users':
      return 'admin/users';
    case 'admin/user':
      return `admin/users/${route.params.id}`;
    case 'admin/stats':
      return 'admin/stats';
    case 'admin/reports':
      return 'admin/reports';
    case 'admin/report':
      return `admin/reports/${route.params.id}`;
    case 'admin/announcements':
      return 'admin/announcements';
    case 'admin/announcement-create':
      return 'admin/announcements/create';
    case 'admin/announcement':
      return `admin/announcements/${route.params.id}`;
    case 'admin/announcement-edit':
      return `admin/announcements/${route.params.id}/edit`;
    case 'admin/inquiries':
      return 'admin/inquiries';
    case 'admin/inquiry':
      return `admin/inquiries/${route.params.id}`;
    case 'admin/tournaments':
      return 'admin/tournaments';
    case 'reviews/detail':
      return `reviews/${route.params.workLogId}`;
    case 'reviews/pending':
      return 'reviews/pending';
    default:
      return (
        RouteMapper.toExpoPath(route)
          .replace(/\/\([^)]+\)/g, '')
          .replace(/^\/+/, '') || 'home'
      );
  }
}

export function createDeepLink(
  route: DeepLinkRoute,
  options: { useWebUrl?: boolean } = {}
): string {
  const prefix = options.useWebUrl ? WEB_PREFIX : SCHEME_PREFIX;
  return `${prefix}${toExternalPath(route)}`;
}

export function createJobDeepLink(jobId: string, useWebUrl = false): string {
  return createDeepLink({ name: 'job', params: { id: jobId } }, { useWebUrl });
}

function isWebRootUrl(url: string): boolean {
  if (Platform.OS !== 'web') return false;

  try {
    const urlObj = new URL(url);
    const isRootPath = urlObj.pathname === '/' || urlObj.pathname === '';
    const hasNoParams = urlObj.searchParams.toString() === '';
    return isRootPath && hasNoParams;
  } catch {
    return false;
  }
}

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

export function waitForNavigationReadyAsync(): Promise<void> {
  return new Promise((resolve) => {
    waitForNavigationReady(() => resolve());
  });
}

export function setupDeepLinkListener(onDeepLink?: (url: string) => void): () => void {
  const dispatchDeepLink = (url: string) => {
    if (onDeepLink) {
      onDeepLink(url);
      return;
    }

    void navigateToDeepLink(url);
  };

  const subscription = Linking.addEventListener('url', ({ url }) => {
    if (isWebRootUrl(url)) return;

    logger.info('딥링크 수신', { url });
    dispatchDeepLink(url);
  });

  Linking.getInitialURL().then((url) => {
    if (!url || isWebRootUrl(url)) return;

    logger.info('초기 딥링크', { url });
    waitForNavigationReady(() => {
      dispatchDeepLink(url);
    });
  });

  return () => {
    subscription.remove();
  };
}

export async function getInitialDeepLink(): Promise<string | null> {
  try {
    return await Linking.getInitialURL();
  } catch (error) {
    logger.error('초기 딥링크 가져오기 실패', toError(error));
    return null;
  }
}

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

export const deepLinkService = {
  validateNotificationLink,
  parseDeepLink,
  navigateToDeepLink,
  navigateFromNotification,
  getRouteFromNotification,
  createDeepLink,
  createJobDeepLink,
  waitForNavigationReady,
  waitForNavigationReadyAsync,
  setupDeepLinkListener,
  getInitialDeepLink,
  openExternalUrl,
  APP_SCHEME,
  WEB_DOMAIN,
};

export default deepLinkService;
