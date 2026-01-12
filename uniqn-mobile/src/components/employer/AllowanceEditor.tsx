/**
 * UNIQN Mobile - 수당 편집 컴포넌트
 *
 * @description 식비/교통비/숙박비 수당 설정 (제공 또는 금액)
 * @version 1.0.0
 */

import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type Allowances,
  PROVIDED_FLAG,
  formatCurrency,
} from '@/utils/settlement';

// ============================================================================
// Types
// ============================================================================

export interface AllowanceEditorProps {
  /** 현재 수당 정보 */
  allowances: Allowances;
  /** 수당 정보 변경 콜백 */
  onChange: (allowances: Allowances) => void;
  /** 근무 일수 (일당 계산용) */
  workDays?: number;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 레이블 표시 여부 */
  showLabel?: boolean;
  /** 총 수당 표시 여부 */
  showTotal?: boolean;
  /** 추가 스타일 클래스 */
  className?: string;
}

type AllowanceType = 'meal' | 'transportation' | 'accommodation';

interface AllowanceItemConfig {
  key: AllowanceType;
  label: string;
  icon: string;
  placeholder: string;
}

// ============================================================================
// Constants
// ============================================================================

const ALLOWANCE_ITEMS: AllowanceItemConfig[] = [
  {
    key: 'meal',
    label: '식비',
    icon: 'restaurant-outline',
    placeholder: '10,000',
  },
  {
    key: 'transportation',
    label: '교통비',
    icon: 'bus-outline',
    placeholder: '10,000',
  },
  {
    key: 'accommodation',
    label: '숙박비',
    icon: 'bed-outline',
    placeholder: '50,000',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 수당 값의 상태 확인
 */
function getAllowanceStatus(value: number | undefined): 'none' | 'provided' | 'amount' {
  if (value === undefined || value === 0) return 'none';
  if (value === PROVIDED_FLAG) return 'provided';
  return 'amount';
}

/**
 * 총 수당 금액 계산 (금액만, 제공은 제외)
 */
function calculateTotalAllowance(allowances: Allowances): number {
  let total = 0;

  if (allowances.meal && allowances.meal !== PROVIDED_FLAG && allowances.meal > 0) {
    total += allowances.meal;
  }
  if (allowances.transportation && allowances.transportation !== PROVIDED_FLAG && allowances.transportation > 0) {
    total += allowances.transportation;
  }
  if (allowances.accommodation && allowances.accommodation !== PROVIDED_FLAG && allowances.accommodation > 0) {
    total += allowances.accommodation;
  }
  // 추가 수당
  if (allowances.additional && allowances.additional > 0) {
    total += allowances.additional;
  }

  return total;
}

// ============================================================================
// Sub Components
// ============================================================================

interface AllowanceItemProps {
  config: AllowanceItemConfig;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}

const AllowanceItem = memo(function AllowanceItem({
  config,
  value,
  onChange,
  disabled = false,
}: AllowanceItemProps) {
  const status = getAllowanceStatus(value);
  const isEnabled = status !== 'none';

  // 체크박스 토글
  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (isEnabled) {
      // 해제 시 값 삭제
      onChange(undefined);
    } else {
      // 활성화 시 기본값으로 "제공" 설정
      onChange(PROVIDED_FLAG);
    }
  }, [disabled, isEnabled, onChange]);

  // 제공/금액 전환
  const handleModeChange = useCallback((mode: 'provided' | 'amount') => {
    if (disabled) return;
    if (mode === 'provided') {
      onChange(PROVIDED_FLAG);
    } else {
      // 금액 모드로 전환 시 기본값 설정
      onChange(10000);
    }
  }, [disabled, onChange]);

  // 금액 변경
  const handleAmountChange = useCallback((text: string) => {
    if (disabled) return;
    const numericValue = text.replace(/[^0-9]/g, '');
    const amount = parseInt(numericValue, 10) || 0;
    onChange(amount);
  }, [disabled, onChange]);

  // 포맷된 금액
  const formattedAmount = useMemo(() => {
    if (status !== 'amount' || !value || value <= 0) return '';
    return value.toLocaleString('ko-KR');
  }, [status, value]);

  return (
    <View className="mb-4">
      {/* 체크박스 + 라벨 */}
      <Pressable
        onPress={handleToggle}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isEnabled, disabled }}
        accessibilityLabel={config.label}
        className={`flex-row items-center ${disabled ? 'opacity-50' : ''}`}
      >
        {/* 체크박스 */}
        <View
          className={`
            h-5 w-5 rounded border-2 items-center justify-center mr-3
            ${isEnabled
              ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500'
              : 'bg-transparent border-gray-300 dark:border-gray-500'
            }
          `}
        >
          {isEnabled && (
            <Ionicons name="checkmark" size={14} color="white" />
          )}
        </View>

        {/* 아이콘 + 라벨 */}
        <View className="flex-row items-center flex-1">
          <Ionicons
            name={config.icon}
            size={18}
            color={isEnabled ? '#4F46E5' : '#9CA3AF'}
          />
          <Text
            className={`ml-2 text-base font-medium ${
              isEnabled
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {config.label}
          </Text>
        </View>
      </Pressable>

      {/* 활성화된 경우: 제공/금액 선택 */}
      {isEnabled && (
        <View className="ml-8 mt-2">
          {/* 제공/금액 라디오 버튼 */}
          <View className="flex-row gap-4 mb-2">
            {/* 제공 옵션 */}
            <Pressable
              onPress={() => handleModeChange('provided')}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: status === 'provided', disabled }}
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                status === 'provided'
                  ? 'bg-indigo-100 dark:bg-indigo-900/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <View
                className={`h-4 w-4 rounded-full border-2 mr-2 items-center justify-center ${
                  status === 'provided'
                    ? 'border-indigo-600 dark:border-indigo-400'
                    : 'border-gray-400 dark:border-gray-500'
                }`}
              >
                {status === 'provided' && (
                  <View className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </View>
              <Text
                className={`text-sm ${
                  status === 'provided'
                    ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                제공
              </Text>
            </Pressable>

            {/* 금액 옵션 */}
            <Pressable
              onPress={() => handleModeChange('amount')}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: status === 'amount', disabled }}
              className={`flex-row items-center px-3 py-1.5 rounded-full ${
                status === 'amount'
                  ? 'bg-indigo-100 dark:bg-indigo-900/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <View
                className={`h-4 w-4 rounded-full border-2 mr-2 items-center justify-center ${
                  status === 'amount'
                    ? 'border-indigo-600 dark:border-indigo-400'
                    : 'border-gray-400 dark:border-gray-500'
                }`}
              >
                {status === 'amount' && (
                  <View className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </View>
              <Text
                className={`text-sm ${
                  status === 'amount'
                    ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                금액
              </Text>
            </Pressable>
          </View>

          {/* 금액 입력 필드 (금액 모드일 때만) */}
          {status === 'amount' && (
            <View
              className={`
                flex-row items-center rounded-lg border px-3 h-10
                bg-white dark:bg-gray-800
                border-gray-300 dark:border-gray-600
                ${disabled ? 'opacity-50' : ''}
              `}
            >
              <TextInput
                value={formattedAmount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                editable={!disabled}
                placeholder={config.placeholder}
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-base text-gray-900 dark:text-white"
                accessibilityLabel={`${config.label} 금액`}
              />
              <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                원
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const AllowanceEditor = memo(function AllowanceEditor({
  allowances,
  onChange,
  workDays,
  disabled = false,
  showLabel = true,
  showTotal = true,
  className = '',
}: AllowanceEditorProps) {
  // 개별 수당 변경 핸들러
  const handleItemChange = useCallback(
    (key: AllowanceType, value: number | undefined) => {
      const newAllowances = { ...allowances };

      if (value === undefined) {
        delete newAllowances[key];
      } else {
        newAllowances[key] = value;
      }

      onChange(newAllowances);
    },
    [allowances, onChange]
  );

  // 총 수당 계산
  const totalAllowance = useMemo(
    () => calculateTotalAllowance(allowances),
    [allowances]
  );

  // 제공 항목 수
  const providedCount = useMemo(() => {
    let count = 0;
    if (allowances.meal === PROVIDED_FLAG) count++;
    if (allowances.transportation === PROVIDED_FLAG) count++;
    if (allowances.accommodation === PROVIDED_FLAG) count++;
    return count;
  }, [allowances]);

  return (
    <View className={className}>
      {/* 레이블 */}
      {showLabel && (
        <Text className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          수당 설정
        </Text>
      )}

      {/* 수당 항목들 */}
      {ALLOWANCE_ITEMS.map((config) => (
        <AllowanceItem
          key={config.key}
          config={config}
          value={allowances[config.key]}
          onChange={(value) => handleItemChange(config.key, value)}
          disabled={disabled}
        />
      ))}

      {/* 추가 수당 입력 */}
      <View className="mb-4">
        <View className="flex-row items-center mb-2">
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={allowances.additional && allowances.additional > 0 ? '#4F46E5' : '#9CA3AF'}
          />
          <Text
            className={`ml-2 text-base font-medium ${
              allowances.additional && allowances.additional > 0
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            추가 수당
          </Text>
        </View>
        <View
          className={`
            flex-row items-center rounded-lg border px-3 h-10
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            ${disabled ? 'opacity-50' : ''}
          `}
        >
          <TextInput
            value={allowances.additional && allowances.additional > 0
              ? allowances.additional.toLocaleString('ko-KR')
              : ''}
            onChangeText={(text) => {
              if (disabled) return;
              const numericValue = text.replace(/[^0-9]/g, '');
              const amount = parseInt(numericValue, 10) || 0;
              onChange({
                ...allowances,
                additional: amount > 0 ? amount : undefined,
              });
            }}
            keyboardType="numeric"
            editable={!disabled}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-base text-gray-900 dark:text-white"
            accessibilityLabel="추가 수당 금액"
          />
          <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
            원
          </Text>
        </View>
        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-1">
          기타 수당 금액을 직접 입력하세요
        </Text>
      </View>

      {/* 구분선 */}
      {showTotal && (totalAllowance > 0 || providedCount > 0) && (
        <View className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
      )}

      {/* 총 수당 요약 */}
      {showTotal && (totalAllowance > 0 || providedCount > 0) && (
        <View className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              총 수당
              {workDays && workDays > 1 && (
                <Text className="text-xs"> ({workDays}일 기준)</Text>
              )}
            </Text>
            <View className="items-end">
              {totalAllowance > 0 && (
                <Text className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(totalAllowance * (workDays || 1))}
                </Text>
              )}
              {providedCount > 0 && (
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  + {providedCount}개 항목 제공
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

export default AllowanceEditor;
