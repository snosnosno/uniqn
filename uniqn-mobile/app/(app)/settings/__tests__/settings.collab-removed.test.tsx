import React from 'react';
import { render } from '@testing-library/react-native';
import SettingsScreen from '../index';

// PR-3 진입점 단일화: 설정의 '공고 협업' 섹션이 제거되어
// 워크스페이스 진입은 오직 '내 공고' 탭의 ⋯ 메뉴로만 가능해야 한다.

// expo-router: 전역 setup 은 useRouter 만 목킹하므로 router 싱글턴을 이 파일에서 목킹한다.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

// SafeAreaView 는 children 을 그대로 통과시켜 화면 내용이 렌더되게 한다.
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Card 는 children 을 렌더(섹션 텍스트 노출), Divider 는 경량 no-op.
jest.mock('@/components/ui', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Divider: () => null,
  };
});

jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/components/settings', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    DangerZone: () => null,
    // 라벨 텍스트 단언이 가능하도록 label 만 렌더하는 경량 passthrough
    SettingItem: ({ label }: { label: string }) => <Text>{label}</Text>,
  };
});
jest.mock('@/components/icons', () => ({
  BellIcon: () => null,
  BellSlashIcon: () => null,
  LockIcon: () => null,
  LogOutIcon: () => null,
  ChevronRightIcon: () => null,
  TrashIcon: () => null,
  BriefcaseIcon: () => null,
  InboxIcon: () => null,
}));

// 인증/권한 — employer + 인증 상태로 두어야, 제거 이전엔 '공고 협업' 섹션이 렌더된다.
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    profile: { marketingAgreed: false },
    user: { uid: 'employer-1' },
  }),
}));
jest.mock('@/hooks/auth/useCurrentUser', () => ({
  useIsAppleUser: () => false,
}));
jest.mock('@/stores/authStore', () => ({
  useHasRole: () => true,
  useAuthStore: (selector: (state: { setProfile: () => void }) => unknown) =>
    selector({ setProfile: jest.fn() }),
}));

// 받은 초대 훅 — 섹션 렌더 게이트와 무관하게 안전한 기본값.
jest.mock('@/hooks/workspace', () => ({
  useReceivedWorkspaceInvitations: () => ({ invitations: [] }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false, setTheme: jest.fn() }),
}));
jest.mock('@/stores/modalStore', () => ({
  useModalStore: () => ({ showConfirm: jest.fn() }),
}));
jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (state: { addToast: () => void }) => unknown) =>
    selector({ addToast: jest.fn() }),
}));

jest.mock('@/hooks/useClearCache', () => ({
  useClearCache: () => ({ clearCache: jest.fn(), isClearing: false, cacheStats: null }),
}));
jest.mock('@/hooks', () => ({
  useAutoLogin: () => ({
    autoLoginEnabled: false,
    setAutoLoginEnabled: jest.fn(),
    isLoading: false,
  }),
  useBiometricAuth: () => ({
    isEnabled: false,
    isAvailable: false,
    isLoading: false,
    isAuthenticating: false,
    biometricTypeName: '생체 인증',
    setEnabled: jest.fn(),
    refresh: jest.fn(),
  }),
  AUTO_LOGIN_HELPER_TEXT: '자동 로그인 안내',
}));
jest.mock('@/services/auth', () => ({
  signOut: jest.fn(),
}));

describe('설정 화면 — 공고 협업 섹션 제거(PR-3 진입점 단일화)', () => {
  it("employer 로 인증돼도 '공고 협업' 섹션과 '팀' 항목이 렌더되지 않는다", () => {
    const { queryByText } = render(<SettingsScreen />);

    // 화면이 실제로 렌더됐는지 확인하는 대조군 — 다른 섹션 헤더는 존재해야 한다.
    expect(queryByText('계정')).not.toBeNull();

    // 핵심 단언: 협업 진입점(섹션 헤더 + 워크스페이스 항목)이 사라져야 한다.
    expect(queryByText('공고 협업')).toBeNull();
    expect(queryByText('팀')).toBeNull();
  });
});
