import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HeaderBackButton } from '../HeaderBackButton';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
  }),
  useNavigation: () => ({
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
}));

describe('HeaderBackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    const { getByLabelText } = render(
      <HeaderBackButton tintColor="#111827" fallbackHref="/jobs" />
    );

    fireEvent.press(getByLabelText('뒤로 가기'));

    expect(mockReplace).toHaveBeenCalledWith('/jobs');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
