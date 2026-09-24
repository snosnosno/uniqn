/**
 * 내 공고 탭 — [공고]/[근무표] 세그먼트 + 오늘 한 줄 (구인자 IA S3)
 *
 * - 기본값은 [공고] — 신규 사용자 경험을 바꾸지 않는다.
 * - 근무표 플래그 OFF 면 세그먼트 자체가 없다(기존 근무표 버튼과 같은 게이트).
 * - 오늘 한 줄은 0건이면 없다. 누르면 공고 하나면 그 [근무], 여러 공고면 근무표의 그 날짜.
 * - 공고 목록의 로딩·실패는 [공고] 본문만의 상태다 — 근무표·오늘 한 줄까지 막으면 안 된다.
 * - [근무표] 는 탭 화면이라 탭바 높이만큼 하단 여백을 받아야 한다.
 * 대조군(새 공고 작성 / 근무표 본문)을 함께 단언해 "아무것도 안 그려서 통과" 를 배제한다.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import EmployerTabScreen from '../employer';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

let mockWorkScheduleEnabled = true;
jest.mock('@/hooks/useWorkScheduleEnabled', () => ({
  useWorkScheduleEnabled: () => ({ enabled: mockWorkScheduleEnabled, isLoading: false }),
}));

const mockAttentionRefetch = jest.fn();
let mockAttention: {
  absentCount: number;
  missingCheckoutCount: number;
  target: { kind: 'posting'; jobPostingId: string } | { kind: 'schedule'; date: string } | null;
} = { absentCount: 0, missingCheckoutCount: 0, target: null };
jest.mock('@/hooks/employer/useTodayAttention', () => ({
  useTodayAttention: () => ({
    summary: mockAttention,
    isError: false,
    refetch: mockAttentionRefetch,
  }),
}));

// 근무표 본문은 자체 테스트가 있다 — 여기선 전환 여부·이동 요청·하단 여백만 본다.
let mockLastFocusRequest: unknown = null;
let mockLastBottomPadding: unknown = undefined;
jest.mock('@/features/employer/workSchedule/WorkScheduleView', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    WorkScheduleView: ({
      focusRequest,
      contentBottomPadding,
    }: {
      focusRequest?: unknown;
      contentBottomPadding?: number;
    }) => {
      mockLastFocusRequest = focusRequest ?? null;
      mockLastBottomPadding = contentBottomPadding;
      return <ReactNative.Text>근무표 본문</ReactNative.Text>;
    },
  };
});

jest.mock('@/features/employer/tab/EmployerMoreMenu', () => ({ EmployerMoreMenu: () => null }));

jest.mock('@/components', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    Button: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      accessibilityLabel?: string;
    }) => (
      <ReactNative.Pressable onPress={onPress} accessibilityLabel={accessibilityLabel}>
        {children}
      </ReactNative.Pressable>
    ),
    ConfirmModal: () => null,
    PostingSurfaceState: ({
      mode,
      actionLabel,
      onAction,
    }: {
      mode: string;
      actionLabel?: string;
      onAction?: () => void;
    }) => (
      <ReactNative.View>
        <ReactNative.Text>{`공고 상태:${mode}`}</ReactNative.Text>
        {actionLabel && onAction ? (
          <ReactNative.Pressable onPress={onAction}>
            <ReactNative.Text>{actionLabel}</ReactNative.Text>
          </ReactNative.Pressable>
        ) : null}
      </ReactNative.View>
    ),
  };
});
jest.mock('@/components/ui/AppFlashList', () => ({ AppFlashList: () => null }));
jest.mock('@/components/employer', () => ({
  JobPostingCard: () => null,
  NonEmployerView: () => null,
}));
jest.mock('@/components/headers', () => ({ TabHeader: () => null }));
jest.mock('@/components/workspace', () => ({ WorkspaceContextBar: () => null }));
jest.mock('@/components/icons', () => ({
  BriefcaseIcon: () => null,
  ChevronRightIcon: () => null,
  PlusIcon: () => null,
  UserPlusIcon: () => null,
}));
jest.mock('@/components/share/BulkShareActionBar', () => ({
  BulkShareActionBar: () => null,
  BULK_SHARE_ACTION_BAR_HEIGHT: 64,
}));
jest.mock('@/hooks/share/useBulkShare', () => ({
  useBulkShare: () => ({ shareJobs: jest.fn(), isSharing: false }),
}));
jest.mock('@/hooks/share/useBulkShareSelection', () => ({
  useBulkShareSelection: () => ({
    isSelectionMode: false,
    selectedIds: new Set<string>(),
    selectedCount: 0,
    maxCount: 10,
    canSelect: () => true,
    toggle: jest.fn(),
    clear: jest.fn(),
    selectAll: jest.fn(),
    enterSelectionMode: jest.fn(),
    exitSelectionMode: jest.fn(),
  }),
}));
jest.mock('@/domains/job-posting', () => ({
  buildPostingFacts: () => ({ schedule: { dateRequirements: [] } }),
  POSTING_STATUS_ACTION_TEXT: {
    close: { confirmTitle: '', confirmMessage: '', confirmText: '' },
    reopen: { confirmTitle: '', confirmMessage: '', confirmText: '' },
  },
}));
let mockPostingsState: { data: unknown[] | undefined; isLoading: boolean; error: Error | null } = {
  data: [],
  isLoading: false,
  error: null,
};
jest.mock('@/hooks/useJobManagement', () => ({
  useMyJobPostings: () => ({ ...mockPostingsState, refetch: jest.fn() }),
  useCloseJobPosting: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useReopenJobPosting: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/job-posting/useSharedJobPostings', () => ({
  useSharedJobPostings: () => ({ sharedPostings: [] }),
}));
jest.mock('@/hooks/useManualRefresh', () => ({
  useManualRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock('@/hooks/usePostingFilledCounts', () => ({
  usePostingFilledCounts: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useSubmitGate', () => ({
  useSubmitGate: () => ({ submit: jest.fn() }),
}));
jest.mock('@/hooks/useTabBarBottomPadding', () => ({ useTabBarBottomPadding: () => 90 }));
jest.mock('@/stores/authStore', () => ({ useHasRole: () => true }));
jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector?: (state: { isDarkMode: boolean }) => unknown) => {
    const state = { isDarkMode: false };
    return selector ? selector(state) : state;
  },
}));
jest.mock('@/constants', () => ({ getIconColor: () => '#000000' }));

function resetMocks() {
  jest.clearAllMocks();
  mockWorkScheduleEnabled = true;
  mockAttention = { absentCount: 0, missingCheckoutCount: 0, target: null };
  mockLastFocusRequest = null;
  mockLastBottomPadding = undefined;
  mockPostingsState = { data: [], isLoading: false, error: null };
}

describe('내 공고 탭 — 세그먼트', () => {
  beforeEach(resetMocks);

  it('기본값은 [공고] — 공고 본문이 보이고 근무표 본문은 없다', () => {
    const { queryByText, getByTestId, getByLabelText } = render(<EmployerTabScreen />);

    expect(getByTestId('employer-segment-postings')).toBeTruthy();
    expect(getByTestId('employer-segment-schedule')).toBeTruthy();
    expect(getByLabelText('새 공고 작성')).toBeTruthy();
    expect(queryByText('근무표 본문')).toBeNull();
  });

  it('[근무표] 를 누르면 근무표 본문으로 바뀌고, [공고] 로 돌아올 수 있다', () => {
    const { getByText, queryByText, getByTestId, getByLabelText, queryByLabelText } = render(
      <EmployerTabScreen />
    );

    fireEvent.press(getByTestId('employer-segment-schedule'));
    expect(getByText('근무표 본문')).toBeTruthy();
    expect(queryByLabelText('새 공고 작성')).toBeNull();

    fireEvent.press(getByTestId('employer-segment-postings'));
    expect(getByLabelText('새 공고 작성')).toBeTruthy();
    expect(queryByText('근무표 본문')).toBeNull();
  });

  it('근무표 플래그가 꺼져 있으면 세그먼트가 없다', () => {
    mockWorkScheduleEnabled = false;
    const { queryByTestId, getByLabelText } = render(<EmployerTabScreen />);

    expect(getByLabelText('새 공고 작성')).toBeTruthy();
    expect(queryByTestId('employer-segment-schedule')).toBeNull();
    expect(queryByTestId('employer-segment-postings')).toBeNull();
  });

  it('새 공고 작성은 필터 행의 라벨 버튼으로 남고, 빈 화면에는 첫 공고 행동이 있다', () => {
    const { getByLabelText, getByText } = render(<EmployerTabScreen />);

    // 아이콘만 남으면 #490 근무표처럼 기능이 발견되지 않는다 — 보이는 글자를 단언한다.
    expect(getByText('새 공고')).toBeTruthy();
    fireEvent.press(getByLabelText('새 공고 작성'));
    expect(router.push).toHaveBeenLastCalledWith('/(employer)/my-postings/create');

    fireEvent.press(getByText('첫 공고 올리기'));
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenLastCalledWith('/(employer)/my-postings/create');
  });

  it('전체가 아닌 필터의 빈 화면에는 첫 공고 행동이 없다', () => {
    const { getByLabelText, getByText, queryByText } = render(<EmployerTabScreen />);

    expect(getByText('첫 공고 올리기')).toBeTruthy();
    fireEvent.press(getByLabelText('마감 공고 0건'));
    expect(queryByText('첫 공고 올리기')).toBeNull();
  });

  it('근무표 본문 버튼(구 진입점)은 세그먼트로 대체되어 없다', () => {
    const { queryByTestId } = render(<EmployerTabScreen />);

    expect(queryByTestId('employer-work-schedule')).toBeNull();
  });

  it('[근무표] 는 탭바 높이만큼의 하단 여백을 받는다', () => {
    const { getByTestId, getByText } = render(<EmployerTabScreen />);

    fireEvent.press(getByTestId('employer-segment-schedule'));

    expect(getByText('근무표 본문')).toBeTruthy();
    expect(mockLastBottomPadding).toBe(90);
  });

  it.each([
    ['로딩 중', { data: undefined, isLoading: true, error: null }, 'loading'],
    ['조회 실패', { data: undefined, isLoading: false, error: new Error('실패') }, 'error'],
  ])('공고 목록이 %s 이어도 세그먼트로 근무표에 갈 수 있다', (_label, state, mode) => {
    mockPostingsState = state;
    const { getByTestId, getByText, queryByText } = render(<EmployerTabScreen />);

    // 대조군 — [공고] 본문 자리에는 상태 화면이 보인다.
    expect(getByText(`공고 상태:${mode}`)).toBeTruthy();

    fireEvent.press(getByTestId('employer-segment-schedule'));

    expect(getByText('근무표 본문')).toBeTruthy();
    expect(queryByText(`공고 상태:${mode}`)).toBeNull();
  });
});

describe('내 공고 탭 — 오늘 한 줄', () => {
  beforeEach(resetMocks);

  it('0건이면 렌더하지 않는다', () => {
    const { queryByTestId, getByLabelText } = render(<EmployerTabScreen />);

    expect(getByLabelText('새 공고 작성')).toBeTruthy();
    expect(queryByTestId('today-attention-line')).toBeNull();
  });

  it('신호가 공고 하나에만 있으면 그 공고의 [근무] 로 간다', () => {
    mockAttention = {
      absentCount: 1,
      missingCheckoutCount: 0,
      target: { kind: 'posting', jobPostingId: 'jp-7' },
    };
    const { getByTestId } = render(<EmployerTabScreen />);

    fireEvent.press(getByTestId('today-attention-line'));

    expect(router.push).toHaveBeenCalledWith('/(employer)/my-postings/jp-7/settlements');
  });

  it('여러 공고에 걸치면 [근무표] 로 전환하고 그 날짜로 옮긴다', () => {
    mockAttention = {
      absentCount: 2,
      missingCheckoutCount: 1,
      target: { kind: 'schedule', date: '2026-07-31' },
    };
    const { getByTestId, getByText } = render(<EmployerTabScreen />);

    fireEvent.press(getByTestId('today-attention-line'));

    expect(getByText('근무표 본문')).toBeTruthy();
    expect(mockLastFocusRequest).toEqual(expect.objectContaining({ date: '2026-07-31' }));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('[근무표] 세그먼트에서도 오늘 한 줄은 그대로 보인다', () => {
    mockAttention = {
      absentCount: 1,
      missingCheckoutCount: 0,
      target: { kind: 'posting', jobPostingId: 'jp-7' },
    };
    const { getByTestId } = render(<EmployerTabScreen />);

    fireEvent.press(getByTestId('employer-segment-schedule'));

    expect(getByTestId('today-attention-line')).toBeTruthy();
  });

  it('근무표가 꺼져 있는데 신호가 여러 공고에 걸치면 누를 수 없는 안내 줄로 그린다', () => {
    mockWorkScheduleEnabled = false;
    mockAttention = {
      absentCount: 2,
      missingCheckoutCount: 0,
      target: { kind: 'schedule', date: '2026-07-31' },
    };
    const { getByTestId, queryByText, getByLabelText } = render(<EmployerTabScreen />);

    const line = getByTestId('today-attention-line');
    // 갈 곳(근무표 세그먼트)이 없으므로 버튼이 아니라 요약이다.
    expect(line.props.accessibilityRole).toBe('summary');
    expect(line.props.onPress).toBeUndefined();

    fireEvent.press(line);

    expect(router.push).not.toHaveBeenCalled();
    expect(queryByText('근무표 본문')).toBeNull();
    expect(getByLabelText('새 공고 작성')).toBeTruthy();
  });

  it('근무표가 꺼져 있어도 신호가 공고 하나면 그 [근무] 로는 갈 수 있다', () => {
    mockWorkScheduleEnabled = false;
    mockAttention = {
      absentCount: 1,
      missingCheckoutCount: 0,
      target: { kind: 'posting', jobPostingId: 'jp-7' },
    };
    const { getByTestId } = render(<EmployerTabScreen />);

    fireEvent.press(getByTestId('today-attention-line'));

    expect(router.push).toHaveBeenCalledWith('/(employer)/my-postings/jp-7/settlements');
  });

  it('공고 목록 조회가 실패해도 오늘 한 줄은 보인다', () => {
    mockPostingsState = { data: undefined, isLoading: false, error: new Error('실패') };
    mockAttention = {
      absentCount: 1,
      missingCheckoutCount: 0,
      target: { kind: 'posting', jobPostingId: 'jp-7' },
    };
    const { getByTestId } = render(<EmployerTabScreen />);

    expect(getByTestId('today-attention-line')).toBeTruthy();
  });
});
