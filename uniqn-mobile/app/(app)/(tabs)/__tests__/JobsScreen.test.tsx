import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import JobsScreen from '../index';

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
  usePostingTypeCounts: () => ({
    firstAvailableType: 'urgent',
    isLoading: false,
  }),
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
    onChange,
  }: {
    onChange: (value: 'urgent' | 'regular' | 'tournament' | null) => void;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
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
  DateSlider: ({ onDateSelect }: { onDateSelect: (date: Date) => void }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
    return (
      <ReactNative.Pressable
        testID="date-select"
        onPress={() => onDateSelect(new Date('2026-04-01T00:00:00.000Z'))}
      >
        <ReactNative.Text>date</ReactNative.Text>
      </ReactNative.Pressable>
    );
  },
  JobList: ({
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
  },
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

    (useQuery as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'urgent-job',
          title: '긴급 공고',
          postingType: 'urgent',
          workDate: '2026-04-01',
        },
        {
          id: 'regular-job-a',
          title: '정기 공고 A',
          postingType: 'regular',
          workDate: '2026-04-01',
        },
        {
          id: 'regular-job-b',
          title: '정기 공고 B',
          postingType: 'regular',
          workDate: '2026-04-02',
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

  it('applies visible type and date filters to search results', async () => {
    const { getByTestId, getByText, queryByText } = render(<JobsScreen />);

    fireEvent.changeText(getByTestId('search-input'), '공고');

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(getByText('긴급 공고')).toBeTruthy();
    });
    expect(queryByText('정기 공고 A')).toBeNull();
    expect(queryByText('정기 공고 B')).toBeNull();

    fireEvent.press(getByText('regular'));

    await waitFor(() => {
      expect(getByText('정기 공고 A')).toBeTruthy();
    });
    expect(getByText('정기 공고 B')).toBeTruthy();
    expect(queryByText('긴급 공고')).toBeNull();

    fireEvent.press(getByTestId('date-select'));

    await waitFor(() => {
      expect(getByText('정기 공고 A')).toBeTruthy();
    });
    expect(queryByText('정기 공고 B')).toBeNull();
  });
});
