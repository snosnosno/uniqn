import { fireEvent, render } from '@testing-library/react-native';
import { PublicBottomTabBar } from '../PublicBottomTabBar';

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('PublicBottomTabBar', () => {
  it('marks the jobs tab as selected and ignores presses on it', () => {
    const onProtectedTabPress = jest.fn();
    const { getByLabelText } = render(
      <PublicBottomTabBar activeTab="jobs" onProtectedTabPress={onProtectedTabPress} />
    );

    const jobsTab = getByLabelText('구인구직 탭');
    fireEvent.press(jobsTab);

    expect(jobsTab.props.accessibilityState).toEqual({ disabled: true, selected: true });
    expect(onProtectedTabPress).not.toHaveBeenCalled();
  });

  it('forwards protected tab presses', () => {
    const onProtectedTabPress = jest.fn();
    const { getByLabelText } = render(
      <PublicBottomTabBar activeTab="jobs" onProtectedTabPress={onProtectedTabPress} />
    );

    fireEvent.press(getByLabelText('내 스케줄 탭'));
    fireEvent.press(getByLabelText('내 공고 탭'));
    fireEvent.press(getByLabelText('프로필 탭'));

    expect(onProtectedTabPress).toHaveBeenNthCalledWith(1, 'schedule');
    expect(onProtectedTabPress).toHaveBeenNthCalledWith(2, 'employer');
    expect(onProtectedTabPress).toHaveBeenNthCalledWith(3, 'profile');
  });
});
