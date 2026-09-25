/**
 * chatPresenceStore — '보고 있는 채팅방' 참조 카운트 (S3 포그라운드 푸시 삼킴)
 */
import { useChatPresenceStore } from '../chatPresenceStore';

const A = 'AAAAAAAA-1111-4111-8111-111111111111';
const B = 'bbbbbbbb-2222-4222-8222-222222222222';

beforeEach(() => {
  useChatPresenceStore.setState({ viewCounts: {} });
});

describe('chatPresenceStore', () => {
  it('등록한 방은 대소문자와 무관하게 보고 있는 방이다', () => {
    useChatPresenceStore.getState().enterConversation(A);
    expect(useChatPresenceStore.getState().isViewingConversation(A.toLowerCase())).toBe(true);
    expect(useChatPresenceStore.getState().isViewingConversation(B)).toBe(false);
  });

  it('방→방 전환: 옛 방 정리가 늦게 와도 새 방 등록은 유지된다', () => {
    const s = useChatPresenceStore.getState();
    s.enterConversation(A);
    s.enterConversation(B);
    s.leaveConversation(A);
    expect(useChatPresenceStore.getState().isViewingConversation(B)).toBe(true);
    expect(useChatPresenceStore.getState().isViewingConversation(A)).toBe(false);
  });

  it('같은 방 두 인스턴스: 새 인스턴스 등록 뒤 옛 인스턴스 정리가 와도 여전히 보고 있다', () => {
    const s = useChatPresenceStore.getState();
    s.enterConversation(A); // 옛 인스턴스
    s.enterConversation(A); // 알림 탭으로 쌓인 새 인스턴스
    s.leaveConversation(A); // 옛 인스턴스 blur 정리(순서 보장 없음)
    expect(useChatPresenceStore.getState().isViewingConversation(A)).toBe(true);
    s.leaveConversation(A);
    expect(useChatPresenceStore.getState().isViewingConversation(A)).toBe(false);
    expect(useChatPresenceStore.getState().viewCounts).toEqual({});
  });
});
