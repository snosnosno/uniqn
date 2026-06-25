import { router } from 'expo-router';
import { trackEvent } from '../analyticsService';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';
import {
  NOTIFICATION_ROUTE_MAP,
  RouteMapper,
  type DeepLinkRoute,
  type NavigationContext,
} from '@/shared/deeplink';
import { NotificationType } from '@/types/notification';
import {
  COLD_START_MAX_RETRIES,
  COLD_START_RETRY_INTERVAL_MS,
  FALLBACK_ROUTE,
  NAVIGATION_RETRY_DELAY_MS,
} from './deepLinkConstants';
import { validateNotificationLink } from './deepLinkLinkValidator';
import { getCurrentWebRoute, parseDeepLink } from './deepLinkRouteParser';

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
  // REQUEST/REMINDER 는 작성 유도 알림이므로 허브 미작성 탭으로 보낸다.
  // link 는 workLogId 만 담겨 상세 화면이 작성 정보를 해소하지 못함.
  // RECEIVED 는 받은 평가 확인이므로 link(상세) 유지.
  if (type === NotificationType.REVIEW_REQUEST || type === NotificationType.REVIEW_REMINDER) {
    const routeGenerator = NOTIFICATION_ROUTE_MAP[type];
    if (routeGenerator) {
      return routeGenerator(data);
    }
  }

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

export function waitForNavigationReady(callback: () => void, retryCount = 0): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const cancel = () => {
    cancelled = true;

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const scheduleNavigationCheck = (attempt: number) => {
    if (cancelled) {
      return;
    }

    if (attempt >= COLD_START_MAX_RETRIES) {
      logger.warn('콜드 스타트 네비게이션: 최대 대기 초과, 강제 실행', {
        retries: attempt,
        totalWaitMs: attempt * COLD_START_RETRY_INTERVAL_MS,
      });
      callback();
      return;
    }

    try {
      router.canGoBack();
      timeoutId = setTimeout(() => {
        if (cancelled) {
          return;
        }

        callback();
      }, COLD_START_RETRY_INTERVAL_MS);
    } catch {
      timeoutId = setTimeout(() => {
        scheduleNavigationCheck(attempt + 1);
      }, COLD_START_RETRY_INTERVAL_MS);
    }
  };

  scheduleNavigationCheck(retryCount);
  return cancel;
}
