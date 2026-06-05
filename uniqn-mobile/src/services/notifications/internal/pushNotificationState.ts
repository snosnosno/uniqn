/**
 * UNIQN Mobile - Push Notification Shared State
 *
 * @description pushNotificationService 내부 모듈들이 공유하는 단일 가변 상태 홀더.
 *
 * 모든 내부 모듈은 자체 복사본 대신 이 모듈의 `pushState` 객체 하나를 통해
 * isInitialized / currentToken / 핸들러 / 구독을 읽고 씁니다. 파일 분할로 인해
 * 모듈별 가변 변수가 갈라지는 것을 막기 위한 단일 소스입니다.
 *
 * expo-notifications 모듈은 런타임에 동적 로드되며, 재할당된 `let` export 는
 * 임포터에게 안정적으로 관찰되지 않으므로 `getNotifications()` 접근자를 통해서만
 * 노출합니다.
 */

import type {
  NotificationReceivedHandler,
  NotificationResponseHandler,
} from './pushNotificationTypes';

/**
 * 모든 내부 모듈이 공유하는 단일 가변 상태 홀더
 */
export const pushState: {
  isInitialized: boolean;
  currentToken: string | null;
  receivedHandler: NotificationReceivedHandler | null;
  responseHandler: NotificationResponseHandler | null;
  responseSubscription: { remove: () => void } | null;
} = {
  isInitialized: false,
  currentToken: null,
  receivedHandler: null,
  responseHandler: null,
  responseSubscription: null,
};

// Expo Notifications 모듈 (동적 로드)
let notificationsModule: typeof import('expo-notifications') | null = null;

export async function loadNotificationsModule(): Promise<
  typeof import('expo-notifications') | null
> {
  if (notificationsModule) {
    return notificationsModule;
  }

  try {
    if (process.env.JEST_WORKER_ID) {
      // Jest on React Native does not support the dynamic import path used by the app runtime.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      notificationsModule = require('expo-notifications') as typeof import('expo-notifications');
    } else {
      notificationsModule = await import('expo-notifications');
    }
    return notificationsModule;
  } catch {
    return null;
  }
}

/**
 * 현재 로드된 expo-notifications 모듈 접근자.
 *
 * 재할당되는 `let Notifications` export 는 임포터가 안정적으로 관찰하지 못하므로
 * 모든 내부 모듈은 이 접근자를 통해 최신 참조를 얻습니다.
 */
export function getNotifications(): typeof import('expo-notifications') | null {
  return notificationsModule;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
