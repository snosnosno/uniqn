/**
 * JobPostingDetailScreen — 상태 전이 배선 회귀 테스트 (S2-3).
 *
 * 종전에는 마감/재오픈이 **목록 화면에만** 있었고 상세의 상태 뱃지는 표시 전용이었다.
 * 상세를 보다가 마감하려면 뒤로 나갔다 들어와야 했다.
 *
 * 고정하는 계약 넷.
 *  1. 모집 중이면 상태 뱃지를 눌러 "모집 마감하기"를 고를 수 있다.
 *  2. 마감은 **가역**이라 확인 모달로 앞을 막지 않고 **되돌리기 토스트**를 뒤에 붙인다.
 *     (삭제는 되돌릴 수 없으므로 확인 모달을 유지한다 — 두 액션의 무게가 다르다.)
 *  3. 되돌리기를 누르면 재오픈이 실제로 호출된다.
 *  4. 정원 참(capacity_full)은 수동 전이를 제안하지 않고 **사유만** 말한다 —
 *     트리거가 즉시 되돌릴 전이를 제안하면 앱이 고장 난 것처럼 보인다.
 *
 * ⚠️ ActionSheet 를 null 로 목하면 1·4 가 통째로 사라진다 — options/description 을
 *    그대로 뱉는 목을 쓴다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import JobPostingDetailScreen from '../index';

const mockAddToast = jest.fn();
const mockCloseMutate = jest.fn();
const mockReopenMutate = jest.fn();
const mockStatus = jest.fn();

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
    job: {
      id: 'posting-1',
      title: '금요일 딜러 모집',
      location: { name: '서울 강남구' },
      description: '',
      status: mockStatus(),
      postingType: 'regular',
      schedule: { kind: 'dated' },
    },
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

// 옵션과 사유 문구를 그대로 노출하는 목 — null 목이면 이 파일의 계약이 통째로 사라진다.
jest.mock('@/components/ui', () => {
  const { Text: RNText, View: RNView, Pressable: RNPressable } = jest.requireActual('react-native');
  return {
    ActionSheet: ({
      visible,
      options,
      description,
      onSelect,
    }: {
      visible: boolean;
      options: { label: string; value: string }[];
      description?: string;
      onSelect: (value: string) => void;
    }) =>
      visible ? (
        <RNView testID="status-sheet">
          <RNText testID="status-sheet-description">{description ?? ''}</RNText>
          <RNText testID="status-sheet-option-count">{String(options.length)}</RNText>
          {options.map((option) => (
            <RNPressable
              key={option.value}
              testID={`status-sheet-option-${option.value}`}
              onPress={() => onSelect(option.value)}
            >
              <RNText>{option.label}</RNText>
            </RNPressable>
          ))}
        </RNView>
      ) : null,
  };
});

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

// 상태별 액션 표는 실제 규칙을 태운다 — statusActions.test.ts 와 같은 진실원.
jest.mock('@/domains/job-posting', () => {
  const actual = jest.requireActual('@/domains/job-posting');
  return {
    ...actual,
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
  };
});

jest.mock('@/hooks/applicant', () => ({
  useApplicantsByJobPosting: () => ({
    data: { stats: { total: 0, confirmed: 0, applied: 0, cancellationPending: 0 } },
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
  useWorkLogsByJobPosting: () => ({ data: [] }),
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({ shareJob: jest.fn(), isSharing: false }),
}));

jest.mock('@/hooks/useJobManagement', () => ({
  useDeleteJobPosting: () => ({ mutate: jest.fn(), isPending: false }),
  useCloseJobPosting: () => ({ mutate: mockCloseMutate, isPending: false }),
  useReopenJobPosting: () => ({ mutate: mockReopenMutate, isPending: false }),
}));

jest.mock('@/hooks/usePostingFilledCounts', () => ({
  usePostingFilledCounts: () => ({ data: undefined }),
  extractPostingFilledSubmap: () => ({}),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: unknown }) => unknown) =>
    selector({ addToast: mockAddToast }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('@/hooks/ops', () => ({
  useOpsTournamentsForPosting: () => ({ opsTournaments: [], isLoading: false }),
}));

/** mutate(id, { onSuccess, onSettled }) 를 성공 경로로 흘려보낸다. */
const succeed = (_id: string, options?: { onSuccess?: () => void; onSettled?: () => void }) => {
  options?.onSuccess?.();
  options?.onSettled?.();
};

describe('JobPostingDetailScreen — 상태 전이', () => {
  beforeEach(() => {
    mockAddToast.mockReset();
    mockCloseMutate.mockReset().mockImplementation(succeed);
    mockReopenMutate.mockReset().mockImplementation(succeed);
    mockStatus.mockReturnValue('active');
  });

  it('모집 중이면 상태 뱃지에서 "모집 마감하기"를 고를 수 있다', () => {
    const { getByTestId } = render(<JobPostingDetailScreen />);

    fireEvent.press(getByTestId('job-posting-status-badge'));

    expect(getByTestId('status-sheet-option-close')).toBeTruthy();
  });

  it('마감은 확인 모달 없이 실행되고 되돌리기 토스트를 남긴다', () => {
    const { getByTestId } = render(<JobPostingDetailScreen />);

    fireEvent.press(getByTestId('job-posting-status-badge'));
    fireEvent.press(getByTestId('status-sheet-option-close'));

    expect(mockCloseMutate).toHaveBeenCalledWith('posting-1', expect.any(Object));

    const toast = mockAddToast.mock.calls[0][0];
    expect(toast.message).toContain('마감했어요');
    expect(toast.action.label).toBe('되돌리기');
  });

  it('되돌리기를 누르면 재오픈이 실제로 호출된다', () => {
    const { getByTestId } = render(<JobPostingDetailScreen />);

    fireEvent.press(getByTestId('job-posting-status-badge'));
    fireEvent.press(getByTestId('status-sheet-option-close'));

    const toast = mockAddToast.mock.calls[0][0];
    toast.action.onPress();

    expect(mockReopenMutate).toHaveBeenCalledWith('posting-1', expect.any(Object));
  });

  it('재오픈에는 되돌리기를 달지 않는다 — 서로 되돌리는 토스트는 무한 왕복이 된다', () => {
    mockStatus.mockReturnValue('closed');

    const { getByTestId } = render(<JobPostingDetailScreen />);

    fireEvent.press(getByTestId('job-posting-status-badge'));
    fireEvent.press(getByTestId('status-sheet-option-reopen'));

    expect(mockReopenMutate).toHaveBeenCalledWith('posting-1', expect.any(Object));
    expect(mockAddToast.mock.calls[0][0].action).toBeUndefined();
  });

  it('정원 참은 수동 전이를 제안하지 않고 사유만 말한다', () => {
    mockStatus.mockReturnValue('capacity_full');

    const { getByTestId } = render(<JobPostingDetailScreen />);

    fireEvent.press(getByTestId('job-posting-status-badge'));

    expect(getByTestId('status-sheet-option-count').props.children).toBe('0');
    expect(getByTestId('status-sheet-description').props.children).toContain('정원이 차서');
  });

  it('임시저장처럼 할 말도 할 일도 없는 상태에서는 뱃지를 누를 수 없다', () => {
    mockStatus.mockReturnValue('draft');

    const { queryByTestId } = render(<JobPostingDetailScreen />);

    expect(queryByTestId('job-posting-status-badge')).toBeNull();
  });
});
