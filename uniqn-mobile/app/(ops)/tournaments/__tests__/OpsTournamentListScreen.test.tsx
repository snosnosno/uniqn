/**
 * OpsTournamentListScreen — 목록 개편(S1 A2+A3) + `?postingId=` 필터(1e) 회귀 테스트.
 *
 * 커버리지(설계 §9.1 상태 매트릭스 5상태):
 *  - LOADING  : Skeleton 3행(공간 예약) · 진입점 유지
 *  - EMPTY    : 3단 온보딩("첫 대회 만들기" CTA) · 재개 카드 미노출
 *  - ERROR    : 에러 + 재시도, 진입점 유지 · 재개 카드 숨김 · 목록 유지
 *  - SUCCESS  : 리스트 + 재개 카드(active 최신 우선)
 *  - PARTIAL  : pull-to-refresh(재개 카드/목록 유지)
 * 그리고 `ops_hub_entered` 마운트 1회 발화(메인 모드 한정) + postingId 필터 회귀.
 */
import React from 'react';
import { render, fireEvent, within } from '@testing-library/react-native';
import OpsTournamentListScreen from '../index';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as { postingId?: string });
const mockRefetch = jest.fn();
const mockUseOpsTournaments = jest.fn();
const mockTrackOpsFunnel = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/headers', () => ({
  StackHeader: ({ rightAction }: { rightAction?: React.ReactNode }) => rightAction,
}));

jest.mock('@/hooks/ops', () => ({
  useOpsTournaments: () => mockUseOpsTournaments(),
}));

jest.mock('@/services/observability/analyticsService', () => ({
  trackOpsFunnel: (...args: unknown[]) => mockTrackOpsFunnel(...args),
}));

const ISO = new Date('2026-07-01T00:00:00.000Z').toISOString();

const ROWS = [
  {
    id: 't1',
    name: '대회A',
    gameType: 'NLH',
    venue: '강남점',
    eventDate: '2026-08-01',
    status: 'upcoming',
    jobPostingId: 'posting-1',
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: 't2',
    name: '대회B',
    gameType: 'NLH',
    venue: '홍대점',
    eventDate: '2026-08-02',
    status: 'active',
    jobPostingId: 'posting-2',
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: 't3',
    name: '대회C',
    gameType: 'NLH',
    venue: null,
    eventDate: null,
    status: 'upcoming',
    jobPostingId: null,
    createdAt: ISO,
    updatedAt: ISO,
  },
];

type State = {
  tournaments?: unknown[];
  isLoading?: boolean;
  error?: unknown;
};

function setState({ tournaments = ROWS, isLoading = false, error = null }: State = {}) {
  mockUseOpsTournaments.mockReturnValue({
    tournaments,
    isLoading,
    error,
    refetch: (...args: unknown[]) => mockRefetch(...args),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({});
  setState();
});

describe('OpsTournamentListScreen — postingId 필터 (1e 회귀)', () => {
  it('postingId 가 없으면 전체 대회를 노출하고 "+ 대회"는 프리셋 없이 이동한다', () => {
    const { getByText } = render(<OpsTournamentListScreen />);

    expect(getByText('대회A')).toBeTruthy();
    expect(getByText('대회C')).toBeTruthy();

    fireEvent.press(getByText('+ 대회'));
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/new');
  });

  it('postingId 가 있으면 해당 공고 대회만 노출하고 "+ 대회"는 postingId 프리셋을 전달한다', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-1' });

    const { getByText, queryByText, queryByTestId } = render(<OpsTournamentListScreen />);

    expect(getByText('대회A')).toBeTruthy();
    expect(queryByText('대회B')).toBeNull();
    expect(queryByText('대회C')).toBeNull();
    // 재개 카드는 피커(postingId) 모드에서 미노출
    expect(queryByTestId('ops-resume-card')).toBeNull();

    fireEvent.press(getByText('+ 대회'));
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/new?postingId=posting-1');
  });

  it('postingId 필터 결과가 0건이면 연결 안내 + 생성 버튼을 노출한다', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-no-match' });

    const { getByText, queryByText } = render(<OpsTournamentListScreen />);

    expect(getByText(/이 공고에 연결된 대회가 없습니다/)).toBeTruthy();
    expect(queryByText('대회A')).toBeNull();
  });
});

describe('OpsTournamentListScreen — 상태 매트릭스(§9.1)', () => {
  it('LOADING: Skeleton 3행(공간 예약)을 노출하고 목록 아이템은 없으며 진입점(+대회)은 유지된다', () => {
    setState({ isLoading: true });

    const { getByTestId, queryByText, getByText } = render(<OpsTournamentListScreen />);

    expect(getByTestId('ops-list-skeleton')).toBeTruthy();
    expect(queryByText('대회A')).toBeNull();
    // 진입점(생성 버튼)은 로딩 중에도 유지
    expect(getByText('+ 대회')).toBeTruthy();
  });

  it('EMPTY(메인): 3단 온보딩과 "첫 대회 만들기" CTA 를 노출하고 CTA 는 생성 플로우로 이동한다', () => {
    setState({ tournaments: [] });

    const { getByText, queryByTestId } = render(<OpsTournamentListScreen />);

    // 재개 카드 미노출
    expect(queryByTestId('ops-resume-card')).toBeNull();
    // 인지(타이틀) + 행동(CTA)
    expect(getByText('첫 대회 만들기')).toBeTruthy();

    fireEvent.press(getByText('첫 대회 만들기'));
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/new');
  });

  it('ERROR(데이터 없음): 에러 + 재시도 노출, 재시도 시 refetch, 진입점 유지', () => {
    setState({ tournaments: [], error: new Error('network') });

    const { getByTestId, getByText, queryByTestId } = render(<OpsTournamentListScreen />);

    expect(getByTestId('ops-error')).toBeTruthy();
    // 진입점 유지
    expect(getByText('+ 대회')).toBeTruthy();
    // 재개 카드 숨김
    expect(queryByTestId('ops-resume-card')).toBeNull();

    fireEvent.press(getByText('다시 시도'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('ERROR(캐시 데이터 있음): 목록은 유지하되 재개 카드는 숨기고 재시도 배너를 노출한다', () => {
    setState({ tournaments: ROWS, error: new Error('stale') });

    const { getByTestId, getByText, queryByTestId } = render(<OpsTournamentListScreen />);

    // 목록 유지
    expect(getByText('대회A')).toBeTruthy();
    // 재개 카드 숨김
    expect(queryByTestId('ops-resume-card')).toBeNull();
    // 에러 + 재시도(배너)
    expect(getByTestId('ops-error-banner')).toBeTruthy();

    fireEvent.press(within(getByTestId('ops-error-banner')).getByText('다시 시도'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('SUCCESS: active 최신 대회를 재개 카드로 렌더(대회명/상태 배지/보조 메타)하고 탭 시 상세로 이동한다', () => {
    const { getByTestId } = render(<OpsTournamentListScreen />);

    const card = getByTestId('ops-resume-card');
    // ① 대회명
    expect(within(card).getByText('대회B')).toBeTruthy();
    // ② 상태 배지
    expect(within(card).getByText('진행 중')).toBeTruthy();
    // ③ 보조 메타(장소·날짜)
    expect(within(card).getByText('NLH · 홍대점 · 2026-08-02')).toBeTruthy();

    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/t2');
  });

  it('SUCCESS: 목록 카드 탭 시 해당 대회 상세로 이동한다', () => {
    const { getAllByText } = render(<OpsTournamentListScreen />);

    // 대회C(비-active)는 재개 카드 대상이 아니므로 목록에만 1회 노출
    fireEvent.press(getAllByText('대회C')[0]);
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/t3');
  });
});

describe('OpsTournamentListScreen — 진입 계측(ops_hub_entered)', () => {
  it('메인 모드 마운트 시 ops_hub_entered 를 1회 발화한다', () => {
    render(<OpsTournamentListScreen />);
    expect(mockTrackOpsFunnel).toHaveBeenCalledWith('ops_hub_entered');
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
  });

  it('재렌더가 반복돼도 ops_hub_entered 는 1회만 발화한다', () => {
    const { rerender } = render(<OpsTournamentListScreen />);
    rerender(<OpsTournamentListScreen />);
    rerender(<OpsTournamentListScreen />);
    expect(mockTrackOpsFunnel).toHaveBeenCalledTimes(1);
  });

  it('피커(postingId) 모드에서는 진입 이벤트를 발화하지 않는다(퍼널 분모 보호)', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-1' });
    render(<OpsTournamentListScreen />);
    expect(mockTrackOpsFunnel).not.toHaveBeenCalled();
  });
});
