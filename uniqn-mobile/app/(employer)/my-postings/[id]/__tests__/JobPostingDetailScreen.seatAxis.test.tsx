/**
 * JobPostingDetailScreen — 숫자 진실원(축) 회귀 테스트 (S2-2).
 *
 * 공고 화면에는 축이 다른 두 종류의 숫자가 함께 산다.
 *  - **applications 축**: 지원자 / 검토 대기 / 확정 (`posting.stats` jsonb)
 *  - **work_logs 축**: 채워진 좌석 (`filled_positions` 컬럼, 트리거 유지)
 * 두 축은 갱신 시점이 달라 같은 순간에도 값이 어긋날 수 있다.
 *
 * 여기서 고정하는 계약은 셋이다.
 *  1. **삭제 가드는 좌석 축이다.** 서버(`deleteWithTransaction`)가 `filledPositions > 0` 로
 *     막으므로 버튼도 같은 축이어야 한다. 종전에는 applications 축(confirmedApplicants)이라,
 *     근무가 끝나 확정이 completed 로 전이되면 좌석이 남았는데도 버튼이 열렸다.
 *  2. 좌석 표기는 "자리 N/M 채움" 하나뿐이다 — "확정"은 applications 축 전용 라벨.
 *  3. 정산 ActionCard 배지는 **정산 대기 건수**다. 좌석 수를 달면 스태프가 있기만 해도
 *     배지가 상시로 떠 있어 "처리할 일"을 가리키지 못한다.
 *
 * ⚠️ `isPostingDeletable` 을 목으로 덮으면 1번이 통째로 검증되지 않는다 — requireActual 로
 *    실제 규칙을 태운다. (목이 계약을 삼키는 사고가 이 트리에서 반복됐다.)
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import JobPostingDetailScreen from '../index';

const mockManagementView = jest.fn();
const mockApplicantStats = jest.fn();
const mockWorkLogs = jest.fn();

const mockPosting = {
  id: 'posting-1',
  title: '금요일 딜러 모집',
  location: { name: '서울 강남구' },
  description: '',
  status: 'active',
  postingType: 'regular',
  schedule: { kind: 'dated' },
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'posting-1' }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

jest.mock('../_layout', () => ({
  useJobDetailContext: () => ({
    job: mockPosting,
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

// SeatFillSummary 는 목하지 않는다 — 좌석 문구가 이 파일이 고정하려는 계약의 일부다.
jest.mock('@/components/jobs', () => {
  const actual = jest.requireActual('@/components/jobs/shared/SeatFillSummary');
  return {
    PostingCompensationContent: () => null,
    PostingScheduleContent: () => null,
    PostingStatusBadge: () => null,
    PostingSurfaceState: () => null,
    PostingTypeBadge: () => null,
    ResubmitButton: () => null,
    TournamentStatusBadge: () => null,
    SeatFillSummary: actual.SeatFillSummary,
  };
});

// 삭제 가드의 **실제 규칙**을 태운다. 여기를 () => true 로 덮으면 계약 1이 사라진다.
jest.mock('@/domains/job-posting', () => {
  const actual = jest.requireActual('@/domains/job-posting');
  return {
    buildPostingFacts: (p: unknown) => p,
    isPostingDeletable: actual.isPostingDeletable,
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
  useConfirmedStaff: () => ({
    staff: [],
    grouped: [],
    stats: { total: 0, checkedIn: 0, completed: 0, noShow: 0 },
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    isRefreshing: false,
  }),
}));

jest.mock('@/hooks/useSettlement', () => ({
  useWorkLogsByJobPosting: () => ({ data: mockWorkLogs() }),
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({ shareJob: jest.fn(), isSharing: false }),
}));

jest.mock('@/hooks/useJobManagement', () => ({
  useDeleteJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/usePostingFilledCounts', () => ({
  usePostingFilledCounts: () => ({ data: undefined }),
  extractPostingFilledSubmap: () => ({}),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('@/hooks/ops', () => ({
  useOpsTournamentsForPosting: () => ({ opsTournaments: [], isLoading: false }),
}));

const managementView = (filledPositions: number, confirmedApplicants: number) => ({
  filledPositions,
  totalPositions: 5,
  totalApplicants: 3,
  confirmedApplicants,
  pendingApplicants: 1,
  locationLabel: '서울 강남구',
  allowanceLabels: [],
  questions: [],
});

describe('JobPostingDetailScreen — 숫자 진실원(축)', () => {
  beforeEach(() => {
    mockApplicantStats.mockReturnValue({
      total: 3,
      confirmed: 0,
      applied: 1,
      cancellationPending: 0,
    });
    mockManagementView.mockReturnValue(managementView(0, 0));
    mockWorkLogs.mockReturnValue([]);
  });

  it('좌석이 차 있으면 확정 지원자가 0명이어도 삭제 버튼을 잠근다', () => {
    // 근무가 끝나 application 이 completed 로 전이된 상태 — applications 축은 0인데 좌석은 남아 있다.
    // 서버는 이 공고의 삭제를 거부한다. 버튼이 열려 있으면 사장은 눌러 보고 나서야 알게 된다.
    mockManagementView.mockReturnValue(managementView(3, 0));
    mockApplicantStats.mockReturnValue({
      total: 3,
      confirmed: 0,
      applied: 0,
      cancellationPending: 0,
    });

    const { getByTestId } = render(<JobPostingDetailScreen />);

    expect(getByTestId('job-posting-delete-button').props.accessibilityState.disabled).toBe(true);
  });

  it('좌석이 비어 있으면 삭제 버튼을 연다', () => {
    mockManagementView.mockReturnValue(managementView(0, 0));

    const { getByTestId } = render(<JobPostingDetailScreen />);

    expect(getByTestId('job-posting-delete-button').props.accessibilityState.disabled).toBe(false);
  });

  it('좌석 표기는 "자리 N/M 채움" 하나다 — 좌석을 "확정"이라 부르지 않는다', () => {
    mockManagementView.mockReturnValue(managementView(3, 0));

    const { getByLabelText, queryByText } = render(<JobPostingDetailScreen />);

    expect(getByLabelText('5자리 중 3자리 채움')).toBeTruthy();
    expect(queryByText('배정 현황')).toBeNull();
  });

  it('정산 ActionCard 배지는 정산 대기 건수다 — 좌석 수가 아니다', () => {
    mockManagementView.mockReturnValue(managementView(4, 0));
    mockWorkLogs.mockReturnValue([
      { payrollStatus: 'pending' },
      { payrollStatus: 'completed' },
      { payrollStatus: 'pending' },
    ]);

    const { getByTestId } = render(<JobPostingDetailScreen />);

    const label = getByTestId('job-posting-manage-settlements').props.accessibilityLabel;
    expect(label).toContain('정산 2건');
    // 좌석 수(4)가 배지로 새어 나오면 안 된다.
    expect(label).not.toContain('4명');
  });

  it('정산 대기가 없으면 배지를 달지 않는다', () => {
    mockManagementView.mockReturnValue(managementView(4, 0));
    mockWorkLogs.mockReturnValue([{ payrollStatus: 'completed' }]);

    const { getByTestId } = render(<JobPostingDetailScreen />);

    // 카드 제목·설명에도 "정산"이 들어가므로 배지 형태(`정산 N건`)로 좁혀 단언한다.
    expect(getByTestId('job-posting-manage-settlements').props.accessibilityLabel).not.toMatch(
      /정산 \d+건/
    );
  });
});
