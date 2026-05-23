import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TabHeader } from '../TabHeader';

const mockPush = jest.fn();
const mockPathname = jest.fn(() => '/(app)/(tabs)/home-jobs');

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  usePathname: () => mockPathname(),
}));

jest.mock('@/components/icons', () => ({
  BellIcon: () => null,
  QrCodeIcon: () => null,
  SettingsIcon: () => null,
}));

jest.mock('@/components/notifications', () => ({
  NotificationBadge: () => null,
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('@/stores/notificationStore', () => ({
  useUnreadCount: () => 0,
}));

jest.mock('@/constants', () => ({
  getIconColor: () => '#000',
  getLayoutColor: () => '#fff',
  HEADER_CLASSES: {
    title: 'text-secondary-900',
    actionPressed: 'active:bg-secondary-100',
  },
}));

describe('TabHeader', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname.mockReturnValue('/(app)/(tabs)/home-jobs');
  });

  it('renders title text', () => {
    const { getByText } = render(<TabHeader title="구인구직" />);
    expect(getByText('구인구직')).toBeTruthy();
  });

  it('renders UNIQN logo in center', () => {
    const { getByText } = render(<TabHeader title="구인구직" />);
    expect(getByText('UNIQN')).toBeTruthy();
  });

  it('navigates to home when logo is tapped', () => {
    const { getByRole } = render(<TabHeader title="구인구직" />);
    fireEvent.press(getByRole('button', { name: 'UNIQN 홈으로 이동' }));
    expect(mockPush).toHaveBeenCalledWith('/(app)/home');
  });

  it('does not navigate when already on home screen (grouped path)', () => {
    mockPathname.mockReturnValue('/(app)/home');
    const { getByRole } = render(<TabHeader title="구인구직" />);
    fireEvent.press(getByRole('button', { name: 'UNIQN 홈으로 이동' }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not navigate when already on home screen (web path)', () => {
    mockPathname.mockReturnValue('/home');
    const { getByRole } = render(<TabHeader title="구인구직" />);
    fireEvent.press(getByRole('button', { name: 'UNIQN 홈으로 이동' }));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
