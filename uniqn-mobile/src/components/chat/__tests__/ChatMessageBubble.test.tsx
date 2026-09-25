/**
 * 말풍선 — 실패 시 재전송·삭제, 삭제된 메시지, 발신자 이름
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatOutboxBubble, ChatServerBubble } from '../ChatMessageBubble';
import type { ChatMessage, ChatOutboxItem } from '@/types/chat';

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
});
