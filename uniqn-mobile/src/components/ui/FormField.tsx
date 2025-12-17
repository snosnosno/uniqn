/**
 * UNIQN Mobile - FormField 컴포넌트
 *
 * @description 폼 필드 래퍼 (레이블, 에러 표시 포함)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, type ViewProps } from 'react-native';

// ============================================================================
// Types
// ============================================================================

interface FormFieldProps extends ViewProps {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export function FormField({
  label,
  error,
  hint,
  required = false,
  children,
  className,
  ...props
}: FormFieldProps) {
  return (
    <View className={`mb-4 ${className || ''}`} {...props}>
      {/* 레이블 */}
      {label && (
        <View className="flex-row mb-2">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </Text>
          {required && (
            <Text className="text-red-500 ml-0.5">*</Text>
          )}
        </View>
      )}

      {/* 입력 필드 */}
      {children}

      {/* 에러 메시지 */}
      {error && (
        <View className="flex-row items-center mt-1.5">
          <Text className="text-red-500 mr-1">⚠</Text>
          <Text className="text-red-500 text-sm flex-1">
            {error}
          </Text>
        </View>
      )}

      {/* 힌트 텍스트 */}
      {hint && !error && (
        <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">
          {hint}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// Compound Components
// ============================================================================

interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <View className="mb-6">
      {title && (
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {title}
        </Text>
      )}
      {description && (
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {description}
        </Text>
      )}
      {children}
    </View>
  );
}

interface FormRowProps {
  children: React.ReactNode;
}

export function FormRow({ children }: FormRowProps) {
  return <View className="flex-row gap-3">{children}</View>;
}

// ============================================================================
// Exports
// ============================================================================

export default FormField;
