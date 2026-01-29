/**
 * ErrorBoundary 모듈 배럴 export
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * 기존 import 경로 호환성 유지:
 * - import { ErrorBoundary } from '@/components/ui/ErrorBoundary' → 동작
 * - import { ErrorBoundary } from '@/components/ui/error-boundary' → 동작
 * - import { ErrorBoundary } from '@/components/ui' → 동작
 */

// ============================================================================
// Types
// ============================================================================

export type {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  NetworkErrorBoundaryProps,
  AuthErrorBoundaryProps,
  FormErrorBoundaryProps,
  DataFetchErrorBoundaryProps,
  CompositeErrorBoundaryProps,
  NetworkErrorFallbackProps,
  AuthErrorFallbackProps,
  FormErrorFallbackProps,
  DataFetchErrorFallbackProps,
} from './types';

// ============================================================================
// Helpers
// ============================================================================

export {
  isNetworkRelatedError,
  isAuthRelatedError,
  isFormRelatedError,
  isDataFetchRelatedError,
} from './helpers';

// ============================================================================
// Base ErrorBoundary
// ============================================================================

export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// ============================================================================
// Screen/Feature Boundaries
// ============================================================================

export { ScreenErrorBoundary, FeatureErrorBoundary } from './ScreenErrorBoundary';

// ============================================================================
// Specialized Boundaries
// ============================================================================

export { NetworkErrorBoundary } from './NetworkErrorBoundary';
export { AuthErrorBoundary } from './AuthErrorBoundary';
export { FormErrorBoundary } from './FormErrorBoundary';
export { DataFetchErrorBoundary } from './DataFetchErrorBoundary';
export { CompositeErrorBoundary } from './CompositeErrorBoundary';

// ============================================================================
// Default Export
// ============================================================================

export { ErrorBoundary as default } from './ErrorBoundary';
