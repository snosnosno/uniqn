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

  it('채팅 칸은 showChat 일 때만 보이고, 누르면 chat 키를 넘긴다', () => {
    const onTabPress = jest.fn();
    const hidden = render(<BoardTabBar activeTab="schedule" onTabPress={onTabPress} />);
    expect(hidden.queryByText('채팅')).toBeNull();

    const shown = render(<BoardTabBar activeTab="chat" onTabPress={onTabPress} showChat />);
    const chatTab = shown.getByLabelText('채팅 탭');
    expect(chatTab.props.accessibilityState?.selected).toBe(true);
    fireEvent.press(chatTab);
    expect(onTabPress).toHaveBeenCalledWith('chat');
  });

  it('채팅 안 읽음이 있으면 채팅 칸에 배지를 달고, 0 이면 달지 않는다', () => {
    const withUnread = render(
      <BoardTabBar activeTab="schedule" onTabPress={jest.fn()} showChat chatUnread={3} />
    );
    expect(withUnread.getByText('3')).toBeTruthy();
    expect(withUnread.getByLabelText('채팅 탭, 안 읽은 메시지 3개')).toBeTruthy();

    const capped = render(
      <BoardTabBar activeTab="schedule" onTabPress={jest.fn()} showChat chatUnread={150} />
    );
    expect(capped.getByText('99+')).toBeTruthy();

    const none = render(
      <BoardTabBar activeTab="schedule" onTabPress={jest.fn()} showChat chatUnread={0} />
    );
    expect(none.getByLabelText('채팅 탭')).toBeTruthy();
    expect(none.queryByLabelText(/읽지 않은 알림/)).toBeNull();
  });

  it('invokes onTabPress with the pressed tab key', () => {
    const onTabPress = jest.fn();
    const { getByLabelText } = render(<BoardTabBar activeTab="schedule" onTabPress={onTabPress} />);
    fireEvent.press(getByLabelText('공지 탭'));
    expect(onTabPress).toHaveBeenCalledWith('notice');
  });
});
