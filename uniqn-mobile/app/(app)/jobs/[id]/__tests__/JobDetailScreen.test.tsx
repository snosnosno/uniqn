import React from 'react';
import { ScrollView, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import JobDetailScreen from '../index';

const mockStackHeader = jest.fn((_props?: unknown) => null);
const mockRefresh = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: jest.fn(() => ({
    id: 'job-1',
  })),
}));

jest.mock('@/components/jobs', () => ({
  JobDetail: () => null,
}));

jest.mock('@/components/headers', () => ({
  StackHeader: (props: unknown) => mockStackHeader(props),
}));

jest.mock('@/components/icons', () => ({
  ShareIcon: () => null,
}));

jest.mock('@/components/ui', () => ({
  ErrorState: () => null,
  Loading: () => null,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/hooks', () => ({
  useApplications: () => ({
    hasApplied: () => false,
    getApplicationStatus: () => null,
  }),
  useAuth: () => ({
    user: {
      uid: 'user-1',
    },
  }),
  useHasAppliedToJob: () => ({
    data: false,
    isLoading: false,
    isFetching: false,
  }),
  useInstallPrompt: () => ({
    openInstallPrompt: jest.fn(),
  }),
  useJobDetail: () => ({
    job: {
      id: 'job-1',
      title: 'Night Shift',
      location: { name: 'Seoul' },
      workDate: '2025-01-16',
      status: 'active',
      schedule: { kind: 'fixed' },
    },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: mockRefresh,
  }),
  useShare: () => ({
    shareJob: jest.fn(),
    isSharing: false,
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

jest.mock('@/services/observability', () => ({
  trackJobView: jest.fn(),
}));

jest.mock('@/stores', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => boolean) =>
    selector({ isDarkMode: false }),
}));

jest.mock('@/utils/applicationStatusMessage', () => ({
  getApplicationStatusMessage: () => '지원 완료',
}));

jest.mock('@/utils/jobPostingVisibility', () => ({
  isCanonicalDatedPosting: () => true,
  isSupportedReleasePosting: () => true,
}));

describe('JobDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the authenticated fallback route to the header and adjusts scroll padding after layout', () => {
    const screen = render(<JobDetailScreen />);

    expect(mockStackHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '공고 상세',
        fallbackHref: '/(app)/(tabs)/home-jobs',
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
            height: 172,
          },
        },
      });
    });

    expect(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).toEqual({
      paddingBottom: 188,
    });
  });
});
