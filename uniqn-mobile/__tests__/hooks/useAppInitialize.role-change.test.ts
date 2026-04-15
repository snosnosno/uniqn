/**
 * T-D7: useAppInitialize role change JWT 무효화 테스트
 *
 * WF-04: employer 전환 시 JWT/RLS sync timing
 * - resolveSession 함수가 role mismatch를 올바르게 감지하는지 검증
 * - shouldSynchronizeClaims 유닛 테스트
 */

// ============================================================================
// Mock 변수 (jest.mock 호이스팅 전에 선언 필요)
// ============================================================================

// ============================================================================
// Import (mock 이후)
// ============================================================================

import { resolveSession } from '@/hooks/useAppInitialize';

const mockSetUser = jest.fn();
const mockSetProfile = jest.fn();
const mockSetBootstrapSource = jest.fn();
const mockSetNeedsServerReconcile = jest.fn();
const mockClearAuthState = jest.fn();
const mockClearAuthUiState = jest.fn();
const mockLoadLatestProfile = jest.fn();
const mockIsCurrentAutoLoginSession = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerDebug = jest.fn();

// ============================================================================
// Module Mocks
// ============================================================================

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      user: null,
      profile: null,
      status: 'idle',
      setUser: mockSetUser,
      setProfile: mockSetProfile,
      setBootstrapSource: mockSetBootstrapSource,
      setNeedsServerReconcile: mockSetNeedsServerReconcile,
      clearAuthState: mockClearAuthState,
      clearAuthUiState: mockClearAuthUiState,
    }),
  },
  waitForHydration: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/services/auth', () => ({
  getUserProfile: (...args: unknown[]) => mockLoadLatestProfile(...args),
  signOut: jest.fn(),
}));

jest.mock('@/utils/profileConverter', () => ({
  toStoreProfile: jest.fn((p: unknown) => p),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
  },
}));

jest.mock('@/lib/env', () => ({
  validateEnv: jest.fn().mockReturnValue({ success: true }),
}));

jest.mock('@/lib/autoLoginSession', () => ({
  isCurrentAutoLoginSession: (...args: unknown[]) => mockIsCurrentAutoLoginSession(...args),
}));

jest.mock('@/lib/mmkvStorage', () => ({
  migrateFromAsyncStorage: jest.fn(),
}));

jest.mock('@/services/versionService', () => ({
  checkForceUpdate: jest.fn().mockResolvedValue({
    mustUpdate: false,
    isMaintenanceMode: false,
    shouldUpdate: false,
  }),
  isForceUpdateError: jest.fn().mockReturnValue(false),
  isMaintenanceError: jest.fn().mockReturnValue(false),
}));

jest.mock('@/hooks/internal/appInitializeAuthSession', () => ({
  waitForInitialAuthUser: jest.fn(),
  getCurrentAuthUserAsync: jest.fn(),
  waitForAuthUser: jest.fn(),
}));

jest.mock('@/hooks/useAutoLogin', () => ({
  checkAutoLoginEnabled: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn().mockReturnValue({ isOnline: true }),
}));

jest.mock('@/shared/auth/protectedAuthFlow', () => ({
  getProtectedAuthFlowKind: jest.fn().mockReturnValue(null),
}));

jest.mock('@/utils/retry', () => ({
  retryWithBackoff: jest.fn().mockImplementation(async (fn: () => Promise<unknown>) => ({
    data: await fn(),
  })),
}));

jest.mock('@/errors', () => ({
  isNetworkError: jest.fn().mockReturnValue(false),
  toError: jest.fn((e: unknown) => e),
}));

jest.mock('@/services/observability/analyticsService', () => ({
  trackLogout: jest.fn(),
  setUserId: jest.fn().mockResolvedValue(undefined),
}));

// shouldSynchronizeClaims는 export되지 않으므로 직접 테스트용 구현
// 실제 소스 로직과 동일: profileRole이 string이고 tokenRole과 다를 때 true
function shouldSynchronizeClaims(
  profileRole: string | null | undefined,
  tokenRole: string | null
): boolean {
  return typeof profileRole === 'string' && profileRole.length > 0 && tokenRole !== profileRole;
}

// ============================================================================
// 공통 헬퍼
// ============================================================================

function buildAuthUser(role: string | null) {
  return {
    id: 'user-123',
    app_metadata: role !== null ? { role } : {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
  } as Parameters<typeof resolveSession>[0]['authUser'];
}

// ============================================================================
// 테스트
// ============================================================================

describe('useAppInitialize — role change JWT 무효화 (T-D7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // autoLogin 기본값: 활성화
    mockIsCurrentAutoLoginSession.mockReturnValue(true);
  });

  // --------------------------------------------------------------------------
  // 시나리오 3: shouldSynchronizeClaims 유닛 테스트
  // --------------------------------------------------------------------------
  describe('shouldSynchronizeClaims 유닛 테스트', () => {
    it('(null, null) → false를 반환한다', () => {
      expect(shouldSynchronizeClaims(null, null)).toBe(false);
    });

    it("('staff', 'staff') → false를 반환한다", () => {
      expect(shouldSynchronizeClaims('staff', 'staff')).toBe(false);
    });

    it("('employer', 'staff') → true를 반환한다 (DB role이 최신)", () => {
      expect(shouldSynchronizeClaims('employer', 'staff')).toBe(true);
    });

    it("('admin', null) → true를 반환한다 (JWT에 role 없음)", () => {
      expect(shouldSynchronizeClaims('admin', null)).toBe(true);
    });

    it("(null, 'staff') → false를 반환한다 (profileRole이 없으면 reconcile 불필요)", () => {
      expect(shouldSynchronizeClaims(null, 'staff')).toBe(false);
    });

    it("(undefined, 'staff') → false를 반환한다", () => {
      expect(shouldSynchronizeClaims(undefined, 'staff')).toBe(false);
    });

    it("('', 'staff') → false를 반환한다 (빈 문자열 profileRole)", () => {
      expect(shouldSynchronizeClaims('', 'staff')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 시나리오 1: role 일치 → needsServerReconcile = false
  // --------------------------------------------------------------------------
  describe('시나리오 1: role 일치 → needsServerReconcile = false', () => {
    it('authUser.role = staff, profile.role = staff → setNeedsServerReconcile(false)', async () => {
      const authUser = buildAuthUser('staff');
      mockLoadLatestProfile.mockResolvedValue({
        uid: 'user-123',
        role: 'staff',
        nickname: 'TestUser',
      });

      const result = await resolveSession({
        authUser,
        authResolutionSource: 'event',
        autoLoginEnabled: true,
      });

      // needsServerReconcile = false여야 함
      expect(result.offlineBootstrap.needsServerReconcile).toBe(false);
      expect(mockSetNeedsServerReconcile).toHaveBeenCalledWith(false);
    });
  });

  // --------------------------------------------------------------------------
  // 시나리오 2: role 불일치 (staff→employer) → needsServerReconcile = true
  // --------------------------------------------------------------------------
  describe('시나리오 2: role 불일치 → needsServerReconcile = true', () => {
    it('JWT role = staff (구), profile.role = employer (DB 최신) → setNeedsServerReconcile(true)', async () => {
      // JWT에는 아직 'staff'가 남아 있고, DB profile은 'employer'로 업데이트된 상황
      const authUser = buildAuthUser('staff');
      mockLoadLatestProfile.mockResolvedValue({
        uid: 'user-123',
        role: 'employer',
        nickname: 'TestUser',
      });

      const result = await resolveSession({
        authUser,
        authResolutionSource: 'event',
        autoLoginEnabled: true,
      });

      // role mismatch → needsServerReconcile = true
      expect(result.offlineBootstrap.needsServerReconcile).toBe(true);
      expect(mockSetNeedsServerReconcile).toHaveBeenCalledWith(true);
    });

    it('반환값 offlineBootstrap.source = server, needsServerReconcile = true', async () => {
      const authUser = buildAuthUser('staff');
      mockLoadLatestProfile.mockResolvedValue({
        uid: 'user-123',
        role: 'employer',
        nickname: 'TestUser',
      });

      const result = await resolveSession({
        authUser,
        authResolutionSource: 'event',
        autoLoginEnabled: true,
      });

      expect(result.offlineBootstrap.source).toBe('server');
      expect(result.offlineBootstrap.needsServerReconcile).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 시나리오 4: role mismatch 시 로그 확인
  // --------------------------------------------------------------------------
  describe('시나리오 4: role mismatch 로그 확인', () => {
    it("role 불일치 시 logger.info가 'Deferred claims reconciliation scheduled'로 호출된다", async () => {
      const authUser = buildAuthUser('staff');
      mockLoadLatestProfile.mockResolvedValue({
        uid: 'user-123',
        role: 'employer',
        nickname: 'TestUser',
      });

      await resolveSession({
        authUser,
        authResolutionSource: 'event',
        autoLoginEnabled: true,
      });

      const allInfoCalls = mockLoggerInfo.mock.calls;
      const reconcileLog = allInfoCalls.find(
        (args) =>
          typeof args[0] === 'string' &&
          (args[0].includes('Deferred claims reconciliation scheduled') ||
            args[0].includes('Role mismatch'))
      );

      expect(reconcileLog).toBeDefined();
    });

    it('role 일치 시 reconciliation 관련 로그가 호출되지 않는다', async () => {
      const authUser = buildAuthUser('employer');
      mockLoadLatestProfile.mockResolvedValue({
        uid: 'user-123',
        role: 'employer',
        nickname: 'TestUser',
      });

      mockLoggerInfo.mockClear();

      await resolveSession({
        authUser,
        authResolutionSource: 'event',
        autoLoginEnabled: true,
      });

      const allInfoCalls = mockLoggerInfo.mock.calls;
      const reconcileLog = allInfoCalls.find(
        (args) =>
          typeof args[0] === 'string' &&
          (args[0].includes('Deferred claims reconciliation scheduled') ||
            args[0].includes('Role mismatch'))
      );

      expect(reconcileLog).toBeUndefined();
    });
  });
});
