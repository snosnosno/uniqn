/**
 * SalarySheet — 급여 시트 테스트 (S2 개편: 역할별 기본값 시드·스테퍼·인라인 직접입력)
 *
 * (1) 협의(other)는 amount 0으로 확정, (2) 시급 ±1,000 스테퍼(shared),
 * (3) 동일급여 OFF 시 역할별 기본값 시드(딜러 2만/플로어 3만)로 즉시 확정 가능,
 * (4) 역할별 스테퍼·금액 탭→인라인 직접입력·빈 blur 복원, (5) 역할 없이 OFF면 안내 + 확인 비활성,
 * (6) same=false면 상단 단일 금액 영역 숨김, (7) 타입 전환 시 사용자 수정 금액 보존(미수정 행만 재시드),
 * (8) 협의→시급 왕복은 0 유지(확인 비활성), (9) 금액 1억 클램프.
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
const FLOOR: UniqueRole = { role: 'floor', label: '플로어' };

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

  it('동일급여 OFF 전환 시 역할별 기본값이 시드돼 즉시 확정 가능하다 (프리필 안전망)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary
        roleSalaries={[]}
        uniqueRoles={[DEALER, FLOOR]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-same-toggle')); // OFF
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        useSameSalary: false,
        roleSalaries: [
          { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
        ],
      })
    );
  });

  it('역할별 시급 스테퍼 +1,000 후 확인하면 해당 역할만 증가한다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary={false}
        roleSalaries={[
          { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
        ]}
        uniqueRoles={[DEALER, FLOOR]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-role-plus-dealer:'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        roleSalaries: expect.arrayContaining([
          { role: 'dealer', salary: { type: 'hourly', amount: 21000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
        ]),
      })
    );
  });

  it('금액 탭 → 인라인 직접입력 → 완료로 해당 역할 금액을 바꾼다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary={false}
        roleSalaries={[{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-role-amount-dealer:'));
    fireEvent.changeText(getByTestId('order-sheet-salary-role-input-dealer:'), '32000');
    fireEvent.press(getByTestId('order-sheet-salary-role-done-dealer:'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 32000 } }],
      })
    );
  });

  it('빈 입력 blur는 이전 값을 복원한다 (0/미정 퇴행 금지 — 2차 Design-H3)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary={false}
        roleSalaries={[{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-role-amount-dealer:'));
    fireEvent.changeText(getByTestId('order-sheet-salary-role-input-dealer:'), '');
    fireEvent(getByTestId('order-sheet-salary-role-input-dealer:'), 'blur');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }],
      })
    );
  });

  it('same=false면 상단 단일 금액 영역(스테퍼·직접입력)이 숨겨진다 (R4 위반 지점 제거)', () => {
    const { queryByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary={false}
        roleSalaries={[{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }]}
        uniqueRoles={[DEALER]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(queryByTestId('order-sheet-salary-minus')).toBeNull();
    expect(queryByTestId('order-sheet-salary-plus')).toBeNull();
    expect(queryByTestId('order-sheet-salary-amount')).toBeNull();
  });

  it('타입 전환 왕복(시급→일급→시급)은 사용자 수정 금액을 보존하고 미수정(기본값) 행만 재시드한다', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary={false}
        roleSalaries={[
          { role: 'dealer', salary: { type: 'hourly', amount: 25000 } }, // 사용자 수정
          { role: 'floor', salary: { type: 'hourly', amount: 30000 } }, // 시급 기본값 그대로
        ]}
        uniqueRoles={[DEALER, FLOOR]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-type-daily'));
    fireEvent.press(getByTestId('order-sheet-salary-type-hourly'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        roleSalaries: expect.arrayContaining([
          { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
          { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
        ]),
      })
    );
  });

  it('협의→시급 왕복은 역할 금액 0 유지 — 확인 비활성 (확정 동작 회귀 고정)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary={false}
        roleSalaries={[{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-type-other'));
    fireEvent.press(getByTestId('order-sheet-salary-type-hourly'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('직접입력 금액은 1억으로 클램프된다 (Eng-M4)', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(
      <SalarySheet
        visible
        value={HOURLY_VALUE}
        useSameSalary={false}
        roleSalaries={[{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }]}
        uniqueRoles={[DEALER]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('order-sheet-salary-role-amount-dealer:'));
    fireEvent.changeText(getByTestId('order-sheet-salary-role-input-dealer:'), '999999999999');
    fireEvent.press(getByTestId('order-sheet-salary-role-done-dealer:'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 100_000_000 } }],
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
