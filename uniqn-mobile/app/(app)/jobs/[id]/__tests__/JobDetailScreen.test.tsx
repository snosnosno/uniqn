import React from 'react';
import { ScrollView, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import JobDetailScreen from '../index';

const mockStackHeader = jest.fn((_props?: unknown) => null);
const mockErrorState = jest.fn((_props?: unknown) => null);
const mockLoading = jest.fn((_props?: unknown) => null);
const mockRefresh = jest.fn();
const mockPush = jest.fn();

// 케이스별 오버라이드용 가변 목 상태 — beforeEach에서 기본값으로 리셋
const baseJob = {
  id: 'job-1',
  title: 'Night Shift',
  location: { name: 'Seoul' },
  workDate: '2025-01-16',
  status: 'active',
  schedule: { kind: 'fixed' },
};
let mockAuthState: Record<string, unknown> = { user: { uid: 'user-1' } };
let mockJob: Record<string, unknown> = baseJob;

// P0#4 승인 게이트 케이스 — 실게이트 로직(isTournamentApprovalBlocked)을 그대로 태운다
const pendingTournamentJob = {
  ...baseJob,
  title: 'Tournament Job',
  schedule: { kind: 'dated' },
  postingType: 'tournament',
  tournamentConfig: { approvalStatus: 'pending' },
};

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
  ErrorState: (props: unknown) => mockErrorState(props),
  Loading: (props: unknown) => mockLoading(props),
}));

jest.mock('@/components/ui/Button', () => {
  const ReactActual = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    // getByText 매칭을 위해 Text로 래핑 (raw string은 RNTL 텍스트 쿼리에 안 잡힘)
    Button: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(Text, null, children),
  };
});

jest.mock('@/hooks', () => ({
  useApplications: () => ({
    hasApplied: () => false,
    getApplicationStatus: () => null,
  }),
  useAuth: () => mockAuthState,
  useHasAppliedToJob: () => ({
    data: false,
    isLoading: false,
    isFetching: false,
  }),
  useInstallPrompt: () => ({
    openInstallPrompt: jest.fn(),
  }),
  useJobDetail: () => ({
    job: mockJob,
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
  getCancelUnavailableReason: () => null,
}));

jest.mock('@/utils/jobPostingVisibility', () => ({
  isCanonicalDatedPosting: () => true,
  isSupportedReleasePosting: () => true,
}));

describe('JobDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { user: { uid: 'user-1' } };
    mockJob = baseJob;
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

  // P0#4 승인 게이트 — admin 예외 (fix/admin-tournament-detail-gate)
  describe('미승인 대회공고 승인 게이트', () => {
    it('일반 유저는 차단 화면을 본다', () => {
      mockAuthState = { user: { uid: 'user-1' }, isInitialized: true, isAdmin: false };
      mockJob = pendingTournamentJob;

      const screen = render(<JobDetailScreen />);

      expect(mockErrorState).toHaveBeenCalledWith(
        expect.objectContaining({ message: '승인 대기 중인 공고입니다.' })
      );
      expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();
    });

    it('관리자는 상세를 열람하고 지원 CTA 대신 열람 전용 안내를 본다', () => {
      mockAuthState = { user: { uid: 'admin-1' }, isInitialized: true, isAdmin: true };
      mockJob = pendingTournamentJob;

      const screen = render(<JobDetailScreen />);

      expect(mockErrorState).not.toHaveBeenCalled();
      expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
      expect(screen.getByText('미승인 대회공고 — 관리자 열람 전용')).toBeTruthy();
      expect(screen.queryByText('지원하기')).toBeNull();
    });

    it('인증 초기화 전에는 차단 화면 대신 로딩을 보여 깜빡임을 막는다', () => {
      mockAuthState = { user: null, isInitialized: false, isAdmin: false };
      mockJob = pendingTournamentJob;

      render(<JobDetailScreen />);

      expect(mockLoading).toHaveBeenCalled();
      expect(mockErrorState).not.toHaveBeenCalled();
    });
  });
});
