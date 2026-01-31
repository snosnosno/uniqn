/**
 * UNIQN Mobile - ErrorState 컴포넌트
 *
 * @description 에러 상태 표시 컴포넌트
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { isAppError, type AppError } from '@/errors';
import { Button } from './Button';

// ============================================================================
// Types
// ============================================================================

interface ErrorStateProps {
  error?: AppError | Error | string | null;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryText?: string;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ErrorState({
  error,
  title = '문제가 발생했습니다',
  message,
  onRetry,
  retryText = '다시 시도',
  compact = false,
}: ErrorStateProps) {
  // 에러 메시지 추출
  const errorMessage = React.useMemo(() => {
    if (message) return message;

    if (isAppError(error)) {
      return error.userMessage;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return '알 수 없는 오류가 발생했습니다';
  }, [error, message]);

  // 재시도 가능 여부
  const canRetry = React.useMemo(() => {
    if (!onRetry) return false;
    if (isAppError(error)) {
      return error.isRetryable;
    }
    return true;
  }, [error, onRetry]);

  if (compact) {
    return (
      <View className="flex-row items-center bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl">
        <Text className="text-red-600 dark:text-red-400 text-lg mr-3">⚠</Text>
        <Text className="text-red-700 dark:text-red-300 text-sm flex-1">
          {errorMessage}
        </Text>
        {canRetry && (
          <Pressable
            onPress={onRetry}
            className="ml-2"
            accessibilityRole="button"
            accessibilityLabel={retryText}
          >
            <Text className="text-red-600 dark:text-red-400 text-sm font-medium">
              {retryText}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center p-8">
      {/* 에러 아이콘 */}
      <View className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-6">
        <Text className="text-4xl">⚠️</Text>
      </View>

      {/* 제목 */}
      <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
        {title}
      </Text>

      {/* 메시지 */}
      <Text className="text-gray-600 dark:text-gray-400 text-center mb-6 leading-6">
        {errorMessage}
      </Text>

      {/* 에러 코드 (AppError인 경우) */}
      {isAppError(error) && (
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          에러 코드: {error.code}
        </Text>
      )}

      {/* 재시도 버튼 */}
      {canRetry && (
        <Button
          variant="primary"
          onPress={onRetry}
          accessibilityLabel={retryText}
        >
          {retryText}
        </Button>
      )}
    </View>
  );
}

export default ErrorState;
