/**
 * `(ops)` 레이아웃 게이트 계약 (결함⑥ 결정 고정, 2026-08-08).
 *
 * 고정하는 것은 **두 가지**다:
 *  1. 인증 게이트는 있다 — 비로그인은 로그인으로 리다이렉트.
 *  2. `ops_hub_enabled` 게이트는 **없다** — 플래그가 OFF 여도 로그인 사용자는 진입한다.
 *
 * 2번이 이 파일의 존재 이유다. 관찰만 보면 "플래그 OFF 인데 들어가진다"가 버그처럼 읽혀서,
 * 근거를 안 읽은 다음 사람이 레이아웃에 게이트를 심을 수 있다. 그러면 롤아웃 중 플래그를
 * 잠깐 OFF 로 되돌리는 순간 **진행 중인 라이브 대회 운영이 화면째로 끊긴다.**
 * 근거 전문은 `app/(ops)/_layout.tsx` 헤더 주석.
 */
import { render } from '@testing-library/react-native';
import OpsLayout from '../_layout';

const mockUseOpsHubEnabled = jest.fn(() => ({ enabled: false }));

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Stack: () => <Text>OPS_STACK</Text>,
    Redirect: ({ href }: { href: string }) => <Text>{`REDIRECT:${href}`}</Text>,
  };
});

jest.mock('@/components/ui', () => {
  const { Text } = require('react-native');
  return {
    Loading: () => <Text>LOADING</Text>,
    // 섹션 에러 경계(감사 err-03)는 게이트 판정과 무관하므로 통과시킨다.
    // 목에서 빼면 undefined 컴포넌트가 되어 렌더 자체가 터진다.
    ScreenErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// 플래그 훅을 모킹해 둔다 — 레이아웃이 이걸 **호출하지 않는다**는 것까지 단언한다.
jest.mock('@/hooks/useOpsHubEnabled', () => ({
  useOpsHubEnabled: () => mockUseOpsHubEnabled(),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) => selector({ isDarkMode: false }),
}));

type MockAuthState = { isLoading: boolean; isAuthenticated: boolean; profile: unknown };
let mockAuthState: MockAuthState = {
  isLoading: false,
  isAuthenticated: true,
  profile: { uid: 'u1' },
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      isLoading: mockAuthState.isLoading,
      isAuthenticated: mockAuthState.isAuthenticated,
      profile: mockAuthState.profile,
    };
    return selector ? selector(state) : state;
  },
  selectProfile: (s: { profile: unknown }) => s.profile,
}));

describe('(ops) 레이아웃 게이트', () => {
  beforeEach(() => {
    mockUseOpsHubEnabled.mockClear();
    mockAuthState = { isLoading: false, isAuthenticated: true, profile: { uid: 'u1' } };
  });

  it('비로그인은 로그인으로 리다이렉트한다', () => {
    mockAuthState = { isLoading: false, isAuthenticated: false, profile: null };
    const { getByText } = render(<OpsLayout />);
    expect(getByText('REDIRECT:/(auth)/login')).toBeTruthy();
  });

  it('로딩·hydration 중에는 Loading 을 보여준다', () => {
    mockAuthState = { isLoading: true, isAuthenticated: false, profile: null };
    const { getByText } = render(<OpsLayout />);
    expect(getByText('LOADING')).toBeTruthy();
  });

  // 🔒 결함⑥ 결정 — 여기가 깨지면 게이트가 새로 심긴 것이다. 주석의 근거를 먼저 읽어라.
  it('ops_hub_enabled 가 OFF 여도 로그인 사용자는 진입한다(발견 표면만 게이트)', () => {
    mockUseOpsHubEnabled.mockReturnValue({ enabled: false });
    const { getByText } = render(<OpsLayout />);
    expect(getByText('OPS_STACK')).toBeTruthy();
    // 레이아웃은 플래그를 읽지도 않는다 — 읽기 시작했다면 게이트를 심으려는 변경이다.
    expect(mockUseOpsHubEnabled).not.toHaveBeenCalled();
  });
});
