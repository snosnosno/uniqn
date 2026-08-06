/**
 * ScheduleSlotsSheet — 예외 추출 모드 (T3/D2 · 설계 §3.4·§3.9 F7③·F11)
 *
 * "이 카드에서 일부 날짜만 다르게" — 카드의 날짜들 중 일부를 골라 다른 조건으로 분리한다.
 * 다중 선택이라 예외 여러 날이 **1회 입력**으로 끝난다(구 ③ "날짜마다 따로"는 N회였다).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { ScheduleSlotsSheet } from '../ScheduleSlotsSheet';

jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer, overlay }: any) =>
      visible ? (
        <View>
          <Text testID="mock-sheet-title">{title}</Text>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, onConfirm }: any) =>
      visible ? (
        <Pressable testID="mock-time-confirm" onPress={() => onConfirm({ hour: 20, minute: 30 })}>
          <Text>MockPicker</Text>
        </Pressable>
      ) : null,
  };
});

const seededSlots = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 2 }] }];
const CARD_DATES = ['2026-08-10', '2026-08-11', '2026-08-13'];

describe('예외 추출 모드 (F11 — 0개 선택으로 시작)', () => {
  const setup = (overrides: Record<string, unknown> = {}) => {
    const onConfirmException = jest.fn();
    const utils = render(
      <ScheduleSlotsSheet
        visible
        value={seededSlots}
        selectableDates={CARD_DATES}
        onConfirmException={onConfirmException}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        {...overrides}
      />
    );
    return { ...utils, onConfirmException };
  };

  it('카드의 날짜들을 선택 칩으로 보여준다', () => {
    const { getByTestId } = setup();
    for (const date of CARD_DATES) {
      expect(getByTestId(`order-sheet-exception-date-${date}`)).toBeTruthy();
    }
  });

  it('아무 날짜도 선택되지 않은 채로 열리고 확인이 잠겨 있다', () => {
    const { getByText, getByTestId } = setup();
    expect(getByText('다르게 할 날짜를 골라주세요')).toBeTruthy();
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(true);
  });

  it('날짜를 고르면 확인 잠금이 풀린다', () => {
    const { getByTestId } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(false);
  });

  it('날짜를 고르기 전에는 확인이 아무것도 배출하지 않는다', () => {
    const { getByText, onConfirmException } = setup();
    fireEvent.press(getByText('확인'));
    expect(onConfirmException).not.toHaveBeenCalled();
  });

  it('날짜를 고르면 확인이 열리고 선택 날짜와 조건을 함께 배출한다', () => {
    const { getByTestId, getByText, onConfirmException } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-11'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-13'));
    fireEvent.press(getByText('확인'));
    expect(onConfirmException).toHaveBeenCalledWith({
      dates: ['2026-08-11', '2026-08-13'],
      slots: seededSlots,
    });
  });

  it('다중 예외가 1회 입력으로 끝난다 — 배출 호출은 한 번이다', () => {
    const { getByTestId, getByText, onConfirmException } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-11'));
    fireEvent.press(getByText('확인'));
    expect(onConfirmException).toHaveBeenCalledTimes(1);
  });

  it('선택을 다시 누르면 해제된다', () => {
    const { getByTestId, getByText, onConfirmException } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-11'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    fireEvent.press(getByText('확인'));
    expect(onConfirmException).toHaveBeenCalledWith({
      dates: ['2026-08-11'],
      slots: seededSlots,
    });
  });

  it('전 날짜를 고르면 카드 전체 편집과 같아진다 — 그대로 허용한다(정규화가 처리)', () => {
    const { getByTestId, getByText, onConfirmException } = setup();
    for (const date of CARD_DATES) {
      fireEvent.press(getByTestId(`order-sheet-exception-date-${date}`));
    }
    fireEvent.press(getByText('확인'));
    expect(onConfirmException).toHaveBeenCalledWith({ dates: CARD_DATES, slots: seededSlots });
  });

  it('본문은 현재 카드 조건을 시드로 받는다 (빈 슬롯에서 시작하지 않는다)', () => {
    const { getByText } = setup();
    expect(getByText('출근 19:00')).toBeTruthy();
  });

  it('예외 모드 타이틀이 목적을 말한다', () => {
    const { getByTestId } = setup();
    expect(getByTestId('mock-sheet-title').props.children).toContain('일부 날짜만');
  });

  it('예외 모드에서는 예외 진입 링크를 다시 보여주지 않는다', () => {
    const { queryByTestId } = setup({ onSwitchToException: jest.fn() });
    expect(queryByTestId('order-sheet-slots-switch-exception')).toBeNull();
  });
});

describe('일반 모드 하단 예외 진입 링크 (F7③ — 조건 고치러 온 자리가 예외를 깨닫는 자리)', () => {
  it('진입 콜백이 있으면 링크를 보여준다', () => {
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={seededSlots}
        onSwitchToException={jest.fn()}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByTestId('order-sheet-slots-switch-exception')).toBeTruthy();
    expect(getByText('일부 날짜만 다르게 할까요?')).toBeTruthy();
  });

  it('진입 콜백이 없으면(날짜 1개 카드) 링크를 숨긴다', () => {
    const { queryByTestId } = render(
      <ScheduleSlotsSheet visible value={seededSlots} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(queryByTestId('order-sheet-slots-switch-exception')).toBeNull();
  });

  it('링크를 누르면 예외 모드 전환을 요청한다', () => {
    const onSwitchToException = jest.fn();
    const { getByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={seededSlots}
        onSwitchToException={onSwitchToException}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-sheet-slots-switch-exception'));
    expect(onSwitchToException).toHaveBeenCalled();
  });
});
