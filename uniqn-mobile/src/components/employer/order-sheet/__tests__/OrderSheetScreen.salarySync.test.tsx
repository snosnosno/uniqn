/**
 * OrderSheetScreen — 역할별 급여 자동 프리필 배선 테스트 (설계 §S2.3)
 *
 * (1) 역할 확정 시 syncRoleSalaries로 급여 자동 set(시트 안 열어도 등록 가능) + '기본값' 배지,
 * (2) 후속 역할 추가 시 1회성 토스트(기본 급여 적용 안내 — 2차 CEO-2), 초기 시드는 토스트 없음,
 * (3) 급여 시트 confirm 시 배지 해제, (4) 프리셋 적용(reset 직전) 시 부분 커버 by_role 템플릿 sync(Eng-H3).
 */
import { render, fireEvent, act, within } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import type { OrderSheetPreset } from '../PresetCarousel';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer, overlay }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});
jest.mock('@/components/ui/Modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});
jest.mock('@/components/ui/CalendarPicker', () => ({ CalendarPicker: () => null }));

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
  onSwitchToLegacyForm: jest.fn(),
};

const flushValidation = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const filledBase = (
  timeSlots: { startTime: string; roles: { role: 'dealer' | 'floor'; count: number }[] }[]
): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러 구합니다',
  location: { name: '강남 홀덤펍' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [{ dates: ['2026-07-14'], timeSlots, grouped: false }],
});

describe('OrderSheetScreen — 역할별 급여 자동 프리필(syncRoleSalaries) 배선', () => {
  beforeEach(() => {
    mockAddToast.mockClear();
  });

  it('역할 확정 시 급여가 기본값으로 자동 set되고 급여 행에 기본값 배지가 선다 (초기 시드 — 토스트 없음)', async () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...filledBase([{ startTime: '19:00', roles: [] }]),
        }}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-roles')); // 슬롯 1개 → RolesSheet 직접
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    await flushValidation();

    const salaryRow = getByTestId('order-sheet-row-salary');
    expect(within(salaryRow).getByText(/딜러 20,000/)).toBeTruthy();
    expect(getByTestId('order-sheet-row-salary-badge')).toBeTruthy();
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('후속 역할 추가 시 새 역할 기본값 적용 토스트가 뜬다 (무음 주입 완화)', async () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...filledBase([{ startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] }]),
          roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }],
        }}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-roles'));
    fireEvent.press(getByTestId('order-role-chip-floor'));
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    await flushValidation();

    const salaryRow = getByTestId('order-sheet-row-salary');
    expect(within(salaryRow).getByText(/딜러 20,000 · 플로어 30,000/)).toBeTruthy();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('플로어 30,000원'),
      })
    );
  });

  it('급여 시트 confirm 시 기본값 배지가 해제된다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...filledBase([{ startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] }]),
          roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }],
        }}
      />
    );

    expect(getByTestId('order-sheet-row-salary-badge')).toBeTruthy();

    fireEvent.press(getByTestId('order-sheet-row-salary'));
    fireEvent.press(getByText('확인')); // SalarySheet confirm
    await flushValidation();

    expect(queryByTestId('order-sheet-row-salary-badge')).toBeNull();
  });

  it('프리셋 적용 시 부분 커버 by_role 값이 reset 직전 sync로 전수 커버된다 (사용자 금액은 배지 없음)', async () => {
    const preset: OrderSheetPreset = {
      id: 'last',
      title: '⚡ 마지막 공고',
      subtitle: '지난 공고 요약',
      values: {
        ...filledBase([
          {
            startTime: '19:00',
            roles: [
              { role: 'dealer', count: 2 },
              { role: 'floor', count: 1 },
            ],
          },
        ]),
        roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 25000 } }],
      },
    };
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()}
        presets={[preset]}
      />
    );

    fireEvent.press(getByTestId('order-sheet-preset-last'));
    await flushValidation();

    const salaryRow = getByTestId('order-sheet-row-salary');
    expect(within(salaryRow).getByText(/딜러 25,000 · 플로어 30,000/)).toBeTruthy();
    expect(queryByTestId('order-sheet-row-salary-badge')).toBeNull(); // 딜러 25,000 ≠ 기본값
  });
});
