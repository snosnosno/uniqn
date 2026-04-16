import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BoardTabBar } from './BoardTabBar';

describe('BoardTabBar', () => {
  it('renders all six tabs in order', () => {
    const { getByText } = render(<BoardTabBar activeTab="home" onTabPress={jest.fn()} />);
    for (const label of ['홈', '공지', '일정', '자유', 'TDA', '대타']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('marks the active tab with accessibility selected state', () => {
    const { getByLabelText } = render(<BoardTabBar activeTab="free" onTabPress={jest.fn()} />);
    const freeTab = getByLabelText('자유 탭');
    expect(freeTab.props.accessibilityState?.selected).toBe(true);

    const homeTab = getByLabelText('홈 탭');
    expect(homeTab.props.accessibilityState?.selected).toBe(false);
  });

  it('invokes onTabPress with the pressed tab key', () => {
    const onTabPress = jest.fn();
    const { getByLabelText } = render(<BoardTabBar activeTab="home" onTabPress={onTabPress} />);
    fireEvent.press(getByLabelText('TDA 탭'));
    expect(onTabPress).toHaveBeenCalledWith('tda');
  });
});
