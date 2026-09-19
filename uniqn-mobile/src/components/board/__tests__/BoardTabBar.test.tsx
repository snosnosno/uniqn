import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BoardTabBar } from '../BoardTabBar';

describe('BoardTabBar', () => {
  it('renders only schedule and notice tabs', () => {
    const { getByText, queryByText } = render(
      <BoardTabBar activeTab="schedule" onTabPress={jest.fn()} />
    );
    for (const label of ['일정', '공지']) {
      expect(getByText(label)).toBeTruthy();
    }
    expect(queryByText('자유')).toBeNull();
    expect(queryByText('TDA')).toBeNull();
    expect(queryByText('대타')).toBeNull();
  });

  it('marks the active tab with accessibility selected state', () => {
    const { getByLabelText } = render(<BoardTabBar activeTab="schedule" onTabPress={jest.fn()} />);
    const scheduleTab = getByLabelText('일정 탭');
    expect(scheduleTab.props.accessibilityState?.selected).toBe(true);

    const noticeTab = getByLabelText('공지 탭');
    expect(noticeTab.props.accessibilityState?.selected).toBe(false);
  });

  it('invokes onTabPress with the pressed tab key', () => {
    const onTabPress = jest.fn();
    const { getByLabelText } = render(<BoardTabBar activeTab="schedule" onTabPress={onTabPress} />);
    fireEvent.press(getByLabelText('공지 탭'));
    expect(onTabPress).toHaveBeenCalledWith('notice');
  });
});
