/**
 * ErrorBoundary module barrel export
 *
 * @description Phase 5 - ErrorBoundary module split
 * @version 1.0.0
 *
 * Recommended import paths:
 * - import { ErrorBoundary } from '@/components/ui/error-boundary'
 * - import { ErrorBoundary } from '@/components/ui'
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
