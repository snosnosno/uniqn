/**
 * OrderSheetScreen — 관측 이벤트 4종 (T5 · 설계 §8.6)
 *
 * 이 화면에는 계기판이 없었다(Sentry release 미태깅·애널리틱스 부재). 어느 옵션이 실제로
 * 쓰이는지 모르니 "기능 삭제 없이 표현만 바꾼다"고 결정했고, 그 판단의 근거를 쌓는 게 이 이벤트다.
 *
 * ⚠️ 반드시 `logger.observability` 만 쓴다 — `logger.error` 로 되돌리면 웹에서
 *    sentry↔logger 무한 재귀가 재발한다(2026-08-04, 콘솔 에러 370만건).
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const mockObservability = jest.fn();
jest.mock('@/utils/logger', () => ({
  logger: {
    observability: (...args: unknown[]) => mockObservability(...args),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
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

const baseProps = { onSubmit: jest.fn(), isSubmitting: false };
const dealerSlot = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 2 }] }];

const withDates = (dates: string[]): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러',
  location: { name: '강남 홀덤펍', region: '서울 강남구' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [{ dates, timeSlots: dealerSlot, grouped: false }],
  roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }],
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const eventNames = () => mockObservability.mock.calls.map((c) => c[0]);
const contextOf = (name: string) =>
  mockObservability.mock.calls.find((c) => c[0] === name)?.[2] as Record<string, unknown>;

describe('관측 이벤트', () => {
  beforeEach(() => mockObservability.mockClear());

  it('묶음 토글은 on 여부와 run 길이를 남긴다', async () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={withDates(['2026-07-14', '2026-07-15'])} />
    );

    fireEvent(getByTestId('order-sheet-card-run-toggle-0-0'), 'valueChange', true);
    await flush();

    expect(eventNames()).toContain('order_sheet.bundle_toggle');
    expect(contextOf('order_sheet.bundle_toggle')).toMatchObject({ on: true, runLength: 2 });
  });

  it('예외 추출은 고른 날짜 수와 카드 전체 날짜 수를 남긴다', async () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withDates(['2026-07-14', '2026-07-15', '2026-07-16'])}
      />
    );

    fireEvent.press(getByTestId('order-sheet-card-exception-0'));
    fireEvent.press(getByTestId('order-sheet-exception-date-2026-07-15'));
    fireEvent.press(getByText('확인'));
    await flush();

    expect(eventNames()).toContain('order_sheet.exception_extract');
    expect(contextOf('order_sheet.exception_extract')).toMatchObject({
      dateCount: 1,
      totalDates: 3,
    });
  });

  it('자동 병합은 카드 수 변화를 남긴다', async () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...withDates(['2026-07-14']),
          scheduleGroups: [
            { dates: ['2026-07-14'], timeSlots: dealerSlot, grouped: false },
            {
              dates: ['2026-07-20'],
              timeSlots: [{ startTime: '21:00', roles: [{ role: 'dealer', count: 2 }] }],
              grouped: false,
            },
          ],
        }}
      />
    );

    // 두 번째 카드의 시각을 20:30 으로 바꾸면... 아직 다르므로 병합되지 않는다.
    // 첫 카드도 같은 20:30 으로 맞춰야 시그니처가 같아져 병합된다.
    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm'));
    fireEvent.press(getByText('확인'));
    await flush();

    fireEvent.press(getByTestId('order-sheet-card-condition-1'));
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm'));
    fireEvent.press(getByText('확인'));
    await flush();

    expect(eventNames()).toContain('order_sheet.auto_merge');
    expect(contextOf('order_sheet.auto_merge')).toMatchObject({ cardsBefore: 2, cardsAfter: 1 });
  });

  it('관측은 logger.observability 로만 나간다 (재귀 가드)', async () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={withDates(['2026-07-14', '2026-07-15'])} />
    );

    fireEvent(getByTestId('order-sheet-card-run-toggle-0-0'), 'valueChange', true);
    await flush();

    // 이 스위트는 logger 전체를 목으로 바꿨다 — observability 외 채널로 샜다면 이름이 안 잡힌다.
    expect(mockObservability).toHaveBeenCalled();
    expect(eventNames().every((n) => String(n).startsWith('order_sheet.'))).toBe(true);
  });
});
