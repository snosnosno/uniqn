import React from 'react';
import { render, act } from '@testing-library/react-native';

import { WorkspaceRevocationModal } from '../WorkspaceRevocationModal';

const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();

jest.mock('@/services/auth', () => ({
  signOut: () => mockSignOut(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('WorkspaceRevocationModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSignOut.mockClear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('visible=false 면 signOut 호출 안 함', () => {
    render(<WorkspaceRevocationModal visible={false} workspaceName="포커룸 A" />);
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('visible=true 후 카운트다운 0 도달 시 signOut + login 이동', async () => {
    render(<WorkspaceRevocationModal visible workspaceName="포커룸 A" countdownSeconds={3} />);
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    // signOut 은 promise 라 resolution 대기
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('카운트다운이 다 되기 전 visible=false 가 되면 timer 취소 (signOut 호출 안 함)', () => {
    const { rerender } = render(<WorkspaceRevocationModal visible countdownSeconds={5} />);
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    rerender(<WorkspaceRevocationModal visible={false} countdownSeconds={5} />);
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signOut 실패해도 fallback 으로 login 화면 강제 이동 (E5 보안)', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('network down'));
    render(<WorkspaceRevocationModal visible workspaceName="포커룸 A" countdownSeconds={1} />);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('accessibilityRole="alert" + liveRegion="polite" 설정', () => {
    const { getByTestId } = render(<WorkspaceRevocationModal visible countdownSeconds={5} />);
    const alert = getByTestId('workspace-revocation-alert');
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
  });
});
