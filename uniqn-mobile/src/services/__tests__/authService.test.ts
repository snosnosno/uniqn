/**
 * UNIQN Mobile - Auth Service Tests
 *
 * @description 인증 서비스 테스트
 * @version 2.0.0
 */

import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import {
  login,
  signUp,
  signOut,
  getUserProfile,
  updateUserProfile,
  checkEmailExists,
} from '../authService';

// ============================================================================
// Mock 변수 선언
// ============================================================================

// Modular API: getAuth()가 반환하는 auth 인스턴스 mock
// 'mock' 접두사 → jest.mock 호이스팅에서 참조 가능 (클로저로 지연 평가)
const mockNativeAuthInstance = {
  currentUser: { uid: 'native-uid' },
};

// ============================================================================
// Module Mocks
// ============================================================================

// @react-native-firebase/auth (Modular API)
// jest.fn()을 팩토리 내부에서 생성하여 호이스팅 문제 방지
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => mockNativeAuthInstance),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  linkWithCredential: jest.fn(),
  updateProfile: jest.fn(),
  deleteUser: jest.fn(),
  EmailAuthProvider: {
    credential: jest.fn().mockReturnValue('mock-email-credential'),
  },
}));

// nativeAuth 공통 모듈 (authService가 이 모듈에서 import)
jest.mock('@/lib/nativeAuth', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nativeAuth = require('@react-native-firebase/auth');
  return {
    hasNativeAuth: true,
    getNativeAuth: nativeAuth.getAuth,
    nativeSignInWithEmailAndPassword: nativeAuth.signInWithEmailAndPassword,
    nativeSignInWithPhoneNumber: nativeAuth.signInWithPhoneNumber,
    nativeLinkWithCredential: nativeAuth.linkWithCredential,
    nativeUpdateProfile: nativeAuth.updateProfile,
    nativeDeleteUser: nativeAuth.deleteUser,
    nativeSignOut: nativeAuth.signOut,
    NativeEmailAuthProvider: nativeAuth.EmailAuthProvider,
  };
});

// Firebase Web SDK
jest.mock('firebase/auth');

const mockSetDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mock-doc-ref'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

const mockHttpsCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({ currentUser: null })),
  getFirebaseDb: jest.fn(() => ({})),
  getFirebaseFunctions: jest.fn(() => ({})),
}));

// Auth Bridge (Dual SDK 동기화)
jest.mock('@/lib/authBridge', () => ({
  syncToWebAuth: jest.fn().mockResolvedValue(undefined),
  syncSignOut: jest.fn().mockResolvedValue(undefined),
}));

// Repositories
jest.mock('@/repositories', () => ({
  userRepository: {
    getById: jest.fn(),
    createOrMerge: jest.fn(),
    updateFields: jest.fn(),
    existsByEmail: jest.fn(),
  },
}));

// Utilities
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

jest.mock('@/shared/cache/counterSyncCache', () => ({
  clearCounterSyncCache: jest.fn(),
}));

jest.mock('../analyticsService', () => ({
  trackLogin: jest.fn(),
  trackSignup: jest.fn(),
  trackLogout: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn(),
}));

// ============================================================================
// Mock 참조
// ============================================================================

const mockSignInWithEmailAndPassword = signInWithEmailAndPassword as jest.Mock;
const mockFirebaseSignOut = firebaseSignOut as jest.Mock;

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  syncToWebAuth: mockSyncToWebAuth,
  syncSignOut: mockSyncSignOut,
} = require('@/lib/authBridge');
const { userRepository: mockUserRepository } = require('@/repositories');
const { getFirebaseAuth: mockGetFirebaseAuth } = require('@/lib/firebase');
const {
  getAuth: mockGetNativeAuth,
  signInWithEmailAndPassword: mockNativeSignIn,
  linkWithCredential: mockLinkWithCredential,
  updateProfile: mockNativeUpdateProfile,
  deleteUser: mockNativeDelete,
  EmailAuthProvider: mockNativeEmailAuthProvider,
} = require('@react-native-firebase/auth');
/* eslint-enable @typescript-eslint/no-require-imports */

// ============================================================================
// Tests
// ============================================================================

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // login
  // ==========================================================================
  describe('login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      getIdToken: jest.fn(() => Promise.resolve('mock-token')),
    };

    const mockProfile = {
      uid: 'test-uid',
      email: 'test@example.com',
      name: '테스트 유저',
      role: 'staff',
      isActive: true,
      createdAt: { toDate: () => new Date() },
      updatedAt: { toDate: () => new Date() },
    };

    it('should login successfully with valid credentials', async () => {
      mockNativeSignIn.mockResolvedValue({ user: { uid: 'native-uid' } });
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUserRepository.getById.mockResolvedValue(mockProfile);

      const result = await login(validCredentials);

      expect(mockNativeSignIn).toHaveBeenCalledWith(
        mockNativeAuthInstance,
        validCredentials.email,
        validCredentials.password
      );
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
      expect(result.profile).toEqual(mockProfile);
    });

    it('should throw error when user profile not found', async () => {
      mockNativeSignIn.mockResolvedValue({ user: { uid: 'native-uid' } });
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUserRepository.getById.mockResolvedValue(null);

      await expect(login(validCredentials)).rejects.toThrow();
    });

    it('should throw error when account is disabled', async () => {
      mockNativeSignIn.mockResolvedValue({ user: { uid: 'native-uid' } });
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUserRepository.getById.mockResolvedValue({ ...mockProfile, isActive: false });

      await expect(login(validCredentials)).rejects.toThrow();
    });

    it('should handle Firebase auth errors', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/invalid-credential',
        message: 'Invalid credentials',
      });

      await expect(login(validCredentials)).rejects.toThrow();
    });

    it('should cleanup on partial login failure', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue(new Error('login failed'));

      await expect(login(validCredentials)).rejects.toThrow();
      expect(mockSyncSignOut).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // signUp
  // ==========================================================================
  describe('signUp', () => {
    const validSignUpData = {
      email: 'newuser@example.com',
      password: 'Password123!',
      name: '홍길동',
      birthDate: '19900101',
      gender: 'male' as const,
      nickname: '신규유저',
      role: 'staff' as const,
      phoneVerified: true as const,
      verifiedPhone: '010-1234-5678',
      termsAgreed: true,
      privacyAgreed: true,
      marketingAgreed: false,
    };

    const mockWebUser = {
      uid: 'native-uid',
      email: 'newuser@example.com',
    };

    beforeEach(() => {
      // signUp 테스트 기본 설정
      mockLinkWithCredential.mockResolvedValue(undefined);
      mockNativeUpdateProfile.mockResolvedValue(undefined);
      mockNativeDelete.mockResolvedValue(undefined);
      mockSyncToWebAuth.mockResolvedValue(undefined);
      mockUserRepository.createOrMerge.mockResolvedValue(undefined);
      // syncToWebAuth 이후 Web SDK currentUser가 존재해야 함
      mockGetFirebaseAuth.mockReturnValue({ currentUser: mockWebUser });
    });

    it('should sign up successfully with phone-verified account', async () => {
      const result = await signUp(validSignUpData);

      // Phone Auth 계정에 이메일 연결
      expect(mockNativeEmailAuthProvider.credential).toHaveBeenCalledWith(
        validSignUpData.email,
        validSignUpData.password
      );
      expect(mockLinkWithCredential).toHaveBeenCalledWith(
        mockNativeAuthInstance.currentUser,
        'mock-email-credential'
      );

      // displayName 설정
      expect(mockNativeUpdateProfile).toHaveBeenCalledWith(mockNativeAuthInstance.currentUser, {
        displayName: validSignUpData.nickname,
      });

      // Web SDK 동기화
      expect(mockSyncToWebAuth).toHaveBeenCalledWith(
        validSignUpData.email,
        validSignUpData.password
      );

      // Firestore 저장
      expect(mockUserRepository.createOrMerge).toHaveBeenCalledWith(
        'native-uid',
        expect.objectContaining({
          uid: 'native-uid',
          email: validSignUpData.email,
          name: validSignUpData.name,
          nickname: validSignUpData.nickname,
          phone: validSignUpData.verifiedPhone,
          phoneVerified: true,
          role: 'staff',
        })
      );

      expect(result.user).toEqual(mockWebUser);
      expect(result.profile).toMatchObject({
        uid: 'native-uid',
        email: validSignUpData.email,
        role: 'staff',
      });
    });

    it('should throw error when phone auth not completed (no nativeUser)', async () => {
      // getNativeAuth().currentUser를 null로 설정
      mockGetNativeAuth.mockReturnValueOnce({ currentUser: null });

      await expect(signUp(validSignUpData)).rejects.toThrow();
      // linkWithCredential이 호출되면 안 됨
      expect(mockLinkWithCredential).not.toHaveBeenCalled();
    });

    it('should handle email already in use error from linkWithCredential', async () => {
      mockLinkWithCredential.mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'Email already in use',
      });

      await expect(signUp(validSignUpData)).rejects.toThrow();
      // 롤백: phone-only 계정 삭제
      expect(mockNativeDelete).toHaveBeenCalledWith(mockNativeAuthInstance.currentUser);
    });

    it('should handle weak password error from linkWithCredential', async () => {
      mockLinkWithCredential.mockRejectedValue({
        code: 'auth/weak-password',
        message: 'Weak password',
      });

      await expect(signUp(validSignUpData)).rejects.toThrow();
      expect(mockNativeDelete).toHaveBeenCalledWith(mockNativeAuthInstance.currentUser);
    });

    it('should rollback phone-only account when Firestore save fails', async () => {
      mockUserRepository.createOrMerge.mockRejectedValue(new Error('Firestore write failed'));

      await expect(signUp(validSignUpData)).rejects.toThrow();

      // nativeUser.delete()로 롤백
      expect(mockNativeDelete).toHaveBeenCalledWith(mockNativeAuthInstance.currentUser);
      // Web SDK 세션도 독립적으로 정리
      expect(mockFirebaseSignOut).toHaveBeenCalled();
    });

    it('should still cleanup Web SDK when nativeUser.delete fails', async () => {
      mockUserRepository.createOrMerge.mockRejectedValue(new Error('Firestore write failed'));
      mockNativeDelete.mockRejectedValue(new Error('delete failed'));

      await expect(signUp(validSignUpData)).rejects.toThrow();

      expect(mockNativeDelete).toHaveBeenCalledWith(mockNativeAuthInstance.currentUser);
      // nativeUser.delete() 실패해도 Web SDK 정리는 시도
      expect(mockFirebaseSignOut).toHaveBeenCalled();
    });

    it('should rollback phone-only account when Web SDK sync fails', async () => {
      mockSyncToWebAuth.mockRejectedValue(new Error('Web SDK sync failed'));

      await expect(signUp(validSignUpData)).rejects.toThrow();
      expect(mockNativeDelete).toHaveBeenCalledWith(mockNativeAuthInstance.currentUser);
    });

    it('should throw when Web SDK currentUser is null after sync', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null });

      await expect(signUp(validSignUpData)).rejects.toThrow();
      expect(mockNativeDelete).toHaveBeenCalledWith(mockNativeAuthInstance.currentUser);
    });

    it('should reject non-staff role (role injection prevention)', async () => {
      const hackedData = { ...validSignUpData, role: 'employer' as const };

      await expect(signUp(hackedData as never)).rejects.toThrow();
      // linkWithCredential이 호출되면 안 됨 (role 체크 단계에서 차단)
      expect(mockLinkWithCredential).not.toHaveBeenCalled();
    });

    it('should mark orphan account when native rollback fails', async () => {
      mockUserRepository.createOrMerge.mockRejectedValue(new Error('Firestore write failed'));
      mockNativeDelete.mockRejectedValue(new Error('delete failed'));
      mockSetDoc.mockResolvedValue(undefined);

      await expect(signUp(validSignUpData)).rejects.toThrow();

      // orphanAccounts 마킹 시도
      expect(mockSetDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({
          uid: 'native-uid',
          reason: 'native_signup_rollback_failed',
          phone: validSignUpData.verifiedPhone,
        })
      );
    });
  });

  // ==========================================================================
  // checkEmailExists
  // ==========================================================================
  describe('checkEmailExists', () => {
    it('should return true when email exists via Cloud Function', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { exists: true } });
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = await checkEmailExists('existing@example.com');

      expect(result).toBe(true);
      expect(mockCallable).toHaveBeenCalledWith({ email: 'existing@example.com' });
    });

    it('should return false when email does not exist', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { exists: false } });
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = await checkEmailExists('new@example.com');

      expect(result).toBe(false);
      expect(mockCallable).toHaveBeenCalledWith({ email: 'new@example.com' });
    });

    it('should normalize email to lowercase', async () => {
      const mockCallable = jest.fn().mockResolvedValue({ data: { exists: false } });
      mockHttpsCallable.mockReturnValue(mockCallable);

      await checkEmailExists('User@Example.COM');

      expect(mockCallable).toHaveBeenCalledWith({ email: 'user@example.com' });
    });

    it('should handle Cloud Function errors', async () => {
      const mockCallable = jest.fn().mockRejectedValue(new Error('Function error'));
      mockHttpsCallable.mockReturnValue(mockCallable);

      await expect(checkEmailExists('test@example.com')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // signOut
  // ==========================================================================
  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockSyncSignOut.mockResolvedValue(undefined);

      await expect(signOut()).resolves.not.toThrow();
      expect(mockSyncSignOut).toHaveBeenCalled();
    });

    it('should handle sign out errors', async () => {
      mockSyncSignOut.mockRejectedValue(new Error('Sign out failed'));

      await expect(signOut()).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getUserProfile
  // ==========================================================================
  describe('getUserProfile', () => {
    const testUid = 'test-uid';

    const mockProfile = {
      uid: testUid,
      email: 'test@example.com',
      name: '테스트 유저',
      role: 'staff',
    };

    it('should return user profile when exists', async () => {
      mockUserRepository.getById.mockResolvedValue(mockProfile);

      const result = await getUserProfile(testUid);

      expect(mockUserRepository.getById).toHaveBeenCalledWith(testUid);
      expect(result).toEqual(mockProfile);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.getById.mockResolvedValue(null);

      const result = await getUserProfile(testUid);

      expect(result).toBeNull();
    });

    it('should handle Firestore errors', async () => {
      mockUserRepository.getById.mockRejectedValue(new Error('Firestore error'));

      await expect(getUserProfile(testUid)).rejects.toThrow();
    });
  });

  // ==========================================================================
  // updateUserProfile
  // ==========================================================================
  describe('updateUserProfile', () => {
    const testUid = 'test-uid';

    it('should update profile successfully', async () => {
      mockUserRepository.updateFields.mockResolvedValue(undefined);
      mockGetFirebaseAuth.mockReturnValue({ currentUser: { uid: testUid } });

      await expect(updateUserProfile(testUid, { nickname: '새닉네임' })).resolves.not.toThrow();
      expect(mockUserRepository.updateFields).toHaveBeenCalledWith(testUid, {
        nickname: '새닉네임',
      });
    });

    it('should handle update errors', async () => {
      mockUserRepository.updateFields.mockRejectedValue(new Error('Update failed'));

      await expect(updateUserProfile(testUid, { nickname: '새닉네임' })).rejects.toThrow();
    });
  });
});
