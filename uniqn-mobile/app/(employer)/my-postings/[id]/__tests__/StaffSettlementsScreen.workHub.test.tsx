/**
 * [근무] 화면(settlements.tsx) — 공고 상세에서 흡수한 진입점 배선 (구인자 IA S1).
 *
 * 고정하는 계약.
 *  1. 취소 요청 한 줄은 지원자 통계의 건수를 쓰고, 누르면 검토 화면으로 간다. 0건이면 없다.
 *  2. 🚨 지원자 조회는 realtime 을 켜지 않는다 — 스택 아래 공고 상세가 이미 구독 중이라
 *     켜면 같은 공고 채널이 둘이 된다(훅에 디듀프가 없다).
 *  3. 헤더 `메시지` 는 확정 인원이 있을 때만 — 0명이면 보낼 대상이 없다.
 *  4. 상시 공고는 막다른 에러 대신 근무표로 안내한다.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import StaffSettlementsScreen from '../settlements';

const mockPush = jest.fn();
const mockApplicantsHook = jest.fn();
const mockStaffTotal = jest.fn();
const mockIsDated = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'posting-1' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../_layout', () => ({
  useJobDetailContext: () => ({
    job: { id: 'posting-1', title: '금요일 딜러 모집' },
    refresh: jest.fn(),
    handleShowQR: jest.fn(),
  }),
  HeaderQRAction: () => null,
  JobTitleSuffix: () => null,
}));

// rightAction 을 실제로 렌더한다 — null 목이면 메시지 버튼 계약이 검증되지 않는다.
jest.mock('@/components/headers', () => ({
  StackHeader: ({ rightAction }: { rightAction?: React.ReactNode }) => rightAction ?? null,
}));

jest.mock('@/components/icons', () => ({ MessageIcon: () => null }));
jest.mock('@/components', () => ({ ErrorState: () => null }));
jest.mock('@/components/jobs', () => ({ PostingSurfaceState: () => null }));
jest.mock('@/components/employer', () => ({
  SettlementList: () => null,
  StaffManagementTab: () => null,
}));
jest.mock('@/features/employer/settlements/SettlementModals', () => ({
  SettlementModals: () => null,
}));
jest.mock('@/features/employer/settlements/TabHeader', () => ({ TabHeader: () => null }));
jest.mock('@/features/employer/settlements/TodayOpsStrip', () => ({ TodayOpsStrip: () => null }));
jest.mock('@/features/employer/settlements/useStaffSettlementsHandlers', () => ({
  useStaffSettlementsHandlers: () => ({}),
}));
jest.mock('@/features/employer/settlements/settlementCalc', () => ({
  deriveSalaryConfig: () => ({ roles: [], defaultSalary: undefined, allowances: undefined }),
  deriveRolesForList: () => [],
  selectPendingSettlementCount: () => 0,
}));

jest.mock('@/domains/job-posting', () => ({
  getPostingSettlementContext: () => undefined,
  aggregateRoleFilledFromSubmap: () => ({}),
  selectPostingCapacityGaps: () => [],
  toCapacityGapByDate: () => new Map(),
}));

jest.mock('@/utils/jobPostingVisibility', () => ({
  isCanonicalDatedPosting: () => mockIsDated(),
}));

jest.mock('@/hooks/applicant', () => ({
  useApplicantsByJobPosting: (...args: unknown[]) => mockApplicantsHook(...args),
}));

jest.mock('@/hooks/useConfirmedStaff', () => ({
  useConfirmedStaff: () => ({ stats: { total: mockStaffTotal() }, grouped: [] }),
}));

jest.mock('@/hooks/useSettlement', () => ({
  useSettlement: () => ({
    workLogs: [],
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    settleWorkLog: jest.fn(),
    bulkSettle: jest.fn(),
    updateStatusAsync: jest.fn(),
    isUpdatingStatus: false,
    isSettling: false,
    isBulkSettling: false,
  }),
}));

jest.mock('@/hooks/useSettlementModals', () => ({ useSettlementModals: () => ({}) }));
jest.mock('@/hooks/useManualRefresh', () => ({
  useManualRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock('@/hooks/usePostingFilledCounts', () => ({
  usePostingFilledCounts: () => ({ data: undefined }),
  extractPostingFilledSubmap: () => ({}),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));
jest.mock('@/stores/toastStore', () => ({ useToastStore: () => ({ addToast: jest.fn() }) }));

const applicantResult = (cancellationPending: number) => ({
  data: { stats: { cancellationPending } },
});

describe('StaffSettlementsScreen — [근무] 허브 배선', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApplicantsHook.mockReset();
    mockApplicantsHook.mockReturnValue(applicantResult(0));
    mockStaffTotal.mockReturnValue(0);
    mockIsDated.mockReturnValue(true);
  });

  it('취소 요청이 있으면 한 줄을 띄우고 누르면 검토 화면으로 간다', () => {
    mockApplicantsHook.mockReturnValue(applicantResult(2));

    const { getByTestId } = render(<StaffSettlementsScreen />);

    const banner = getByTestId('work-cancellation-banner');
    expect(banner.props.accessibilityLabel).toContain('취소 요청 2건');
    fireEvent.press(banner);
    expect(mockPush).toHaveBeenCalledWith(
      '/(employer)/my-postings/posting-1/cancellation-requests'
    );
  });

  it('취소 요청이 0건이면 한 줄이 없다', () => {
    const { queryByTestId } = render(<StaffSettlementsScreen />);

    expect(queryByTestId('work-cancellation-banner')).toBeNull();
  });

  it('지원자 조회는 realtime 구독을 열지 않는다', () => {
    render(<StaffSettlementsScreen />);

    expect(mockApplicantsHook).toHaveBeenCalled();
    for (const call of mockApplicantsHook.mock.calls) {
      const options = call[2] as { realtime?: boolean } | undefined;
      expect(options?.realtime).not.toBe(true);
    }
  });

  it('확정 인원이 있으면 헤더 메시지로 공지 화면에 간다', () => {
    mockStaffTotal.mockReturnValue(3);

    const { getByTestId } = render(<StaffSettlementsScreen />);
    fireEvent.press(getByTestId('work-announce'));

    expect(mockPush).toHaveBeenCalledWith('/(employer)/my-postings/posting-1/announce');
  });

  it('확정 인원이 0명이면 메시지 버튼이 없다', () => {
    const { queryByTestId } = render(<StaffSettlementsScreen />);

    expect(queryByTestId('work-announce')).toBeNull();
  });

  it('상시 공고는 근무표로 안내한다', () => {
    mockIsDated.mockReturnValue(false);

    const { getByTestId, queryByText } = render(<StaffSettlementsScreen />);

    expect(queryByText('지원하지 않는 화면입니다')).toBeNull();
    fireEvent.press(getByTestId('fixed-posting-open-work-schedule'));
    expect(mockPush).toHaveBeenCalledWith('/(employer)/work-schedule');
  });
});
