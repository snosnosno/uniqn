/**
 * ErrorBoundary 공통 타입 정의
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 */

import type { ReactNode, ErrorInfo } from 'react';

// ============================================================================
// Base Types
// ============================================================================

/**
 * ErrorBoundary 기본 Props
 */
export interface ErrorBoundaryProps {
  /** 자식 컴포넌트 */
  children: ReactNode;
  /** 컴포넌트 이름 (디버깅용) */
  name?: string;
  /** 에러 발생 시 표시할 대체 UI */
  fallback?: ReactNode;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 에러 복구 시 콜백 */
  onReset?: () => void;
  /** 전체 화면 에러 UI 여부 */
  fullScreen?: boolean;
  /** 개발 모드에서 에러 상세 표시 여부 */
  showDetails?: boolean;
}

/**
 * ErrorBoundary 상태
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// Specialized Error Boundary Types
// ============================================================================

/**
 * NetworkErrorBoundary Props
 */
export interface NetworkErrorBoundaryProps extends ErrorBoundaryProps {
  /** 오프라인 상태 */
  isOffline?: boolean;
}

/**
 * AuthErrorBoundary Props
 */
export interface AuthErrorBoundaryProps extends ErrorBoundaryProps {
  /** 로그인 콜백 */
  onLogin?: () => void;
}

/**
 * FormErrorBoundary Props
 */
export interface FormErrorBoundaryProps extends ErrorBoundaryProps {
  /** 폼 초기화 콜백 */
  onFormReset?: () => void;
}

/**
 * DataFetchErrorBoundary Props
 */
export interface DataFetchErrorBoundaryProps extends ErrorBoundaryProps {
  /** 리소스 이름 */
  resourceName?: string;
}

/**
 * CompositeErrorBoundary Props
 */
export interface CompositeErrorBoundaryProps extends ErrorBoundaryProps {
  /** 처리할 에러 타입 */
  handleTypes?: ('network' | 'auth' | 'form' | 'data' | 'all')[];
  /** 오프라인 상태 */
  isOffline?: boolean;
  /** 로그인 콜백 */
  onLogin?: () => void;
  /** 폼 초기화 콜백 */
  onFormReset?: () => void;
  /** 리소스 이름 */
  resourceName?: string;
}

// ============================================================================
// Fallback Types
// ============================================================================

/**
 * NetworkErrorFallback Props
 */
export interface NetworkErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  isOffline?: boolean;
}

/**
 * AuthErrorFallback Props
 */
export interface AuthErrorFallbackProps {
  error: Error | null;
  onLogin: () => void;
  onRetry: () => void;
}

/**
 * FormErrorFallback Props
 */
export interface FormErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  onReset: () => void;
}

/**
 * DataFetchErrorFallback Props
 */
export interface DataFetchErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  resourceName?: string;
}
