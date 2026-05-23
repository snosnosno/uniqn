import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HomeTabBar } from '../HomeTabBar';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/components/icons', () => ({
  HomeIcon: () => null,
  CalendarIcon: () => null,
  MessageIcon: () => null,
  BriefcaseIcon: () => null,
  UserIcon: () => null,
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('HomeTabBar', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('구인구직 탭 press → /(app)/(tabs)/home-jobs로 이동', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('구인구직 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/home-jobs');
  });

  it('내 스케줄 탭 press → /(app)/(tabs)/schedule', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('내 스케줄 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/schedule');
  });

  it('게시판 탭 press → /(app)/(tabs)/board', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('게시판 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/board');
  });

  it('내 공고 탭 press → /(app)/(tabs)/employer', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('내 공고 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/employer');
  });

  it('프로필 탭 press → /(app)/(tabs)/profile', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('프로필 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/profile');
  });

  it('5개 탭이 모두 렌더된다', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    expect(getByLabelText('구인구직 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('내 스케줄 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('게시판 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('내 공고 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('프로필 탭으로 이동')).toBeTruthy();
  });
});
