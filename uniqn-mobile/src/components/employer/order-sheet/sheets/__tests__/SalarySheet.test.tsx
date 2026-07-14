/**
 * SalarySheet — 급여 시트 테스트
 *
 * (1) 협의(other)는 amount 0으로 확정, (2) 시급 ±1,000 스테퍼, (3) 동일급여 OFF·미커버 시 확인 비활성,
 * (4) 역할별 금액 입력 후 커버되면 roleSalaries 확정, (5) 역할 없이 OFF면 안내 + 확인 비활성.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { SalarySheet, type UniqueRole } from '../SalarySheet';

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

const HOURLY_VALUE = { type: 'hourly' as const, amount: 20000 };
const DEALER: UniqueRole = { role: 'dealer', label: '딜러' };

describe('SalarySheet', () => {
  it('협의(other) 선택 후 확인하면 { type:other, amount:0 }로 onConfirm', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary
        roleSalaries={[]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-type-other'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({
      salary: { type: 'other', amount: 0 },
      useSameSalary: true,
      roleSalaries: [],
    });
  });

  it('시급 스테퍼 +1,000 후 확인하면 21,000으로 onConfirm', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary
        roleSalaries={[]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-plus'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ salary: { type: 'hourly', amount: 21000 } })
    );
  });

  it('동일급여 OFF·역할 금액 미입력이면 확인 비활성 (onConfirm 미호출)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary
        roleSalaries={[]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-same-toggle')); // OFF
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('동일급여 OFF·역할별 금액 입력 후 확인하면 roleSalaries가 채워진다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary
        roleSalaries={[]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-same-toggle')); // OFF
    fireEvent.changeText(getByTestId('order-sheet-salary-role-input-dealer:'), '30000');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        useSameSalary: false,
        roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 30000 } }],
      })
    );
  });

  it('역할이 없는데 동일급여 OFF면 안내 문구 + 확인 비활성', () => {
    const onConfirm = jest.fn();
    const { getByText, queryByText } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary
        roleSalaries={[]}
        uniqueRoles={[]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByText('모든 역할 동일 급여')); // OFF
    expect(queryByText(/역할을 먼저 추가/)).toBeTruthy();
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
