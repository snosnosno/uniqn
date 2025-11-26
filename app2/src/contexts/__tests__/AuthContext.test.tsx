/**
 * AuthContext Unit Tests
 * Feature: 001-authcontext-tests
 */

// Mock firebase FIRST before any imports
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth, AuthProvider } from '../AuthContext';
import * as firebaseAuth from 'firebase/auth';

// Mock 데이터는 직접 정의 (jest/no-mocks-import 에러 방지)
const mockAdminUser = {
  uid: 'admin-123',
  email: 'admin@test.com',
  emailVerified: true,
  displayName: 'Admin User',
};
const mockManagerUser = {
  uid: 'manager-123',
  email: 'manager@test.com',
  emailVerified: true,
  displayName: 'Manager User',
};
const mockRegularUser = {
  uid: 'user-123',
  email: 'user@test.com',
  emailVerified: true,
  displayName: 'Regular User',
};
const mockAdminToken = { claims: { role: 'admin' } };
const mockManagerToken = { claims: { role: 'manager' } };
const mockNoRoleToken = { claims: {} };

const wrongPasswordError = new Error('Wrong password');
const userNotFoundError = new Error('User not found');
const invalidEmailError = new Error('Invalid email');
const userDisabledError = new Error('User disabled');
const networkError = new Error('Network error');
const tooManyRequestsError = new Error('Too many requests');
const tokenExpiredError = new Error('Token expired');

jest.mock('../../firebase', () => ({
  auth: {
    currentUser: null,
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/sentry', () => ({
  setSentryUser: jest.fn(),
}));

const mockStorage: Record<string, string> = {};
jest.mock('../../utils/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn((key: string) => mockStorage[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
    }),
    clear: jest.fn(() => Object.keys(mockStorage).forEach((k) => delete mockStorage[k])),
  },
}));

jest.mock('firebase/auth');

describe('AuthContext - User Story 1', () => {
  let mockOnAuthStateChanged: jest.Mock;
  let mockSignInWithEmailAndPassword: jest.Mock;
  let mockSetPersistence: jest.Mock;

  beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
        get length() {
          return Object.keys(store).length;
        },
        key: (index: number) => Object.keys(store)[index] || null,
      },
      writable: true,
      configurable: true,
    });

    mockOnAuthStateChanged = jest.fn((auth, callback) => {
      setTimeout(() => callback(null), 0);
      return jest.fn();
    });
    mockSignInWithEmailAndPassword = jest.fn();
    mockSetPersistence = jest.fn().mockResolvedValue(undefined);

    (firebaseAuth.onAuthStateChanged as jest.Mock) = mockOnAuthStateChanged;
    (firebaseAuth.signInWithEmailAndPassword as jest.Mock) = mockSignInWithEmailAndPassword;
    (firebaseAuth.setPersistence as jest.Mock) = mockSetPersistence;
    (firebaseAuth.browserLocalPersistence as any) = { type: 'LOCAL' };
    (firebaseAuth.browserSessionPersistence as any) = { type: 'SESSION' };

    jest.clearAllMocks();
  });

  test('useAuth Hook returns all context values', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current).toHaveProperty('currentUser');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('isAdmin');
    expect(result.current).toHaveProperty('role');
    expect(result.current.currentUser).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.role).toBeNull();
  });

  test('signIn with valid credentials returns user information', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockAdminToken),
    };
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let userCredential: any;
    await act(async () => {
      userCredential = await result.current.signIn('admin@test.com', 'password123', false);
    });

    expect(userCredential).toBeDefined();
    expect(userCredential.user.email).toBe('admin@test.com');
  });

  test('signOut clears session data from localStorage', async () => {
    localStorage.setItem('rememberMe', 'true');

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const auth = require('../../firebase').auth;
    auth.signOut = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.signOut();
    });

    expect(localStorage.getItem('rememberMe')).toBeNull();
  });

  test('signIn with invalid credentials throws error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(wrongPasswordError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('admin@test.com', 'wrong', false);
      })
    ).rejects.toThrow();
  });

  test('signIn with invalid credentials keeps auth state false', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(userNotFoundError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    try {
      await act(async () => {
        await result.current.signIn('nonexistent@test.com', 'password', false);
      });
    } catch (error) {
      // Expected
    }

    expect(result.current.currentUser).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  test('page refresh restores session', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockAdminToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.currentUser).not.toBeNull();
      expect(result.current.currentUser?.uid).toBe('test-admin-uid');
    });
  });

  test('onAuthStateChanged is called', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockOnAuthStateChanged).toHaveBeenCalled();
  });
});

// =============================================================================
// User Story 2: 역할 기반 권한 검증
// =============================================================================

describe('AuthContext - User Story 2: 역할 기반 권한 검증', () => {
  let mockOnAuthStateChanged: jest.Mock;

  beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
        get length() {
          return Object.keys(store).length;
        },
        key: (index: number) => Object.keys(store)[index] || null,
      },
      writable: true,
      configurable: true,
    });

    mockOnAuthStateChanged = jest.fn((auth, callback) => {
      setTimeout(() => callback(null), 0);
      return jest.fn();
    });

    (firebaseAuth.onAuthStateChanged as jest.Mock) = mockOnAuthStateChanged;
    (firebaseAuth.setPersistence as any) = jest.fn().mockResolvedValue(undefined);
    (firebaseAuth.browserLocalPersistence as any) = { type: 'LOCAL' };
    (firebaseAuth.browserSessionPersistence as any) = { type: 'SESSION' };

    jest.clearAllMocks();
  });

  test('isAdmin returns true for admin role', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockAdminToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.role).toBe('admin');
      expect(result.current.isAdmin).toBe(true);
    });
  });

  test('isAdmin returns true for manager role', async () => {
    const mockUser = {
      ...mockManagerUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockManagerToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.role).toBe('manager');
      expect(result.current.isAdmin).toBe(true); // manager도 isAdmin=true
    });
  });

  test('isAdmin returns false for users without role', async () => {
    const mockUser = {
      ...mockRegularUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockNoRoleToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.role).toBeNull();
      expect(result.current.isAdmin).toBe(false);
    });
  });

  test('isAdmin returns false for unauthenticated users', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(null), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.currentUser).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  test('role returns "admin" for admin users', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockAdminToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.role).toBe('admin');
    });
  });

  test('role returns "manager" for manager users', async () => {
    const mockUser = {
      ...mockManagerUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockManagerToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.role).toBe('manager');
    });
  });

  test('role returns null for users without role', async () => {
    const mockUser = {
      ...mockRegularUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockNoRoleToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.role).toBeNull();
    });
  });

  test('role returns null for unauthenticated users', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(null), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.role).toBeNull();
  });

  test('admin user has all admin permissions', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockAdminToken),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.currentUser?.uid).toBe('test-admin-uid');
      expect(result.current.role).toBe('admin');
      expect(result.current.isAdmin).toBe(true);
    });
  });
});

// =============================================================================
// User Story 3: 에러 및 엣지 케이스
// =============================================================================

describe('AuthContext - User Story 3: 에러 및 엣지 케이스', () => {
  let mockOnAuthStateChanged: jest.Mock;
  let mockSignInWithEmailAndPassword: jest.Mock;
  let mockSetPersistence: jest.Mock;

  beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
        get length() {
          return Object.keys(store).length;
        },
        key: (index: number) => Object.keys(store)[index] || null,
      },
      writable: true,
      configurable: true,
    });

    mockOnAuthStateChanged = jest.fn((auth, callback) => {
      setTimeout(() => callback(null), 0);
      return jest.fn();
    });
    mockSignInWithEmailAndPassword = jest.fn();
    mockSetPersistence = jest.fn().mockResolvedValue(undefined);

    (firebaseAuth.onAuthStateChanged as jest.Mock) = mockOnAuthStateChanged;
    (firebaseAuth.signInWithEmailAndPassword as jest.Mock) = mockSignInWithEmailAndPassword;
    (firebaseAuth.setPersistence as jest.Mock) = mockSetPersistence;
    (firebaseAuth.browserLocalPersistence as any) = { type: 'LOCAL' };
    (firebaseAuth.browserSessionPersistence as any) = { type: 'SESSION' };

    jest.clearAllMocks();
  });

  // Firebase Auth 에러 케이스
  test('handles auth/wrong-password error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(wrongPasswordError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('admin@test.com', 'wrong', false);
      })
    ).rejects.toMatchObject({ code: 'auth/wrong-password' });
  });

  test('handles auth/user-not-found error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(userNotFoundError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('nonexistent@test.com', 'password', false);
      })
    ).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });

  test('handles auth/invalid-email error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(invalidEmailError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('invalid-email', 'password', false);
      })
    ).rejects.toMatchObject({ code: 'auth/invalid-email' });
  });

  test('handles auth/user-disabled error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(userDisabledError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('disabled@test.com', 'password', false);
      })
    ).rejects.toMatchObject({ code: 'auth/user-disabled' });
  });

  test('handles auth/network-request-failed error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(networkError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('admin@test.com', 'password', false);
      })
    ).rejects.toMatchObject({ code: 'auth/network-request-failed' });
  });

  test('handles auth/too-many-requests error', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(tooManyRequestsError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('admin@test.com', 'password', false);
      })
    ).rejects.toMatchObject({ code: 'auth/too-many-requests' });
  });

  // 엣지 케이스
  test('handles null user gracefully', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(null), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.currentUser).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  test('handles getIdTokenResult failure', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockRejectedValue(tokenExpiredError),
    };

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0);
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await waitFor(() => {
      expect(result.current.currentUser).not.toBeNull();
      expect(result.current.role).toBeNull(); // 토큰 실패 시 role null
    });
  });

  test('handles empty email string', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(invalidEmailError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('', 'password', false);
      })
    ).rejects.toThrow();
  });

  test('handles empty password string', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(wrongPasswordError);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn('admin@test.com', '', false);
      })
    ).rejects.toThrow();
  });

  test('persistence setting with rememberMe=true', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockAdminToken),
    };
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('admin@test.com', 'password', true);
    });

    expect(mockSetPersistence).toHaveBeenCalledWith(expect.anything(), { type: 'LOCAL' });
  });

  test('persistence setting with rememberMe=false', async () => {
    const mockUser = {
      ...mockAdminUser,
      getIdTokenResult: jest.fn().mockResolvedValue(mockAdminToken),
    };
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('admin@test.com', 'password', false);
    });

    expect(mockSetPersistence).toHaveBeenCalledWith(expect.anything(), { type: 'SESSION' });
  });
});
