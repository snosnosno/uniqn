/**
 * 알림 탭 → 지금 보고 있는 바로 그 채팅방이면 이동하지 않는다 (S3 리뷰 M)
 * 네이티브는 웹과 달리 같은 경로여도 router.push 가 스택에 한 번 더 쌓는다.
 */
import { router } from 'expo-router';
import { navigateFromNotification } from '../deepLinkNavigationExecutor';
import { useChatPresenceStore } from '@/stores/chatPresenceStore';
import { NotificationType } from '@/types/notification';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../analyticsService', () => ({ trackEvent: jest.fn() }));

const CONV = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  jest.clearAllMocks();
  useChatPresenceStore.setState({ viewCounts: {} });
});

describe('navigateFromNotification — 같은 채팅방', () => {
  it('보고 있는 방의 알림을 탭하면 이동하지 않는다', async () => {
    useChatPresenceStore.getState().enterConversation(CONV);
    await expect(
      navigateFromNotification(
        NotificationType.CHAT_MESSAGE,
        { conversationId: CONV },
        `/chat/${CONV}`
      )
    ).resolves.toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('대조군: 다른 방의 알림은 그 방으로 이동한다', async () => {
    useChatPresenceStore.getState().enterConversation(CONV);
    await navigateFromNotification(
      NotificationType.CHAT_MESSAGE,
      { conversationId: OTHER },
      `/chat/${OTHER}`
    );
    expect(router.push).toHaveBeenCalledWith(`/(app)/chat/${OTHER}`);
  });
});
