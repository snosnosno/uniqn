/**
 * AuthErrorBoundary
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * 인증 관련 에러를 처리하는 에러 경계
 * - 세션 만료
 * - 권한 없음
 * - 인증 실패
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { crashlyticsService } from '@/services/crashlyticsService';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';
import { isAuthRelatedError } from './helpers';
import type { AuthErrorBoundaryProps, AuthErrorFallbackProps, ErrorBoundaryState } from './types';

// ============================================================================
// AuthErrorFallback
// ============================================================================

/**
 * AuthErrorFallback
 *
 * @description 인증 에러 시 표시할 UI
 */
function AuthErrorFallback({
  error,
  onLogin,
  onRetry,
}: AuthErrorFallbackProps): React.ReactElement {
  const isSessionExpired = error?.message.includes('expired') || error?.message.includes('만료');

  return (
    <View className="flex-1 items-center justify-center p-6 bg-white dark:bg-surface-dark">
      <View className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 items-center justify-center mb-6">
        <Text className="text-4xl">🔐</Text>
      </View>

      <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
        {isSessionExpired ? '세션이 만료되었습니다' : '로그인이 필요합니다'}
      </Text>

      <Text className="text-gray-600 dark:text-gray-400 text-center mb-6 leading-6">
        {isSessionExpired
          ? '보안을 위해 다시 로그인해주세요.'
          : '이 기능을 사용하려면 로그인이 필요합니다.'}
      </Text>

      {env.isDevelopment && error && (
        <View className="w-full bg-gray-100 dark:bg-surface rounded-xl p-4 mb-6">
          <Text className="text-xs text-yellow-600 dark:text-yellow-400 font-mono">
            {error.message}
          </Text>
        </View>
      )}

      <View className="flex-row gap-3">
        <Pressable
          onPress={onLogin}
          className="bg-indigo-600 px-6 py-3 rounded-xl active:bg-indigo-700"
          accessibilityRole="button"
          accessibilityLabel="로그인"
        >
          <Text className="text-white font-semibold">로그인</Text>
        </Pressable>

        <Pressable
          onPress={onRetry}
          className="bg-gray-200 dark:bg-surface px-6 py-3 rounded-xl active:bg-gray-300 dark:active:bg-gray-600"
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text className="text-gray-700 dark:text-gray-200 font-semibold">다시 시도</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// AuthErrorBoundary
// ============================================================================

/**
 * AuthErrorBoundary
 *
 * @description 인증 관련 에러를 처리하는 에러 경계
 */
export class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 인증 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isAuthRelatedError(error)) {
      return { hasError: true, error };
    }

    // 인증 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Auth', onError } = this.props;

    this.setState({ errorInfo });

    logger.error(`AuthErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'auth',
    });

    crashlyticsService.recordError(error, {
      domain: 'auth',
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

  handleLogin = (): void => {
    const { onLogin } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onLogin) {
      onLogin();
    }
  };

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <AuthErrorFallback error={error} onLogin={this.handleLogin} onRetry={this.handleRetry} />
      );
    }

    return children;
  }
}
