/**
 * JobPostingDetailScreen — "라이브 운영" ActionCard 라우팅 회귀 테스트 (1e Task 9).
 * 외부 URL 경로 대신 인앱 router.push 로 진입함을 검증(라우트·라벨 회귀 가드).
 * - 연결된 대회 0개: "라이브 운영 시작" → /(ops)/tournaments/new?postingId={id}
 * - 연결된 대회 N개: "라이브 운영 (N)" → /(ops)/tournaments?postingId={id}
 * 화면의 나머지 관심사(지원자/정산/취소요청 등)는 이 파일 범위 밖 — 회귀 위험이 큰
 * 라이브 운영 진입점만 최소 렌더 표면(고정 스케줄 posting)으로 좁혀 검증한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import JobPostingDetailScreen from '../index';

const mockPush = jest.fn();
const mockUseOpsTournamentsForPosting = jest.fn();

const mockPosting = {
  id: 'posting-1',
  title: '수요 딥스택 대회',
  location: { name: '서울 강남구' },
  description: '',
  status: 'active',
  postingType: 'tournament',
  tournamentConfig: { approvalStatus: 'approved', rejectionReason: null },
  schedule: { kind: 'fixed' },
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'posting-1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('../_layout', () => ({
  useJobDetailContext: () => ({ job: null, handleShowQR: jest.fn() }),
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

jest.mock('@/components/jobs', () => ({
  PostingCompensationContent: () => null,
  PostingScheduleContent: () => null,
  PostingStatusBadge: () => null,
  PostingSurfaceState: () => null,
  PostingTypeBadge: () => null,
  ResubmitButton: () => null,
  TournamentStatusBadge: () => null,
}));

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
  useJobDetail: () => ({
    job: mockPosting,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: jest.fn(),
  }),
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
  useOpsTournamentsForPosting: (...args: unknown[]) => mockUseOpsTournamentsForPosting(...args),
}));

describe('JobPostingDetailScreen — 라이브 운영 ActionCard (1e Task 9)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseOpsTournamentsForPosting.mockReset();
  });

  it('연결된 대회가 0개면 "라이브 운영 시작" 라벨로 생성 폼(postingId 프리셋)으로 이동한다', () => {
    mockUseOpsTournamentsForPosting.mockReturnValue({ opsTournaments: [], isLoading: false });

    const { getByTestId, getByText } = render(<JobPostingDetailScreen />);

    expect(getByText('라이브 운영 시작')).toBeTruthy();
    fireEvent.press(getByTestId('job-posting-live-ops'));

    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/new?postingId=posting-1');
  });

  it('연결된 대회가 N개면 "라이브 운영 (N)" 라벨로 목록(postingId 필터)으로 이동한다', () => {
    mockUseOpsTournamentsForPosting.mockReturnValue({
      opsTournaments: [
        { id: 't1', status: 'active' },
        { id: 't2', status: 'upcoming' },
      ],
      isLoading: false,
    });

    const { getByTestId, getByText } = render(<JobPostingDetailScreen />);

    expect(getByText('라이브 운영 (2)')).toBeTruthy();
    fireEvent.press(getByTestId('job-posting-live-ops'));

    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments?postingId=posting-1');
  });
});
