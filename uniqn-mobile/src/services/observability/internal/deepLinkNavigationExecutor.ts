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

/**
 * link 를 무시하고 타입+data 매핑을 강제하는 알림 타입.
 *
 * - REVIEW_REQUEST / REVIEW_REMINDER: 작성 유도 알림인데 link 는 workLogId 상세만 담겨
 *   "무엇을 써야 하는지"를 해소하지 못한다. 허브 미작성 탭이 목적지다.
 *   (RECEIVED 는 받은 평가 확인이므로 link 상세 유지 — 목록에 넣지 않는다)
 * - ROLE_CHANGED: DB RPC 가 link 에 '/settings' 를 심는데 설정 화면에는 역할 표기가
 *   한 곳도 없다. 역할 배지는 프로필 탭에 있다. 이미 발송된 알림의 link 는 되돌릴 수
 *   없으므로 클라이언트에서 흡수한다.
 */
const ROUTE_MAP_PRIORITY_TYPES: NotificationType[] = [
  NotificationType.REVIEW_REQUEST,
  NotificationType.REVIEW_REMINDER,
  NotificationType.ROLE_CHANGED,
];

/** 라우트가 얼마나 구체적인지 — 파라미터 개수로 근사한다. */
function countRouteParams(route: DeepLinkRoute): number {
  const params = 'params' in route ? route.params : undefined;
  return params ? Object.keys(params as Record<string, string>).length : 0;
}

export function getRouteFromNotification(
  type: NotificationType,
  data?: Record<string, string>,
  link?: string
): DeepLinkRoute | null {
  const routeGenerator = NOTIFICATION_ROUTE_MAP[type];
  const mappedRoute = routeGenerator ? routeGenerator(data) : null;

  if (mappedRoute && ROUTE_MAP_PRIORITY_TYPES.includes(type)) {
    return mappedRoute;
  }

  const validatedLink = validateNotificationLink(link);
  const parsed = validatedLink ? parseDeepLink(validatedLink) : null;
  const linkRoute = parsed?.isValid && parsed.route ? parsed.route : null;

  if (!linkRoute) {
    return mappedRoute ?? { name: 'notifications' };
  }
  if (!mappedRoute) {
    return linkRoute;
  }

  // link 가 매핑보다 굵으면(파라미터가 적으면) data 기반 매핑을 쓴다.
  //
  // DB 트리거·RPC 는 지원 생애주기 알림에 link='/schedule' 만 심으면서 data 에는
  // applicationId 를 함께 넣는다. link 를 무조건 우선하면 그 applicationId 가
  // 통째로 버려져, 스케줄 탭이 준비해 둔 정밀 착지(해당 근무월로 점프 → 날짜 선택 →
  // 상세 시트)가 통째로 죽는다. 반대로 no_show_alert 처럼 link 가 더 구체적인
  // (employer/applicants/{jobId}) 경우도 있으므로 "더 구체적인 쪽"으로 판정한다.
  return countRouteParams(mappedRoute) > countRouteParams(linkRoute) ? mappedRoute : linkRoute;
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
