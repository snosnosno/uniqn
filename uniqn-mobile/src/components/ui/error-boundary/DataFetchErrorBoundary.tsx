/**
 * DataFetchErrorBoundary
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * 데이터 페칭 관련 에러를 처리하는 에러 경계
 * - API 호출 실패
 * - 데이터 파싱 오류
 * - 존재하지 않는 리소스
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { crashlyticsService } from '@/services/crashlyticsService';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';
import { isDataFetchRelatedError } from './helpers';
import type {
  DataFetchErrorBoundaryProps,
  DataFetchErrorFallbackProps,
  ErrorBoundaryState,
} from './types';

// ============================================================================
// DataFetchErrorFallback
// ============================================================================

/**
 * DataFetchErrorFallback
 *
 * @description 데이터 로딩 에러 시 표시할 UI
 */
function DataFetchErrorFallback({
  error,
  onRetry,
  resourceName = '데이터',
}: DataFetchErrorFallbackProps): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <View className="w-16 h-16 rounded-full bg-gray-100 dark:bg-surface items-center justify-center mb-4">
        <Text className="text-3xl">📭</Text>
      </View>

      <Text className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
        {resourceName}를 불러올 수 없습니다
      </Text>

      <Text className="text-gray-500 dark:text-gray-400 text-center mb-4 text-sm">
        잠시 후 다시 시도해주세요
      </Text>

      {env.isDevelopment && error && (
        <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mb-4 font-mono">
          {error.message}
        </Text>
      )}

      <Pressable
        onPress={onRetry}
        className="bg-gray-200 dark:bg-surface px-5 min-h-[44px] py-2.5 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="새로고침"
      >
        <Text className="text-gray-700 dark:text-gray-200 font-medium">새로고침</Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// DataFetchErrorBoundary
// ============================================================================

/**
 * DataFetchErrorBoundary
 *
 * @description 데이터 페칭 관련 에러를 처리하는 에러 경계
 */
export class DataFetchErrorBoundary extends Component<
  DataFetchErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: DataFetchErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 데이터 페칭 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isDataFetchRelatedError(error)) {
      return { hasError: true, error };
    }

    // 데이터 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'DataFetch', onError, resourceName } = this.props;

    this.setState({ errorInfo });

    logger.error(`DataFetchErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'dataFetch',
      resourceName,
    });

    crashlyticsService.recordError(error, {
      domain: 'dataFetch',
      component: name,
      resourceName,
    });

    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    const { onReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onReset) {
      onReset();
    }
  };

  render(): ReactNode {
    const { children, fallback, resourceName } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <DataFetchErrorFallback
          error={error}
          onRetry={this.handleRetry}
          resourceName={resourceName}
        />
      );
    }

    return children;
  }
}
