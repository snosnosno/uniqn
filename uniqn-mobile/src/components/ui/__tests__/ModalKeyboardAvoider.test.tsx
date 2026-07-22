/**
 * ModalKeyboardAvoider 테스트
 *
 * Android에서 RNModal(statusBarTranslucent) 별도 윈도우는 adjustResize가 무시되고
 * KeyboardAvoidingView(height)도 무력화되므로(relativeKeyboardHeight=0 붕괴),
 * keyboardDidShow의 endCoordinates.height(IME 인셋 직산)를 paddingBottom으로
 * 직접 적용하는지 검증한다.
 */
import React from 'react';
import { Keyboard, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { AndroidKeyboardInsetView, ModalKeyboardAvoider } from '../ModalKeyboardAvoider';

describe('AndroidKeyboardInsetView', () => {
  // jest restoreMocks:true — 모듈 스코프 spyOn은 2번째 테스트부터 무력화되므로 beforeEach에서 재설치
  let listeners: Record<string, (event?: unknown) => void>;
  let removeSpies: jest.Mock[];

  beforeEach(() => {
    listeners = {};
    removeSpies = [];
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      eventName: string,
      callback: (event?: unknown) => void
    ) => {
      listeners[eventName] = callback;
      const remove = jest.fn();
      removeSpies.push(remove);
      return { remove };
    }) as never);
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  });

  it('키보드 이벤트 전에는 paddingBottom 0', () => {
    const { getByTestId } = render(
      <AndroidKeyboardInsetView>
        <Text>내용</Text>
      </AndroidKeyboardInsetView>
    );

    expect(getByTestId('modal-keyboard-inset')).toHaveStyle({ paddingBottom: 0 });
  });

  it('keyboardDidShow 시 endCoordinates.height만큼 paddingBottom 적용', () => {
    const { getByTestId } = render(
      <AndroidKeyboardInsetView>
        <Text>내용</Text>
      </AndroidKeyboardInsetView>
    );

    act(() => {
      listeners['keyboardDidShow']?.({ endCoordinates: { height: 336 } });
    });

    expect(getByTestId('modal-keyboard-inset')).toHaveStyle({ paddingBottom: 336 });
  });

  it('keyboardDidHide 시 paddingBottom 0으로 복귀', () => {
    const { getByTestId } = render(
      <AndroidKeyboardInsetView>
        <Text>내용</Text>
      </AndroidKeyboardInsetView>
    );

    act(() => {
      listeners['keyboardDidShow']?.({ endCoordinates: { height: 336 } });
    });
    act(() => {
      listeners['keyboardDidHide']?.();
    });

    expect(getByTestId('modal-keyboard-inset')).toHaveStyle({ paddingBottom: 0 });
  });

  it('마운트 시 키보드가 이미 떠 있으면 초기값으로 반영', () => {
    (Keyboard.isVisible as jest.Mock).mockReturnValue(true);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue({
      height: 280,
      screenX: 0,
      screenY: 0,
      width: 0,
    });

    const { getByTestId } = render(
      <AndroidKeyboardInsetView>
        <Text>내용</Text>
      </AndroidKeyboardInsetView>
    );

    expect(getByTestId('modal-keyboard-inset')).toHaveStyle({ paddingBottom: 280 });
  });

  it('언마운트 시 리스너 해제', () => {
    const { unmount } = render(
      <AndroidKeyboardInsetView>
        <Text>내용</Text>
      </AndroidKeyboardInsetView>
    );

    unmount();

    expect(removeSpies.length).toBeGreaterThanOrEqual(2);
    removeSpies.forEach((remove) => expect(remove).toHaveBeenCalled());
  });
});

describe('ModalKeyboardAvoider', () => {
  it('children을 렌더링한다 (iOS/기타 플랫폼 KAV 경로)', () => {
    const { getByText } = render(
      <ModalKeyboardAvoider>
        <Text>모달 내용</Text>
      </ModalKeyboardAvoider>
    );

    expect(getByText('모달 내용')).toBeTruthy();
  });
});
