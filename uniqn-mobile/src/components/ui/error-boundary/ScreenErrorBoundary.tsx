/**
 * ScreenErrorBoundary & FeatureErrorBoundary
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * 화면/기능 단위 에러 경계 래퍼
 */

import React, { type ReactNode, type ErrorInfo } from 'react';
import { env } from '@/config/env';
import { ErrorBoundary } from './ErrorBoundary';

// ============================================================================
// ScreenErrorBoundary
// ============================================================================

interface ScreenErrorBoundaryProps {
  children: ReactNode;
  name?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

/**
 * ScreenErrorBoundary
 *
 * @description 화면 단위 에러 경계 (전체 화면 에러 UI)
 */
export function ScreenErrorBoundary({
  children,
  name,
  onError,
  onReset,
}: ScreenErrorBoundaryProps): React.ReactElement {
  return (
    <ErrorBoundary
      name={name}
      fullScreen
      showDetails={env.isDevelopment}
      onError={onError}
      onReset={onReset}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// FeatureErrorBoundary
// ============================================================================

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

/**
 * FeatureErrorBoundary
 *
 * @description 기능 단위 에러 경계 (인라인 에러 UI)
 */
export function FeatureErrorBoundary({
  children,
  name,
  fallback,
  onError,
  onReset,
}: FeatureErrorBoundaryProps): React.ReactElement {
  return (
    <ErrorBoundary
      name={name}
      fullScreen={false}
      showDetails={env.isDevelopment}
      fallback={fallback}
      onError={onError}
      onReset={onReset}
    >
      {children}
    </ErrorBoundary>
  );
}
