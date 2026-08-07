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

const setup = (overrides: Record<string, unknown> = {}) => {
  const onConfirm = jest.fn();
  const utils = render(
    <ScheduleSlotsSheet
      visible
      value={seededSlots}
      selectableDates={CARD_DATES}
      onConfirm={onConfirm}
      onClose={jest.fn()}
      {...overrides}
    />
  );
  return { ...utils, onConfirm };
};

describe('적용할 날짜 — 상시 노출 · 0개 = 전체 적용', () => {
  it('카드의 날짜들을 선택 칩으로 보여준다', () => {
    const { getByTestId } = setup();
    for (const date of CARD_DATES) {
      expect(getByTestId(`order-sheet-exception-date-${date}`)).toBeTruthy();
    }
  });

  it('아무 날짜도 선택되지 않은 채로 열리고, 그 상태를 "전체 적용"이라고 말한다', () => {
    const { getByText } = setup();
    expect(getByText('안 고르면 전체 날짜에 적용돼요')).toBeTruthy();
  });

  /**
   * 사용자 결정(2026-08-07) — 구 계약은 "0개 = 확인 잠금"이었다. 0개가 가장 흔한 조작
   * (전 날짜 같은 조건)인데 그걸 막으면 날짜 확정 직후 연쇄가 막다른 길이 된다.
   */
  it('0개 선택에서도 확인이 열려 있고, 빈 날짜 배열로 배출한다 (= 전체 적용)', () => {
    const { getByText, getByTestId, onConfirm } = setup();
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ dates: [], slots: seededSlots });
  });

  it('날짜를 고르면 고른 날짜만 배출한다 — 다중 예외가 1회 입력으로 끝난다', () => {
    const { getByTestId, getByText, onConfirm } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-11'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-13'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      dates: ['2026-08-11', '2026-08-13'],
      slots: seededSlots,
    });
  });

  it('고르면 몇 일이 나뉘는지 되읽어 준다', () => {
    const { getByTestId, getByText } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-11'));
    expect(getByText('고른 1일만 이 조건으로 나뉘어요')).toBeTruthy();
  });

  it('선택을 다시 누르면 해제된다', () => {
    const { getByTestId, getByText, onConfirm } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-11'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ dates: ['2026-08-11'], slots: seededSlots });
  });

  it('배출 순서는 탭한 순서가 아니라 화면(날짜) 순서다', () => {
    const { getByTestId, getByText, onConfirm } = setup();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-13'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({
      dates: ['2026-08-10', '2026-08-13'],
      slots: seededSlots,
    });
  });

  it('본문은 현재 카드 조건을 시드로 받는다 (빈 슬롯에서 시작하지 않는다)', () => {
    const { getByText } = setup();
    expect(getByText('출근 19:00')).toBeTruthy();
  });

  it('타이틀은 모드에 따라 갈리지 않는다 — 시트가 하나로 합쳐졌다', () => {
    const { getByTestId } = setup();
    expect(getByTestId('mock-sheet-title').props.children).toBe('시간 · 역할');
  });

  it('구 "일부 날짜만 다르게 할까요?" 링크는 더 이상 없다', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('order-sheet-slots-switch-exception')).toBeNull();
  });

  it('후보가 1개뿐이면 고를 여지가 없어 날짜 행을 숨긴다', () => {
    const { queryByTestId, queryByText } = setup({ selectableDates: ['2026-08-10'] });
    expect(queryByTestId('order-sheet-exception-date-2026-08-10')).toBeNull();
    expect(queryByText('안 고르면 전체 날짜에 적용돼요')).toBeNull();
  });

  it('날짜 행이 숨겨져도 확인은 빈 배열로 배출한다 (전체 적용)', () => {
    const { getByText, onConfirm } = setup({ selectableDates: ['2026-08-10'] });
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ dates: [], slots: seededSlots });
  });
});

/**
 * 리뷰 HIGH 1 회귀 가드 — 템플릿 프리셋이 만드는 "조건만 있고 날짜 없는 카드".
 * 이 카드는 0개 선택이 "전체"가 될 수 없다(적용될 날짜가 0일이라 제출이 막힌다).
 */
describe('날짜를 아직 못 받은 조건 카드 (requiresDatePick)', () => {
  const setupEmpty = (overrides: Record<string, unknown> = {}) =>
    setup({ requiresDatePick: true, ...overrides });

  it('후보가 1개뿐이어도 날짜 행을 보여준다 — 배정이 필요하다', () => {
    const { getByTestId } = setupEmpty({ selectableDates: ['2026-08-10'] });
    expect(getByTestId('order-sheet-exception-date-2026-08-10')).toBeTruthy();
  });

  /** 대조군 — 후보가 1개라도 **있으면** 배정 요구는 그대로다(0개일 때만 요구가 성립하지 않는다) */
  it('후보가 1개뿐이어도 고르기 전에는 확인이 잠긴다', () => {
    const { getByTestId } = setupEmpty({ selectableDates: ['2026-08-10'] });
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-10'));
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(false);
  });

  it('최소 1개를 고를 때까지 확인이 잠긴다', () => {
    const { getByTestId, getByText } = setupEmpty();
    expect(getByText('이 조건을 쓸 날짜를 골라주세요')).toBeTruthy();
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(true);
  });

  it('날짜를 고르면 잠금이 풀리고 그 날짜를 배출한다', () => {
    const { getByTestId, getByText, onConfirm } = setupEmpty();
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-08-11'));
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ dates: ['2026-08-11'], slots: seededSlots });
  });
});

/**
 * 리뷰 HIGH — **후보가 0개**인 막다른 길. 공고에 날짜가 하나도 없으면(신규 주문서·프리셋
 * 1탭 적용) 날짜 행은 고를 게 없어 숨는데 `requiresDatePick` 은 최소 1개를 요구했다 →
 * 고를 UI 가 없는데 고르라고 요구해 확인이 영영 잠겼다. 요구 자체가 성립하지 않는 상황이다.
 */
describe('후보가 0개 — 배정할 날짜가 아예 없다 (막다른 길 금지)', () => {
  const setupNoDates = (overrides: Record<string, unknown> = {}) =>
    setup({ requiresDatePick: true, selectableDates: [], ...overrides });

  it('고를 UI 가 없으므로 날짜 행도 없다', () => {
    const { queryByText } = setupNoDates();
    expect(queryByText('이 조건을 쓸 날짜')).toBeNull();
  });

  it('확인이 잠기지 않는다 — 고를 수 없는 것을 고르라고 요구하지 않는다', () => {
    const { getByTestId } = setupNoDates();
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(false);
  });

  it('확인하면 빈 날짜 배열로 배출한다 (= 이 카드에 그대로 적용)', () => {
    const { getByText, onConfirm } = setupNoDates();
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ dates: [], slots: seededSlots });
  });

  it('슬롯이 미완성이면 여전히 잠긴다 — 날짜 요구만 풀 뿐 완성 게이트는 그대로다', () => {
    const { getByTestId } = setupNoDates({ value: [{ startTime: '19:00', roles: [] }] });
    expect(getByTestId('order-sheet-slots-confirm').props.accessibilityState.disabled).toBe(true);
  });
});

/**
 * 리뷰 HIGH — 확인이 잠겼는데 **왜 잠겼는지가 화면에 없다**. 구 구조는 안내가 날짜 블록
 * 안에만 있어, 블록이 숨거나(후보 0·1개) 잠금 사유가 슬롯 미완성이면 사장은 회색 버튼만 본다.
 * 사유는 잠긴 버튼 옆에 항상 있어야 한다.
 */
describe('확인이 잠기면 이유가 보인다', () => {
  it('슬롯 미완성 — 무엇을 채워야 하는지 말해 준다', () => {
    const { getByTestId } = setup({ value: [{ startTime: '19:00', roles: [] }] });
    expect(getByTestId('order-sheet-slots-lock-reason').props.children).toBe(
      '시간과 역할을 모두 채워야 확인할 수 있어요'
    );
  });

  it('날짜 배정이 필요한 조건 카드 — 잠긴 버튼 옆에서도 사유가 보인다', () => {
    const { getByTestId } = setup({ requiresDatePick: true });
    expect(getByTestId('order-sheet-slots-lock-reason').props.children).toBe(
      '이 조건을 쓸 날짜를 골라야 확인할 수 있어요'
    );
  });

  it('확인이 열려 있으면 사유를 띄우지 않는다', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('order-sheet-slots-lock-reason')).toBeNull();
  });
});
