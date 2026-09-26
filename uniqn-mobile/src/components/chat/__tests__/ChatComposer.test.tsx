/**
 * ChatComposer — 개인정보 경고는 비차단, 오프라인은 입력 차단, 웹 Enter 전송·Alt+Enter 줄바꿈
 */
import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
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

  it('onAttach 가 없으면 사진 첨부 버튼을 그리지 않는다', () => {
    const { queryByTestId } = render(<ChatComposer onSend={jest.fn()} />);
    expect(queryByTestId('chat-attach-button')).toBeNull();
  });

  it('네이티브: + 를 누르면 앨범/카메라가 뜨고, 고른 쪽으로 onAttach 를 부른다', () => {
    const onAttach = jest.fn();
    const { getByTestId, getByLabelText, queryByTestId } = render(
      <ChatComposer onSend={jest.fn()} onAttach={onAttach} />
    );

    fireEvent.press(getByTestId('chat-attach-button'));
    expect(getByTestId('chat-attach-menu')).toBeTruthy();
    fireEvent.press(getByLabelText('카메라에서 사진 고르기'));

    expect(onAttach).toHaveBeenCalledWith('camera');
    expect(queryByTestId('chat-attach-menu')).toBeNull();
  });

  it('오프라인(disabled)이면 첨부 버튼도 막힌다', () => {
    const { getByTestId } = render(
      <ChatComposer onSend={jest.fn()} onAttach={jest.fn()} disabled disabledReason="오프라인" />
    );
    expect(getByTestId('chat-attach-button').props.accessibilityState?.disabled).toBe(true);
  });

  describe('웹 키보드 (09-26 QA)', () => {
    const original = Object.getOwnPropertyDescriptor(Platform, 'OS');
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
    });
    afterEach(() => {
      if (original) Object.defineProperty(Platform, 'OS', original);
    });

    const keyPress = (over: Record<string, unknown> = {}) => ({
      key: 'Enter',
      preventDefault: jest.fn(),
      nativeEvent: { key: 'Enter', isComposing: false },
      ...over,
    });

    it('Enter 는 보내고 기본 줄바꿈을 막는다', () => {
      const onSend = jest.fn();
      const { getByTestId } = render(<ChatComposer onSend={onSend} />);
      const input = getByTestId('chat-composer-input');
      fireEvent.changeText(input, '안녕하세요');
      const event = keyPress();
      fireEvent(input, 'keyPress', event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(onSend).toHaveBeenCalledWith('안녕하세요');
      expect(input.props.value).toBe('');
    });

    it('한글 조합 중 Enter 는 보내지 않는다(isComposing · keyCode 229)', () => {
      const onSend = jest.fn();
      const { getByTestId } = render(<ChatComposer onSend={onSend} />);
      const input = getByTestId('chat-composer-input');
      fireEvent.changeText(input, '안녕');
      fireEvent(input, 'keyPress', keyPress({ nativeEvent: { key: 'Enter', isComposing: true } }));
      fireEvent(input, 'keyPress', keyPress({ keyCode: 229 }));
      expect(onSend).not.toHaveBeenCalled();
    });

    it('Shift+Enter 는 브라우저 기본 줄바꿈에 맡긴다(보내지 않음·막지 않음)', () => {
      const onSend = jest.fn();
      const { getByTestId } = render(<ChatComposer onSend={onSend} />);
      const input = getByTestId('chat-composer-input');
      fireEvent.changeText(input, '첫 줄');
      const event = keyPress({ shiftKey: true });
      fireEvent(input, 'keyPress', event);
      expect(onSend).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('Alt+Enter 는 커서 자리에 줄바꿈을 넣고 보내지 않는다', () => {
      const onSend = jest.fn();
      const { getByTestId } = render(<ChatComposer onSend={onSend} />);
      const input = getByTestId('chat-composer-input');
      fireEvent.changeText(input, 'ab');
      const setSelectionRange = jest.fn();
      const event = keyPress({
        altKey: true,
        target: { value: 'ab', selectionStart: 1, selectionEnd: 1, setSelectionRange },
      });
      jest.useFakeTimers();
      try {
        fireEvent(input, 'keyPress', event);
        act(() => {
          jest.runOnlyPendingTimers();
        });
      } finally {
        jest.useRealTimers();
      }
      expect(event.preventDefault).toHaveBeenCalled();
      expect(onSend).not.toHaveBeenCalled();
      expect(input.props.value).toBe('a\nb');
      expect(setSelectionRange).toHaveBeenCalledWith(2, 2);
    });

    it('Alt+Enter 로 한도(1000자)를 넘기면 줄바꿈을 넣지 않는다', () => {
      const { getByTestId } = render(<ChatComposer onSend={jest.fn()} />);
      const input = getByTestId('chat-composer-input');
      const full = '가'.repeat(1000);
      fireEvent.changeText(input, full);
      fireEvent(
        input,
        'keyPress',
        keyPress({
          altKey: true,
          target: { value: full, selectionStart: 1000, selectionEnd: 1000 },
        })
      );
      expect(input.props.value).toBe(full);
    });

    it('Enter 는 입력창의 실제 값을 보낸다(조합 확정 직후 상태 지연 대비)', () => {
      const onSend = jest.fn();
      const { getByTestId } = render(<ChatComposer onSend={onSend} />);
      const input = getByTestId('chat-composer-input');
      fireEvent.changeText(input, '안녕하세');
      fireEvent(input, 'keyPress', keyPress({ target: { value: '안녕하세요' } }));
      expect(onSend).toHaveBeenCalledWith('안녕하세요');
    });

    it('터치 기기 웹에서는 Enter 로 보내지 않는다(가상 키보드 = 줄바꿈)', () => {
      const original = window.matchMedia;
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: jest.fn().mockReturnValue({ matches: true }),
      });
      try {
        const onSend = jest.fn();
        const { getByTestId } = render(<ChatComposer onSend={onSend} />);
        const input = getByTestId('chat-composer-input');
        fireEvent.changeText(input, '안녕');
        const event = keyPress();
        fireEvent(input, 'keyPress', event);
        expect(onSend).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          writable: true,
          value: original,
        });
      }
    });

    it('빈 입력에서 Enter 는 아무것도 보내지 않는다', () => {
      const onSend = jest.fn();
      const { getByTestId } = render(<ChatComposer onSend={onSend} />);
      fireEvent(getByTestId('chat-composer-input'), 'keyPress', keyPress());
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  it('네이티브에서는 Enter 키 이벤트로 보내지 않는다(줄바꿈 키 = 줄바꿈)', () => {
    const onSend = jest.fn();
    const { getByTestId } = render(<ChatComposer onSend={onSend} />);
    const input = getByTestId('chat-composer-input');
    fireEvent.changeText(input, '안녕');
    fireEvent(input, 'keyPress', {
      key: 'Enter',
      preventDefault: jest.fn(),
      nativeEvent: { key: 'Enter' },
    });
    expect(onSend).not.toHaveBeenCalled();
  });
});
