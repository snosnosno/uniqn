/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * 회귀 테스트 — 프로필 설정 화면 이탈(로그아웃) 경로 (2026-08-02)
 *
 * 버그: 가입 직후 프로필 설정 화면에서 나갈 방법이 아예 없었다. 하단 '이전' 버튼은
 * 토스트만 띄웠고(커밋 1d7b2a950 의 잔해), `(app)/_layout.tsx` 가 gestureEnabled:false 를
 * 걸고, `useAuthGuard` 가 profileCompleted=false 사용자를 다른 경로에서 여기로 되돌린다.
 * `handle_new_user` 가 profile_completed 를 DEFAULT false 로 굳히므로 신규 가입자는
 * 100% 이 화면에 갇혔다 — 계정을 잘못 만들어도 앱 삭제 외에 방법이 없었다.
 *
 * 수정: 유일한 합법 출구인 signOut 경유 이탈을 열었다.
 * 이 테스트가 고정하는 것:
 *   1) 이탈은 곧바로 나가지 않고 confirmAction 확인을 거친다 + 문구가 '계정은 남는다'를 알린다
 *   2) 확인 시 signOut → authStore.reset → 로그인으로 replace (redirect 보존)
 *   3) signOut 이 throw 해도 reset + replace 는 진행된다
 *   4) 저장 진행 중(isLoading)에는 이탈이 무시된다 (completeProfile 과 signOut 의 race 차단)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => children,
}));

// 폼 자체는 이 테스트의 관심사가 아니다 — onNext/onExit 만 노출하는 스텁으로 대체한다.
jest.mock('@/components/auth/signup/SignupStepProfile', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    SignupStepProfile: ({
      onNext,
      onExit,
      isLoading,
    }: {
      onNext: (data: unknown) => void;
      onExit: () => void;
      isLoading?: boolean;
    }) => (
      <View>
        <Pressable testID="stub-next" onPress={() => onNext({ nickname: 'tester' })}>
          <Text>제출</Text>
        </Pressable>
        <Pressable testID="stub-exit" onPress={onExit}>
          <Text>이탈</Text>
        </Pressable>
        <Text testID="stub-loading">{isLoading ? 'loading' : 'idle'}</Text>
      </View>
    ),
  };
});

const mockSignOut = jest.fn();
const mockCheckNicknameExists = jest.fn();
jest.mock('@/services/auth', () => ({
  completeProfile: jest.fn(),
  checkNicknameExists: (...args: unknown[]) => mockCheckNicknameExists(...args),
  getUserProfile: jest.fn(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

const mockResetAuthStore = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      setProfile: jest.fn(),
      reset: mockResetAuthStore,
      user: { uid: 'user-1' },
      // gender 가 채워져 있어 requireGender=false — 성별 분기는 이 테스트의 관심사가 아니다.
      profile: { gender: 'male' },
    }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    show: jest.fn(),
  }),
}));

jest.mock('@/shared/navigation/authRedirect', () => ({
  normalizePostAuthRedirect: (redirect?: string) => redirect ?? null,
}));

interface ConfirmActionCall {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  /** 구현이 async 라 항상 Promise 를 돌려준다 — 테스트에서 await 로 흐름을 이어받는다. */
  onConfirm: () => Promise<void>;
}

const mockConfirmAction = jest.fn();
jest.mock('@/utils/confirmAction', () => ({
  confirmAction: (options: unknown) => mockConfirmAction(options),
}));

jest.mock('@/utils/profileConverter', () => ({
  toStoreProfile: jest.fn((p) => p),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function renderScreen() {
  const ProfileSetupScreen = require('../profile-setup').default as React.ComponentType;
  return render(<ProfileSetupScreen />);
}

/** confirmAction 에 전달된 옵션 (마지막 호출) */
function lastConfirmOptions(): ConfirmActionCall {
  const calls = mockConfirmAction.mock.calls;
  return calls[calls.length - 1][0] as ConfirmActionCall;
}

describe('ProfileSetupScreen 이탈(로그아웃)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockSignOut.mockResolvedValue(undefined);
    mockCheckNicknameExists.mockResolvedValue(false);
  });

  it('이탈은 곧바로 나가지 않고 확인을 거친다 — 문구가 계정 유지·재개 가능을 알린다', () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('stub-exit'));

    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    const options = lastConfirmOptions();
    expect(options.title).toBe('로그아웃할까요?');
    // '가입 취소'로 오해하면 안 된다 — 계정은 이미 생성돼 있다.
    expect(options.message).toContain('계정은 그대로 남아 있고');
    expect(options.message).toContain('다시 로그인하면 여기서 이어서 진행할 수 있어요');
    // 확인 전에는 세션도 네비게이션도 건드리지 않는다.
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockResetAuthStore).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('확인하면 signOut → authStore.reset → 로그인으로 replace 한다', async () => {
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('stub-exit'));
    await lastConfirmOptions().onConfirm();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    expect(mockResetAuthStore).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('redirect 파라미터를 로그인 화면까지 보존한다', async () => {
    mockSearchParams = { redirect: '/jobs/123' };
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('stub-exit'));
    await lastConfirmOptions().onConfirm();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        `/(auth)/login?redirect=${encodeURIComponent('/jobs/123')}`
      );
    });
  });

  it('signOut 이 실패해도 reset + replace 는 진행한다 (편도 문 재발 방지)', async () => {
    mockSignOut.mockRejectedValue(new Error('네트워크 오류'));
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('stub-exit'));
    await lastConfirmOptions().onConfirm();

    await waitFor(() => {
      expect(mockResetAuthStore).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('저장 진행 중에는 이탈을 무시한다 — completeProfile 과 signOut 의 race 차단', () => {
    // 닉네임 중복 확인을 영원히 pending 시켜 isLoading=true 상태를 붙잡는다.
    mockCheckNicknameExists.mockReturnValue(new Promise(() => {}));
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('stub-next'));
    expect(getByTestId('stub-loading').props.children).toBe('loading');

    fireEvent.press(getByTestId('stub-exit'));

    expect(mockConfirmAction).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
