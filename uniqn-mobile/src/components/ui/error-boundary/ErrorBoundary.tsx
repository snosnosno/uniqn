/**
 * ErrorBoundary 기본 클래스
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * React 에러 경계 패턴을 구현하여 자식 컴포넌트에서 발생하는
 * JavaScript 에러를 캐치하고, 앱 크래시를 방지합니다.
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { isAppError } from '@/errors';
import { sentryService } from '@/services/observability';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';
import type { ErrorBoundaryProps, ErrorBoundaryState } from './types';

// ============================================================================
// ErrorBoundary Component
// ============================================================================

/**
 * ErrorBoundary
 *
 * @description
 * React의 에러 경계 패턴을 구현하여 자식 컴포넌트에서 발생하는
 * JavaScript 에러를 캐치하고, 앱 크래시를 방지합니다.
 *
 * 에러 발생 시:
 * 1. Sentry에 에러 리포트 전송
 * 2. 로그 기록
 * 3. 대체 UI 표시
 * 4. 복구 옵션 제공
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <ErrorBoundary name="MyFeature">
 *   <MyFeatureComponent />
 * </ErrorBoundary>
 *
 * // 커스텀 fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <RiskyComponent />
 * </ErrorBoundary>
 *
 * // 전체 화면 에러
 * <ErrorBoundary fullScreen>
 *   <AppContent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * 에러 발생 시 상태 업데이트
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * 에러 캐치 후 처리
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Unknown', onError } = this.props;
    const logContext = {
      component: name,
      boundary: 'ErrorBoundary',
      componentStack: errorInfo.componentStack || '',
    };

    // 상태 업데이트
    this.setState({ errorInfo });

    // 로깅
    if (isAppError(error)) {
      logger.appError(error, logContext);
    } else {
      logger.error(`ErrorBoundary [${name}] 에러 캐치`, error, logContext);
    }

    // Sentry에 리포팅
    void sentryService.recordComponentError(error, {
      componentStack: errorInfo.componentStack || undefined,
    });

    // 사용자 정의 콜백
    if (onError) {
      onError(error, errorInfo);
    }
  }

  /**
   * 에러 복구 (상태 초기화)
   */
  handleReset = (): void => {
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

  /**
   * 에러 UI 렌더링
   */
  renderError(): ReactNode {
    const { fallback, fullScreen = false, showDetails = env.isDevelopment, name } = this.props;
    const { error, errorInfo } = this.state;

    // 커스텀 fallback이 있으면 사용
    if (fallback) {
      return fallback;
    }

    const containerClass = fullScreen ? 'flex-1 bg-white dark:bg-surface-dark' : 'p-4';

    return (
      <View className={containerClass}>
        <View className="flex-1 items-center justify-center p-6">
          {/* 에러 아이콘 */}
          <View className="w-20 h-20 rounded-sm bg-error-50 dark:bg-error-900/30 items-center justify-center mb-6">
            <Text className="text-4xl font-sans">{''}</Text>
          </View>

          {/* 제목 */}
          <Text className="text-xl font-display text-content-primary dark:text-off-white text-center mb-2">
            문제가 발생했습니다
          </Text>

          {/* 설명 */}
          <Text className="text-content-muted dark:text-secondary-400 text-center mb-6 leading-6 font-sans">
            {fullScreen
              ? '앱에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
              : '이 기능에 문제가 발생했습니다.'}
          </Text>

          {/* 개발 모드 상세 정보 */}
          {showDetails && error && (
            <ScrollView
              className="max-h-40 w-full bg-surface-card dark:bg-surface rounded-md p-4 mb-6"
              showsVerticalScrollIndicator={true}
            >
              <Text className="text-xs text-error-600 dark:text-error-400 font-mono mb-2 font-sans">
                {name && `[${name}] `}
                {error.name}: {error.message}
              </Text>
              {errorInfo?.componentStack && (
                <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-mono font-sans">
                  {errorInfo.componentStack.slice(0, 500)}
                </Text>
              )}
            </ScrollView>
          )}

          {/* 복구 버튼 */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={this.handleReset}
              className="bg-primary-600 px-6 py-3 rounded-md active:bg-primary-700"
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
            >
              <Text className="text-surface-dark font-sans-semibold">다시 시도</Text>
            </Pressable>

            {fullScreen && (
              <Pressable
                onPress={() => {
                  // 앱 재시작을 유도하는 UI (실제 재시작은 네이티브에서 처리)
                  this.handleReset();
                }}
                className="bg-secondary-200 dark:bg-surface px-6 py-3 rounded-md active:bg-secondary-300 dark:active:bg-secondary-600"
                accessibilityRole="button"
                accessibilityLabel="홈으로"
              >
                <Text className="text-content-secondary dark:text-secondary-200 font-sans-semibold">
                  홈으로
                </Text>
              </Pressable>
            )}
          </View>

          {/* 문의 안내 */}
          {fullScreen && (
            <Text className="text-xs text-content-placeholder mt-6 text-center font-sans">
              문제가 계속되면 고객센터에 문의해주세요
            </Text>
          )}
        </View>
      </View>
    );
  }

  render(): ReactNode {
    const { children } = this.props;
    const { hasError } = this.state;

    if (hasError) {
      return this.renderError();
    }

    return children;
  }
}

// ============================================================================
// HOC (Higher Order Component)
// ============================================================================

/**
 * withErrorBoundary HOC
 *
 * @description 컴포넌트를 ErrorBoundary로 감싸는 HOC
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(RiskyComponent, {
 *   name: 'RiskyComponent',
 *   fullScreen: true,
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => {
    return (
      <ErrorBoundary name={displayName} {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}
