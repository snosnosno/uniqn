/**
 * RolesSheet — 고정(fixed) 역할 시트 테스트
 *
 * RoleCountEditor 를 감싸는 얇은 껍데기가 되었으므로, 시트 계약(확인=onConfirm+onClose,
 * 빈 목록이면 확인 비활성)만 검증한다. 편집 동작 자체는 RoleCountEditor.test.tsx 담당.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { RolesSheet } from '../RolesSheet';

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

describe('RolesSheet', () => {
  it('칩으로 역할 선택 후 확인 → onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={onClose} />
    );
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'dealer', count: 1 }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('빈 목록이면 확인 비활성 (onConfirm 미호출)', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('초기 value 를 시드로 받아 편집한다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet
        visible
        value={[{ role: 'dealer', count: 2 }]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'dealer', count: 3 }]);
  });

  it('커스텀 역할도 확인 시 그대로 배출된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '칩카운터');
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'other', customRole: '칩카운터', count: 1 }]);
  });
});
