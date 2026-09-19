/**
 * ScheduleDatesSheet — 전 일정 스코프 날짜 시트
 *
 * 3지 세그먼트가 제거된 뒤 이 시트가 지는 계약은 하나다: **날짜만** 배출한다.
 * (묶음지원은 조건 카드 안의 run 토글로, 조건 분화는 예외 추출로 이동했다.)
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { ScheduleDatesSheet } from '../ScheduleDatesSheet';

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
  const { Pressable, Text } = require('react-native');
  return {
    CalendarPicker: ({ onMultiSelectChange }: any) => (
      <Pressable
        testID="calendar-stub"
        onPress={() => onMultiSelectChange([new Date(2026, 6, 20), new Date(2026, 6, 21)])}
      >
        <Text>calendar</Text>
      </Pressable>
    ),
  };
});

const setup = (overrides: Record<string, unknown> = {}) => {
  const onConfirm = jest.fn();
  const utils = render(
    <ScheduleDatesSheet
      visible
      postingType="regular"
      initialSelectedDates={[]}
      onConfirm={onConfirm}
      onClose={jest.fn()}
      {...overrides}
    />
  );
  return { ...utils, onConfirm };
};

describe('ScheduleDatesSheet — 날짜만 배출한다', () => {
  it('선택한 날짜를 배열 그대로 넘긴다 (segment 축 없음)', () => {
    const { getByTestId, onConfirm } = setup();

    fireEvent.press(getByTestId('calendar-stub'));
    fireEvent.press(getByTestId('job-posting-date-confirm-button'));

    expect(onConfirm).toHaveBeenCalledWith(['2026-07-20', '2026-07-21']);
  });

  it('기존 날짜를 시드로 받아 재선택·해제할 수 있다', () => {
    const { getByTestId, onConfirm } = setup({
      initialSelectedDates: ['2026-07-14'],
    });

    fireEvent.press(getByTestId('job-posting-date-confirm-button'));

    expect(onConfirm).toHaveBeenCalledWith(['2026-07-14']);
  });

  it('3지 세그먼트를 렌더하지 않는다 (구조 질문 0개)', () => {
    const { queryByTestId, queryByText } = setup({
      initialSelectedDates: ['2026-07-20', '2026-07-21'],
    });

    expect(queryByTestId('order-sheet-dates-segment-same')).toBeNull();
    expect(queryByTestId('order-sheet-dates-segment-grouped')).toBeNull();
    expect(queryByTestId('order-sheet-dates-segment-separate')).toBeNull();
    expect(queryByText('여러 날짜, 어떻게 받을까요?')).toBeNull();
  });
});
