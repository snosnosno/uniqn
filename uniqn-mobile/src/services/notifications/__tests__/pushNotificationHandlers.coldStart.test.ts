/**
 * 앱을 연 알림 탭(콜드 스타트) — 09-26 실기기: 앱이 꺼진 상태에서 채팅 푸시를 눌러도 방으로 안 감
 *
 * 탭 응답이 JS 리스너 등록보다 먼저 와서 리스너로는 못 받는다. 핸들러를 등록하는 순간
 * getLastNotificationResponse 를 한 번 읽어 처리하고, 리스너와 겹쳐도 한 번만 처리한다.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { pushNotificationService } from '../pushNotificationService';

const mockGetPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();
const mockGetLastNotificationResponse = jest.fn();
const mockClearLastNotificationResponse = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
  getLastNotificationResponse: (...args: unknown[]) => mockGetLastNotificationResponse(...args),
  clearLastNotificationResponse: (...args: unknown[]) => mockClearLastNotificationResponse(...args),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
}));

jest.mock('@/repositories', () => ({
  notificationRepository: { registerFCMToken: jest.fn(), unregisterFCMToken: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/services/observability', () => ({
  crashlyticsService: { recordError: jest.fn(), leaveBreadcrumb: jest.fn() },
}));

const CONV = '11111111-1111-4111-8111-111111111111';

function chatTap(identifier: string) {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      request: {
        identifier,
        content: {
          title: '스노',
          body: '안녕하세요',
          data: { type: 'chat_message', conversationId: CONV },
        },
      },
    },
  };
}

/** initialize 가 등록한 탭 리스너 */
function listener(): (response: unknown) => void {
  return mockAddNotificationResponseReceivedListener.mock.calls.at(-1)?.[0];
}

describe('앱을 연 알림 탭(콜드 스타트)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    pushNotificationService.cleanup();
    mockAddNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
    mockGetLastNotificationResponse.mockReturnValue(null);
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    Object.defineProperty(Device, 'isDevice', { value: true, writable: true });
    Object.defineProperty(Constants, 'expoConfig', {
      value: { extra: { eas: { projectId: 'test-project-id' } } },
      writable: true,
      configurable: true,
    });
    await pushNotificationService.initialize();
  });

  it('핸들러를 등록하는 순간 앱을 연 탭을 처리하고 비운다', () => {
    mockGetLastNotificationResponse.mockReturnValue(chatTap('launch-1'));
    const handler = jest.fn();

    pushNotificationService.setNotificationResponseHandler(handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ data: { type: 'chat_message', conversationId: CONV } }),
      'expo.modules.notifications.actions.DEFAULT'
    );
    expect(mockClearLastNotificationResponse).toHaveBeenCalled();
  });

  it('같은 탭이 리스너로 다시 와도, 핸들러를 다시 등록해도 한 번만 처리한다', () => {
    mockGetLastNotificationResponse.mockReturnValue(chatTap('launch-1'));
    const handler = jest.fn();

    pushNotificationService.setNotificationResponseHandler(handler);
    listener()(chatTap('launch-1'));
    pushNotificationService.setNotificationResponseHandler(handler);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('핸들러가 없을 때 리스너로 온 탭은 버리지 않고, 핸들러 등록 때 처리한다', () => {
    listener()(chatTap('early-1'));
    mockGetLastNotificationResponse.mockReturnValue(chatTap('early-1'));
    const handler = jest.fn();

    pushNotificationService.setNotificationResponseHandler(handler);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('앱을 연 탭이 없으면 아무것도 하지 않는다 · 이후 새 탭은 리스너로 처리', () => {
    const handler = jest.fn();
    pushNotificationService.setNotificationResponseHandler(handler);
    expect(handler).not.toHaveBeenCalled();

    listener()(chatTap('warm-1'));
    listener()(chatTap('warm-2'));
    expect(handler).toHaveBeenCalledTimes(2);
  });
  it('로그아웃(핸들러 해제) 중에 누른 탭은 버린다 — 다음 로그인 계정이 처리하지 않게', () => {
    const first = jest.fn();
    pushNotificationService.setNotificationResponseHandler(first);
    pushNotificationService.setNotificationResponseHandler(null);

    listener()(chatTap('logged-out-1'));
    expect(mockClearLastNotificationResponse).toHaveBeenCalled();

    // 네이티브가 비웠으므로 다음 등록 때 getLast 는 null
    mockGetLastNotificationResponse.mockReturnValue(null);
    const next = jest.fn();
    pushNotificationService.setNotificationResponseHandler(next);
    expect(first).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('앱 시작 직후(아직 등록 전) 리스너로 온 탭은 비우지 않는다 — 안드로이드 재전달 보존', () => {
    listener()(chatTap('android-early'));
    expect(mockClearLastNotificationResponse).not.toHaveBeenCalled();
  });

  it('웹에서는 앱을 연 탭을 읽지 않는다', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    mockGetLastNotificationResponse.mockReturnValue(chatTap('web-1'));
    const handler = jest.fn();
    pushNotificationService.setNotificationResponseHandler(handler);
    expect(mockGetLastNotificationResponse).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
