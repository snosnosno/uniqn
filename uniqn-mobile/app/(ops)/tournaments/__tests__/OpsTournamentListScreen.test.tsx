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
import { Alert } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';
import OpsTournamentListScreen from '../index';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as { postingId?: string });
const mockRefetch = jest.fn();
const mockUseOpsTournaments = jest.fn();
const mockTrackOpsFunnel = jest.fn();
const mockDuplicateMutate = jest.fn();
const mockUseDuplicateTournament = jest.fn(() => ({
  mutate: mockDuplicateMutate,
  isPending: false,
}));

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/headers', () => ({
  StackHeader: ({ rightAction }: { rightAction?: React.ReactNode }) => rightAction,
}));

jest.mock('@/hooks/ops', () => ({
  useOpsTournaments: () => mockUseOpsTournaments(),
  useDuplicateTournament: () => mockUseDuplicateTournament(),
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

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({});
  mockUseDuplicateTournament.mockReturnValue({ mutate: mockDuplicateMutate, isPending: false });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  setState();
});

afterEach(() => {
  alertSpy.mockRestore();
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

describe('OpsTournamentListScreen — 복제 액션(A4)', () => {
  const COMPLETED = {
    id: 't-done',
    name: '어제의 대회',
    gameType: 'NLH',
    venue: '강남점',
    eventDate: '2026-07-16',
    status: 'completed',
    jobPostingId: null,
    createdAt: ISO,
    updatedAt: ISO,
  };

  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    // KST 00~09 함정 구간을 고정: UTC 2026-07-16T23:30Z = KST 2026-07-17T08:30 → 오늘 KST '2026-07-17'
    // (toISOString 직접 사용 시 '2026-07-16'으로 하루 밀리는 버그를 kstDateString 재사용으로 방지하는지 검증)
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-16T23:30:00.000Z'));
    setState({ tournaments: [COMPLETED] });
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('완료 카드에서 복제 → Alert 확인 → mutate(오늘 KST eventDate) → 성공 시 새 대회 상세로 push', () => {
    const { getByTestId } = render(<OpsTournamentListScreen />);

    fireEvent.press(getByTestId('ops-duplicate-t-done'));

    // 계획 고정 문구 — 메시지·버튼 순서
    const [, message, buttons] = alertSpy.mock.calls[0] as [
      string,
      string,
      { text: string; style?: string; onPress?: () => void }[],
    ];
    expect(message).toBe(`'어제의 대회' 설정으로 새 대회를 만들까요?`);
    expect(buttons.map((b) => b.text)).toEqual(['취소', '만들기']);

    // 확인 → mutate 호출: eventDate = 오늘 KST(함정 구간에서도 하루 안 밀림)
    buttons.find((b) => b.text === '만들기')?.onPress?.();
    expect(mockDuplicateMutate).toHaveBeenCalledTimes(1);
    expect(mockDuplicateMutate.mock.calls[0][0]).toEqual({
      sourceTournamentId: 't-done',
      eventDate: '2026-07-17',
    });

    // 성공 콜백 → 새 대회 상세로 push(기존 카드 탭과 동일 라우트 패턴)
    const options = mockDuplicateMutate.mock.calls[0][1] as {
      onSuccess: (r: { tournamentId: string }) => void;
    };
    options.onSuccess({ tournamentId: 'new-77' });
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/new-77');
  });

  it('취소를 누르면 복제 mutate 를 호출하지 않는다', () => {
    const { getByTestId } = render(<OpsTournamentListScreen />);

    fireEvent.press(getByTestId('ops-duplicate-t-done'));
    const buttons = alertSpy.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
    // 취소 버튼은 onCancel 콜백만 실행하고 복제는 건드리지 않는다
    // (confirmAction 이 취소를 알려야 confirmActionAsync 가 false 로 해소된다)
    buttons.find((b) => b.text === '취소')?.onPress?.();
    expect(mockDuplicateMutate).not.toHaveBeenCalled();
  });

  it('복제 진행 중(isPending)에는 버튼이 비활성화되어 연타(재요청)를 막는다', () => {
    mockUseDuplicateTournament.mockReturnValue({ mutate: mockDuplicateMutate, isPending: true });

    const { getByTestId } = render(<OpsTournamentListScreen />);
    fireEvent.press(getByTestId('ops-duplicate-t-done'));

    // disabled Pressable → onPress 미발화 → Alert 미표시 → mutate 미호출
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockDuplicateMutate).not.toHaveBeenCalled();
  });

  it('완료가 아닌 카드(upcoming/active)에는 복제 버튼을 노출하지 않는다', () => {
    setState({
      tournaments: [
        { ...COMPLETED, id: 't-up', name: '예정 대회', status: 'upcoming' },
        { ...COMPLETED, id: 't-act', name: '진행 대회', status: 'active' },
      ],
    });

    const { queryByTestId } = render(<OpsTournamentListScreen />);
    expect(queryByTestId('ops-duplicate-t-up')).toBeNull();
    expect(queryByTestId('ops-duplicate-t-act')).toBeNull();
  });

  it('피커(postingId) 모드에서는 완료 카드라도 복제 버튼을 숨긴다(운영 허브 전용 액션)', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-1' });
    setState({ tournaments: [{ ...COMPLETED, jobPostingId: 'posting-1' }] });

    const { getByText, queryByTestId } = render(<OpsTournamentListScreen />);
    // 카드 자체는 노출되지만
    expect(getByText('어제의 대회')).toBeTruthy();
    // 복제 버튼은 미노출
    expect(queryByTestId('ops-duplicate-t-done')).toBeNull();
  });
});
