/**
 * JobPostingDetailScreen — 카드 위계 회귀 테스트 (S2-4 · S2-8).
 *
 * 관리 카드 6장이 전부 같은 크기·같은 모양이라 우선순위 표현이 0이었다 — 사장은 매번
 * 여섯 장을 읽고 무엇이 급한지 스스로 판단해야 했다.
 *
 * 고정하는 계약 여섯.
 *  1. 손해가 가장 큰 신호 하나만 "지금 할 일"로 크게 낸다. 없으면 그 자리도 없다.
 *  2. 승격된 카드는 목록에서 빠진다 — 같은 testID 가 두 번 나오면 무엇을 누른 건지 모호해진다.
 *  3. 우선순위가 실제로 지켜진다(취소 요청 > 대기 지원자).
 *  4. 같은 카드라도 무엇 때문에 올라왔는지에 따라 다른 말을 한다(미출근 ≠ 정산).
 *  5. 🚨 라이브 운영은 연결된 대회가 있으면 목록 **맨 위** 고정 — 빈도로 강등하면
 *     대회 D-day 현장에서 사장이 이 진입점을 못 찾는다.
 *  6. 통계 세 숫자는 각자 자기 목록으로 데려간다(`?filter=`).
 *
 * ⚠️ `selectPrimaryAction` 을 목으로 덮으면 1~4 가 통째로 사라진다 — requireActual 로 태운다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import JobPostingDetailScreen from '../index';

const mockManagementView = jest.fn();
const mockApplicantStats = jest.fn();
const mockWorkLogs = jest.fn();
const mockConfirmedStaff = jest.fn();
const mockOpsTournaments = jest.fn();
const mockPostingType = jest.fn();
const mockPush = jest.fn();
const mockAddToast = jest.fn();
const mockTriggerHaptic = jest.fn();

const mockPosting = () => ({
  id: 'posting-1',
  title: '금요일 딜러 모집',
  location: { name: '서울 강남구' },
  description: '',
  status: 'active',
  postingType: mockPostingType(),
  tournamentConfig: { approvalStatus: 'approved', rejectionReason: null },
  schedule: { kind: 'dated' },
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'posting-1' }),
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('../_layout', () => ({
  useJobDetailContext: () => ({
    job: mockPosting(),
    isFixed: false,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    handleShowQR: jest.fn(),
  }),
  HeaderQRAction: () => null,
  JobTitleSuffix: () => null,
}));

jest.mock('@/components', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => children,
  Badge: ({ children }: { children?: React.ReactNode }) => children,
  ConfirmModal: () => null,
}));

jest.mock('@/components/ui', () => ({
  ActionSheet: () => null,
}));

jest.mock('@/components/headers', () => ({
  StackHeader: () => null,
}));

jest.mock('@/components/icons', () => ({
  BanknotesIcon: () => null,
  ChevronDownIcon: () => null,
  ChevronRightIcon: () => null,
  ChevronUpIcon: () => null,
  ClockIcon: () => null,
  CurrencyDollarIcon: () => null,
  DocumentIcon: () => null,
  EditIcon: () => null,
  EyeIcon: () => null,
  MapPinIcon: () => null,
  ShareIcon: () => null,
  TrashIcon: () => null,
  UserPlusIcon: () => null,
  UsersIcon: () => null,
  XCircleIcon: () => null,
}));

jest.mock('@/components/jobs', () => ({
  PostingCompensationContent: () => null,
  PostingScheduleContent: () => null,
  PostingStatusBadge: () => null,
  PostingSurfaceState: () => null,
  PostingTypeBadge: () => null,
  ResubmitButton: () => null,
  TournamentStatusBadge: () => null,
  SeatFillSummary: () => null,
}));

// 우선순위 규칙(selectPrimaryAction)은 실제 구현을 태운다 — 목으로 덮으면 이 파일이 무의미해진다.
jest.mock('@/domains/job-posting', () => {
  const actual = jest.requireActual('@/domains/job-posting');
  return {
    ...actual,
    buildPostingFacts: (p: unknown) => p,
    isPostingDeletable: () => true,
    projectPostingSurface: () => mockManagementView(),
  };
});

jest.mock('@/hooks/applicant', () => ({
  useApplicantsByJobPosting: () => ({
    data: { stats: mockApplicantStats() },
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('@/hooks/useConfirmedStaff', () => ({
  useConfirmedStaff: () => mockConfirmedStaff(),
}));

jest.mock('@/hooks/useSettlement', () => ({
  useWorkLogsByJobPosting: () => ({ data: mockWorkLogs() }),
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({ shareJob: jest.fn(), isSharing: false }),
}));

jest.mock('@/hooks/useJobManagement', () => ({
  useDeleteJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
  useCloseJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
  useReopenJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/usePostingFilledCounts', () => ({
  usePostingFilledCounts: () => ({ data: undefined }),
  extractPostingFilledSubmap: () => ({}),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: unknown }) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

// 🚨 소리는 쓰지 않는다(야간·고소음 현장) — 햅틱만 나가는지 여기서 고정한다.
jest.mock('@/utils/haptics', () => ({
  triggerHaptic: (...args: unknown[]) => mockTriggerHaptic(...args),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('@/hooks/ops', () => ({
  useOpsTournamentsForPosting: () => ({ opsTournaments: mockOpsTournaments(), isLoading: false }),
}));

const managementView = () => ({
  filledPositions: 0,
  totalPositions: 5,
  totalApplicants: 3,
  confirmedApplicants: 0,
  pendingApplicants: 0,
  locationLabel: '서울 강남구',
  allowanceLabels: [],
  questions: [],
});

const emptyStaff = {
  staff: [],
  grouped: [],
  stats: { total: 0, checkedIn: 0, completed: 0, noShow: 0 },
  isLoading: false,
  error: null,
  refresh: jest.fn(),
  isRefreshing: false,
};

const stats = (overrides: Record<string, number> = {}) => ({
  total: 3,
  confirmed: 0,
  applied: 0,
  cancellationPending: 0,
  ...overrides,
});

/** 화면의 버튼 라벨을 렌더 순서대로 훑는다 — 목록의 물리적 순서를 보기 위한 것. */
const buttonLabels = (getAllByRole: (role: string) => { props: Record<string, unknown> }[]) =>
  getAllByRole('button')
    .map((node) => node.props.accessibilityLabel)
    .filter((label): label is string => typeof label === 'string');

describe('JobPostingDetailScreen — 카드 위계', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAddToast.mockReset();
    mockTriggerHaptic.mockReset();
    mockPostingType.mockReturnValue('regular');
    mockApplicantStats.mockReturnValue(stats());
    mockManagementView.mockReturnValue(managementView());
    mockWorkLogs.mockReturnValue([]);
    mockConfirmedStaff.mockReturnValue(emptyStaff);
    mockOpsTournaments.mockReturnValue([]);
  });

  it('할 일이 없으면 "지금 할 일" 카드를 만들지 않는다', () => {
    const { queryByText } = render(<JobPostingDetailScreen />);

    expect(queryByText('지금 할 일')).toBeNull();
  });

  it('대기 지원자가 있으면 지원자 카드가 "지금 할 일"로 승격된다', () => {
    mockApplicantStats.mockReturnValue(stats({ applied: 2 }));

    const { getByText, getByTestId } = render(<JobPostingDetailScreen />);

    expect(getByText('지금 할 일')).toBeTruthy();
    expect(getByTestId('job-posting-manage-applicants').props.accessibilityLabel).toContain(
      '지금 할 일'
    );
  });

  it('승격된 카드는 목록에 중복으로 남지 않는다', () => {
    mockApplicantStats.mockReturnValue(stats({ applied: 2 }));

    const { getAllByTestId } = render(<JobPostingDetailScreen />);

    expect(getAllByTestId('job-posting-manage-applicants')).toHaveLength(1);
  });

  it('취소 요청은 대기 지원자보다 먼저 승격된다', () => {
    mockApplicantStats.mockReturnValue(stats({ applied: 5, cancellationPending: 1 }));

    const { getByTestId } = render(<JobPostingDetailScreen />);

    expect(
      getByTestId('job-posting-manage-cancellation-requests').props.accessibilityLabel
    ).toContain('지금 할 일');
    expect(getByTestId('job-posting-manage-applicants').props.accessibilityLabel).not.toContain(
      '지금 할 일'
    );
  });

  // 같은 카드(정산)라도 미출근 때문에 올라왔으면 정산 얘기를 하면 안 된다 —
  // 사장이 문구를 읽고 엉뚱한 화면을 연다.
  it('오늘 미출근으로 승격되면 정산이 아니라 출근 이야기를 한다', () => {
    mockConfirmedStaff.mockReturnValue({
      ...emptyStaff,
      grouped: [
        {
          date: '2026-08-13',
          formattedDate: '8월 13일',
          isToday: true,
          isPast: false,
          staff: [{}, {}],
          stats: { total: 2, checkedIn: 1, completed: 0, noShow: 0 },
        },
      ],
    });

    const { getByText, getByTestId } = render(<JobPostingDetailScreen />);

    const label = getByTestId('job-posting-manage-settlements').props.accessibilityLabel;
    expect(label).toContain('오늘 출근 확인');
    expect(label).toContain('1명');
    expect(getByText('출근 현황 보기')).toBeTruthy();
  });

  it('정산 대기로 승격되면 정산 문구를 쓴다', () => {
    mockWorkLogs.mockReturnValue([{ payrollStatus: 'pending' }, { payrollStatus: 'pending' }]);

    const { getByText, getByTestId } = render(<JobPostingDetailScreen />);

    expect(getByTestId('job-posting-manage-settlements').props.accessibilityLabel).toContain(
      '정산할 근무가 2건'
    );
    expect(getByText('정산하러 가기')).toBeTruthy();
  });

  // 🚨 대회 D-day 현장에서 사장이 이 진입점을 못 찾으면 운영이 멈춘다.
  it('연결된 대회가 있으면 라이브 운영이 목록 맨 위다', () => {
    mockPostingType.mockReturnValue('tournament');
    mockOpsTournaments.mockReturnValue([{ id: 't1', status: 'active' }]);
    // 라이브 운영보다 우선순위가 높은 신호를 세워 승격은 다른 카드가 가져가게 한다.
    mockApplicantStats.mockReturnValue(stats({ applied: 3 }));

    const { getByTestId, getAllByRole } = render(<JobPostingDetailScreen />);

    expect(getByTestId('job-posting-manage-applicants').props.accessibilityLabel).toContain(
      '지금 할 일'
    );

    const labels = buttonLabels(getAllByRole);
    const liveOpsIndex = labels.findIndex((label) => label.includes('라이브 운영'));
    const settlementsIndex = labels.findIndex((label) => label.includes('스태프 관리/정산'));
    expect(liveOpsIndex).toBeGreaterThanOrEqual(0);
    expect(liveOpsIndex).toBeLessThan(settlementsIndex);
  });

  // S2-11 — realtime 으로 숫자만 조용히 바뀌면 사장은 화면을 다시 훑기 전엔 모른다.
  describe('새 지원 인라인 알림', () => {
    it('첫 관측은 기준선일 뿐이다 — 진입하자마자 "새 지원"이라 말하지 않는다', () => {
      mockApplicantStats.mockReturnValue(stats({ applied: 4 }));

      render(<JobPostingDetailScreen />);

      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('보고 있는 동안 지원이 늘면 증가분을 알린다', () => {
      mockApplicantStats.mockReturnValue(stats({ applied: 1 }));
      const { rerender } = render(<JobPostingDetailScreen />);

      mockApplicantStats.mockReturnValue(stats({ applied: 3 }));
      rerender(<JobPostingDetailScreen />);

      const toast = mockAddToast.mock.calls[0][0];
      expect(toast.message).toContain('새 지원이 2건');
      expect(toast.action.label).toBe('보러 가기');
    });

    it('소리 대신 햅틱만 쓴다 — 야간·고소음 현장에서 소리는 방해가 된다', () => {
      mockApplicantStats.mockReturnValue(stats({ applied: 1 }));
      const { rerender } = render(<JobPostingDetailScreen />);

      mockApplicantStats.mockReturnValue(stats({ applied: 2 }));
      rerender(<JobPostingDetailScreen />);

      expect(mockTriggerHaptic).toHaveBeenCalledWith('success');
    });

    it('지원이 줄어들 때는 알리지 않는다(취소·거절 반영)', () => {
      mockApplicantStats.mockReturnValue(stats({ applied: 3 }));
      const { rerender } = render(<JobPostingDetailScreen />);

      mockApplicantStats.mockReturnValue(stats({ applied: 1 }));
      rerender(<JobPostingDetailScreen />);

      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  it('통계 세 숫자는 각자 자기 목록으로 데려간다', () => {
    const { getByTestId } = render(<JobPostingDetailScreen />);

    fireEvent.press(getByTestId('job-posting-stat-pending'));
    expect(mockPush).toHaveBeenCalledWith(
      '/(employer)/my-postings/posting-1/applicants?filter=applied'
    );

    fireEvent.press(getByTestId('job-posting-stat-confirmed'));
    expect(mockPush).toHaveBeenCalledWith(
      '/(employer)/my-postings/posting-1/applicants?filter=confirmed'
    );

    fireEvent.press(getByTestId('job-posting-stat-total'));
    expect(mockPush).toHaveBeenCalledWith(
      '/(employer)/my-postings/posting-1/applicants?filter=all'
    );
  });
});
