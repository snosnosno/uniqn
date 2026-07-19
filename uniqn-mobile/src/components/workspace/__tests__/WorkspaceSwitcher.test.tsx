import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { WorkspaceSwitcher } from '../WorkspaceSwitcher';

const mockSetActiveWorkspaceId = jest.fn();
let mockHookReturn: {
  activeWorkspace: any;
  workspaces: any[];
  isLoading: boolean;
  setActiveWorkspaceId: (id: string) => void;
};

jest.mock('@/hooks/workspace/useActiveWorkspace', () => ({
  useActiveWorkspace: () => mockHookReturn,
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: { uid: 'user-1' } };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/utils/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const W = (overrides: { id: string; name: string; ownerId: string }) => ({
  id: overrides.id,
  name: overrides.name,
  ownerId: overrides.ownerId,
  memberCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    mockSetActiveWorkspaceId.mockClear();
  });

  it('워크스페이스가 0개면 아무것도 렌더하지 않는다', () => {
    mockHookReturn = {
      activeWorkspace: undefined,
      workspaces: [],
      isLoading: false,
      setActiveWorkspaceId: mockSetActiveWorkspaceId,
    };
    const { toJSON } = render(<WorkspaceSwitcher />);
    expect(toJSON()).toBeNull();
  });

  it('워크스페이스가 1개면 텍스트만 표시 (BottomSheet 미노출)', () => {
    const ws = W({ id: 'ws-1', name: '내 워크스페이스', ownerId: 'user-1' });
    mockHookReturn = {
      activeWorkspace: ws,
      workspaces: [ws],
      isLoading: false,
      setActiveWorkspaceId: mockSetActiveWorkspaceId,
    };
    const { getByText, queryByLabelText } = render(<WorkspaceSwitcher />);
    expect(getByText('내 워크스페이스')).toBeTruthy();
    expect(queryByLabelText(/변경하려면 탭/)).toBeNull();
  });

  it('워크스페이스가 2개+이면 transfer 버튼 노출', () => {
    const owned = W({ id: 'ws-1', name: '내 룸', ownerId: 'user-1' });
    const shared = W({ id: 'ws-2', name: '공동 룸', ownerId: 'other' });
    mockHookReturn = {
      activeWorkspace: owned,
      workspaces: [owned, shared],
      isLoading: false,
      setActiveWorkspaceId: mockSetActiveWorkspaceId,
    };
    const { getByLabelText } = render(<WorkspaceSwitcher />);
    expect(getByLabelText(/현재 팀 내 룸, 변경하려면 탭/)).toBeTruthy();
  });

  it('다른 워크스페이스 선택 시 setActiveWorkspaceId + onChange 콜백 호출', () => {
    const owned = W({ id: 'ws-1', name: '내 룸', ownerId: 'user-1' });
    const shared = W({ id: 'ws-2', name: '공동 룸', ownerId: 'other' });
    mockHookReturn = {
      activeWorkspace: owned,
      workspaces: [owned, shared],
      isLoading: false,
      setActiveWorkspaceId: mockSetActiveWorkspaceId,
    };
    const onChange = jest.fn();
    const { getByLabelText } = render(<WorkspaceSwitcher onChange={onChange} />);
    fireEvent.press(getByLabelText(/현재 팀 내 룸, 변경하려면 탭/));
    fireEvent.press(getByLabelText(/공동 룸 공동관리/));

    expect(mockSetActiveWorkspaceId).toHaveBeenCalledWith('ws-2');
    expect(onChange).toHaveBeenCalledWith('ws-2');
  });
});
