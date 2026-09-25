/**
 * 말풍선 — 실패 시 재전송·삭제, 삭제된 메시지, 발신자 이름
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatOutboxBubble, ChatServerBubble } from '../ChatMessageBubble';
import type { ChatMessage, ChatOutboxItem } from '@/types/chat';

const mockImageBubble = jest.fn();
jest.mock('../ChatImageBubble', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    ChatImageBubble: (props: Record<string, unknown>) => {
      mockImageBubble(props);
      return <ReactNative.Text>[사진]</ReactNative.Text>;
    },
  };
});

const failed: ChatOutboxItem = {
  clientMessageId: 'c1',
  kind: 'text',
  body: '내일 뵙겠습니다',
  status: 'failed',
  errorMessage: '메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요.',
  createdAtLocal: '2026-09-25T09:00:00.000Z',
};

function message(patch: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'conv',
    senderId: 'other',
    senderSide: 'employer',
    senderDisplayName: '홀덤펍 담당자',
    kind: 'text',
    body: '네 확인했어요',
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    clientMessageId: 'x',
    createdAt: '2026-09-25T09:00:00.000Z',
    deletedAt: null,
    ...patch,
  };
}

describe('ChatOutboxBubble', () => {
  it('실패하면 에러 문구와 재전송·삭제를 보여 주고 같은 clientMessageId 로 부른다', () => {
    const onRetry = jest.fn();
    const onDiscard = jest.fn();
    const { getByText, getByLabelText } = render(
      <ChatOutboxBubble item={failed} onRetry={onRetry} onDiscard={onDiscard} />
    );

    expect(getByText(failed.errorMessage!)).toBeTruthy();
    fireEvent.press(getByLabelText('메시지 다시 보내기'));
    expect(onRetry).toHaveBeenCalledWith('c1');
    fireEvent.press(getByLabelText('보내지 못한 메시지 삭제'));
    expect(onDiscard).toHaveBeenCalledWith('c1');
  });

  it('보내는 중에는 재전송 버튼이 없다', () => {
    const { queryByLabelText, getByText } = render(
      <ChatOutboxBubble
        item={{ ...failed, status: 'sending' }}
        onRetry={jest.fn()}
        onDiscard={jest.fn()}
      />
    );
    expect(queryByLabelText('메시지 다시 보내기')).toBeNull();
    expect(getByText('보내는 중')).toBeTruthy();
  });
});

describe('ChatServerBubble', () => {
  it('구직자 화면에서는 상대 말풍선 위에 발신자 이름을 단다', () => {
    const { getByText } = render(
      <ChatServerBubble message={message()} isMine={false} showSenderName />
    );
    expect(getByText('홀덤펍 담당자')).toBeTruthy();
  });

  it('내 말풍선에는 이름을 달지 않는다', () => {
    const { queryByText } = render(
      <ChatServerBubble message={message({ senderId: 'me' })} isMine showSenderName />
    );
    expect(queryByText('홀덤펍 담당자')).toBeNull();
  });

  it('삭제된 메시지는 본문 대신 안내', () => {
    const { getByText, queryByText } = render(
      <ChatServerBubble
        message={message({ deletedAt: '2026-09-25T10:00:00Z', body: '' })}
        isMine={false}
        showSenderName={false}
      />
    );
    expect(getByText('삭제된 메시지예요')).toBeTruthy();
    expect(queryByText('네 확인했어요')).toBeNull();
  });

  it('사진 메시지는 경로·크기로 사진 말풍선을 그린다', () => {
    const { getByText } = render(
      <ChatServerBubble
        message={message({
          kind: 'image',
          body: '',
          imagePath: 'c/u/m.jpg',
          imageWidth: 1600,
          imageHeight: 1200,
        })}
        isMine={false}
        showSenderName={false}
      />
    );
    expect(getByText('[사진]')).toBeTruthy();
    expect(mockImageBubble).toHaveBeenCalledWith(
      expect.objectContaining({ imagePath: 'c/u/m.jpg', width: 1600, height: 1200, isMine: false })
    );
  });

  it('삭제된 사진은 사진 대신 삭제 안내', () => {
    mockImageBubble.mockClear();
    const { getByText } = render(
      <ChatServerBubble
        message={message({
          kind: 'image',
          body: '',
          imagePath: null,
          deletedAt: '2026-09-25T10:00:00Z',
        })}
        isMine={false}
        showSenderName={false}
      />
    );
    expect(getByText('삭제된 메시지예요')).toBeTruthy();
    expect(mockImageBubble).not.toHaveBeenCalled();
  });
});

describe('ChatOutboxBubble — 사진', () => {
  it('올리는 중이면 로컬 사진에 단계 문구를 얹는다', () => {
    mockImageBubble.mockClear();
    render(
      <ChatOutboxBubble
        item={{
          ...failed,
          kind: 'image',
          body: '',
          status: 'sending',
          stage: 'uploading',
          errorMessage: undefined,
          image: { localUri: 'file:///a.jpg', width: 400, height: 300 },
        }}
        onRetry={jest.fn()}
        onDiscard={jest.fn()}
      />
    );
    expect(mockImageBubble).toHaveBeenCalledWith(
      expect.objectContaining({
        localUri: 'file:///a.jpg',
        pendingLabel: '사진 올리는 중',
        isMine: true,
      })
    );
  });

  it('재시도해도 같은 실패면 재전송 버튼 없이 삭제만 보인다', () => {
    const { queryByLabelText, getByLabelText } = render(
      <ChatOutboxBubble
        item={{ ...failed, retryable: false }}
        onRetry={jest.fn()}
        onDiscard={jest.fn()}
      />
    );
    expect(queryByLabelText('메시지 다시 보내기')).toBeNull();
    expect(getByLabelText('보내지 못한 메시지 삭제')).toBeTruthy();
  });
});
