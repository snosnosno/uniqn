/**
 * OpsTournamentCreateScreen — "공고 연결(선택)" 필드 + `?postingId=` 프리셋 회귀 테스트 (1e Task 9).
 * PostingPickerSheet(Task 8 산출)는 별도로 검증된 컴포넌트이므로 여기서는 가벼운 모킹으로 대체하고,
 * new.tsx 가 선택 결과를 상태로 반영하고 생성 mutate 호출에 jobPostingId 를 포함시키는지만 검증한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OpsTournamentCreateScreen from '../new';

const mockReplace = jest.fn();
const mockMutate = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as { postingId?: string });

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/headers', () => ({
  StackHeader: () => null,
}));

jest.mock('@/hooks/ops', () => ({
  useCreateOpsTournament: () => ({ mutate: mockMutate, isPending: false }),
}));

const MY_POSTINGS = [
  { id: 'posting-1', title: '수요 딥스택 공고' },
  { id: 'posting-2', title: '주말 홀덤 공고' },
];

jest.mock('@/hooks/useJobManagement', () => ({
  useMyJobPostings: () => ({ data: MY_POSTINGS }),
}));

jest.mock('@/components/ops', () => {
  const { Text, Pressable } = require('react-native');
  return {
    PostingPickerSheet: (props: any) => {
      if (!props.visible) return null;
      return (
        <Pressable accessibilityRole="button" onPress={() => props.onSelect('posting-2')}>
          <Text>공고피커열림</Text>
        </Pressable>
      );
    },
  };
});

describe('OpsTournamentCreateScreen — 공고 연결(선택) 필드 (1e Task 9)', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockMutate.mockReset();
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it('postingId 프리셋이 없으면 안내 문구가 노출되고, 피커에서 선택하면 제목이 반영된다', () => {
    const { getByTestId, getByText, queryByText } = render(<OpsTournamentCreateScreen />);

    expect(getByText('공고를 선택하세요')).toBeTruthy();

    fireEvent.press(getByTestId('ops-create-posting-select'));
    fireEvent.press(getByText('공고피커열림'));

    expect(getByText('주말 홀덤 공고')).toBeTruthy();
    expect(queryByText('공고를 선택하세요')).toBeNull();
  });

  it('`?postingId=` 프리셋이 있으면 공고 필드가 선반영된다', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-1' });

    const { getByText } = render(<OpsTournamentCreateScreen />);

    expect(getByText('수요 딥스택 공고')).toBeTruthy();
  });

  it('생성 호출에 프리셋된 jobPostingId 가 포함된다', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-1' });

    const { getByPlaceholderText, getByText } = render(<OpsTournamentCreateScreen />);

    fireEvent.changeText(getByPlaceholderText('예: 수요 딥스택'), '테스트 대회');
    fireEvent.press(getByText('대회 만들기'));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: '테스트 대회', jobPostingId: 'posting-1' }),
      expect.any(Object)
    );
  });

  it('"해제"를 누르면 공고 연결이 취소되고 생성 호출에 jobPostingId 가 없다', () => {
    mockUseLocalSearchParams.mockReturnValue({ postingId: 'posting-1' });

    const { getByTestId, getByPlaceholderText, getByText } = render(<OpsTournamentCreateScreen />);

    fireEvent.press(getByTestId('ops-create-posting-clear'));
    fireEvent.changeText(getByPlaceholderText('예: 수요 딥스택'), '테스트 대회2');
    fireEvent.press(getByText('대회 만들기'));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: '테스트 대회2', jobPostingId: undefined }),
      expect.any(Object)
    );
  });
});
