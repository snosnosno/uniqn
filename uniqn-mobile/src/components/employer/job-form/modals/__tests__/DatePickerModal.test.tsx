/**
 * DatePickerModal — additive prop initialSelectedDates 시드 + 무회귀 테스트
 *
 * 주문서(order-sheet)가 기존 날짜를 재편집 가능하도록 initialSelectedDates 로 선택 상태를 시드한다.
 * (1) prop 미전달 시 선택 0개(무회귀), (2) prop 전달 시 그 날짜 수만큼 시드되어 확인 활성.
 * Modal/CalendarPicker 는 렌더 스텁으로 모킹(캘린더 내부 date-fns 무관하게 footer/요약만 검증).
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { DatePickerModal } from '../DatePickerModal';

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

jest.mock('@/components/ui/CalendarPicker', () => ({
  CalendarPicker: () => null,
}));

describe('DatePickerModal — initialSelectedDates', () => {
  it('prop 미전달 시 선택 0개 — 확인 라벨 유지(무회귀)', () => {
    const { getByText } = render(
      <DatePickerModal
        visible
        onClose={jest.fn()}
        onSelectDates={jest.fn()}
        postingType="regular"
        existingDates={[]}
      />
    );
    expect(getByText('선택한 날짜 (0개)')).toBeTruthy();
    expect(getByText('확인')).toBeTruthy();
  });

  it('initialSelectedDates 전달 시 그 개수만큼 시드된다', () => {
    const { getByText } = render(
      <DatePickerModal
        visible
        onClose={jest.fn()}
        onSelectDates={jest.fn()}
        postingType="regular"
        existingDates={[]}
        initialSelectedDates={['2026-07-14', '2026-07-15']}
      />
    );
    expect(getByText('선택한 날짜 (2개)')).toBeTruthy();
    expect(getByText('2개 추가')).toBeTruthy();
  });
});
