/**
 * UNIQN Mobile - 숫자 입력 공통 컴포넌트
 *
 * @description 숫자만 허용, 천단위 콤마 표시, suffix(원/시간/분 등) 지원
 * @version 1.0.0
 */

import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface NumericInputProps {
  /** 현재 숫자 값 */
  value: number | undefined;
  /** 값 변경 콜백 */
  onChange: (value: number) => void;
  /** 입력 필드 placeholder */
  placeholder?: string;
  /** 오른쪽에 표시할 단위 (예: '원', '시간', '분', '%') */
  suffix?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 접근성 라벨 */
  accessibilityLabel?: string;
  /** 컨테이너 추가 클래스 */
  className?: string;
  /** TextInput 추가 클래스 */
  inputClassName?: string;
  /** 최솟값 (기본: 0) */
  min?: number;
  /** 최댓값 */
  max?: number;
  /** 0 이하일 때 빈 문자열 표시 여부 (기본: true) */
  hideZero?: boolean;
  /** 추가 TextInput props (keyboardType 등 오버라이드 가능) */
  textInputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'editable'>;
}

// ============================================================================
// Component
// ============================================================================

export const NumericInput = memo(function NumericInput({
  value,
  onChange,
  placeholder = '0',
  suffix,
  disabled = false,
  error = false,
  accessibilityLabel,
  className = '',
  inputClassName = '',
  min = 0,
  max,
  hideZero = true,
  textInputProps,
}: NumericInputProps) {
  // 천단위 콤마 포맷
  const formattedValue = useMemo(() => {
    if (value === undefined || value === null) return '';
    if (hideZero && value <= 0) return '';
    return value.toLocaleString('ko-KR');
  }, [value, hideZero]);

  // 숫자만 추출 후 onChange 호출
  const handleChangeText = useCallback(
    (text: string) => {
      if (disabled) return;

      const numericValue = text.replace(/[^0-9]/g, '');
      let amount = parseInt(numericValue, 10) || 0;

      // 범위 제한
      if (amount < min) amount = min;
      if (max !== undefined && amount > max) amount = max;

      onChange(amount);
    },
    [disabled, onChange, min, max]
  );

  return (
    <View
      className={`
        flex-row items-center rounded-lg border px-3 h-10
        bg-white dark:bg-surface
        ${error ? 'border-red-500' : 'border-gray-300 dark:border-surface-overlay'}
        ${disabled ? 'opacity-50' : ''}
        ${className}
      `}
    >
      <TextInput
        value={formattedValue}
        onChangeText={handleChangeText}
        keyboardType="numeric"
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        className={`flex-1 text-base text-gray-900 dark:text-white ${inputClassName}`}
        accessibilityLabel={accessibilityLabel}
        {...textInputProps}
      />
      {suffix ? (
        <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">{suffix}</Text>
      ) : null}
    </View>
  );
});

export default NumericInput;
