/**
 * @file DeletionScheduledModal — P2 #5 탈퇴 grace period 명시적 결정 모달.
 */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { DeletionScheduledModal } from '../DeletionScheduledModal';

const mockCancelAccountDeletion = jest.fn();
const mockSignOut = jest.fn();
const mockUseAuth = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/auth', () => ({
  cancelAccountDeletion: (...args: unknown[]) => mockCancelAccountDeletion(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: jest.fn(),
    info: jest.fn(),
    show: jest.fn(),
  }),
}));

jest.mock('@/errors', () => ({
  extractUserMessage: jest.fn((err: unknown) => (err instanceof Error ? err.message : undefined)),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
}));

const futureDate = new Date(Date.now() + 7 * 86_400_000);
const onKept = jest.fn();

describe('DeletionScheduledModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockCancelAccountDeletion.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it('남은 일수 + 예정일 표시', () => {
    const { getByText } = render(
      <DeletionScheduledModal visible scheduledFor={futureDate} onKept={onKept} />
    );
    expect(getByText(/회원탈퇴가 예약되어 있어요/)).toBeTruthy();
    expect(getByText(/일 후/)).toBeTruthy();
  });

  it('예정일 지난 경우 즉시 철회 안내', () => {
    const pastDate = new Date(Date.now() - 86_400_000);
    const { getByText } = render(
      <DeletionScheduledModal visible scheduledFor={pastDate} onKept={onKept} />
    );
    expect(getByText(/예정일.+지났습니다/)).toBeTruthy();
  });

  it('"탈퇴 철회" 클릭 → cancelAccountDeletion 호출 + onKept', async () => {
    const onKeptLocal = jest.fn();
    const { getByText } = render(
      <DeletionScheduledModal visible scheduledFor={futureDate} onKept={onKeptLocal} />
    );

    await act(async () => {
      fireEvent.press(getByText('탈퇴 철회하고 계속 사용'));
    });

    await waitFor(() => {
      expect(mockCancelAccountDeletion).toHaveBeenCalledWith('user-1');
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(onKeptLocal).toHaveBeenCalledTimes(1);
    });
  });

  it('"탈퇴 철회" 실패 → toast.error + onKept 미호출', async () => {
    const onKeptLocal = jest.fn();
    mockCancelAccountDeletion.mockRejectedValue(new Error('서버 오류'));
    const { getByText } = render(
      <DeletionScheduledModal visible scheduledFor={futureDate} onKept={onKeptLocal} />
    );

    await act(async () => {
      fireEvent.press(getByText('탈퇴 철회하고 계속 사용'));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(onKeptLocal).not.toHaveBeenCalled();
  });

  it('"로그아웃" 클릭 → signOut 호출', async () => {
    const { getByText } = render(
      <DeletionScheduledModal visible scheduledFor={futureDate} onKept={onKept} />
    );

    await act(async () => {
      fireEvent.press(getByText('로그아웃'));
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('user.uid 없으면 cancelAccountDeletion 호출 안 함', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { getByText } = render(
      <DeletionScheduledModal visible scheduledFor={futureDate} onKept={onKept} />
    );

    await act(async () => {
      fireEvent.press(getByText('탈퇴 철회하고 계속 사용'));
    });

    expect(mockCancelAccountDeletion).not.toHaveBeenCalled();
  });
});
