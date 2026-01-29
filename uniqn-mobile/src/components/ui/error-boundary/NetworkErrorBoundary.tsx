/**
 * NetworkErrorBoundary
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * 네트워크 관련 에러를 처리하는 에러 경계
 * - 오프라인 상태 감지
 * - 네트워크 타임아웃 처리
 * - 서버 연결 실패 처리
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { crashlyticsService } from '@/services/crashlyticsService';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';
import { isNetworkRelatedError } from './helpers';
import type {
  NetworkErrorBoundaryProps,
  NetworkErrorFallbackProps,
  ErrorBoundaryState,
} from './types';

// ============================================================================
// NetworkErrorFallback
// ============================================================================

/**
 * NetworkErrorFallback
 *
 * @description 네트워크 에러 시 표시할 UI
 */
function NetworkErrorFallback({
  error,
  onRetry,
  isOffline = false,
}: NetworkErrorFallbackProps): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-white dark:bg-gray-900">
      <View className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center mb-6">
        <Text className="text-4xl">{isOffline ? '📡' : '🌐'}</Text>
      </View>

      <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
        {isOffline ? '오프라인 상태입니다' : '네트워크 오류'}
      </Text>

      <Text className="text-gray-600 dark:text-gray-400 text-center mb-6 leading-6">
        {isOffline
          ? '인터넷 연결을 확인해주세요.'
          : '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'}
      </Text>

      {env.isDevelopment && error && (
        <View className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-6">
          <Text className="text-xs text-orange-600 dark:text-orange-400 font-mono">
            {error.message}
          </Text>
        </View>
      )}

      <Pressable
        onPress={onRetry}
        className="bg-orange-600 px-6 py-3 rounded-xl active:bg-orange-700"
        accessibilityRole="button"
        accessibilityLabel="다시 시도"
      >
        <Text className="text-white font-semibold">다시 시도</Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// NetworkErrorBoundary
// ============================================================================

/**
 * NetworkErrorBoundary
 *
 * @description 네트워크 관련 에러를 처리하는 에러 경계
 */
export class NetworkErrorBoundary extends Component<
  NetworkErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: NetworkErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 네트워크 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isNetworkRelatedError(error)) {
      return { hasError: true, error };
    }

    // 네트워크 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Network', onError } = this.props;

    this.setState({ errorInfo });

    logger.error(`NetworkErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'network',
    });

    crashlyticsService.recordError(error, {
      domain: 'network',
      component: name,
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
    const { children, isOffline = false, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <NetworkErrorFallback
          error={error}
          onRetry={this.handleRetry}
          isOffline={isOffline}
        />
      );
    }

    return children;
  }
}
