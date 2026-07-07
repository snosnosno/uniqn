/**
 * OpsTournamentListScreen — `?postingId=` 필터 회귀 테스트 (1e Task 9).
 * postingId 파라미터가 있으면 해당 공고에 연결된 대회만 노출하고, "+ 대회" 버튼도
 * postingId 를 프리셋으로 생성 폼에 전달한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OpsTournamentListScreen from '../index';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as { postingId?: string });
const mockRefetch = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/headers', () => ({
  StackHeader: ({ rightAction }: { rightAction?: React.ReactNode }) => rightAction,
}));

const TOURNAMENTS = [
  {
    id: 't1',
    name: '대회A',
    gameType: 'NLH',
    venue: null,
    eventDate: null,
    status: 'upcoming',
    jobPostingId: 'posting-1',
  },
  {
    id: 't2',
    name: '대회B',
    gameType: 'NLH',
    venue: null,
    eventDate: null,
    status: 'active',
    jobPostingId: 'posting-2',
  },
  {
    id: 't3',
    name: '대회C',
    gameType: 'NLH',
    venue: null,
    eventDate: null,
    status: 'upcoming',
    jobPostingId: null,
  },
];

jest.mock('@/hooks/ops', () => ({
  useOpsTournaments: () => ({
    tournaments: TOURNAMENTS,
    isLoading: false,
    refetch: (...args: unknown[]) => mockRefetch(...args),
  }),
}));

describe('OpsTournamentListScreen — postingId 필터 (1e Task 9)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it('postingId 가 없으면 전체 대회를 노출하고 "+ 대회"는 프리셋 없이 이동한다', () => {
    const { getByText, queryByText } = render(<OpsTournamentListScreen />);

    expect(getByText('대회A')).toBeTruthy();
    expect(getByText('대회B')).toBeTruthy();
    expect(getByText('대회C')).toBeTruthy();
    expect(
      queryByText('이 공고에 연결된 대회가 없습니다.\n“+ 대회”로 만들어 연결해 보세요.')
    ).toBeNull();

    fireEvent.press(getByText('+ 대회'));
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/new');
  });

  it('postingId 가 있으면 해당 공고에 연결된 대회만 노출하고 "+ 대회"는 postingId 를 프리셋으로 전달한다', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-1' });

    const { getByText, queryByText } = render(<OpsTournamentListScreen />);

    expect(getByText('대회A')).toBeTruthy();
    expect(queryByText('대회B')).toBeNull();
    expect(queryByText('대회C')).toBeNull();

    fireEvent.press(getByText('+ 대회'));
    expect(mockPush).toHaveBeenCalledWith('/(ops)/tournaments/new?postingId=posting-1');
  });

  it('postingId 필터 결과가 0건이면 연결 안내 문구를 노출한다', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-no-match' });

    const { getByText, queryByText } = render(<OpsTournamentListScreen />);

    expect(
      getByText('이 공고에 연결된 대회가 없습니다.\n“+ 대회”로 만들어 연결해 보세요.')
    ).toBeTruthy();
    expect(queryByText('대회A')).toBeNull();
  });
});
