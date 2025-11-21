/**
 * Firebase Error Handler Unit Tests
 *
 * TDD 접근법: 테스트 먼저 작성, 구현 전 FAIL 확인
 *
 * @version 1.0.0
 * @created 2025-11-20
 * @feature 002-phase3-integration
 */

import {
  getFirebaseErrorMessage,
  isPermissionDenied,
  handleFirebaseError,
  FirebaseError
} from '../firebaseErrors';
import { logger } from '../logger';

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Firebase Error Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('T048: getFirebaseErrorMessage returns Korean message for permission-denied', () => {
    it('should return Korean message for permission-denied error', () => {
      const error: FirebaseError = {
        code: 'permission-denied',
        message: 'Permission denied',
        name: 'FirebaseError',
      };

      const message = getFirebaseErrorMessage(error, 'ko');

      expect(message).toBe('권한이 없습니다. 관리자에게 문의하세요.');
    });
  });

  describe('T049: getFirebaseErrorMessage returns English message for permission-denied', () => {
    it('should return English message for permission-denied error', () => {
      const error: FirebaseError = {
        code: 'permission-denied',
        message: 'Permission denied',
        name: 'FirebaseError',
      };

      const message = getFirebaseErrorMessage(error, 'en');

      expect(message).toBe('Permission denied. Please contact administrator.');
    });
  });

  describe('T050: getFirebaseErrorMessage returns fallback for unknown error', () => {
    it('should return fallback message for unknown error code', () => {
      const error: FirebaseError = {
        code: 'unknown-error-code',
        message: 'Unknown error',
        name: 'FirebaseError',
      };

      const messageKo = getFirebaseErrorMessage(error, 'ko');
      const messageEn = getFirebaseErrorMessage(error, 'en');

      expect(messageKo).toBe('알 수 없는 오류가 발생했습니다.');
      expect(messageEn).toBe('An unknown error occurred.');
    });

    it('should return fallback message for non-Firebase error', () => {
      const error = new Error('Regular error');

      const messageKo = getFirebaseErrorMessage(error as any, 'ko');
      const messageEn = getFirebaseErrorMessage(error as any, 'en');

      expect(messageKo).toBe('알 수 없는 오류가 발생했습니다.');
      expect(messageEn).toBe('An unknown error occurred.');
    });
  });

  describe('T051: isPermissionDenied Type Guard detects permission-denied correctly', () => {
    it('should return true for permission-denied error', () => {
      const error: FirebaseError = {
        code: 'permission-denied',
        message: 'Permission denied',
        name: 'FirebaseError',
      };

      expect(isPermissionDenied(error)).toBe(true);
    });

    it('should return false for other Firebase errors', () => {
      const error: FirebaseError = {
        code: 'not-found',
        message: 'Not found',
        name: 'FirebaseError',
      };

      expect(isPermissionDenied(error)).toBe(false);
    });

    it('should return false for non-Firebase errors', () => {
      const error = new Error('Regular error');

      expect(isPermissionDenied(error as any)).toBe(false);
    });
  });

  describe('T052: handleFirebaseError logs error and returns user message', () => {
    it('should log error with context and return Korean message', () => {
      const error: FirebaseError = {
        code: 'permission-denied',
        message: 'Permission denied',
        name: 'FirebaseError',
      };
      const context = { operation: 'deleteStaff', userId: 'user123' };

      const message = handleFirebaseError(error, context, 'ko');

      expect(logger.error).toHaveBeenCalledWith(
        'Firebase Error',
        expect.any(Error),
        {
          component: 'firebaseErrors',
          data: {
            code: 'permission-denied',
            message: 'Permission denied',
            context,
          },
        }
      );
      expect(message).toBe('권한이 없습니다. 관리자에게 문의하세요.');
    });

    it('should log error with context and return English message', () => {
      const error: FirebaseError = {
        code: 'not-found',
        message: 'Document not found',
        name: 'FirebaseError',
      };
      const context = { operation: 'getDocument', docId: 'doc123' };

      const message = handleFirebaseError(error, context, 'en');

      expect(logger.error).toHaveBeenCalledWith(
        'Firebase Error',
        expect.any(Error),
        {
          component: 'firebaseErrors',
          data: {
            code: 'not-found',
            message: 'Document not found',
            context,
          },
        }
      );
      expect(message).toBe('Document not found.');
    });

    it('should handle error without context', () => {
      const error: FirebaseError = {
        code: 'unauthenticated',
        message: 'User not authenticated',
        name: 'FirebaseError',
      };

      const message = handleFirebaseError(error, undefined, 'ko');

      expect(logger.error).toHaveBeenCalled();
      expect(message).toBe('로그인이 필요합니다.');
    });
  });

  describe('Additional error codes coverage', () => {
    it('should handle all defined error codes in Korean', () => {
      const testCases: Array<{ code: string; expectedMessage: string }> = [
        { code: 'not-found', expectedMessage: '요청한 데이터를 찾을 수 없습니다.' },
        { code: 'unauthenticated', expectedMessage: '로그인이 필요합니다.' },
        { code: 'already-exists', expectedMessage: '이미 존재하는 데이터입니다.' },
        { code: 'resource-exhausted', expectedMessage: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.' },
        { code: 'cancelled', expectedMessage: '작업이 취소되었습니다.' },
        { code: 'unknown', expectedMessage: '알 수 없는 오류가 발생했습니다.' },
      ];

      testCases.forEach(({ code, expectedMessage }) => {
        const error: FirebaseError = {
          code,
          message: `Test ${code}`,
          name: 'FirebaseError',
        };
        expect(getFirebaseErrorMessage(error, 'ko')).toBe(expectedMessage);
      });
    });

    it('should handle all defined error codes in English', () => {
      const testCases: Array<{ code: string; expectedMessage: string }> = [
        { code: 'not-found', expectedMessage: 'Document not found.' },
        { code: 'unauthenticated', expectedMessage: 'Authentication required.' },
        { code: 'already-exists', expectedMessage: 'Document already exists.' },
        { code: 'resource-exhausted', expectedMessage: 'Request quota exceeded. Please try again later.' },
        { code: 'cancelled', expectedMessage: 'Operation cancelled.' },
        { code: 'unknown', expectedMessage: 'An unknown error occurred.' },
      ];

      testCases.forEach(({ code, expectedMessage }) => {
        const error: FirebaseError = {
          code,
          message: `Test ${code}`,
          name: 'FirebaseError',
        };
        expect(getFirebaseErrorMessage(error, 'en')).toBe(expectedMessage);
      });
    });
  });
});
