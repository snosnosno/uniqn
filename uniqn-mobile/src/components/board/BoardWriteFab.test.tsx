import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BoardWriteFab } from './BoardWriteFab';

jest.mock('@/components/icons', () => ({
  AddCircleOutlineIcon: () => null,
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('BoardWriteFab', () => {
  it('renders with the 글쓰기 accessibility label', () => {
    const { getByLabelText } = render(<BoardWriteFab onPress={jest.fn()} />);
    expect(getByLabelText('글쓰기')).toBeTruthy();
  });

  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<BoardWriteFab onPress={onPress} />);
    fireEvent.press(getByLabelText('글쓰기'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
