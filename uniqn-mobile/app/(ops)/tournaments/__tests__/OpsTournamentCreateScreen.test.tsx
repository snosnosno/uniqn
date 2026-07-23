/**
 * OpsTournamentCreateScreen — "공고 연결(선택)" 필드 + `?postingId=` 프리셋 회귀 테스트 (1e Task 9).
 * PostingPickerSheet(Task 8 산출)는 별도로 검증된 컴포넌트이므로 여기서는 가벼운 모킹으로 대체하고,
 * new.tsx 가 선택 결과를 상태로 반영하고 생성 mutate 호출에 jobPostingId 를 포함시키는지만 검증한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OpsTournamentCreateScreen from '../new';
import { DEFAULT_BLIND_LEVELS } from '@/domains/ops/defaultBlindStructure';

const mockReplace = jest.fn();
const mockMutate = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as { postingId?: string });
const mockSetLevels = jest.fn();
const mockToastError = jest.fn();

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

// B2: 대회 생성 성공 시 기본 블라인드 30레벨 시드(fire-and-forget) 검증용 모킹.
// `@/services/ops` 배럴은 `export * as`(동결 네임스페이스)라 spyOn 대신 모듈 모킹.
jest.mock('@/services/ops', () => ({
  opsBlindLevelService: {
    setLevels: (...args: unknown[]) => mockSetLevels(...args),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { uid: 'actor-1' } }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ error: (...args: unknown[]) => mockToastError(...args) }),
  },
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

describe('OpsTournamentCreateScreen — 기본 블라인드 30레벨 시드 (B2)', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockMutate.mockReset();
    mockSetLevels.mockReset();
    mockToastError.mockReset();
    mockUseLocalSearchParams.mockReturnValue({});
    // 생성 성공을 즉시 재생: onSuccess 콜백을 곧바로 호출한다.
    mockMutate.mockImplementation(
      (_input: unknown, opts: { onSuccess: (r: { tournamentId: string }) => void }) =>
        opts.onSuccess({ tournamentId: 't-new' })
    );
    mockSetLevels.mockResolvedValue({ count: DEFAULT_BLIND_LEVELS.length, reanchored: false });
  });

  it('대회 생성 성공 시 기본 30레벨을 시드한다', async () => {
    const { getByPlaceholderText, getByText } = render(<OpsTournamentCreateScreen />);

    fireEvent.changeText(getByPlaceholderText('예: 수요 딥스택'), '수요일 딥스택 야간');
    fireEvent.press(getByText('대회 만들기'));

    expect(mockSetLevels).toHaveBeenCalledWith('t-new', expect.any(String), DEFAULT_BLIND_LEVELS);
  });

  it('시드 실패해도 상세 화면으로 즉시 이동한다(fire-and-forget)', async () => {
    mockSetLevels.mockRejectedValue(new Error('시드 실패'));

    const { getByPlaceholderText, getByText } = render(<OpsTournamentCreateScreen />);

    fireEvent.changeText(getByPlaceholderText('예: 수요 딥스택'), '실패 케이스');
    fireEvent.press(getByText('대회 만들기'));

    // 내비게이션은 시드 결과를 기다리지 않고 동기적으로 실행된다.
    expect(mockReplace).toHaveBeenCalledWith('/(ops)/tournaments/t-new');
    // 실패 토스트는 마이크로태스크(catch)에서 발생 → 다음 틱에 확인.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('시드 성공 시에는 토스트를 띄우지 않는다(조용히)', async () => {
    const { getByPlaceholderText, getByText } = render(<OpsTournamentCreateScreen />);

    fireEvent.changeText(getByPlaceholderText('예: 수요 딥스택'), '성공 케이스');
    fireEvent.press(getByText('대회 만들기'));

    await Promise.resolve();
    await Promise.resolve();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(ops)/tournaments/t-new');
  });
});
