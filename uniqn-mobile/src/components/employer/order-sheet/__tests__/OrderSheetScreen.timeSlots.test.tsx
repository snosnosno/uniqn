/**
 * OrderSheetScreen — 일정·모집 시트 라우팅 + #244 지연 전환(switchSheet) 테스트
 *
 * (1) roles 행: 슬롯 1개면 역할 시트 직접, 복수면 TimeSlotsSheet 진입,
 * (2) TimeSlotsSheet→RolesSheet 스왑은 즉시 스왑이 아니라 닫고 SHEET_DISMISS_ANIMATION_MS 뒤 열림,
 * (3) 전환 예약 중 언마운트 시 타이머 정리(크래시·누수 없음).
 * SheetModal 은 children+footer+overlay 렌더로 모킹(reanimated 타이머 배제 — fake timer 격리).
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import { SHEET_DISMISS_ANIMATION_MS } from '@/constants/animation';

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

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
  onSwitchToLegacyForm: jest.fn(),
};

const withSlots = (slots: { startTime: string; roles: any[] }[]) => ({
  ...initialOrderSheetValues(),
  timeSlots: slots,
});

describe('OrderSheetScreen — 일정·모집 라우팅 + #244 전환', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('roles 행 — 슬롯 복수면 TimeSlotsSheet 진입', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByText('출근 21:00')).toBeTruthy();
  });

  it('roles 행 — 슬롯 1개면 역할 시트 직접 진입', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([{ startTime: '19:00', roles: [] }])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('어떤 역할이 필요하세요?')).toBeTruthy();
  });

  it('TimeSlotsSheet→RolesSheet 스왑은 지연 전환(즉시 스왑 금지)', async () => {
    jest.useFakeTimers();
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles')); // TimeSlotsSheet
    fireEvent.press(getByTestId('order-time-roles-0')); // 슬롯0 역할 편집 → switchSheet
    // onConfirm(setValue shouldValidate)의 RHF 비동기 검증 microtask flush
    await act(async () => {
      await Promise.resolve();
    });

    // 닫힘 직후: TimeSlots 닫히고 RolesSheet 아직 안 열림
    expect(queryByText('출근 19:00')).toBeNull();
    expect(queryByText('어떤 역할이 필요하세요?')).toBeNull();

    // dismiss 애니메이션 경과 후 RolesSheet 열림
    act(() => {
      jest.advanceTimersByTime(SHEET_DISMISS_ANIMATION_MS);
    });
    expect(getByText('어떤 역할이 필요하세요?')).toBeTruthy();
  });

  it('전환 예약 중 언마운트 → 타이머 정리(크래시 없음)', async () => {
    jest.useFakeTimers();
    const { getByTestId, unmount } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    fireEvent.press(getByTestId('order-time-roles-0')); // switchSheet 예약
    await act(async () => {
      await Promise.resolve();
    });
    expect(() => {
      unmount();
      act(() => {
        jest.advanceTimersByTime(SHEET_DISMISS_ANIMATION_MS * 2);
      });
    }).not.toThrow();
  });
});
