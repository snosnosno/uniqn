import React from 'react';
import { ScrollView, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import PublicJobDetailAliasRoute from '../[id]';

const mockStackHeader = jest.fn((_props?: unknown) => null);
const mockOpenInstallPrompt = jest.fn();
const mockShareJob = jest.fn();
const mockRefresh = jest.fn();

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: jest.fn(() => ({
    id: 'job-1',
  })),
}));

jest.mock('@/components/jobs', () => ({
  JobDetail: () => null,
  PostingSurfaceState: () => null,
}));

jest.mock('@/components/headers', () => ({
  StackHeader: (props: unknown) => mockStackHeader(props),
}));

jest.mock('@/components/icons', () => ({
  ShareIcon: () => null,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/hooks', () => ({
  useInstallPrompt: () => ({
    openInstallPrompt: mockOpenInstallPrompt,
  }),
  useJobDetail: () => ({
    job: {
      id: 'job-1',
      title: 'Night Shift',
      location: { name: 'Seoul' },
      workDate: '2025-01-16',
      status: 'active',
    },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: mockRefresh,
  }),
  useShare: () => ({
    shareJob: mockShareJob,
    isSharing: false,
  }),
}));

jest.mock('@/services/observability', () => ({
  trackJobView: jest.fn(),
}));

jest.mock('@/stores', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => boolean) =>
    selector({ isDarkMode: false }),
}));

jest.mock('@/utils/jobPostingVisibility', () => ({
  isCanonicalDatedPosting: () => true,
}));

describe('PublicJobDetailAliasRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the public fallback route to the header and adjusts scroll padding after layout', () => {
    const screen = render(<PublicJobDetailAliasRoute />);

    expect(mockStackHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '공고 상세',
        fallbackHref: '/jobs',
      })
    );

    expect(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).toEqual({
      paddingBottom: 132,
    });

    const layoutView = screen
      .UNSAFE_getAllByType(View)
      .find((node) => typeof node.props.onLayout === 'function');

    expect(layoutView).toBeTruthy();

    act(() => {
      layoutView?.props.onLayout({
        nativeEvent: {
          layout: {
            height: 180,
          },
        },
      });
    });

    expect(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).toEqual({
      paddingBottom: 196,
    });
  });
});
