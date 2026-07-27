import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarCell } from '../CalendarCell';
import { computeDayCell } from '@/domains/weeklyGrid';

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

  // 이 테스트는 원래 '탭 시 햅틱 light 트리거'를 단언해 규칙 위반을 고정하고 있었다.
  // impeccable §17 은 '리스트 선택'을 문자 그대로 금지한다 — 날짜 셀 탭이 정확히 그것이고,
  // 같은 일을 하는 스케줄 탭 달력은 원래 진동이 없다. 재도입 방지 가드로 뒤집는다.
  it('날짜 선택에 햅틱을 쓰지 않는다 (impeccable §17 — 리스트 선택 금지)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { triggerHaptic } = require('@/utils/haptics');
    const { getByTestId } = render(<CalendarCell {...baseProps} testID="cell" />);
    fireEvent.press(getByTestId('cell'));
    expect(triggerHaptic).not.toHaveBeenCalled();
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

describe('CalendarCell — 그리드 모드(gridCell prop)', () => {
  // 그리드 모드는 count prop 대신 gridCell.priorityBadge 가 뱃지를 결정한다.
  const gridProps = {
    date: BASE_DATE,
    count: 0,
    isToday: false,
    isSelected: false,
    isOutsideMonth: false,
    onPress: jest.fn(),
  };

  it('U2 부족 우선: shortage>0 + jobCount>0 이어도 부족 뱃지 1개만(공고 뱃지 미렌더)', () => {
    // shortage = softTarget(4) - headcount(1) = 3
    const gridCell = computeDayCell({
      dateKey: '2026-04-18',
      headcount: 1,
      jobCount: 2,
      softTarget: 4,
    });
    const { getByText, queryByText, getByLabelText } = render(
      <CalendarCell {...gridProps} gridCell={gridCell} testID="cell" />
    );
    expect(getByText('!3')).toBeTruthy(); // 글리프(!)+숫자 병기(U1)
    expect(queryByText('+2')).toBeNull(); // 공고 뱃지는 우선순위에서 밀림
    expect(getByLabelText(/부족 3명/)).toBeTruthy(); // U1 a11y: 종류명+수치
  });

  it('staffed(부족·공고 없음): 배치 뱃지 + "배치 N명" a11y', () => {
    const gridCell = computeDayCell({
      dateKey: '2026-04-18',
      headcount: 5,
      jobCount: 0,
      softTarget: 0,
    });
    const { getByText, getByLabelText } = render(
      <CalendarCell {...gridProps} gridCell={gridCell} testID="cell" />
    );
    expect(getByText('✓5')).toBeTruthy();
    expect(getByLabelText(/배치 5명/)).toBeTruthy();
  });

  it('공고 우선(부족 없음, 공고 있음): "+N" 뱃지 + "공고 N건" a11y', () => {
    const gridCell = computeDayCell({
      dateKey: '2026-04-18',
      headcount: 0,
      jobCount: 2,
      softTarget: 0,
    });
    const { getByText, getByLabelText } = render(
      <CalendarCell {...gridProps} gridCell={gridCell} testID="cell" />
    );
    expect(getByText('+2')).toBeTruthy();
    expect(getByLabelText(/공고 2건/)).toBeTruthy();
  });

  it('빈 셀(priorityBadge=null): 뱃지 없음 + "비어있음" a11y + 월내 탭 가능', () => {
    const onPress = jest.fn();
    const gridCell = computeDayCell({
      dateKey: '2026-04-18',
      headcount: 0,
      jobCount: 0,
      softTarget: 0,
    });
    const { queryByText, getByLabelText, getByTestId } = render(
      <CalendarCell {...gridProps} onPress={onPress} gridCell={gridCell} testID="cell" />
    );
    expect(queryByText(/^[!+✓]/)).toBeNull();
    expect(getByLabelText(/비어있음/)).toBeTruthy();
    // 그리드 모드: 빈 날도 월내면 탭 가능
    fireEvent.press(getByTestId('cell'));
    expect(onPress).toHaveBeenCalledWith(BASE_DATE);
  });

  it('isOutsideMonth면 그리드 모드라도 뱃지 미표시 + 탭 불가', () => {
    const onPress = jest.fn();
    const gridCell = computeDayCell({
      dateKey: '2026-04-18',
      headcount: 1,
      jobCount: 0,
      softTarget: 4,
    });
    const { queryByText, getByTestId } = render(
      <CalendarCell
        {...gridProps}
        onPress={onPress}
        isOutsideMonth
        gridCell={gridCell}
        testID="cell"
      />
    );
    expect(queryByText('!3')).toBeNull();
    fireEvent.press(getByTestId('cell'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
