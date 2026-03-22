/**
 * UNIQN Mobile - Auth Store Tests
 *
 * @description Tests for authentication state management
 */

import { act } from '@testing-library/react-native';
import { USER_ROLE_HIERARCHY } from '@/types/role';
import { RoleResolver } from '@/shared/role';
import {
  useAuthStore,
  selectUser,
  selectProfile,
  selectIsAuthenticated,
  selectIsAdmin,
  selectIsEmployer,
  selectIsStaff,
  selectHasHydrated,
  waitForHydration,
  type AuthUser,
  type UserProfile,
} from '../authStore';

const mockFirebaseAuth = {
  currentUser: null as any,
};
const mockGetUserProfile = jest.fn();
const mockToStoreProfile = jest.fn((profile) => profile);
const mockUnsubscribeAll = jest.fn();
const mockClearCounterSyncCache = jest.fn();
const mockClearCriticalOfflineCacheForUser = jest.fn();
const mockIsAutoLoginEnabled = jest.fn();
const mockSyncSignOut = jest.fn();
const mockTrackLogout = jest.fn();
const mockSetUserId = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => mockFirebaseAuth),
}));

jest.mock('@/lib/authBridge', () => ({
  syncSignOut: () => mockSyncSignOut(),
}));

jest.mock('@/lib/secureStorage', () => ({
  settingsStorage: {
    isAutoLoginEnabled: () => mockIsAutoLoginEnabled(),
  },
}));

jest.mock('@/services/observability/analyticsService', () => ({
  trackLogout: () => mockTrackLogout(),
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
}));

jest.mock('@/services/auth/userProfileService', () => ({
  getUserProfile: (uid: string) => mockGetUserProfile(uid),
}));

jest.mock('@/utils/profileConverter', () => ({
  toStoreProfile: (profile: unknown) => mockToStoreProfile(profile),
}));

jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    unsubscribeAll: () => mockUnsubscribeAll(),
  },
}));

jest.mock('@/shared/cache/counterSyncCache', () => ({
  clearCounterSyncCache: () => mockClearCounterSyncCache(),
}));

jest.mock('@/services/offline/criticalOfflineCache', () => ({
  clearCriticalOfflineCacheForUser: (userId?: string | null) =>
    mockClearCriticalOfflineCacheForUser(userId),
}));

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.getState().reset();
    mockFirebaseAuth.currentUser = null;
    mockGetUserProfile.mockReset();
    mockToStoreProfile.mockClear();
    mockUnsubscribeAll.mockClear();
    mockClearCounterSyncCache.mockClear();
    mockClearCriticalOfflineCacheForUser.mockClear();
    mockIsAutoLoginEnabled.mockResolvedValue(true);
    mockSyncSignOut.mockResolvedValue(undefined);
    mockTrackLogout.mockClear();
    mockSetUserId.mockClear();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.isInitialized).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.isAdmin).toBe(false);
      expect(state.isEmployer).toBe(false);
      expect(state.isStaff).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should set user from Firebase user', () => {
      const mockFirebaseUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        emailVerified: true,
        phoneNumber: '+821012345678',
      };

      act(() => {
        useAuthStore.getState().setUser(mockFirebaseUser as any);
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual({
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        emailVerified: true,
        phoneNumber: '+821012345678',
      });
      expect(state.status).toBe('authenticated');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should clear user when passed null', () => {
      // First set a user
      act(() => {
        useAuthStore.getState().setUser({
          uid: 'test-uid',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: null,
          emailVerified: true,
          phoneNumber: null,
        } as any);
      });

      // Then clear the user
      act(() => {
        useAuthStore.getState().setUser(null);
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe('unauthenticated');
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setProfile', () => {
    it('should set user profile and calculate role flags', () => {
      const mockProfile: UserProfile = {
        uid: 'test-uid',
        email: 'admin@example.com',
        name: '관리자',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        useAuthStore.getState().setProfile(mockProfile);
      });

      const state = useAuthStore.getState();
      expect(state.profile).toEqual(mockProfile);
      expect(state.isAdmin).toBe(true);
      expect(state.isEmployer).toBe(true);
      expect(state.isStaff).toBe(true);
    });

    it('should set correct flags for employer role', () => {
      const mockProfile: UserProfile = {
        uid: 'test-uid',
        email: 'employer@example.com',
        name: '구인자',
        role: 'employer',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        useAuthStore.getState().setProfile(mockProfile);
      });

      const state = useAuthStore.getState();
      expect(state.isAdmin).toBe(false);
      expect(state.isEmployer).toBe(true);
      expect(state.isStaff).toBe(true);
    });

    it('should set correct flags for staff role', () => {
      const mockProfile: UserProfile = {
        uid: 'test-uid',
        email: 'staff@example.com',
        name: '스태프',
        role: 'staff',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        useAuthStore.getState().setProfile(mockProfile);
      });

      const state = useAuthStore.getState();
      expect(state.isAdmin).toBe(false);
      expect(state.isEmployer).toBe(false);
      expect(state.isStaff).toBe(true);
    });

    it('should clear flags when profile is null', () => {
      // First set an admin profile
      act(() => {
        useAuthStore.getState().setProfile({
          uid: 'test-uid',
          email: 'admin@example.com',
          name: '관리자',
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      // Then clear the profile
      act(() => {
        useAuthStore.getState().setProfile(null);
      });

      const state = useAuthStore.getState();
      expect(state.profile).toBeNull();
      expect(state.isAdmin).toBe(false);
      expect(state.isEmployer).toBe(false);
      expect(state.isStaff).toBe(false);
    });
  });

  describe('setStatus', () => {
    it('should set status and isLoading correctly', () => {
      act(() => {
        useAuthStore.getState().setStatus('loading');
      });

      expect(useAuthStore.getState().status).toBe('loading');
      expect(useAuthStore.getState().isLoading).toBe(true);

      act(() => {
        useAuthStore.getState().setStatus('authenticated');
      });

      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set and clear error', () => {
      act(() => {
        useAuthStore.getState().setError('로그인 실패');
      });

      expect(useAuthStore.getState().error).toBe('로그인 실패');

      act(() => {
        useAuthStore.getState().setError(null);
      });

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should set isInitialized and status based on user presence', async () => {
      // When user is null
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().status).toBe('unauthenticated');

      // Reset and set user first
      act(() => {
        useAuthStore.getState().reset();
        useAuthStore.getState().setUser({
          uid: 'test-uid',
          email: 'test@example.com',
        } as any);
      });

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().status).toBe('authenticated');
    });
  });

  describe('checkAuthState', () => {
    it('should preserve cached auth state when Firebase auth has not settled yet', async () => {
      act(() => {
        useAuthStore.getState().setUser({
          uid: 'stale-user',
          email: 'stale@example.com',
        } as any);
        useAuthStore.getState().setProfile({
          uid: 'stale-user',
          email: 'stale@example.com',
          name: 'Stale User',
          role: 'staff',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        useAuthStore.getState().setInitialized(true);
      });

      await act(async () => {
        await useAuthStore.getState().checkAuthState();
      });

      expect(useAuthStore.getState().user?.uid).toBe('stale-user');
      expect(useAuthStore.getState().profile?.uid).toBe('stale-user');
      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(mockUnsubscribeAll).not.toHaveBeenCalled();
      expect(mockClearCounterSyncCache).not.toHaveBeenCalled();
      expect(mockClearCriticalOfflineCacheForUser).not.toHaveBeenCalled();
    });

    it('should clear stale authenticated state when auth listener explicitly reports sign-out', async () => {
      act(() => {
        useAuthStore.getState().setUser({
          uid: 'stale-user',
          email: 'stale@example.com',
        } as any);
        useAuthStore.getState().setProfile({
          uid: 'stale-user',
          email: 'stale@example.com',
          name: 'Stale User',
          role: 'staff',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        useAuthStore.getState().setInitialized(true);
      });

      await act(async () => {
        await useAuthStore.getState().checkAuthState(null);
      });

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(mockUnsubscribeAll).toHaveBeenCalled();
      expect(mockClearCounterSyncCache).toHaveBeenCalled();
      expect(mockClearCriticalOfflineCacheForUser).toHaveBeenCalledWith('stale-user');
    });

    it('should ignore stale explicit auth restore when live Firebase session is already cleared', async () => {
      const firebaseUser = {
        uid: 'stale-user',
        email: 'stale@example.com',
        displayName: 'Stale User',
        photoURL: null,
        emailVerified: true,
        phoneNumber: null,
      };

      mockFirebaseAuth.currentUser = null;

      await act(async () => {
        await useAuthStore.getState().checkAuthState(firebaseUser as any);
      });

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(mockGetUserProfile).not.toHaveBeenCalled();
    });

    it('should sign out explicit auth restore when auto login is disabled', async () => {
      const firebaseUser = {
        uid: 'suppressed-user',
        email: 'suppressed@example.com',
        displayName: 'Suppressed User',
        photoURL: null,
        emailVerified: true,
        phoneNumber: null,
      };

      mockIsAutoLoginEnabled.mockResolvedValue(false);
      mockFirebaseAuth.currentUser = firebaseUser;

      act(() => {
        useAuthStore.setState({
          status: 'unauthenticated',
          isInitialized: true,
          user: null,
          profile: null,
          bootstrapSource: 'none',
        });
      });

      await act(async () => {
        await useAuthStore.getState().checkAuthState(firebaseUser as any);
      });

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
      expect(mockTrackLogout).toHaveBeenCalledTimes(1);
      expect(mockSetUserId).toHaveBeenCalledWith(null);
      expect(mockGetUserProfile).not.toHaveBeenCalled();
      expect(mockClearCriticalOfflineCacheForUser).not.toHaveBeenCalled();
    });

    it('should hydrate user and profile from Firebase session', async () => {
      const firebaseUser = {
        uid: 'firebase-user',
        email: 'firebase@example.com',
        displayName: 'Firebase User',
        photoURL: null,
        emailVerified: true,
        phoneNumber: null,
      };
      const profile = {
        uid: 'firebase-user',
        email: 'firebase@example.com',
        name: 'Firebase User',
        role: 'staff',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirebaseAuth.currentUser = firebaseUser;
      mockGetUserProfile.mockResolvedValue(profile as never);

      await act(async () => {
        await useAuthStore.getState().checkAuthState();
      });

      expect(useAuthStore.getState().user?.uid).toBe('firebase-user');
      expect(useAuthStore.getState().profile).toEqual(profile);
      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(mockGetUserProfile).toHaveBeenCalledWith('firebase-user');
      expect(mockToStoreProfile).toHaveBeenCalledWith(profile);
    });

    it('should clear session when authenticated user has no profile document', async () => {
      const firebaseUser = {
        uid: 'firebase-user',
        email: 'firebase@example.com',
        displayName: 'Firebase User',
        photoURL: null,
        emailVerified: true,
        phoneNumber: null,
      };

      mockFirebaseAuth.currentUser = firebaseUser;
      mockGetUserProfile.mockResolvedValue(null);

      await act(async () => {
        await useAuthStore.getState().checkAuthState();
      });

      expect(mockSyncSignOut).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
    });

    it('should preserve a phone-only signup session when the profile is not created yet', async () => {
      const firebaseUser = {
        uid: 'phone-only-user',
        email: null,
        displayName: null,
        photoURL: null,
        emailVerified: false,
        phoneNumber: '+821012345678',
        providerData: [{ providerId: 'phone' }],
      };

      mockFirebaseAuth.currentUser = firebaseUser;
      mockGetUserProfile.mockResolvedValue(null);

      await act(async () => {
        await useAuthStore.getState().checkAuthState();
      });

      expect(mockSyncSignOut).not.toHaveBeenCalled();
      expect(useAuthStore.getState().user?.uid).toBe('phone-only-user');
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().bootstrapSource).toBe('none');
      expect(useAuthStore.getState().needsServerReconcile).toBe(false);
    });

    it('should request server reconcile when profile refresh fails', async () => {
      const firebaseUser = {
        uid: 'firebase-user',
        email: 'firebase@example.com',
        displayName: 'Firebase User',
        photoURL: null,
        emailVerified: true,
        phoneNumber: null,
      };

      mockFirebaseAuth.currentUser = firebaseUser;
      mockGetUserProfile.mockRejectedValue(new Error('network failure'));

      await act(async () => {
        await useAuthStore.getState().checkAuthState();
      });

      expect(useAuthStore.getState().user?.uid).toBe('firebase-user');
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().needsServerReconcile).toBe(true);
      expect(useAuthStore.getState().bootstrapSource).toBe('none');
    });
  });

  describe('clearAuthUiState', () => {
    it('should preserve user-scoped offline cache while clearing local auth UI state', () => {
      act(() => {
        useAuthStore.getState().setUser({
          uid: 'cached-user',
          email: 'cached@example.com',
        } as any);
        useAuthStore.getState().setProfile({
          uid: 'cached-user',
          email: 'cached@example.com',
          name: 'Cached User',
          role: 'staff',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      act(() => {
        useAuthStore.getState().clearAuthUiState();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.status).toBe('unauthenticated');
      expect(state.lastScopedUserId).toBe('cached-user');
      expect(state.suppressedSessionUserId).toBe('cached-user');
      expect(mockUnsubscribeAll).toHaveBeenCalled();
      expect(mockClearCounterSyncCache).toHaveBeenCalled();
      expect(mockClearCriticalOfflineCacheForUser).not.toHaveBeenCalled();
    });

    it('should clear preserved offline cache when a different user logs in later', () => {
      act(() => {
        useAuthStore.getState().setUser({
          uid: 'cached-user',
          email: 'cached@example.com',
        } as any);
        useAuthStore.getState().setProfile({
          uid: 'cached-user',
          email: 'cached@example.com',
          name: 'Cached User',
          role: 'staff',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        useAuthStore.getState().clearAuthUiState();
      });

      mockUnsubscribeAll.mockClear();
      mockClearCounterSyncCache.mockClear();
      mockClearCriticalOfflineCacheForUser.mockClear();

      act(() => {
        useAuthStore.getState().setUser({
          uid: 'other-user',
          email: 'other@example.com',
        } as any);
      });

      expect(mockClearCriticalOfflineCacheForUser).toHaveBeenCalledWith('cached-user');
      expect(useAuthStore.getState().suppressedSessionUserId).toBeNull();
      expect(useAuthStore.getState().lastScopedUserId).toBe('other-user');
    });
  });

  describe('waitForHydration', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve immediately when hydration is already complete', async () => {
      act(() => {
        useAuthStore.setState({ _hasHydrated: true });
      });

      await expect(waitForHydration(100)).resolves.toBe(true);
    });

    it('should time out without forcing hydration to complete', async () => {
      jest.useFakeTimers();

      act(() => {
        useAuthStore.setState({ _hasHydrated: false });
      });

      const hydrationPromise = waitForHydration(100);

      await act(async () => {
        jest.advanceTimersByTime(100);
        await hydrationPromise;
      });

      await expect(hydrationPromise).resolves.toBe(false);
      expect(selectHasHydrated(useAuthStore.getState())).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      // Set some state
      act(() => {
        useAuthStore.getState().setUser({
          uid: 'test-uid',
          email: 'test@example.com',
        } as any);
        useAuthStore.getState().setProfile({
          uid: 'test-uid',
          email: 'test@example.com',
          name: 'Test',
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        useAuthStore.getState().setError('Some error');
      });

      // Reset
      act(() => {
        useAuthStore.getState().reset();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('USER_ROLE_HIERARCHY', () => {
    it('should have correct role values', () => {
      expect(USER_ROLE_HIERARCHY.admin).toBe(100);
      expect(USER_ROLE_HIERARCHY.employer).toBe(50);
      expect(USER_ROLE_HIERARCHY.staff).toBe(10);
    });

    it('should have admin > employer > staff', () => {
      expect(USER_ROLE_HIERARCHY.admin).toBeGreaterThan(USER_ROLE_HIERARCHY.employer);
      expect(USER_ROLE_HIERARCHY.employer).toBeGreaterThan(USER_ROLE_HIERARCHY.staff);
    });
  });

  describe('hasPermission', () => {
    it('should return false for null role', () => {
      expect(RoleResolver.hasPermission(null, 'staff')).toBe(false);
      expect(RoleResolver.hasPermission(null, 'admin')).toBe(false);
    });

    it('should return true when user role >= required role', () => {
      expect(RoleResolver.hasPermission('admin', 'admin')).toBe(true);
      expect(RoleResolver.hasPermission('admin', 'employer')).toBe(true);
      expect(RoleResolver.hasPermission('admin', 'staff')).toBe(true);
    });

    it('should return false when user role < required role', () => {
      expect(RoleResolver.hasPermission('staff', 'admin')).toBe(false);
      expect(RoleResolver.hasPermission('staff', 'employer')).toBe(false);
    });

    it('should handle employer permissions correctly', () => {
      expect(RoleResolver.hasPermission('employer', 'employer')).toBe(true);
      expect(RoleResolver.hasPermission('employer', 'staff')).toBe(true);
      expect(RoleResolver.hasPermission('employer', 'admin')).toBe(false);
    });

    it('should handle staff permissions correctly', () => {
      expect(RoleResolver.hasPermission('staff', 'staff')).toBe(true);
      expect(RoleResolver.hasPermission('staff', 'employer')).toBe(false);
      expect(RoleResolver.hasPermission('staff', 'admin')).toBe(false);
    });
  });

  describe('Selectors', () => {
    it('should select user correctly', () => {
      const mockUser: AuthUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test',
        photoURL: null,
        emailVerified: true,
        phoneNumber: null,
      };

      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      expect(selectUser(useAuthStore.getState())).toEqual(mockUser);
    });

    it('should select profile correctly', () => {
      const mockProfile: UserProfile = {
        uid: 'test-uid',
        email: 'test@example.com',
        name: 'Test',
        role: 'staff',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        useAuthStore.setState({ profile: mockProfile });
      });

      expect(selectProfile(useAuthStore.getState())).toEqual(mockProfile);
    });

    it('should select isAuthenticated correctly', () => {
      act(() => {
        useAuthStore.setState({ isAuthenticated: true });
      });

      expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
    });

    it('should select role flags correctly', () => {
      act(() => {
        useAuthStore.setState({
          isAdmin: true,
          isEmployer: true,
          isStaff: true,
        });
      });

      const state = useAuthStore.getState();
      expect(selectIsAdmin(state)).toBe(true);
      expect(selectIsEmployer(state)).toBe(true);
      expect(selectIsStaff(state)).toBe(true);
    });
  });
});
