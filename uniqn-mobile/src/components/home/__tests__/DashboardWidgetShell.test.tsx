import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DashboardWidgetShell } from '../DashboardWidgetShell';

jest.mock('@/components/ui', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return (
      <View testID="card" {...props}>
        {children}
      </View>
    );
  },
  SkeletonCard: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="skeleton-card" />;
  },
}));

jest.mock('@/components/icons', () => ({
  ChevronRightIcon: () => null,
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

describe('DashboardWidgetShell', () => {
  it('shows SkeletonCard when isLoading is true', () => {
    const { getByTestId, queryByText } = render(
      <DashboardWidgetShell title="테스트 위젯" isLoading>
        <></>
      </DashboardWidgetShell>
    );
    expect(getByTestId('skeleton-card')).toBeTruthy();
    expect(queryByText('테스트 위젯')).toBeNull();
  });

  it('shows error state with retry button when error is provided', () => {
    const mockRetry = jest.fn();
    const { getByText } = render(
      <DashboardWidgetShell
        title="테스트 위젯"
        error={new Error('네트워크 오류')}
        onRetry={mockRetry}
      >
        <></>
      </DashboardWidgetShell>
    );
    expect(getByText('불러오지 못했습니다')).toBeTruthy();
    const retryButton = getByText('다시 시도');
    expect(retryButton).toBeTruthy();
    fireEvent.press(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('renders children when partial is true even if error is set', () => {
    const { getByText, queryByText } = render(
      <DashboardWidgetShell title="테스트 위젯" error={new Error('부분 실패')} partial>
        <></>
      </DashboardWidgetShell>
    );
    expect(getByText('테스트 위젯')).toBeTruthy();
    expect(queryByText('불러오지 못했습니다')).toBeNull();
  });

  it('calls onSeeMore when see-more button is pressed', () => {
    const mockSeeMore = jest.fn();
    const { getByText } = render(
      <DashboardWidgetShell title="테스트 위젯" onSeeMore={mockSeeMore}>
        <></>
      </DashboardWidgetShell>
    );
    fireEvent.press(getByText('상세 보기'));
    expect(mockSeeMore).toHaveBeenCalledTimes(1);
  });

  it('shows emptyState message when provided with no children content', () => {
    const { getByText } = render(
      <DashboardWidgetShell title="테스트 위젯" emptyState={{ message: '데이터가 없습니다' }}>
        {null}
      </DashboardWidgetShell>
    );
    expect(getByText('데이터가 없습니다')).toBeTruthy();
  });
});
