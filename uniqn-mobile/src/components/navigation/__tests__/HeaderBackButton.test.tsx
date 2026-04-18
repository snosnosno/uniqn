import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HeaderBackButton } from '../HeaderBackButton';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
const mockPathname = jest.fn(() => '/some-route');

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
  }),
  useNavigation: () => ({
    canGoBack: mockCanGoBack,
  }),
  usePathname: () => mockPathname(),
}));

jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
}));

describe('HeaderBackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/some-route');
  });

  it('goes back when navigation history exists', () => {
    mockCanGoBack.mockReturnValue(true);

    const { getByLabelText } = render(
      <HeaderBackButton tintColor="#111827" fallbackHref="/(app)/(tabs)" />
    );

    fireEvent.press(getByLabelText('뒤로 가기'));

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('uses the fallback route when there is no navigation history', () => {
    mockCanGoBack.mockReturnValue(false);
    mockPathname.mockReturnValue('/current-screen'); // fallbackHref와 다른 경로

    const { getByLabelText } = render(
      <HeaderBackButton tintColor="#111827" fallbackHref="/jobs" />
    );

    fireEvent.press(getByLabelText('뒤로 가기'));

    expect(mockReplace).toHaveBeenCalledWith('/jobs');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('skips replace when fallbackHref equals current pathname (prevents loop)', () => {
    mockCanGoBack.mockReturnValue(false);
    // fallbackHref `/(app)/(tabs)` → stripRouteGroups → '/'
    // pathname `/` → stripRouteGroups → '/' 매치 → replace 스킵
    mockPathname.mockReturnValue('/');

    const { getByLabelText } = render(
      <HeaderBackButton tintColor="#111827" fallbackHref="/(app)/(tabs)" />
    );

    fireEvent.press(getByLabelText('뒤로 가기'));

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
