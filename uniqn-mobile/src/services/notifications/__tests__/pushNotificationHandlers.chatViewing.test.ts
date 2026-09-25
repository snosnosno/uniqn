/**
 * 포그라운드 채팅 푸시 — 보고 있는 방이면 앱 콜백(인앱 토스트·로컬 배지)까지 삼킨다 (S3 리뷰 H)
 *
 * 게이트(순수 함수)만 막으면 OS 배너는 사라지지만 usePushNotificationSetup 의 토스트·addNotification
 * 경로가 따로 살아 있다. 실제 expo-notifications 핸들러를 잡아 두 경로를 함께 단언한다.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { pushNotificationService } from '../pushNotificationService';
import { useChatPresenceStore } from '@/stores/chatPresenceStore';

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockSetBadgeCountAsync = jest.fn();
const mockGetBadgeCountAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockCancelAllScheduledNotificationsAsync = jest.fn();
const mockDismissAllNotificationsAsync = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockRegisterFCMToken = jest.fn();
const mockUnregisterFCMToken = jest.fn();
const mockRecordError = jest.fn();
const mockLeaveBreadcrumb = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  setBadgeCountAsync: (...args: unknown[]) => mockSetBadgeCountAsync(...args),
  getBadgeCountAsync: (...args: unknown[]) => mockGetBadgeCountAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) =>
    mockCancelScheduledNotificationAsync(...args),
  cancelAllScheduledNotificationsAsync: (...args: unknown[]) =>
    mockCancelAllScheduledNotificationsAsync(...args),
  dismissAllNotificationsAsync: (...args: unknown[]) => mockDismissAllNotificationsAsync(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: 'timeInterval',
    DATE: 'date',
  },
}));

jest.mock('@/repositories', () => ({
  notificationRepository: {
    registerFCMToken: (...args: unknown[]) => mockRegisterFCMToken(...args),
    unregisterFCMToken: (...args: unknown[]) => mockUnregisterFCMToken(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/services/observability', () => ({
  crashlyticsService: {
    recordError: (...args: unknown[]) => mockRecordError(...args),
    leaveBreadcrumb: (...args: unknown[]) => mockLeaveBreadcrumb(...args),
  },
}));

const CONV = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';

type HandleNotification = (
  n: unknown
) => Promise<{ shouldShowBanner: boolean; shouldShowList: boolean }>;

function chatPush(conversationId: string) {
  return {
    request: {
      content: {
        title: '사장닉',
        body: '안녕하세요',
        data: { type: 'chat_message', conversationId },
      },
    },
  };
}

async function captureHandler(): Promise<HandleNotification> {
  await pushNotificationService.initialize();
  const config = mockSetNotificationHandler.mock.calls.at(-1)?.[0] as {
    handleNotification: HandleNotification;
  };
  return config.handleNotification;
}

describe('포그라운드 채팅 푸시 — 보고 있는 방', () => {
  const received = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    pushNotificationService.cleanup();
    useChatPresenceStore.setState({ viewCounts: {} });
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    Object.defineProperty(Device, 'isDevice', { value: true, writable: true });
    Object.defineProperty(Constants, 'expoConfig', {
      value: { extra: { eas: { projectId: 'test-project-id' } } },
      writable: true,
      configurable: true,
    });
    pushNotificationService.setNotificationReceivedHandler(received);
  });

  it('보고 있는 방의 채팅 푸시는 앱 콜백을 부르지 않고 알림센터에도 남기지 않는다', async () => {
    const handle = await captureHandler();
    useChatPresenceStore.getState().enterConversation(CONV);

    const presentation = await handle(chatPush(CONV));

    expect(received).not.toHaveBeenCalled();
    expect(presentation.shouldShowBanner).toBe(false);
    expect(presentation.shouldShowList).toBe(false);
  });

  it('대조군: 다른 방의 채팅 푸시는 앱 콜백으로 넘기고 배너를 띄운다', async () => {
    const handle = await captureHandler();
    useChatPresenceStore.getState().enterConversation(CONV);

    const presentation = await handle(chatPush(OTHER));

    expect(received).toHaveBeenCalledTimes(1);
    expect(presentation.shouldShowBanner).toBe(true);
  });
});
