/**
 * JobPostingDetailScreen — 허브 신호 회귀 테스트 (1단계 체감 묶음).
 *
 * 고정하는 계약 넷.
 *  1. 근무 정보(일정·급여·위치)는 **기본 펼침**이다. 사장이 매 진입마다 [상세]를 누를 이유가 없다.
 *  2. 지원자 0명이면 상태 보고("0명이 대기중입니다") 대신 다음 행동(공유 CTA)을 준다.
 *  3. 오늘 근무가 있으면 당일 운영 요약(출근/노쇼)이 허브에 뜬다 — 정산 화면까지 2탭 들어가지 않는다.
 *  4. 헤더는 `공유` · `⋯` 두 시트로 진입점을 모은다(구인자 IA S1).
 *     공유 = 링크 공유 · 지원 QR · 구직자 화면 보기 / ⋯ = 함께 관리할 사람. 눈 아이콘은 없다.
 *
 * ⚠️ StackHeader 를 null 로 목하면 rightAction(공유·⋯ 버튼)이 통째로 사라져 4번이
 *    "테스트가 있는데 검증되지 않는" 상태가 된다 — rightAction 을 실제로 렌더하는 목을 쓴다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import JobPostingDetailScreen from '../index';

const mockPush = jest.fn();
const mockShareJob = jest.fn();
const mockApplicantStats = jest.fn();
const mockConfirmedStaff = jest.fn();

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
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

// 화면은 공고를 컨텍스트에서 받는다(레이아웃이 realtime 구독과 함께 한 번만 조회).
// job:null 로 두면 전 케이스가 에러 화면으로 떨어져 이 파일의 계약 넷이 통째로 검증되지 않는다.
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

// 시트는 열렸을 때 옵션을 버튼으로 그린다 — null 목이면 공유·⋯ 시트 안의 진입점이
// "테스트가 있는데 검증되지 않는" 상태가 된다. 실제 컴포넌트를 태우면
// 내부 Modal 이 useThemeStore() 를 selector 없이 불러 이 파일의 themeStore 목과 어긋난다.
jest.mock('@/components/ui', () => {
  const { Text: RNText, Pressable: RNPressable } = jest.requireActual('react-native');
  return {
    ActionSheet: ({
      visible,
      options,
      onSelect,
      onClose,
    }: {
      visible: boolean;
      options: { label: string; value: string }[];
      onSelect: (value: string) => void;
      onClose: () => void;
    }) =>
      visible
        ? options.map((option) => (
            <RNPressable
              key={option.value}
              testID={`sheet-option-${option.value}`}
              // 실제 ActionSheet 와 같은 순서 — 선택 후 닫는다.
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
            >
              <RNText>{option.label}</RNText>
            </RNPressable>
          ))
        : null,
  };
});

// rightAction 을 실제로 렌더한다 — null 목이면 헤더 공유·⋯ 진입점 검증이 무효가 된다.
jest.mock('@/components/headers', () => ({
  StackHeader: ({ rightAction }: { rightAction?: React.ReactNode }) => rightAction ?? null,
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
  EllipsisHorizontalIcon: () => null,
  EyeIcon: () => null,
  MapPinIcon: () => null,
  ShareIcon: () => null,
  TrashIcon: () => null,
  UserPlusIcon: () => null,
  UsersIcon: () => null,
  XCircleIcon: () => null,
}));

jest.mock('@/components/jobs', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    // 펼침 여부를 관찰하려면 이 둘이 실제로 무언가를 렌더해야 한다.
    PostingScheduleContent: () => <RNText testID="schedule-content">일정</RNText>,
    PostingCompensationContent: () => <RNText testID="compensation-content">급여</RNText>,
    PostingStatusBadge: () => null,
    PostingSurfaceState: () => null,
    PostingTypeBadge: () => null,
    ResubmitButton: () => null,
    TournamentStatusBadge: () => null,
    // 좌석 표기 계약은 seatAxis.test.tsx 가 검증한다 — 여기서 빠뜨리면 화면 전체가
    // undefined 컴포넌트로 죽는다(목에 없는 컴포넌트를 화면이 쓰면 displayName 에러).
    SeatFillSummary: () => null,
  };
});

jest.mock('@/domains/job-posting', () => ({
  // 배럴 전체를 깔고 필요한 것만 덮는다 — 개별 나열이면 새 export 가 늘 때마다
  // 화면이 "is not a function" 으로 죽는다(실제로 두 번 겪었다).
  ...jest.requireActual('@/domains/job-posting'),
  buildPostingFacts: (p: unknown) => p,
  isPostingDeletable: () => true,
  projectPostingSurface: () => ({
    filledPositions: 0,
    totalPositions: 5,
    totalApplicants: 0,
    confirmedApplicants: 0,
    pendingApplicants: 0,
    locationLabel: '서울 강남구',
    allowanceLabels: [],
    questions: [],
  }),
}));

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

// 실제 훅은 QueryClientProvider 를 요구한다. 이 파일은 정산 대기 건수를 검증하지 않는다.
jest.mock('@/hooks/useSettlement', () => ({
  useWorkLogsByJobPosting: () => ({ data: [] }),
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({ shareJob: mockShareJob, isSharing: false }),
}));

jest.mock('@/hooks/useJobManagement', () => ({
  useDeleteJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
  // 상태 전이 계약은 statusTransition.test.tsx 가 검증한다 — 여기서 빠뜨리면
  // 화면이 마운트조차 못 한다("useCloseJobPosting is not a function").
  useCloseJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
  useReopenJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
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

const emptyStaff = {
  staff: [],
  grouped: [],
  stats: { total: 0, checkedIn: 0, completed: 0, noShow: 0 },
  isLoading: false,
  error: null,
  refresh: jest.fn(),
  isRefreshing: false,
};

describe('JobPostingDetailScreen — 허브 신호', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockShareJob.mockReset();
    mockApplicantStats.mockReturnValue({
      total: 0,
      confirmed: 0,
      applied: 0,
      cancellationPending: 0,
    });
    mockConfirmedStaff.mockReturnValue(emptyStaff);
  });

  it('근무 정보는 기본 펼침이다 — 진입하자마자 일정·급여가 보인다', () => {
    const { getByTestId, getByText } = render(<JobPostingDetailScreen />);

    expect(getByTestId('schedule-content')).toBeTruthy();
    expect(getByTestId('compensation-content')).toBeTruthy();
    // 펼쳐진 상태이므로 토글 라벨은 "접기"
    expect(getByText('접기')).toBeTruthy();
  });

  it('지원자 0명이면 공유 CTA 를 준다', () => {
    const { getByTestId, getByText } = render(<JobPostingDetailScreen />);

    expect(getByText('아직 지원자가 없어요')).toBeTruthy();
    expect(getByTestId('job-posting-empty-share')).toBeTruthy();
  });

  it('지원자가 있으면 빈 상태 CTA 를 띄우지 않는다', () => {
    mockApplicantStats.mockReturnValue({
      total: 3,
      confirmed: 1,
      applied: 2,
      cancellationPending: 0,
    });

    const { queryByTestId } = render(<JobPostingDetailScreen />);

    expect(queryByTestId('job-posting-empty-share')).toBeNull();
  });

  it('오늘 근무가 있으면 당일 운영 요약(출근/노쇼)이 허브에 뜬다', () => {
    mockConfirmedStaff.mockReturnValue({
      ...emptyStaff,
      grouped: [
        {
          date: '2026-08-13',
          formattedDate: '8월 13일',
          isToday: true,
          isPast: false,
          staff: [{ checkInTime: '2026-08-13T09:00:00Z' }, {}],
          stats: { total: 2, checkedIn: 1, completed: 0, noShow: 1 },
        },
      ],
    });

    const { getByText } = render(<JobPostingDetailScreen />);

    expect(getByText('출근 1/2')).toBeTruthy();
    expect(getByText('노쇼 1')).toBeTruthy();
  });

  it('오늘 근무가 없으면 당일 운영 요약을 렌더하지 않는다', () => {
    const { queryByText } = render(<JobPostingDetailScreen />);

    expect(queryByText('오늘')).toBeNull();
  });

  describe('헤더 공유 · ⋯ 시트', () => {
    it('눈 아이콘은 없다 — 구직자 화면 보기는 공유 시트 안에 있다', () => {
      const { getByTestId, queryByTestId } = render(<JobPostingDetailScreen />);

      expect(queryByTestId('job-posting-preview')).toBeNull();
      // 시트는 닫혀 있다 — 누르기 전에는 옵션이 없다.
      expect(queryByTestId('sheet-option-preview')).toBeNull();

      fireEvent.press(getByTestId('job-posting-share'));
      fireEvent.press(getByTestId('sheet-option-preview'));

      expect(mockPush).toHaveBeenCalledWith('/(app)/jobs/posting-1');
    });

    it('공유 시트에서 지원 QR 로 간다', () => {
      const { getByTestId } = render(<JobPostingDetailScreen />);

      fireEvent.press(getByTestId('job-posting-share'));
      fireEvent.press(getByTestId('sheet-option-apply-qr'));

      expect(mockPush).toHaveBeenCalledWith('/(employer)/my-postings/posting-1/apply-qr');
    });

    // 🔑 시트(RN Modal)가 내려가는 도중에 OS 공유창을 띄우면 iOS 가 표시를 무시할 수 있다.
    //    선택 즉시 부르면 이 계약이 깨진다 — 시트 퇴장 뒤에 연다.
    it('링크 공유는 시트가 내려간 뒤에 OS 공유창을 연다', () => {
      jest.useFakeTimers();
      try {
        const { getByTestId } = render(<JobPostingDetailScreen />);

        fireEvent.press(getByTestId('job-posting-share'));
        fireEvent.press(getByTestId('sheet-option-share-link'));
        expect(mockShareJob).not.toHaveBeenCalled();

        jest.runOnlyPendingTimers();
        expect(mockShareJob).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('⋯ 시트에서 함께 관리할 사람으로 간다', () => {
      const { getByTestId } = render(<JobPostingDetailScreen />);

      fireEvent.press(getByTestId('job-posting-more'));
      fireEvent.press(getByTestId('sheet-option-collaborators'));

      expect(mockPush).toHaveBeenCalledWith('/(employer)/my-postings/posting-1/collaborators');
    });
  });
});
