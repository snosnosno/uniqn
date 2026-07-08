import { Linking } from 'react-native';
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

export default deepLinkService;
