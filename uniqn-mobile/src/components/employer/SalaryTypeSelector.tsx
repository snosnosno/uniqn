/**
 * UNIQN Mobile - 급여 타입 선택 컴포넌트
 *
 * @description 급여 유형(시급/일급/월급/기타) + 금액 입력
 * @version 1.0.0
 */

import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import {
  type SalaryType,
  type SalaryInfo,
  SALARY_TYPE_LABELS,
  calculatePayByType,
  formatCurrency,
} from '@/utils/settlement';

// ============================================================================
// Types
// ============================================================================

export interface SalaryTypeSelectorProps {
  /** 현재 급여 정보 */
  salaryInfo: SalaryInfo;
  /** 급여 정보 변경 콜백 */
  onChange: (salaryInfo: SalaryInfo) => void;
  /** 근무 시간 (예상 급여 계산용) */
  hoursWorked?: number;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 레이블 표시 여부 */
  showLabel?: boolean;
  /** 예상 급여 표시 여부 */
  showPreview?: boolean;
  /** 추가 스타일 클래스 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SALARY_TYPES: SalaryType[] = ['hourly', 'daily', 'monthly', 'other'];

// ============================================================================
// Component
// ============================================================================

export const SalaryTypeSelector = memo(function SalaryTypeSelector({
  salaryInfo,
  onChange,
  hoursWorked,
  disabled = false,
  error = false,
  errorMessage,
  showLabel = true,
  showPreview = true,
  className = '',
}: SalaryTypeSelectorProps) {
  // 급여 타입 변경 핸들러
  const handleTypeChange = useCallback(
    (type: SalaryType) => {
      if (disabled) return;
      onChange({ ...salaryInfo, type });
    },
    [disabled, onChange, salaryInfo]
  );

  // 급여 금액 변경 핸들러
  const handleAmountChange = useCallback(
    (text: string) => {
      if (disabled) return;
      // 숫자만 추출
      const numericValue = text.replace(/[^0-9]/g, '');
      const amount = parseInt(numericValue, 10) || 0;
      onChange({ ...salaryInfo, amount });
    },
    [disabled, onChange, salaryInfo]
  );

  // 포맷된 금액 (천 단위 콤마)
  const formattedAmount = useMemo(() => {
    return salaryInfo.amount > 0
      ? salaryInfo.amount.toLocaleString('ko-KR')
      : '';
  }, [salaryInfo.amount]);

  // 예상 급여 계산
  const estimatedPay = useMemo(() => {
    if (!showPreview || hoursWorked === undefined || hoursWorked <= 0) {
      return null;
    }
    return calculatePayByType(salaryInfo, hoursWorked);
  }, [showPreview, hoursWorked, salaryInfo]);

  // 급여 타입에 따른 단위 텍스트
  const unitText = useMemo(() => {
    switch (salaryInfo.type) {
      case 'hourly':
        return '원/시간';
      case 'daily':
        return '원/일';
      case 'monthly':
        return '원/월';
      default:
        return '원';
    }
  }, [salaryInfo.type]);

  return (
    <View className={className}>
      {/* 레이블 */}
      {showLabel && (
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          급여 유형
        </Text>
      )}

      {/* 급여 타입 선택 (수평 라디오) */}
      <View className="flex-row flex-wrap gap-2 mb-3">
        {SALARY_TYPES.map((type) => {
          const isSelected = salaryInfo.type === type;
          return (
            <Pressable
              key={type}
              onPress={() => handleTypeChange(type)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={SALARY_TYPE_LABELS[type]}
              className={`
                px-4 py-2 rounded-lg border min-w-[60px] items-center
                ${isSelected
                  ? 'bg-primary-500 border-primary-500'
                  : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
                }
                ${disabled ? 'opacity-50' : 'active:opacity-80'}
                ${error && !isSelected ? 'border-red-500' : ''}
              `}
            >
              <Text
                className={`
                  text-sm font-medium
                  ${isSelected
                    ? 'text-white'
                    : 'text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                {SALARY_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 금액 입력 */}
      <View className="mb-2">
        <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          금액
        </Text>
        <View
          className={`
            flex-row items-center rounded-lg border px-3 h-12
            bg-white dark:bg-surface
            ${error
              ? 'border-red-500'
              : 'border-gray-300 dark:border-surface-overlay'
            }
            ${disabled ? 'opacity-50' : ''}
          `}
        >
          <TextInput
            value={formattedAmount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            editable={!disabled}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-base text-gray-900 dark:text-white"
            accessibilityLabel="급여 금액"
          />
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
            {unitText}
          </Text>
        </View>
      </View>

      {/* 에러 메시지 */}
      {error && errorMessage && (
        <Text className="text-sm text-red-500 mb-2">
          {errorMessage}
        </Text>
      )}

      {/* 예상 급여 미리보기 */}
      {estimatedPay !== null && (
        <View className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              예상 급여
              {salaryInfo.type === 'hourly' && hoursWorked && (
                <Text className="text-xs">
                  {' '}({hoursWorked.toFixed(1)}시간 기준)
                </Text>
              )}
            </Text>
            <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(estimatedPay)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default SalaryTypeSelector;
