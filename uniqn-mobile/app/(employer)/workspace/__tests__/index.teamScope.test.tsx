/**
 * 팀 화면 — 팀의 범위 안내 한 줄 (구인자 IA S5)
 *
 * 팀원은 "이 팀의 모든 공고" 를, 협업자는 "공고 하나" 를 함께 본다.
 * 사장이 둘을 헷갈려 잘못 초대하지 않도록 팀 화면 상단에 범위를 한 줄로 적는다.
 * 대조군(팀 이름)을 함께 단언해 "아무것도 안 그려서 통과" 를 배제한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import WorkspaceSettingsScreen from '../index';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return { SafeAreaView: ReactNative.View };
});
jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/components/workspace', () => ({ WorkspaceContextBar: () => null }));
jest.mock('@/components/icons', () => ({ CalendarIcon: () => null, ChevronRightIcon: () => null }));
jest.mock('@/components/ui', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');
  return {
    Avatar: () => null,
    Badge: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.Text>{children}</ReactNative.Text>
    ),
    Button: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.Text>{children}</ReactNative.Text>
    ),
    EmptyState: () => null,
    ErrorState: () => null,
    Input: () => null,
  };
});
jest.mock('@/stores/themeStore', () => ({ useThemeStore: () => ({ isDarkMode: false }) }));
jest.mock('@/stores/toastStore', () => ({ useToastStore: () => ({ addToast: jest.fn() }) }));
jest.mock('@/stores/modalStore', () => ({ useModalStore: () => ({ showConfirm: jest.fn() }) }));
jest.mock('@/hooks/useWorkScheduleEnabled', () => ({
  useWorkScheduleEnabled: () => ({ enabled: false, isLoading: false }),
}));

let mockUid = 'owner-1';
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { uid: mockUid } }) }));

const mockMutation = { mutateAsync: jest.fn(), isPending: false };
jest.mock('@/hooks/workspace', () => ({
  useWorkspaces: () => ({ error: null }),
  useActiveWorkspace: () => ({
    activeWorkspace: { id: 'ws-1', name: '우리 홀덤펍 팀', ownerId: 'owner-1', memberCount: 2 },
    isLoading: false,
  }),
  useArchivedWorkspaces: () => ({ archived: [] }),
  useWorkspaceMembers: () => ({ members: [], isLoading: false, error: null }),
  useWorkspaceOwnerProfile: () => ({ ownerProfile: null }),
  useUpdateWorkspaceName: () => mockMutation,
  useRemoveWorkspaceMember: () => mockMutation,
  useCreateWorkspace: () => mockMutation,
  useArchiveWorkspace: () => mockMutation,
}));

describe('팀 화면 범위 안내', () => {
  beforeEach(() => {
    mockUid = 'owner-1';
  });

  it('소유자에게 팀 이름과 함께 "이 팀의 모든 공고를 함께 봅니다" 를 보여준다', () => {
    const { getByText } = render(<WorkspaceSettingsScreen />);

    expect(getByText('우리 홀덤펍 팀')).toBeTruthy();
    expect(getByText('이 팀의 모든 공고를 함께 봅니다')).toBeTruthy();
  });

  it('편집자에게도 같은 범위 안내를 보여준다', () => {
    mockUid = 'editor-1';
    const { getByText } = render(<WorkspaceSettingsScreen />);

    expect(getByText('멤버 3명 · 편집자')).toBeTruthy();
    expect(getByText('이 팀의 모든 공고를 함께 봅니다')).toBeTruthy();
  });
});
