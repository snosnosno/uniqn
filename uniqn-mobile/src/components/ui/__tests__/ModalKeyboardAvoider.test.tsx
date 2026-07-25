/**
 * ModalKeyboardAvoider 테스트
 *
 * RNModal(statusBarTranslucent) 내부의 키보드 회피를
 * react-native-keyboard-controller의 KeyboardAvoidingView에 위임하는지 검증한다.
 *
 * 실제 인셋 계산은 네이티브(ModalAttachedWatcher가 dialog.window에 부착하는
 * WindowInsetsAnimationCallback)에서 일어나므로 유닛 테스트로는 관찰할 수 없다.
 * 여기서는 위임 계약(behavior/flex/children/testID)만 고정하고,
 * 실제 회피 동작은 실기기 QA로 검증한다.
 *
 * 🔑 jest.mock 팩토리는 out-of-scope 변수를 참조할 수 없다 —
 * `mock` 접두 변수만 예외로 허용되므로 스파이 이름을 그렇게 둔다.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { ModalKeyboardAvoider } from '../ModalKeyboardAvoider';

const mockKeyboardAvoidingView = jest.fn();

jest.mock('react-native-keyboard-controller', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    KeyboardAvoidingView: (props: Record<string, unknown>) => {
      mockKeyboardAvoidingView(props);
      return <ReactNative.View {...props} />;
    },
  };
});

describe('ModalKeyboardAvoider', () => {
  beforeEach(() => {
    mockKeyboardAvoidingView.mockClear();
  });

  it('children을 렌더링한다', () => {
    const { getByText } = render(
      <ModalKeyboardAvoider>
        <Text>모달 내용</Text>
      </ModalKeyboardAvoider>
    );

    expect(getByText('모달 내용')).toBeTruthy();
  });

  it('keyboard-controller의 KeyboardAvoidingView에 behavior="padding"으로 위임한다', () => {
    render(
      <ModalKeyboardAvoider>
        <View />
      </ModalKeyboardAvoider>
    );

    expect(mockKeyboardAvoidingView).toHaveBeenCalledTimes(1);
    expect(mockKeyboardAvoidingView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'padding' })
    );
  });

  it('컨테이너가 flex-1을 유지한다 (시트 높이 붕괴 방지)', () => {
    render(
      <ModalKeyboardAvoider>
        <View />
      </ModalKeyboardAvoider>
    );

    expect(mockKeyboardAvoidingView).toHaveBeenCalledWith(
      expect.objectContaining({ className: 'flex-1' })
    );
  });

  it('testID를 유지한다 (소비처 회귀 감지용)', () => {
    const { getByTestId } = render(
      <ModalKeyboardAvoider>
        <View />
      </ModalKeyboardAvoider>
    );

    expect(getByTestId('modal-keyboard-inset')).toBeTruthy();
  });
});
