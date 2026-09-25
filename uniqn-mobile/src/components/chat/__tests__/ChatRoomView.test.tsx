/**
 * ChatRoomView — 읽음 처리는 보고 있을 때만(코드 리뷰 M2), 꼬리 오류는 받은 메시지를 지우지 않는다(M4)
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ChatRoomView } from '../ChatRoomView';
import type { ChatMessage } from '@/types/chat';

const mockMarkRead = jest.fn();
const mockMessages = {
  messages: [] as ChatMessage[],
  isLoading: false,
  error: null as Error | null,
  tailError: null as Error | null,
  retry: jest.fn(),
  hasOlder: false,
  isFetchingOlder: false,
  fetchOlder: jest.fn(),
};
jest.mock('@/hooks/chat', () => ({
  useChatMessages: () => mockMessages,
  useChatRoomActions: () => ({ markRead: mockMarkRead }),
  useSendChatMessage: () => ({ outbox: [], send: jest.fn(), retry: jest.fn(), discard: jest.fn() }),
  useActiveConversation: (id: string | null) => mockUseActiveConversation(id),
}));
const mockUseActiveConversation = jest.fn();
const mockFocus = { focused: true, active: true };
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocus.focused }));
jest.mock('@/hooks/chat/useIsAppActive', () => ({ useIsAppActive: () => mockFocus.active }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn(() => 'me') }));
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

function incoming(id: string): ChatMessage {
  return {
    id,
    conversationId: 'c',
    senderId: 'other',
    senderSide: 'employer',
    senderDisplayName: '담당자',
    kind: 'text',
    body: `본문-${id}`,
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    clientMessageId: `c-${id}`,
    createdAt: '2026-09-25T09:00:00Z',
    deletedAt: null,
  };
}

function renderView() {
  return render(
    <ChatRoomView
      conversationId="c"
      jobPostingId="p"
      seekerId={null}
      postingTitle="공고"
      postingStatus="active"
      mySide="seeker"
      readCursor={null}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocus.focused = true;
  mockFocus.active = true;
  mockMessages.messages = [incoming('m1')];
  mockMessages.error = null;
  mockMessages.tailError = null;
});

describe('ChatRoomView 읽음 처리', () => {
  it('보고 있으면 최신 상대 메시지까지 읽음', () => {
    renderView();
    expect(mockMarkRead).toHaveBeenCalledWith('m1');
  });

  it('포커스가 없으면(공고 상세가 위에 있음) 읽음 처리하지 않는다', () => {
    mockFocus.focused = false;
    renderView();
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it('앱이 백그라운드면 읽음 처리하지 않는다', () => {
    mockFocus.active = false;
    renderView();
    expect(mockMarkRead).not.toHaveBeenCalled();
  });
});

// S3: 포그라운드 채팅 푸시 억제는 '맨 위에 떠 있는 방'에만 걸린다
describe('ChatRoomView 보고 있는 방 등록', () => {
  it('포커스된 방은 보고 있는 방으로 등록한다', () => {
    renderView();
    expect(mockUseActiveConversation).toHaveBeenLastCalledWith('c');
  });

  it('포커스가 없으면(공고 상세가 위에 있음) 등록하지 않는다', () => {
    mockFocus.focused = false;
    renderView();
    expect(mockUseActiveConversation).toHaveBeenLastCalledWith(null);
  });
});

describe('ChatRoomView 오류 표시', () => {
  it('꼬리 조회 오류는 받은 메시지를 지우지 않고 배너로 알린다', () => {
    mockMessages.tailError = new Error('5xx');
    const { getByLabelText } = renderView();
    expect(getByLabelText(/새 메시지를 불러오지 못했어요/)).toBeTruthy();
  });
});
