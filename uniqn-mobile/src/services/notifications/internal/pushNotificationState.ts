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
  /** 마지막으로 처리한 알림 탭(request.identifier) — 리스너와 콜드 스타트 응답의 중복 처리 방지 */
  lastHandledResponseId: string | null;
  /**
   * 핸들러가 **명시적으로 해제된**(로그아웃) 상태인가. 이때 들어온 탭은 보존하지 않고 버린다 —
   * 다음에 로그인한 계정이 남의 탭을 처리하지 않게. 앱 시작 직후(아직 한 번도 등록 전)는 false 라
   * 콜드 스타트 탭(안드로이드는 리스너 등록 순간 재전달)을 보존한다.
   */
  responseHandlerDetached: boolean;
} = {
  isInitialized: false,
  currentToken: null,
  receivedHandler: null,
  responseHandler: null,
  responseSubscription: null,
  lastHandledResponseId: null,
  responseHandlerDetached: false,
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
