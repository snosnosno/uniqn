import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarHeader } from '../CalendarHeader';

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: (props: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text {...(props as object)}>‹</Text>;
  },
  ChevronRightIcon: (props: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text {...(props as object)}>›</Text>;
  },
}));

describe('CalendarHeader', () => {
  const baseProps = {
    visibleMonth: new Date('2026-04-15T00:00:00'),
    canGoPrev: true,
    canGoNext: true,
    hasSelection: false,
    onPrev: jest.fn(),
    onNext: jest.fn(),
    onClearSelection: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onPrev = jest.fn();
    baseProps.onNext = jest.fn();
    baseProps.onClearSelection = jest.fn();
  });

  it('월 이름 표시 (2026년 4월)', () => {
    const { getByText } = render(<CalendarHeader {...baseProps} />);
    expect(getByText('2026년 4월')).toBeTruthy();
  });

  it('좌우 화살표 탭 시 콜백', () => {
    const { getByLabelText } = render(<CalendarHeader {...baseProps} />);
    fireEvent.press(getByLabelText('이전 달'));
    expect(baseProps.onPrev).toHaveBeenCalled();
    fireEvent.press(getByLabelText('다음 달'));
    expect(baseProps.onNext).toHaveBeenCalled();
  });

  it('canGoPrev=false면 이전 화살표 disabled', () => {
    const { getByLabelText } = render(<CalendarHeader {...baseProps} canGoPrev={false} />);
    fireEvent.press(getByLabelText('이전 달'));
    expect(baseProps.onPrev).not.toHaveBeenCalled();
  });

  it('canGoNext=false면 다음 화살표 disabled', () => {
    const { getByLabelText } = render(<CalendarHeader {...baseProps} canGoNext={false} />);
    fireEvent.press(getByLabelText('다음 달'));
    expect(baseProps.onNext).not.toHaveBeenCalled();
  });

  it('hasSelection=false면 "전체 보기" 버튼 미표시', () => {
    const { queryByText } = render(<CalendarHeader {...baseProps} />);
    expect(queryByText('전체 보기')).toBeNull();
  });

  it('hasSelection=true면 "전체 보기" 탭 가능', () => {
    const { getByText } = render(<CalendarHeader {...baseProps} hasSelection />);
    fireEvent.press(getByText('전체 보기'));
    expect(baseProps.onClearSelection).toHaveBeenCalled();
  });
});
