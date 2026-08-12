/**
 * JobPostingDetailScreen — 에러 가드 좁히기 회귀 테스트.
 *
 * 옛 가드는 `if (error || !posting)` 이라, 캐시된 공고를 정상 렌더하던 중 신호가 한 번
 * 튀기만 해도 화면 전체가 "공고를 불러올 수 없습니다"로 교체됐다. 사장은 공고가 삭제된 줄
 * 알고 같은 공고를 하나 더 만들고, 지원자가 두 공고로 쪼개진다.
 *
 * 여기서 고정하는 계약은 셋이다.
 *  1. 공고가 손에 있으면 error 가 있어도 본문을 지키고 얇은 배너로만 알린다.
 *  2. 공고가 없을 때만 전체 에러 화면으로 간다.
 *  3. 오프라인이면 문구가 다르고 재시도 버튼을 내지 않는다("찾을 수 없습니다"는 삭제됐다는 말).
 *
 * ⚠️ PostingSurfaceState 를 null 로 목하면 이 파일이 검증하려는 표면이 통째로 사라진다.
 *    props(mode/title/message/onRetry)를 그대로 뱉는 목을 쓴다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import JobPostingDetailScreen from '../index';

const mockJobDetail = jest.fn();
const mockNetworkStatus = jest.fn();

const mockPosting = {
  id: 'posting-1',
  title: '수요 딥스택 대회',
  location: { name: '서울 강남구' },
  description: '',
  status: 'active',
  postingType: 'regular',
  schedule: { kind: 'fixed' },
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
    job: null,
    isFixed: true,
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
  MapPinIcon: () => null,
  ShareIcon: () => null,
  TrashIcon: () => null,
  UserPlusIcon: () => null,
  UsersIcon: () => null,
  XCircleIcon: () => null,
}));

jest.mock('@/components/jobs', () => {
  const { Text: RNText, View: RNView } = jest.requireActual('react-native');
  return {
    PostingCompensationContent: () => null,
    PostingScheduleContent: () => null,
    PostingStatusBadge: () => null,
    PostingTypeBadge: () => null,
    ResubmitButton: () => null,
    TournamentStatusBadge: () => null,
    // 목이 계약을 버리지 않도록 props 를 그대로 노출한다.
    PostingSurfaceState: ({
      mode,
      title,
      message,
      onRetry,
    }: {
      mode: string;
      title?: string;
      message?: string;
      onRetry?: () => void;
    }) => (
      <RNView testID={`surface-${mode}`}>
        <RNText testID={`surface-${mode}-title`}>{title ?? ''}</RNText>
        <RNText testID={`surface-${mode}-message`}>{message ?? ''}</RNText>
        <RNText testID={`surface-${mode}-retry`}>{onRetry ? 'has-retry' : 'no-retry'}</RNText>
      </RNView>
    ),
  };
});

jest.mock('@/domains/job-posting', () => ({
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
    data: { stats: { total: 0, confirmed: 0, applied: 0, cancellationPending: 0 } },
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

jest.mock('@/hooks/useJobDetail', () => ({
  useJobDetail: () => mockJobDetail(),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockNetworkStatus(),
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

describe('JobPostingDetailScreen — 에러 가드', () => {
  beforeEach(() => {
    mockJobDetail.mockReset();
    mockNetworkStatus.mockReset();
    mockNetworkStatus.mockReturnValue({ isOnline: true });
  });

  it('공고가 손에 있으면 error 가 있어도 본문을 지키고 partial 배너만 띄운다', () => {
    mockJobDetail.mockReturnValue({
      job: mockPosting,
      isLoading: false,
      error: new Error('network hiccup'),
      refresh: jest.fn(),
    });

    const { queryByTestId, getByTestId } = render(<JobPostingDetailScreen />);

    // 전체 에러 화면으로 교체되지 않았다
    expect(queryByTestId('surface-error')).toBeNull();
    // 관리 액션은 그대로 살아 있다
    expect(getByTestId('job-posting-manage-applicants')).toBeTruthy();
    // 대신 얇은 배너로 알린다
    expect(getByTestId('surface-partial')).toBeTruthy();
  });

  it('error 가 없으면 partial 배너를 띄우지 않는다', () => {
    mockJobDetail.mockReturnValue({
      job: mockPosting,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    const { queryByTestId } = render(<JobPostingDetailScreen />);

    expect(queryByTestId('surface-partial')).toBeNull();
    expect(queryByTestId('surface-error')).toBeNull();
  });

  it('공고가 없으면 전체 에러 화면으로 가고, 원시 error.message 를 문구로 쓰지 않는다', () => {
    mockJobDetail.mockReturnValue({
      job: null,
      isLoading: false,
      error: new Error('PGRST116: relation does not exist'),
      refresh: jest.fn(),
    });

    const { getByTestId } = render(<JobPostingDetailScreen />);

    expect(getByTestId('surface-error')).toBeTruthy();
    expect(getByTestId('surface-error-title').props.children).toBe('공고를 불러올 수 없습니다');
    // message 를 넘기지 않아야 ErrorState 의 sanitize 가 작동한다
    expect(getByTestId('surface-error-message').props.children).toBe('');
    expect(getByTestId('surface-error-retry').props.children).toBe('has-retry');
  });

  it('공고도 error 도 없으면 "찾을 수 없습니다" 문구를 쓴다', () => {
    mockJobDetail.mockReturnValue({
      job: null,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    const { getByTestId } = render(<JobPostingDetailScreen />);

    expect(getByTestId('surface-error-message').props.children).toBe(
      '공고 정보를 찾을 수 없습니다.'
    );
  });

  it('오프라인이면 문구가 다르고 재시도 버튼을 내지 않는다', () => {
    mockNetworkStatus.mockReturnValue({ isOnline: false });
    mockJobDetail.mockReturnValue({
      job: null,
      isLoading: false,
      error: new Error('Network request failed'),
      refresh: jest.fn(),
    });

    const { getByTestId } = render(<JobPostingDetailScreen />);

    expect(getByTestId('surface-error-title').props.children).toBe('오프라인 상태예요');
    expect(getByTestId('surface-error-message').props.children).toBe(
      '인터넷에 연결되면 공고 정보를 다시 불러옵니다.'
    );
    // 눌러도 아무 일이 없는 버튼은 없느니만 못하다
    expect(getByTestId('surface-error-retry').props.children).toBe('no-retry');
  });
});
