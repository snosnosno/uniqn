/**
 * Test Utilities for AuthContext Testing
 *
 * Purpose: 테스트 래퍼 및 헬퍼 함수
 * Feature: 001-authcontext-tests
 * Created: 2025-11-06
 */

import React, { ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { AuthProvider } from '../../AuthContext';

/**
 * Test Wrapper Props
 */
interface TestWrapperProps {
  children: ReactNode;
}

/**
 * AuthProvider Wrapper for Testing
 *
 * 사용법:
 * ```typescript
 * const { getByText } = renderWithAuth(<YourComponent />);
 * ```
 */
export const createAuthWrapper = (): React.FC<TestWrapperProps> => {
  const AuthWrapper: React.FC<TestWrapperProps> = ({ children }) => {
    return <AuthProvider>{children}</AuthProvider>;
  };

  return AuthWrapper;
};

/**
 * Render with AuthProvider
 *
 * React Testing Library의 render를 AuthProvider로 감싼 헬퍼 함수
 *
 * @param ui - 렌더링할 컴포넌트
 * @param options - 추가 렌더 옵션
 * @returns RenderResult
 */
export const renderWithAuth = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult => {
  const Wrapper = createAuthWrapper();

  return render(ui, { wrapper: Wrapper, ...options });
};

/**
 * Wait for Auth State to Settle
 *
 * AuthProvider의 loading 상태가 완료될 때까지 대기
 * onAuthStateChanged가 완료되고 loading=false가 될 때까지 기다림
 *
 * @param timeout - 타임아웃 (기본 1000ms)
 */
export const waitForAuthState = (timeout: number = 1000): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
};

/**
 * Mock localStorage for Testing
 *
 * localStorage를 Mock하여 테스트 환경에서 사용 가능하도록 설정
 */
export const mockLocalStorage = (): void => {
  const localStorageMock: Storage = (() => {
    let store: Record<string, string> = {};

    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => {
        const keys = Object.keys(store);
        return keys[index] || null;
      },
      get length() {
        return Object.keys(store).length;
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
};

/**
 * Clear all Mocks and Storage
 *
 * 테스트 간 격리를 위해 모든 Mock과 Storage 초기화
 */
export const clearAllMocks = (): void => {
  // localStorage 초기화
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }

  // Jest Mock 초기화
  jest.clearAllMocks();
};

/**
 * Setup Test Environment
 *
 * 각 테스트 전에 실행할 환경 설정
 * beforeEach에서 호출
 */
export const setupTestEnvironment = (): void => {
  mockLocalStorage();
  clearAllMocks();
};

/**
 * Cleanup Test Environment
 *
 * 각 테스트 후에 실행할 정리 작업
 * afterEach에서 호출
 */
export const cleanupTestEnvironment = (): void => {
  clearAllMocks();
};

/**
 * Mock Firebase Auth Module
 *
 * Jest에서 firebase/auth 모듈을 Mock하는 헬퍼
 * 테스트 파일 상단에서 호출
 */
export const mockFirebaseAuth = (): void => {
  jest.mock('firebase/auth', () => ({
    ...jest.requireActual('firebase/auth'),
    signInWithEmailAndPassword: require('./firebase').signInWithEmailAndPassword,
    onAuthStateChanged: require('./firebase').onAuthStateChanged,
    setPersistence: require('./firebase').setPersistence,
    browserLocalPersistence: require('./firebase').browserLocalPersistence,
    browserSessionPersistence: require('./firebase').browserSessionPersistence,
    signInWithPopup: require('./firebase').signInWithPopup,
    signInWithCustomToken: require('./firebase').signInWithCustomToken,
    sendPasswordResetEmail: require('./firebase').sendPasswordResetEmail,
    sendEmailVerification: require('./firebase').sendEmailVerification,
    reload: require('./firebase').reload,
    GoogleAuthProvider: require('./firebase').GoogleAuthProvider,
  }));
};

/**
 * Common Test Scenarios
 */

/**
 * Simulate Successful Login
 *
 * 성공적인 로그인 시뮬레이션
 */
export const simulateSuccessfulLogin = async (
  email: string = 'admin@test.com',
  password: string = 'correct-password'
): Promise<void> => {
  const { signInWithEmailAndPassword } = require('./firebase');
  const { mockAuth } = require('./firebase');

  await signInWithEmailAndPassword(mockAuth, email, password);
};

/**
 * Simulate Failed Login
 *
 * 실패한 로그인 시뮬레이션 (에러 발생)
 */
export const simulateFailedLogin = async (
  error: Error,
  email: string = 'admin@test.com',
  password: string = 'wrong-password'
): Promise<void> => {
  const { signInWithEmailAndPassword, setMockError } = require('./firebase');
  const { mockAuth } = require('./firebase');

  setMockError(error);

  try {
    await signInWithEmailAndPassword(mockAuth, email, password);
  } catch (e) {
    // 에러 예상됨
  } finally {
    setMockError(null);
  }
};

/**
 * Simulate Logout
 *
 * 로그아웃 시뮬레이션
 */
export const simulateLogout = async (): Promise<void> => {
  const { setMockUser } = require('./firebase');
  setMockUser(null);
};

/**
 * Test ID for elements
 *
 * 테스트 ID 생성 헬퍼
 */
export const testId = (id: string): string => `test-${id}`;

/**
 * Re-export commonly used testing library functions
 */
export {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react';

export { renderHook, waitFor as waitForHook } from '@testing-library/react';
