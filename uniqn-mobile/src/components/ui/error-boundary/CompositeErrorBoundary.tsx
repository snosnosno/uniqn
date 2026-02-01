/**
 * CompositeErrorBoundary
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * 여러 종류의 에러를 한 번에 처리하는 복합 에러 경계
 */

import React, { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { NetworkErrorBoundary } from './NetworkErrorBoundary';
import { AuthErrorBoundary } from './AuthErrorBoundary';
import { FormErrorBoundary } from './FormErrorBoundary';
import { DataFetchErrorBoundary } from './DataFetchErrorBoundary';
import type { CompositeErrorBoundaryProps } from './types';

/**
 * CompositeErrorBoundary
 *
 * @description 여러 종류의 에러를 한 번에 처리하는 복합 에러 경계
 *
 * @example
 * ```tsx
 * <CompositeErrorBoundary
 *   handleTypes={['network', 'auth', 'data']}
 *   onLogin={() => router.push('/login')}
 *   resourceName="공고 목록"
 * >
 *   <JobPostingList />
 * </CompositeErrorBoundary>
 * ```
 */
export function CompositeErrorBoundary({
  children,
  handleTypes = ['all'],
  isOffline,
  onLogin,
  onFormReset,
  resourceName,
  ...props
}: CompositeErrorBoundaryProps): React.ReactElement {
  const shouldHandleAll = handleTypes.includes('all');

  // 에러 타입에 따라 중첩된 에러 경계 구성
  let wrappedChildren: ReactNode = children;

  if (shouldHandleAll || handleTypes.includes('form')) {
    wrappedChildren = (
      <FormErrorBoundary {...props} onFormReset={onFormReset}>
        {wrappedChildren}
      </FormErrorBoundary>
    );
  }

  if (shouldHandleAll || handleTypes.includes('data')) {
    wrappedChildren = (
      <DataFetchErrorBoundary {...props} resourceName={resourceName}>
        {wrappedChildren}
      </DataFetchErrorBoundary>
    );
  }

  if (shouldHandleAll || handleTypes.includes('auth')) {
    wrappedChildren = (
      <AuthErrorBoundary {...props} onLogin={onLogin}>
        {wrappedChildren}
      </AuthErrorBoundary>
    );
  }

  if (shouldHandleAll || handleTypes.includes('network')) {
    wrappedChildren = (
      <NetworkErrorBoundary {...props} isOffline={isOffline}>
        {wrappedChildren}
      </NetworkErrorBoundary>
    );
  }

  // 최상위에 기본 에러 경계 추가
  return <ErrorBoundary {...props}>{wrappedChildren}</ErrorBoundary>;
}
