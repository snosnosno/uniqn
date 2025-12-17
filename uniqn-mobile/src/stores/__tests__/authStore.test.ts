/**
 * UNIQN Mobile - Auth Store Tests
 *
 * @description Tests for authentication state management
 */

import { act } from '@testing-library/react-native';
import {
  useAuthStore,
  ROLE_HIERARCHY,
  hasPermission,
  selectUser,
  selectProfile,
  selectIsAuthenticated,
  selectIsAdmin,
  selectIsEmployer,
  selectIsStaff,
  type AuthUser,
  type UserProfile,
} from '../authStore';

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.getState().reset();
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

  describe('ROLE_HIERARCHY', () => {
    it('should have correct role values', () => {
      expect(ROLE_HIERARCHY.admin).toBe(100);
      expect(ROLE_HIERARCHY.employer).toBe(50);
      expect(ROLE_HIERARCHY.staff).toBe(10);
    });

    it('should have admin > employer > staff', () => {
      expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.employer);
      expect(ROLE_HIERARCHY.employer).toBeGreaterThan(ROLE_HIERARCHY.staff);
    });
  });

  describe('hasPermission', () => {
    it('should return false for null role', () => {
      expect(hasPermission(null, 'staff')).toBe(false);
      expect(hasPermission(null, 'admin')).toBe(false);
    });

    it('should return true when user role >= required role', () => {
      expect(hasPermission('admin', 'admin')).toBe(true);
      expect(hasPermission('admin', 'employer')).toBe(true);
      expect(hasPermission('admin', 'staff')).toBe(true);
    });

    it('should return false when user role < required role', () => {
      expect(hasPermission('staff', 'admin')).toBe(false);
      expect(hasPermission('staff', 'employer')).toBe(false);
    });

    it('should handle employer permissions correctly', () => {
      expect(hasPermission('employer', 'employer')).toBe(true);
      expect(hasPermission('employer', 'staff')).toBe(true);
      expect(hasPermission('employer', 'admin')).toBe(false);
    });

    it('should handle staff permissions correctly', () => {
      expect(hasPermission('staff', 'staff')).toBe(true);
      expect(hasPermission('staff', 'employer')).toBe(false);
      expect(hasPermission('staff', 'admin')).toBe(false);
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
