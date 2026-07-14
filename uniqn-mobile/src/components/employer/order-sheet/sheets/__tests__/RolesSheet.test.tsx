/**
 * RolesSheet — 역할 시트 테스트 (칩 + 기타 직접입력 + 스테퍼 + 다역할)
 *
 * SheetModal 은 children+footer 만 렌더로 모킹. 검증:
 * (1) 칩 선택 후 추가 → 확인 시 해당 역할로 onConfirm, (2) 기타 커스텀 이름 → other+customRole,
 * (3) 상단 스테퍼 반영, (4) 역할 행 ±1 스테퍼, (5) 역할 행 삭제, (6) 빈 목록/빈 커스텀은 확인 비활성.
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
  it('기본 딜러 칩 → 추가 → 확인 시 [{dealer,1}] 로 onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={onClose} />
    );
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'dealer', count: 1 }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('기타 칩 → 커스텀 이름 입력 후 추가 → other+customRole 로 onConfirm', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-role-chip-other'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '  칩카운터  ');
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'other', customRole: '칩카운터', count: 1 }]);
  });

  it('상단 스테퍼 +2 후 추가 → count 3 반영', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-role-count-plus'));
    fireEvent.press(getByTestId('order-role-count-plus'));
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'dealer', count: 3 }]);
  });

  it('추가된 역할 행 +1 스테퍼 → count 2 로 확정', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText, getByLabelText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByLabelText('딜러 인원 늘리기'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'dealer', count: 2 }]);
  });

  it('역할 행 삭제 → 빈 목록이면 확인 비활성(onConfirm 미호출)', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText, getByLabelText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByLabelText('딜러 삭제'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('빈 목록에서 확인 비활성', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('기타 칩인데 커스텀 이름이 비면 추가되지 않는다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-role-chip-other'));
    fireEvent.press(getByTestId('order-role-add')); // 이름 없음 → 무시
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
