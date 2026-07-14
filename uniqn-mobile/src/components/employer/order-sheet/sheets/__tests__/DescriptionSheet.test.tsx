/**
 * DescriptionSheet — 상세 설명 시트 테스트 (multiline 500자 카운터, optional)
 *
 * (1) 입력 후 확인 시 trim 된 설명으로 onConfirm+onClose, (2) 카운터 반영,
 * (3) 빈 설명도 확인 가능(optional 행) — onConfirm('') 호출.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { DescriptionSheet } from '../DescriptionSheet';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

describe('DescriptionSheet', () => {
  it('입력 후 확인 시 trim 된 설명으로 onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <DescriptionSheet visible value="" onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.changeText(
      getByTestId('order-sheet-description-input'),
      '  주말 야간 딜러 모집합니다  '
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith('주말 야간 딜러 모집합니다');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('글자 수 카운터가 입력 길이를 반영한다', () => {
    const { getByTestId, getByText } = render(
      <DescriptionSheet visible value="" onConfirm={jest.fn()} onClose={jest.fn()} />
    );

    fireEvent.changeText(getByTestId('order-sheet-description-input'), '가나다');
    expect(getByText('3/500')).toBeTruthy();
  });

  it('빈 설명도 확인 가능하다 (optional 행) — onConfirm("") 호출', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <DescriptionSheet visible value="" onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith('');
  });
});
