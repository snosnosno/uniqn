import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CollapsedHeader } from '../CollapsedHeader';

jest.mock('@/utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('@/components/icons', () => ({
  CalendarIcon: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>📅</Text>;
  },
  XIcon: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>✕</Text>;
  },
}));

describe('CollapsedHeader', () => {
  const baseProps = {
    selectedDate: new Date('2026-04-18T00:00:00'),
    count: 12,
    onExpand: jest.fn(),
    onClear: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onExpand = jest.fn();
    baseProps.onClear = jest.fn();
  });

  it('선택 날짜 요약 렌더 (4월 18일 (토) · 12건)', () => {
    const { getByText } = render(<CollapsedHeader {...baseProps} />);
    expect(getByText(/4월 18일.*토.*12건/)).toBeTruthy();
  });

  it('헤더 탭 시 onExpand 호출', () => {
    const { getByLabelText } = render(<CollapsedHeader {...baseProps} />);
    fireEvent.press(getByLabelText(/날짜 필터 펼치기/));
    expect(baseProps.onExpand).toHaveBeenCalled();
  });

  it('✕ 탭 시 onClear 호출 + onExpand 호출 안 됨', () => {
    const { getByLabelText } = render(<CollapsedHeader {...baseProps} />);
    fireEvent.press(getByLabelText('날짜 필터 해제'));
    expect(baseProps.onClear).toHaveBeenCalled();
    expect(baseProps.onExpand).not.toHaveBeenCalled();
  });

  it('count=0이어도 요약에 "0건" 표시', () => {
    const { getByText } = render(<CollapsedHeader {...baseProps} count={0} />);
    expect(getByText(/0건/)).toBeTruthy();
  });
});
