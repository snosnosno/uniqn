/**
 * chatPresenceStore — '보고 있는 채팅방' 등록·해제 (S3 포그라운드 푸시 억제)
 */
import { useChatPresenceStore } from '../chatPresenceStore';

const A = 'AAAAAAAA-1111-4111-8111-111111111111';
const B = 'bbbbbbbb-2222-4222-8222-222222222222';

beforeEach(() => {
  useChatPresenceStore.setState({ activeConversationId: null });
});

describe('chatPresenceStore', () => {
  it('등록한 방 id 를 소문자로 보관한다', () => {
    useChatPresenceStore.getState().setActiveConversationId(A);
    expect(useChatPresenceStore.getState().activeConversationId).toBe(A.toLowerCase());
  });

  it('나가는 방이 여전히 활성일 때만 비운다 — 방→방 전환에서 새 방 등록을 지우지 않는다', () => {
    const { setActiveConversationId, clearActiveConversationId } = useChatPresenceStore.getState();
    setActiveConversationId(A);
    setActiveConversationId(B); // 새 방 마운트가 먼저 등록
    clearActiveConversationId(A); // 옛 방 언마운트 정리가 뒤늦게 옴
    expect(useChatPresenceStore.getState().activeConversationId).toBe(B);

    clearActiveConversationId(B);
    expect(useChatPresenceStore.getState().activeConversationId).toBeNull();
  });
});
