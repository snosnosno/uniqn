/**
 * FormErrorBoundary
 *
 * @description Phase 5 - ErrorBoundary 모듈 분리
 * @version 1.0.0
 *
 * 폼 관련 에러를 처리하는 에러 경계
 * - 유효성 검증 실패
 * - 제출 실패
 * - 데이터 처리 오류
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { logger } from '@/utils/logger';
import { isFormRelatedError } from './helpers';
import type {
  FormErrorBoundaryProps,
  FormErrorFallbackProps,
  ErrorBoundaryState,
} from './types';

// ============================================================================
// FormErrorFallback
// ============================================================================

/**
 * FormErrorFallback
 *
 * @description 폼 에러 시 표시할 UI
 */
function FormErrorFallback({
  error,
  onRetry,
  onReset,
}: FormErrorFallbackProps): React.ReactElement {
  const isValidationError = error?.message.includes('validation') || error?.message.includes('검증');

  return (
    <View className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
      <View className="flex-row items-center mb-3">
        <Text className="text-2xl mr-3">⚠️</Text>
        <Text className="text-base font-semibold text-red-800 dark:text-red-200 flex-1">
          {isValidationError ? '입력값을 확인해주세요' : '폼 처리 중 오류 발생'}
        </Text>
      </View>

      {error && (
        <Text className="text-sm text-red-600 dark:text-red-400 mb-4 leading-5">
          {error.message}
        </Text>
      )}

      <View className="flex-row gap-2">
        <Pressable
          onPress={onRetry}
          className="flex-1 bg-red-600 min-h-[44px] py-2.5 rounded-lg active:bg-red-700 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text className="text-white font-medium text-center text-sm">다시 시도</Text>
        </Pressable>

        <Pressable
          onPress={onReset}
          className="flex-1 bg-gray-200 dark:bg-surface min-h-[44px] py-2.5 rounded-lg active:bg-gray-300 dark:active:bg-gray-600 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="초기화"
        >
          <Text className="text-gray-700 dark:text-gray-200 font-medium text-center text-sm">초기화</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// FormErrorBoundary
// ============================================================================

/**
 * FormErrorBoundary
 *
 * @description 폼 관련 에러를 처리하는 에러 경계
 */
export class FormErrorBoundary extends Component<
  FormErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: FormErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 폼 관련 에러인지 확인 (AppError 타입 기반 + 레거시 폴백)
    if (isFormRelatedError(error)) {
      return { hasError: true, error };
    }

    // 폼 에러가 아니면 상위로 전파
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name = 'Form', onError } = this.props;

    this.setState({ errorInfo });

    logger.error(`FormErrorBoundary [${name}] 에러 캐치`, error, {
      component: name,
      errorType: 'form',
    });

    // 폼 에러는 Crashlytics에 보내지 않음 (사용자 입력 오류)
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

  handleFormReset = (): void => {
    const { onFormReset } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onFormReset) {
      onFormReset();
    }
  };

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) return fallback;
      return (
        <FormErrorFallback
          error={error}
          onRetry={this.handleRetry}
          onReset={this.handleFormReset}
        />
      );
    }

    return children;
  }
}
