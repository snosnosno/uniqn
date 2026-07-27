/**
 * OrderSheetScreen — 무음 유실 차단 (W1-12 / ORDER-3 · ORDER-11 · ORDER-8).
 *
 * @description 주문서에는 "사용자가 한 적 없는 일이 조용히 일어나는" 경로가 셋 있었다.
 *   ① 프리셋 카드 1탭이 폼 전체를 확인·Undo 없이 교체하고, `form.reset` 이 isDirty 까지
 *      false 로 떨어뜨려 이탈 경고마저 무장 해제했다. 되돌릴 자산(handleDeleteGroup 의
 *      스냅샷+5초 Undo 토스트)이 **같은 파일에** 있는데 안 쓰고 있었다.
 *   ② 타입 전환이 반대 축 입력(날짜·시간대 / 근무조건)을 치우면서 신호를 0개 냈다.
 *   ③ 날짜 상한을 다 써도 '＋ 일정 추가' 가 열려, 아무것도 못 고르는 시트로 들어갔다.
 */
import { render, fireEvent, act } from '@testing-library/react-native';
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
    SheetModal: ({ visible, title, children, footer }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

const baseProps = { onSubmit: jest.fn(), isSubmitting: false };

const presetValues: OrderSheetFormValues = {
  ...initialOrderSheetValues(),
  title: '프리셋 딜러',
  contactPhone: '010-1234-5678',
};

const preset: OrderSheetPreset = {
  id: 'last',
  title: '마지막 공고',
  subtitle: '지난 공고 요약',
  values: presetValues,
};

/** 지정한 개수의 날짜를 한 그룹에 담은 초기값. */
function valuesWithDates(count: number): OrderSheetFormValues {
  return {
    ...initialOrderSheetValues(),
    postingType: 'regular',
    scheduleGroups: [
      {
        dates: Array.from({ length: count }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`),
        timeSlots: [],
        grouped: false,
      },
    ],
  };
}

/** 마지막으로 발행된 토스트. */
function lastToast() {
  return mockAddToast.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  mockAddToast.mockClear();
});

describe('ORDER-3 — 프리셋 적용은 되돌릴 수 있어야 한다', () => {
  it('입력이 없는 상태의 첫 적용은 되돌릴 게 없으니 토스트를 띄우지 않는다', () => {
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()}
        presets={[preset]}
      />
    );

    fireEvent.press(getByTestId('order-sheet-preset-last'));

    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('쓰던 입력이 있으면 되돌리기 액션이 달린 토스트를 띄운다', () => {
    const { getByTestId, getByPlaceholderText, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()}
        presets={[preset]}
      />
    );

    // 제목 시트로 입력을 만들어 dirty 상태를 만든다.
    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByPlaceholderText('예: 주말 딜러 구합니다'), '내가 쓰던 제목');
    fireEvent.press(getByText('확인'));

    fireEvent.press(getByTestId('order-sheet-preset-last'));

    expect(lastToast()?.action?.label).toBe('되돌리기');
  });

  it('되돌리기를 누르면 프리셋 이전 입력이 복원된다', () => {
    const onSaveTemplate = jest.fn();
    const { getByTestId, getByPlaceholderText, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()}
        presets={[preset]}
        onSaveTemplate={onSaveTemplate}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByPlaceholderText('예: 주말 딜러 구합니다'), '내가 쓰던 제목');
    fireEvent.press(getByText('확인'));

    fireEvent.press(getByTestId('order-sheet-preset-last'));
    lastToast()?.action?.onPress?.();

    fireEvent.press(getByTestId('order-sheet-preset-save'));
    expect(onSaveTemplate.mock.calls.at(-1)?.[0]?.title).toBe('내가 쓰던 제목');
  });

  it('프리셋을 얹으면 저장 안 된 변경으로 남는다 — reset 이 이탈 경고를 끄면 안 된다', () => {
    const onDirtyChange = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={initialOrderSheetValues()}
        presets={[preset]}
        onDirtyChange={onDirtyChange}
      />
    );

    fireEvent.press(getByTestId('order-sheet-preset-last'));

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});

describe('ORDER-11 — 타입 전환이 데이터를 치우면 알린다', () => {
  it('날짜가 담긴 채 고정으로 전환하면 치웠다고 알리고 되돌릴 길을 준다', () => {
    const { getByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={valuesWithDates(2)} />
    );

    fireEvent.press(getByText('고정'));

    expect(lastToast()?.message).toContain('일정·모집');
    expect(lastToast()?.action?.label).toBe('되돌리기');
  });

  it('치울 입력이 없으면 알리지 않는다 (빈 폼 오탭에 소음 금지)', () => {
    const { getByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={initialOrderSheetValues()} />
    );

    fireEvent.press(getByText('고정'));

    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('되돌리기를 누르면 치웠던 날짜가 돌아온다', () => {
    const { getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={valuesWithDates(2)} />
    );

    fireEvent.press(getByText('고정'));
    // fixed 로 전환되면 일정 행이 사라지고 근무조건 행이 선다.
    expect(queryByTestId('order-sheet-row-dates')).toBeNull();
    expect(queryByTestId('order-sheet-row-workConditions')).toBeTruthy();

    act(() => {
      lastToast()?.action?.onPress?.();
    });

    expect(queryByTestId('order-sheet-row-dates')).toBeTruthy();
    expect(queryByTestId('order-sheet-row-workConditions')).toBeNull();
  });
});

describe('ORDER-8 — 날짜 상한을 다 쓰면 일정 추가를 열지 않는다', () => {
  it('상한(regular 7개) 도달 시 일정 추가가 비활성이고 이유를 말한다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={valuesWithDates(7)} />
    );

    expect(getByTestId('order-sheet-add-schedule').props.accessibilityState.disabled).toBe(true);
    expect(getByText('날짜는 7개까지 담을 수 있어요')).toBeTruthy();
  });

  it('여유가 있으면 그대로 열린다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={valuesWithDates(3)} />
    );

    expect(getByTestId('order-sheet-add-schedule').props.accessibilityState.disabled).toBe(false);
    expect(getByText('＋ 일정 추가')).toBeTruthy();
  });
});
