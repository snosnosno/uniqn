import { Linking, Platform } from 'react-native';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';
import { type DeepLinkRoute, type ParsedDeepLink } from '@/shared/deeplink';
import { APP_SCHEME, WEB_DOMAIN } from './internal/deepLinkConstants';
import { validateNotificationLink, isWebRootUrl } from './internal/deepLinkLinkValidator';
import { parseDeepLink } from './internal/deepLinkRouteParser';
import { createDeepLink, createJobDeepLink } from './internal/deepLinkRouteSerializer';
import {
  getRouteFromNotification,
  navigateFromNotification,
  navigateToDeepLink,
  waitForNavigationReady,
} from './internal/deepLinkNavigationExecutor';

export { APP_SCHEME, WEB_DOMAIN };
export type { DeepLinkRoute, ParsedDeepLink };
export {
  validateNotificationLink,
  parseDeepLink,
  navigateToDeepLink,
  getRouteFromNotification,
  navigateFromNotification,
  createDeepLink,
  createJobDeepLink,
  waitForNavigationReady,
};

export function waitForNavigationReadyAsync(retryCount = 0): Promise<void> {
  return new Promise((resolve) => {
    waitForNavigationReady(resolve, retryCount);
  });
}

/** 현재 웹 위치(경로+쿼리). 웹이 아니거나 알 수 없으면 null */
function currentWebLocation(): string | null {
  const location = (globalThis as { location?: { pathname?: string; search?: string } }).location;
  if (!location || typeof location.pathname !== 'string') return null;
  return `${location.pathname}${location.search ?? ''}`;
}

/** URL 의 경로+쿼리. 해석할 수 없으면 null */
function pathAndSearch(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

/**
 * 웹에서 첫 URL 을 다시 디스패치해도 되는가.
 *
 * 웹의 초기 URL 은 페이지 로드라 expo-router 가 이미 그 화면을 띄웠다. 리스너는 늦게 로드되는
 * 런타임 청크 + 인증 초기화 + 네비게이션 준비를 기다린 뒤에야 디스패치하는데, 그 사이 사용자가
 * 다른 화면으로 이동했으면(빠른 클릭, 인증 가드의 profile-setup 이동 등) 옛 URL 이 새 화면 위에
 * 다시 쌓여 **이동이 되튄다**(2026-09-25 실측 — 벨·채팅 버튼 모두 master 에서 3/3 재현).
 * 아직 첫 URL 에 머물러 있을 때만 보낸다 — 레거시 별칭(/my-applications 등) 리매핑은 그대로 산다.
 */
function isStillOnInitialWebUrl(url: string): boolean {
  if (Platform.OS !== 'web') return true;
  const initial = pathAndSearch(url);
  const current = currentWebLocation();
  if (!initial || !current) return true;
  return initial === current;
}

export function setupDeepLinkListener(onDeepLink?: (url: string) => void): () => void {
  let isDisposed = false;
  let cancelInitialNavigationWait: (() => void) | null = null;

  const dispatchDeepLink = (url: string) => {
    if (isDisposed) {
      return;
    }

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

  Linking.getInitialURL()
    .then((url) => {
      if (isDisposed || !url || isWebRootUrl(url)) return;

      logger.info('초기 딥링크', { url });
      cancelInitialNavigationWait = waitForNavigationReady(() => {
        if (!isStillOnInitialWebUrl(url)) {
          logger.info('초기 딥링크 생략 — 사용자가 이미 다른 화면으로 이동', { url });
          return;
        }
        dispatchDeepLink(url);
      });
    })
    .catch((error) => {
      if (isDisposed) {
        return;
      }

      logger.error('초기 딥링크 가져오기 실패', toError(error));
    });

  return () => {
    isDisposed = true;
    cancelInitialNavigationWait?.();
    cancelInitialNavigationWait = null;
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

export const deepLinkService = {
  APP_SCHEME,
  WEB_DOMAIN,
  validateNotificationLink,
  parseDeepLink,
  navigateToDeepLink,
  getRouteFromNotification,
  navigateFromNotification,
  createDeepLink,
  createJobDeepLink,
  waitForNavigationReady,
  waitForNavigationReadyAsync,
  setupDeepLinkListener,
  getInitialDeepLink,
};
