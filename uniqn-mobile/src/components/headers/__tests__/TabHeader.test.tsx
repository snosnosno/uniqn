import React from 'react';
import { render } from '@testing-library/react-native';
import { TabHeader } from '../TabHeader';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
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
  });

  it('renders title text', () => {
    const { getByText } = render(<TabHeader title="구인구직" />);
    expect(getByText('구인구직')).toBeTruthy();
  });

  it('renders UNIQN logo in center', () => {
    const { getByText } = render(<TabHeader title="구인구직" />);
    expect(getByText('UNIQN')).toBeTruthy();
  });

  it('renders the brand mark as non-interactive text', () => {
    const { getByText, queryByRole } = render(<TabHeader title="구인구직" />);
    expect(getByText('UNIQN')).toBeTruthy();
    expect(queryByRole('button', { name: 'UNIQN 홈으로 이동' })).toBeNull();
  });
});
