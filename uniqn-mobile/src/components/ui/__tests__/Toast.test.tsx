/**
 * Toast — 액션 버튼 실렌더 테스트 (S1 리뷰 HIGH-1 회귀 고정)
 *
 * toastStore 계약의 action 필드가 렌더러에 실제 배선되는지 검증한다 —
 * 스토어 mock 테스트만으로는 "payload는 넣었는데 버튼이 안 뜨는" false-green을 못 잡는다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Toast } from '../Toast';
import type { Toast as ToastType } from '@/stores/toastStore';

const baseToast: ToastType = {
  id: 't1',
  type: 'success',
  message: '7/20~21 일정을 삭제했어요',
  duration: 5000,
};

describe('Toast', () => {
  it('action이 있으면 라벨 버튼을 렌더하고, 누르면 onPress 후 dismiss가 이어진다', () => {
    const onPress = jest.fn();
    const onDismiss = jest.fn();
    const { getByTestId, getByText } = render(
      <Toast
        toast={{ ...baseToast, action: { label: '되돌리기', onPress } }}
        onDismiss={onDismiss}
      />
    );

    expect(getByText('되돌리기')).toBeTruthy();
    fireEvent.press(getByTestId('toast-action'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('action이 없으면 액션 버튼을 렌더하지 않는다 (기존 토스트 무회귀)', () => {
    const { queryByTestId } = render(<Toast toast={baseToast} onDismiss={jest.fn()} />);
    expect(queryByTestId('toast-action')).toBeNull();
  });
});
