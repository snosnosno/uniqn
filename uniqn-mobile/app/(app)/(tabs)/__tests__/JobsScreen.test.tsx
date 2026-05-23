import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import JobsScreen from '../home-jobs';

const mockPostingTypeChips = jest.fn();
const mockUsePostingTypeCounts = jest.fn();
const mockJobList = jest.fn(
  ({
    jobs,
  }: {
    jobs: {
      id: string;
      title: string;
    }[];
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return (
      <ReactNative.View>
        {jobs.map((job) => (
          <ReactNative.Text key={job.id}>{job.title}</ReactNative.Text>
        ))}
      </ReactNative.View>
    );
  }
);

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ isEmployer: false }),
}));

jest.mock('@/hooks/useTutorial', () => ({
  useTutorial: () => ({
    needsTutorial: false,
    completeTutorial: jest.fn(),
    isLoading: false,
    timeoutMs: 0,
  }),
}));

jest.mock('@/hooks/usePostingTypeCounts', () => ({
  usePostingTypeCounts: () => mockUsePostingTypeCounts(),
}));

jest.mock('@/hooks/useJobPostings', () => ({
  useJobPostings: () => ({
    jobs: [],
    isLoading: false,
    isRefreshing: false,
    isFetchingMore: false,
    hasMore: false,
    error: null,
    refresh: jest.fn(),
    loadMore: jest.fn(),
  }),
}));

jest.mock('@/components/jobs', () => ({
  SearchBar: ({
    value,
    onChangeText,
  }: {
    value: string;
    onChangeText: (value: string) => void;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return (
      <ReactNative.TextInput testID="search-input" value={value} onChangeText={onChangeText} />
    );
  },
  PostingTypeChips: ({
    counts,
    selected,
    onChange,
  }: {
    counts?: Partial<Record<'urgent' | 'regular' | 'tournament', number>>;
    selected: 'urgent' | 'regular' | 'tournament' | null;
    onChange: (value: 'urgent' | 'regular' | 'tournament' | null) => void;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    mockPostingTypeChips({ counts, selected });
    return (
      <ReactNative.View>
        <ReactNative.Pressable onPress={() => onChange('urgent')}>
          <ReactNative.Text>urgent</ReactNative.Text>
        </ReactNative.Pressable>
        <ReactNative.Pressable onPress={() => onChange('regular')}>
          <ReactNative.Text>regular</ReactNative.Text>
        </ReactNative.Pressable>
      </ReactNative.View>
    );
  },
  DateCalendar: ({
    onDateSelect,
  }: {
    selectedDate: Date | null;
    onDateSelect: (date: Date | null) => void;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return (
      <ReactNative.View testID="date-calendar">
        <ReactNative.Pressable
          testID="date-select"
          onPress={() => onDateSelect(new Date('2026-04-02T00:00:00.000Z'))}
        >
          <ReactNative.Text>date</ReactNative.Text>
        </ReactNative.Pressable>
      </ReactNative.View>
    );
  },
  JobList: (props: { jobs: { id: string; title: string }[] }) => mockJobList(props),
}));

jest.mock('@/components/headers', () => ({
  TabHeader: ({ title }: { title: string }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return <ReactNative.Text>{title}</ReactNative.Text>;
  },
}));

jest.mock('@/components/tutorial', () => ({
  TutorialOverlay: () => null,
}));

describe('JobsScreen search filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockJobList.mockClear();
    mockPostingTypeChips.mockClear();
    mockUsePostingTypeCounts.mockReturnValue({
      counts: {
        urgent: 12,
        tournament: 0,
        regular: 27,
      },
      hasCounts: true,
      firstAvailableType: 'urgent',
      isLoading: false,
    });

    (useQuery as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'urgent-job',
          title: 'urgent job',
          postingType: 'urgent',
          workDate: '2026-04-01',
        },
        {
          id: 'grouped-regular-job',
          title: 'grouped regular job',
          postingType: 'regular',
          workDate: '2026-04-01',
          dateRequirements: [
            { date: '2026-04-01', timeSlots: [{ startTime: '10:00', roles: [] }] },
            { date: '2026-04-02', timeSlots: [{ startTime: '09:00', roles: [] }] },
          ],
          workflow: { isFixed: false, usesGroupedDateRanges: true },
          scheduleDisplay: {
            variant: 'grouped_dates',
            workDate: '2026-04-01',
            timeSlot: '10:00',
            fixed: undefined,
            dateRequirements: [
              { date: '2026-04-01', timeSlots: [{ startTime: '10:00', roles: [] }] },
              { date: '2026-04-02', timeSlots: [{ startTime: '09:00', roles: [] }] },
            ],
            dateGroups: [
              {
                id: 'group-a',
                startDate: '2026-04-01',
                endDate: '2026-04-02',
                timeSlots: [{ startTime: '10:00', roles: [] }],
              },
            ],
          },
        },
        {
          id: 'direct-regular-job',
          title: 'direct regular job',
          postingType: 'regular',
          workDate: '2026-04-02',
          dateRequirements: [
            { date: '2026-04-02', timeSlots: [{ startTime: '12:00', roles: [] }] },
          ],
          workflow: { isFixed: false, usesGroupedDateRanges: false },
          scheduleDisplay: {
            variant: 'dated_requirements',
            workDate: '2026-04-02',
            timeSlot: '12:00',
            fixed: undefined,
            dateRequirements: [
              { date: '2026-04-02', timeSlots: [{ startTime: '12:00', roles: [] }] },
            ],
            dateGroups: [],
          },
        },
        {
          id: 'off-date-regular-job',
          title: 'off-date regular job',
          postingType: 'regular',
          workDate: '2026-04-01',
          dateRequirements: [
            { date: '2026-04-01', timeSlots: [{ startTime: '14:00', roles: [] }] },
          ],
          workflow: { isFixed: false, usesGroupedDateRanges: false },
          scheduleDisplay: {
            variant: 'dated_requirements',
            workDate: '2026-04-01',
            timeSlot: '14:00',
            fixed: undefined,
            dateRequirements: [
              { date: '2026-04-01', timeSlots: [{ startTime: '14:00', roles: [] }] },
            ],
            dateGroups: [],
          },
        },
      ],
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('applies type and focused-date filters to grouped search results without reordering', async () => {
    const { getByTestId, getByText, queryByText } = render(<JobsScreen />);

    fireEvent.changeText(getByTestId('search-input'), 'job');

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(getByText('urgent job')).toBeTruthy();
    });
    expect(queryByText('grouped regular job')).toBeNull();
    expect(queryByText('direct regular job')).toBeNull();

    fireEvent.press(getByText('regular'));

    await waitFor(() => {
      expect(getByText('grouped regular job')).toBeTruthy();
    });
    expect(getByText('direct regular job')).toBeTruthy();
    expect(getByText('off-date regular job')).toBeTruthy();
    expect(queryByText('urgent job')).toBeNull();

    fireEvent.press(getByTestId('date-select'));

    await waitFor(() => {
      expect(getByText('grouped regular job')).toBeTruthy();
    });
    expect(getByText('direct regular job')).toBeTruthy();
    expect(queryByText('off-date regular job')).toBeNull();

    const latestJobs = (mockJobList.mock.calls.at(-1)?.[0]?.jobs ?? []) as {
      title: string;
      displayContext?: {
        focusedDate?: string;
        wasGroupedRange?: boolean;
      };
    }[];
    expect(latestJobs.map((job: { title: string }) => job.title)).toEqual([
      'grouped regular job',
      'direct regular job',
    ]);
    expect(latestJobs[0]?.displayContext).toEqual({
      focusedDate: '2026-04-02',
      wasGroupedRange: true,
    });

    const latestChipProps = mockPostingTypeChips.mock.calls.at(-1)?.[0];
    expect(latestChipProps?.counts).toEqual({
      urgent: 12,
      tournament: 0,
      regular: 27,
    });
  });

  it('hides chip counts while the type counts query is still loading', () => {
    mockUsePostingTypeCounts.mockReturnValue({
      counts: {
        urgent: 12,
        tournament: 0,
        regular: 27,
      },
      hasCounts: true,
      firstAvailableType: null,
      isLoading: true,
    });

    render(<JobsScreen />);

    expect(mockPostingTypeChips).toHaveBeenCalled();
    expect(mockPostingTypeChips.mock.calls.at(-1)?.[0]?.counts).toBeUndefined();
  });

  it('hides chip counts when the type counts query fails', () => {
    mockUsePostingTypeCounts.mockReturnValue({
      counts: undefined,
      hasCounts: false,
      firstAvailableType: null,
      isLoading: false,
      error: new Error('count lookup failed'),
    });

    render(<JobsScreen />);

    expect(mockPostingTypeChips).toHaveBeenCalled();
    expect(mockPostingTypeChips.mock.calls.at(-1)?.[0]?.counts).toBeUndefined();
  });

  it('일반 탭 진입 시 달력이 기본 펼침 상태로 렌더', async () => {
    const { findByTestId, getByText } = render(<JobsScreen />);

    // regular 탭을 선택하면 DateCalendar가 렌더됨
    fireEvent.press(getByText('regular'));

    expect(await findByTestId('date-calendar')).toBeTruthy();
  });
});
