/**
 * getRouteFromNotification — 채팅 알림 탭 라우팅 (S3)
 *
 * 검증 목표:
 *  - CHAT_MESSAGE 는 link 와 무관하게 data.conversationId 의 채팅방으로 간다
 *    (ROUTE_MAP_PRIORITY_TYPES 등록). link 와 매핑의 파라미터 수가 같으면 link 가 이기므로,
 *    등록이 빠지면 공고 링크가 실린 알림은 공고 상세로 새 버린다.
 *  - 서버가 심는 link('/chat/{id}')는 파서가 같은 채팅방으로 해석한다(웹 URL·외부 딥링크 겸용).
 */

import { getRouteFromNotification } from '../deepLinkNavigationExecutor';
import { parseDeepLink } from '../deepLinkRouteParser';
import { RouteMapper } from '@/shared/deeplink';
import { NotificationType } from '@/types/notification';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../analyticsService', () => ({
  trackEvent: jest.fn(),
}));

const CONV = '11111111-1111-4111-8111-111111111111';
const POSTING = '22222222-2222-4222-8222-222222222222';

describe('getRouteFromNotification — 채팅 알림', () => {
  it('서버 link(/chat/{id}) 와 data 가 함께 오면 채팅방으로 간다', () => {
    expect(
      getRouteFromNotification(
        NotificationType.CHAT_MESSAGE,
        { conversationId: CONV, jobPostingId: POSTING },
        `/chat/${CONV}`
      )
    ).toEqual({ name: 'chat', params: { conversationId: CONV } });
  });

  it('link 가 공고 상세여도 공고로 가지 않고 채팅방으로 간다 (PRIORITY 등록)', () => {
    expect(
      getRouteFromNotification(
        NotificationType.CHAT_MESSAGE,
        { conversationId: CONV, jobPostingId: POSTING },
        `/jobs/${POSTING}`
      )
    ).toEqual({ name: 'chat', params: { conversationId: CONV } });
  });

  it('conversationId 가 없으면 채팅 목록으로 간다', () => {
    expect(getRouteFromNotification(NotificationType.CHAT_MESSAGE, {}, undefined)).toEqual({
      name: 'chat/list',
    });
  });
});

describe('채팅 딥링크 파싱·경로 변환', () => {
  it('/chat/{id} 는 채팅방 라우트로 파싱되고 소문자로 정규화된다', () => {
    expect(parseDeepLink(`/chat/${CONV.toUpperCase()}`).route).toEqual({
      name: 'chat',
      params: { conversationId: CONV },
    });
  });

  it('/chat 은 채팅 목록 라우트로 파싱된다', () => {
    expect(parseDeepLink('/chat').route).toEqual({ name: 'chat/list' });
  });

  it('채팅방 라우트는 탭바 밖 스택 경로로, 목록은 소통 탭 채팅 칸으로 변환된다', () => {
    expect(RouteMapper.toExpoPath({ name: 'chat', params: { conversationId: CONV } })).toBe(
      `/(app)/chat/${CONV}`
    );
    expect(RouteMapper.toExpoPath({ name: 'chat/list' })).toBe('/(app)/(tabs)/board/chat');
  });
});

describe('채팅 라우팅 — 리뷰 반영', () => {
  it('/board/chat 은 채팅 목록으로 파싱된다(소통 탭 채팅 칸)', () => {
    expect(parseDeepLink('/board/chat').route).toEqual({ name: 'chat/list' });
  });

  it('알림 data 의 방 id 가 uuid 가 아니면 목록으로 간다(파서와 같은 규칙)', () => {
    expect(
      getRouteFromNotification(NotificationType.CHAT_MESSAGE, { conversationId: 'not-a-uuid' })
    ).toEqual({ name: 'chat/list' });
  });

  it('알림 data 의 방 id 는 소문자로 정규화된다', () => {
    expect(
      getRouteFromNotification(NotificationType.CHAT_MESSAGE, {
        conversationId: CONV.toUpperCase(),
      })
    ).toEqual({ name: 'chat', params: { conversationId: CONV } });
  });
});
