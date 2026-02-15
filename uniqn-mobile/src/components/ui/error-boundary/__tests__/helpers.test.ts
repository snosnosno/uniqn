/**
 * ErrorBoundary helpers 테스트
 */

import { isAppError } from '@/errors';

import {
  isNetworkRelatedError,
  isAuthRelatedError,
  isFormRelatedError,
  isDataFetchRelatedError,
} from '../helpers';

jest.mock('@/errors', () => ({
  isAppError: jest.fn(),
}));

const mockIsAppError = isAppError as unknown as jest.Mock;

function makeAppError(
  category: string,
  code = 'E0000'
): Error & { category: string; code: string } {
  const err = new Error('테스트') as Error & { category: string; code: string };
  err.category = category;
  err.code = code;
  return err;
}

describe('ErrorBoundary helpers', () => {
  beforeEach(() => {
    mockIsAppError.mockReset();
    mockIsAppError.mockImplementation(
      (e: unknown) =>
        e !== null && e !== undefined && typeof e === 'object' && 'category' in e && 'code' in e
    );
  });

  describe('isNetworkRelatedError', () => {
    it('AppError category=network면 true', () => {
      expect(isNetworkRelatedError(makeAppError('network'))).toBe(true);
    });

    it('AppError category=auth면 false', () => {
      expect(isNetworkRelatedError(makeAppError('auth'))).toBe(false);
    });

    it('일반 Error 메시지에 network 포함하면 true', () => {
      expect(isNetworkRelatedError(new Error('Network request failed'))).toBe(true);
    });

    it('일반 Error 메시지에 timeout 포함하면 true', () => {
      expect(isNetworkRelatedError(new Error('Request timeout'))).toBe(true);
    });

    it('일반 Error 메시지에 fetch 포함하면 true', () => {
      expect(isNetworkRelatedError(new Error('fetch failed'))).toBe(true);
    });

    it('일반 Error 메시지에 connection 포함하면 true', () => {
      expect(isNetworkRelatedError(new Error('Connection refused'))).toBe(true);
    });

    it('일반 Error 메시지에 offline 포함하면 true', () => {
      expect(isNetworkRelatedError(new Error('Device is offline'))).toBe(true);
    });

    it('NetworkError 이름이면 true', () => {
      const err = new Error('something');
      err.name = 'NetworkError';
      expect(isNetworkRelatedError(err)).toBe(true);
    });

    it('관련 없는 에러면 false', () => {
      expect(isNetworkRelatedError(new Error('Something went wrong'))).toBe(false);
    });
  });

  describe('isAuthRelatedError', () => {
    it('AppError category=auth면 true', () => {
      expect(isAuthRelatedError(makeAppError('auth'))).toBe(true);
    });

    it('AppError category=permission이면 true', () => {
      expect(isAuthRelatedError(makeAppError('permission'))).toBe(true);
    });

    it('일반 Error 메시지에 unauthorized 포함하면 true', () => {
      expect(isAuthRelatedError(new Error('Unauthorized access'))).toBe(true);
    });

    it('일반 Error 메시지에 로그인 포함하면 true', () => {
      expect(isAuthRelatedError(new Error('로그인이 필요합니다'))).toBe(true);
    });

    it('일반 Error 메시지에 권한 포함하면 true', () => {
      expect(isAuthRelatedError(new Error('권한이 없습니다'))).toBe(true);
    });

    it('일반 Error 메시지에 만료 포함하면 true', () => {
      expect(isAuthRelatedError(new Error('토큰이 만료되었습니다'))).toBe(true);
    });

    it('AuthError 이름이면 true', () => {
      const err = new Error('err');
      err.name = 'AuthError';
      expect(isAuthRelatedError(err)).toBe(true);
    });

    it('PermissionError 이름이면 true', () => {
      const err = new Error('err');
      err.name = 'PermissionError';
      expect(isAuthRelatedError(err)).toBe(true);
    });

    it('관련 없는 에러면 false', () => {
      expect(isAuthRelatedError(new Error('Some error'))).toBe(false);
    });
  });

  describe('isFormRelatedError', () => {
    it('AppError category=validation이면 true', () => {
      expect(isFormRelatedError(makeAppError('validation'))).toBe(true);
    });

    it('일반 Error 메시지에 validation 포함하면 true', () => {
      expect(isFormRelatedError(new Error('Validation failed'))).toBe(true);
    });

    it('일반 Error 메시지에 검증 포함하면 true', () => {
      expect(isFormRelatedError(new Error('검증 실패'))).toBe(true);
    });

    it('ValidationError 이름이면 true', () => {
      const err = new Error('err');
      err.name = 'ValidationError';
      expect(isFormRelatedError(err)).toBe(true);
    });

    it('FormError 이름이면 true', () => {
      const err = new Error('err');
      err.name = 'FormError';
      expect(isFormRelatedError(err)).toBe(true);
    });

    it('관련 없는 에러면 false', () => {
      expect(isFormRelatedError(new Error('Unknown'))).toBe(false);
    });
  });

  describe('isDataFetchRelatedError', () => {
    it('AppError category=firebase면 true', () => {
      expect(isDataFetchRelatedError(makeAppError('firebase'))).toBe(true);
    });

    it('AppError code에 DOCUMENT_NOT_FOUND 포함하면 true', () => {
      const err = makeAppError('business', 'E4002_DOCUMENT_NOT_FOUND');
      expect(isDataFetchRelatedError(err)).toBe(true);
    });

    it('일반 Error 메시지에 not found 포함하면 true', () => {
      expect(isDataFetchRelatedError(new Error('Document not found'))).toBe(true);
    });

    it('일반 Error 메시지에 404 포함하면 true', () => {
      expect(isDataFetchRelatedError(new Error('HTTP 404'))).toBe(true);
    });

    it('일반 Error 메시지에 500 포함하면 true', () => {
      expect(isDataFetchRelatedError(new Error('HTTP 500'))).toBe(true);
    });

    it('FetchError 이름이면 true', () => {
      const err = new Error('err');
      err.name = 'FetchError';
      expect(isDataFetchRelatedError(err)).toBe(true);
    });

    it('DataError 이름이면 true', () => {
      const err = new Error('err');
      err.name = 'DataError';
      expect(isDataFetchRelatedError(err)).toBe(true);
    });

    it('관련 없는 에러면 false', () => {
      expect(isDataFetchRelatedError(new Error('Random error'))).toBe(false);
    });
  });
});
