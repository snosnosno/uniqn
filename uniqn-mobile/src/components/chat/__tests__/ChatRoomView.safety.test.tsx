/**
 * ChatRoomView — (S4) 차단 상태면 입력창 대신 안내, 상대 메시지 길게 눌러 신고
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatRoomView, type ChatRoomViewProps } from '../ChatRoomView';
import type { ChatMessage } from '@/types/chat';

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: ({ item, index }: { item: unknown; index: number }) => React.ReactNode;
  }) => {
    const { View } = jest.requireActual('react-native');
    return (
      <View>
        {data.map((item, index) => (
          <View key={String(index)}>{renderItem({ item, index })}</View>
        ))}
      </View>
    );
  },
}));
jest.mock('@/components/ui/Modal', () => ({
  Modal: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => {
    const { View } = jest.requireActual('react-native');
    return visible ? (
      <View>
        {children}
        {footer}
      </View>
    ) : null;
  },
}));

const mockMessages = {
  messages: [] as ChatMessage[],
  isLoading: false,
  error: null,
  tailError: null,
  retry: jest.fn(),
  fetchOlder: jest.fn(),
};
const mockReport = jest.fn();
jest.mock('@/hooks/chat', () => ({
  useChatMessages: () => mockMessages,
  useChatRoomActions: () => ({ markRead: jest.fn() }),
  useSendChatMessage: () => ({
    outbox: [],
    send: jest.fn(),
    sendImage: jest.fn(),
    retry: jest.fn(),
    discard: jest.fn(),
  }),
  useActiveConversation: jest.fn(),
  useReportChatMessage: () => ({ report: mockReport, isReporting: false }),
}));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/hooks/chat/useIsAppActive', () => ({ useIsAppActive: () => true }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn(() => 'me') }));
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));
jest.mock('@/hooks/chat/useChatMediaUrl', () => ({
  useChatMediaUrl: () => ({ url: null, isError: false }),
}));

function msg(id: string, patch: Partial<ChatMessage> = {}): ChatMessage {
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
    ...patch,
  };
}

function renderView(overrides: Partial<ChatRoomViewProps> = {}) {
  return render(
    <ChatRoomView
      conversationId="c"
      jobPostingId="p"
      seekerId={null}
      postingTitle="공고"
      postingStatus="active"
      mySide="seeker"
      readCursor={null}
      {...overrides}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMessages.messages = [
    msg('m1'),
    msg('m2', { senderId: 'me', senderSide: 'seeker', body: '내 메시지' }),
  ];
});

describe('ChatRoomView 차단 상태', () => {
  it('차단이 아니면 입력창이 보인다', () => {
    const { getByTestId, queryByTestId } = renderView({ blockState: 'none' });
    expect(getByTestId('chat-composer-input')).toBeTruthy();
    expect(queryByTestId('chat-blocked-notice')).toBeNull();
  });

  it('상대가 막았으면 입력창·사진 버튼 대신 안내만(해제 버튼 없음)', () => {
    const { getByText, queryByTestId, queryByLabelText } = renderView({ blockState: 'theirs' });
    expect(getByText('대화할 수 없는 상태예요')).toBeTruthy();
    expect(queryByTestId('chat-composer-input')).toBeNull();
    expect(queryByLabelText('사진 첨부')).toBeNull();
    expect(queryByLabelText('차단 해제')).toBeNull();
  });

  it('내가 막았으면 안내 옆 해제 버튼 → onUnblock', () => {
    const onUnblock = jest.fn();
    const { getByLabelText } = renderView({ blockState: 'mine', onUnblock });
    fireEvent.press(getByLabelText('차단 해제'));
    expect(onUnblock).toHaveBeenCalledTimes(1);
  });
});

describe('ChatRoomView 메시지 신고', () => {
  it('상대 메시지를 길게 누르면 "신고하기" → 신고 시트가 열린다', () => {
    const { getByTestId, getByText, getByLabelText } = renderView();

    fireEvent(getByTestId('chat-bubble-m1'), 'longPress');
    fireEvent.press(getByText('신고하기'));

    expect(getByLabelText('신고 제출')).toBeTruthy();
  });

  it('내 메시지는 길게 눌러도 신고 메뉴가 없다', () => {
    const { getByTestId, queryByText } = renderView();
    expect(getByTestId('chat-bubble-m2').props.accessibilityActions).toBeUndefined();
    expect(queryByText('신고하기')).toBeNull();
  });

  it('삭제된 상대 메시지는 신고 대상이 아니다', () => {
    mockMessages.messages = [msg('m3', { deletedAt: '2026-09-25T10:00:00Z' })];
    const { getByTestId } = renderView();
    expect(getByTestId('chat-bubble-m3').props.accessibilityActions).toBeUndefined();
  });
});
