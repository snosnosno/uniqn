/**
 * ChatComposer — 개인정보 경고는 비차단, 오프라인은 입력 차단
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChatComposer } from '../ChatComposer';

jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => false }));

describe('ChatComposer', () => {
  it('전화번호를 쓰면 경고가 뜨지만 전송 버튼은 살아 있다', () => {
    const onSend = jest.fn();
    const { getByTestId, getByText } = render(<ChatComposer onSend={onSend} />);

    fireEvent.changeText(getByTestId('chat-composer-input'), '연락처 010-1234-5678');
    expect(getByText(/전화번호를 보내려는 것 같아요/)).toBeTruthy();

    const send = getByTestId('chat-composer-send');
    expect(send.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(send);
    expect(onSend).toHaveBeenCalledWith('연락처 010-1234-5678');
  });

  it('보낸 뒤 입력창을 비우고, 앞뒤 공백은 자른다', () => {
    const onSend = jest.fn();
    const { getByTestId } = render(<ChatComposer onSend={onSend} />);
    const input = getByTestId('chat-composer-input');

    fireEvent.changeText(input, '  안녕하세요  ');
    fireEvent.press(getByTestId('chat-composer-send'));

    expect(onSend).toHaveBeenCalledWith('안녕하세요');
    expect(input.props.value).toBe('');
  });

  it('공백만 있으면 보낼 수 없다', () => {
    const onSend = jest.fn();
    const { getByTestId } = render(<ChatComposer onSend={onSend} />);
    fireEvent.changeText(getByTestId('chat-composer-input'), '   ');
    fireEvent.press(getByTestId('chat-composer-send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('오프라인이면 입력·전송을 막고 이유를 보여 준다', () => {
    const onSend = jest.fn();
    const { getByTestId, getByText } = render(
      <ChatComposer
        onSend={onSend}
        disabled
        disabledReason="오프라인에서는 메시지를 보낼 수 없어요"
      />
    );
    expect(getByTestId('chat-composer-input').props.editable).toBe(false);
    expect(getByText('오프라인에서는 메시지를 보낼 수 없어요')).toBeTruthy();
    expect(getByTestId('chat-composer-send').props.accessibilityState?.disabled).toBe(true);
  });

  it('입력창은 다크모드 클래스를 가진다', () => {
    const { getByTestId } = render(<ChatComposer onSend={jest.fn()} />);
    expect(getByTestId('chat-composer-input').props.className).toMatch(/dark:/);
  });
});
