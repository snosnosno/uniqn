import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarCell } from '../CalendarCell';

jest.mock('@/utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

const BASE_DATE = new Date('2026-04-18T00:00:00'); // 토요일

describe('CalendarCell', () => {
  const baseProps = {
    date: BASE_DATE,
    count: 12,
    isToday: false,
    isSelected: false,
    isOutsideMonth: false,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onPress = jest.fn();
  });

  it('기본 상태: 날짜 숫자와 카운트 뱃지 렌더', () => {
    const { getByText } = render(<CalendarCell {...baseProps} />);
    expect(getByText('18')).toBeTruthy();
    expect(getByText('12건')).toBeTruthy();
  });

  it('count=0이면 뱃지 미표시 + 탭 불가', () => {
    const { getByTestId, queryByText } = render(
      <CalendarCell {...baseProps} count={0} testID="cell" />
    );
    expect(queryByText(/건/)).toBeNull();
    fireEvent.press(getByTestId('cell'));
    expect(baseProps.onPress).not.toHaveBeenCalled();
  });

  it('isOutsideMonth=true이면 탭 불가', () => {
    const { getByTestId } = render(<CalendarCell {...baseProps} isOutsideMonth testID="cell" />);
    fireEvent.press(getByTestId('cell'));
    expect(baseProps.onPress).not.toHaveBeenCalled();
  });

  it('탭 가능한 경우 onPress 호출', () => {
    const { getByTestId } = render(<CalendarCell {...baseProps} testID="cell" />);
    fireEvent.press(getByTestId('cell'));
    expect(baseProps.onPress).toHaveBeenCalledWith(BASE_DATE);
  });

  it('탭 시 햅틱 light 트리거', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { triggerHaptic } = require('@/utils/haptics');
    const { getByTestId } = render(<CalendarCell {...baseProps} testID="cell" />);
    fireEvent.press(getByTestId('cell'));
    expect(triggerHaptic).toHaveBeenCalledWith('light');
  });

  it('accessibilityLabel에 날짜+요일+카운트 포함', () => {
    const { getByLabelText } = render(<CalendarCell {...baseProps} />);
    // "4월 18일 토요일 공고 12건" 형식
    expect(getByLabelText(/4월 18일.*토요일.*12건/)).toBeTruthy();
  });

  it('count=0일 때 accessibilityLabel에 "공고 없음"', () => {
    const { getByLabelText } = render(<CalendarCell {...baseProps} count={0} />);
    expect(getByLabelText(/공고 없음/)).toBeTruthy();
  });

  it('isSelected=true면 accessibilityState.selected=true', () => {
    const { getByTestId } = render(<CalendarCell {...baseProps} isSelected testID="cell" />);
    expect(getByTestId('cell').props.accessibilityState.selected).toBe(true);
  });
});
