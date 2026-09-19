/**
 * 협업자 화면 — 공고 하나 범위 안내 + 팀 화면 링크 (구인자 IA S5)
 *
 * - 범위 한 줄은 이 화면을 여는 모두(사장·협업자 본인)에게 보인다.
 * - `팀 보기` 는 사장에게만 — 협업자 본인이 누르면 이 공고와 무관한 자기 팀 화면으로 간다.
 * 대조군(공고 제목)을 함께 단언해 "아무것도 안 그려서 통과" 를 배제한다.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import CollaboratorsRoute from '../collaborators';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'jp-1' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return { SafeAreaView: ReactNative.View };
});
jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/components/job-posting/CollaboratorList', () => ({ CollaboratorList: () => null }));
jest.mock('@/components/job-posting/CollaboratorSearch', () => ({
  CollaboratorSearch: () => null,
}));
jest.mock('@/components/ui', () => ({ ErrorState: () => null }));

let mockUid = 'owner-1';
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { uid: mockUid } }) }));
jest.mock('../_layout', () => ({
  useJobDetailContext: () => ({
    job: { id: 'jp-1', title: '금요일 딜러 모집', ownerId: 'owner-1' },
  }),
}));
jest.mock('@/hooks/job-posting/useJobPostingCollaborators', () => ({
  useJobPostingCollaborators: () => ({
    collaborators: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    add: jest.fn(),
    isAdding: false,
    remove: jest.fn(),
    isRemoving: false,
    leaveSelf: jest.fn(),
    changeRole: jest.fn(),
    isChangingRole: false,
  }),
}));

describe('협업자 화면 범위 안내', () => {
  beforeEach(() => {
    mockUid = 'owner-1';
    jest.clearAllMocks();
  });

  it('사장에게 "이 공고 하나만 함께 봅니다" 와 팀 화면 링크를 보여준다', () => {
    const { getByText, getByTestId } = render(<CollaboratorsRoute />);

    expect(getByText('금요일 딜러 모집')).toBeTruthy();
    expect(getByText('이 공고 하나만 함께 봅니다')).toBeTruthy();
    expect(getByTestId('collaborators-team-link')).toBeTruthy();
  });

  it('팀 보기를 누르면 팀 화면으로 간다', () => {
    const { getByTestId } = render(<CollaboratorsRoute />);

    fireEvent.press(getByTestId('collaborators-team-link'));

    expect(router.push).toHaveBeenCalledWith('/(employer)/workspace');
  });

  it('협업자 본인에게는 범위 안내만 보이고 팀 링크는 없다', () => {
    mockUid = 'collaborator-1';
    const { getByText, queryByTestId } = render(<CollaboratorsRoute />);

    expect(getByText('이 공고 하나만 함께 봅니다')).toBeTruthy();
    expect(queryByTestId('collaborators-team-link')).toBeNull();
  });
});
