import React from 'react';
import { ScrollView, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import PublicJobDetailAliasRoute from '../[id]';

const mockStackHeader = jest.fn((_props?: unknown) => null);
const mockOpenInstallPrompt = jest.fn();
const mockShareJob = jest.fn();
const mockRefresh = jest.fn();

const datedJob = {
  id: 'job-1',
  title: 'Night Shift',
  location: { name: 'Seoul' },
  workDate: '2025-01-16',
  status: 'active',
};
let mockJob: Record<string, unknown> = datedJob;
let mockIsCanonical = true;

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

jest.mock('@/components/ui/Button', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock 팩토리는 import 참조 불가
  const { Text: RNText } = require('react-native');
  return {
    Button: ({ children }: { children: React.ReactNode }) => <RNText>{children}</RNText>,
  };
});

jest.mock('@/hooks', () => ({
  useInstallPrompt: () => ({
    openInstallPrompt: mockOpenInstallPrompt,
  }),
  useJobDetail: () => ({
    job: mockJob,
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
  isCanonicalDatedPosting: () => mockIsCanonical,
}));

describe('PublicJobDetailAliasRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJob = datedJob;
    mockIsCanonical = true;
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

  it('고정 공고는 에러가 아니라 본문 + 전화 문의 CTA 로 렌더한다 (dead-end 방지)', () => {
    mockIsCanonical = false;
    mockJob = {
      id: 'job-1',
      title: 'Hall Staff (상시)',
      location: { name: 'Seoul' },
      status: 'active',
      contactPhone: '010-1234-5678',
    };

    const screen = render(<PublicJobDetailAliasRoute />);

    // 본문 렌더용 ScrollView 가 존재(에러 화면이 아님)
    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
    // 전화 문의 CTA + 안내 카피 노출
    expect(screen.getByText('전화 문의')).toBeTruthy();
    expect(screen.getByText(/앱에서 지원할 수 없어요/)).toBeTruthy();
  });

  it('고정 공고에 연락처가 없으면 전화 문의 버튼을 비활성으로 안내한다', () => {
    mockIsCanonical = false;
    mockJob = {
      id: 'job-1',
      title: 'Hall Staff (상시)',
      location: { name: 'Seoul' },
      status: 'active',
    };

    const screen = render(<PublicJobDetailAliasRoute />);

    expect(screen.getByText('전화 문의 (연락처 미등록)')).toBeTruthy();
  });
});
