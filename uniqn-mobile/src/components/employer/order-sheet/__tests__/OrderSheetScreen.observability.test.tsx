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
// error 채널을 **참조 가능한** 목으로 노출한다 — 인라인 jest.fn() 이면 "observability 로만 나간다"는
// 단언이 반쪽이 된다(observability 에 잡힌 것의 이름만 보게 되어, error 채널 병행 호출을 못 잡는다).
// error 로 새는 순간 웹에서 sentry↔logger 무한 재귀가 재발한다(2026-08-04, 콘솔 에러 370만건).
const mockError = jest.fn();
jest.mock('@/utils/logger', () => ({
  logger: {
    observability: (...args: unknown[]) => mockObservability(...args),
    error: (...args: unknown[]) => mockError(...args),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: jest.fn() }),
}));

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

jest.mock('@/components/ui/CalendarPicker', () => {
  const { Pressable, Text, View } = require('react-native');
  const PICKS: Record<string, number[][]> = {
    '714-720-721': [
      [2026, 6, 14],
      [2026, 6, 20],
      [2026, 6, 21],
    ],
    '720-721': [
      [2026, 6, 20],
      [2026, 6, 21],
    ],
  };
  return {
    CalendarPicker: ({ onMultiSelectChange }: any) => (
      <View>
        {Object.entries(PICKS).map(([key, days]) => (
          <Pressable
            key={key}
            testID={`calendar-pick-${key}`}
            onPress={() => onMultiSelectChange(days.map((d) => new Date(d[0]!, d[1]!, d[2]!)))}
          >
            <Text>{key}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

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

    // 진입로가 조건 시트 하나로 통합됐다 — 거기 "적용할 날짜"에서 고르는 것이 곧 예외 추출이다.
    fireEvent.press(getByTestId('order-sheet-card-condition-0'));
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

  it('새 날짜 승계 고지는 카드 수를 남긴다', async () => {
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...withDates(['2026-07-14']),
          scheduleGroups: [
            { dates: ['2026-07-14'], timeSlots: dealerSlot, grouped: false },
            {
              dates: ['2026-07-20'],
              timeSlots: [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }],
              grouped: false,
            },
          ],
          roleSalaries: [
            { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
            { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
          ],
        }}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-714-720-721')); // 7/21 추가 → 7/20 카드가 승계
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    expect(eventNames()).toContain('order_sheet.inherit_notice');
    expect(contextOf('order_sheet.inherit_notice')).toMatchObject({ cardCount: 2 });
  });

  it('날짜 해제는 auto_merge 를 발화하지 않는다 — 계기판이 가장 흔한 조작으로 오염되면 못 쓴다', async () => {
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withDates(['2026-07-14', '2026-07-20', '2026-07-21'])}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-dates'));
    fireEvent.press(getByTestId('calendar-pick-720-721')); // 7/14 해제
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));
    await flush();

    expect(eventNames()).not.toContain('order_sheet.auto_merge');
  });

  it('관측은 logger.observability 로만 나간다 — error 채널로 새면 무한 재귀가 재발한다', async () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={withDates(['2026-07-14', '2026-07-15'])} />
    );

    fireEvent(getByTestId('order-sheet-card-run-toggle-0-0'), 'valueChange', true);
    await flush();

    expect(mockObservability).toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
    expect(eventNames().every((n) => String(n).startsWith('order_sheet.'))).toBe(true);
  });
});
