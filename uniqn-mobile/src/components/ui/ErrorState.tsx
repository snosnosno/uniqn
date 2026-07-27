/**
 * UNIQN Mobile - ErrorState 컴포넌트
 *
 * @description 에러 상태 표시 컴포넌트
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { AlertTriangleIcon } from '@/components/icons';
import { extractUserMessage, isAppError, type AppError } from '@/errors';
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
  /**
   * isRetryable 과 무관하게 재시도 버튼을 노출한다.
   * 읽기(조회) 화면 전용 — 재실행에 부작용이 없는 경로에서만 켠다.
   */
  alwaysAllowRetry?: boolean;
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
  alwaysAllowRetry = false,
}: ErrorStateProps) {
  // 에러 메시지 추출
  const errorMessage = React.useMemo(() => {
    if (message) return message;

    if (isAppError(error)) {
      return error.userMessage;
    }

    // 일반 Error는 개발자 메시지(원시 error.message) 노출 금지 — 중앙 sanitize
    if (error instanceof Error) {
      return extractUserMessage(error);
    }

    if (typeof error === 'string') {
      return error;
    }

    return '알 수 없는 오류가 발생했습니다';
  }, [error, message]);

  // 재시도 가능 여부
  //
  // AppError 는 기본 isRetryable=false 라, RLS 거부·파싱 실패 같은 조회 실패에서는
  // '다시 시도' 버튼조차 사라진다. 읽기 재실행은 부작용이 없으므로 조회 화면은
  // alwaysAllowRetry 로 버튼을 남길 수 있게 한다(쓰기 경로는 기존 판정 유지).
  const canRetry = React.useMemo(() => {
    if (!onRetry) return false;
    if (alwaysAllowRetry) return true;
    if (isAppError(error)) {
      return error.isRetryable;
    }
    return true;
  }, [error, onRetry, alwaysAllowRetry]);

  if (compact) {
    return (
      <View className="flex-row items-center bg-error-50 dark:bg-error-900/20 px-4 py-3 rounded-md">
        <View className="mr-3">
          <AlertTriangleIcon size={20} color="#DC2626" />
        </View>
        <Text className="text-error-700 dark:text-error-300 text-sm flex-1 font-sans">
          {errorMessage}
        </Text>
        {canRetry && (
          <Pressable
            onPress={onRetry}
            className="ml-2"
            accessibilityRole="button"
            accessibilityLabel={retryText}
          >
            <Text className="text-error-600 dark:text-error-400 text-sm font-sans-medium">
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
      <View className="w-20 h-20 rounded-sm bg-error-50 dark:bg-error-900/30 items-center justify-center mb-6">
        <AlertTriangleIcon size={40} color="#DC2626" />
      </View>

      {/* 제목 */}
      <Text className="text-xl font-display text-content-primary dark:text-off-white text-center mb-2">
        {title}
      </Text>

      {/* 메시지 */}
      <Text className="text-content-muted dark:text-secondary-400 text-center mb-6 leading-6 font-sans">
        {errorMessage}
      </Text>

      {/* 에러 코드 (AppError인 경우) */}
      {isAppError(error) && (
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-4 font-sans">
          에러 코드: {error.code}
        </Text>
      )}

      {/* 재시도 버튼 */}
      {canRetry && (
        <Button variant="primary" onPress={onRetry} accessibilityLabel={retryText}>
          {retryText}
        </Button>
      )}
    </View>
  );
}
