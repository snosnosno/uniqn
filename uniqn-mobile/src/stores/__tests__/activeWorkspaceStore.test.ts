/**
 * UNIQN Mobile - Active Workspace Store Tests
 *
 * @description 다중 워크스페이스 — 현재 활성 워크스페이스 ID 추적
 */

import { act } from '@testing-library/react-native';
import { useActiveWorkspaceStore } from '../activeWorkspaceStore';

function resetStore() {
  act(() => {
    useActiveWorkspaceStore.setState({ activeWorkspaceId: null });
  });
}

describe('activeWorkspaceStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('초기 상태는 null', () => {
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBeNull();
  });

  it('setActiveWorkspaceId 로 활성 ID 설정', () => {
    act(() => {
      useActiveWorkspaceStore.getState().setActiveWorkspaceId('ws-1');
    });
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBe('ws-1');
  });

  it('setActiveWorkspaceId(null) 로 초기화', () => {
    act(() => {
      useActiveWorkspaceStore.getState().setActiveWorkspaceId('ws-1');
      useActiveWorkspaceStore.getState().setActiveWorkspaceId(null);
    });
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBeNull();
  });

  it('clear 로 null 로 리셋', () => {
    act(() => {
      useActiveWorkspaceStore.getState().setActiveWorkspaceId('ws-1');
      useActiveWorkspaceStore.getState().clear();
    });
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBeNull();
  });
});
