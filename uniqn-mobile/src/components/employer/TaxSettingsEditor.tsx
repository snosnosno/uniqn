/**
 * UNIQN Mobile - 세금 설정 컴포넌트
 *
 * @description 세금 설정 (없음/세율/고정 금액) + 적용 대상 선택
 * @version 2.0.0
 */

import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatCurrency,
  calculateTaxAmount,
  calculateAfterTaxAmount,
  type TaxType,
  type TaxSettings,
  type TaxableItems,
  DEFAULT_TAXABLE_ITEMS,
} from '@/utils/settlement';

// Re-export types and functions for backward compatibility
export type { TaxType, TaxSettings, TaxableItems };
export { DEFAULT_TAXABLE_ITEMS, calculateTaxAmount, calculateAfterTaxAmount };

export interface TaxSettingsEditorProps {
  /** 현재 세금 설정 */
  taxSettings: TaxSettings;
  /** 세금 설정 변경 콜백 */
  onChange: (settings: TaxSettings) => void;
  /** 총 금액 (세후 미리보기용) */
  totalAmount?: number;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 레이블 표시 여부 */
  showLabel?: boolean;
  /** 세후 금액 미리보기 표시 여부 */
  showPreview?: boolean;
  /** 추가 스타일 클래스 */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TAX_TYPE_OPTIONS: { type: TaxType; label: string }[] = [
  { type: 'none', label: '없음' },
  { type: 'rate', label: '세율' },
  { type: 'fixed', label: '고정 금액' },
];

const COMMON_TAX_RATES = [
  { rate: 3.3, label: '3.3% (프리랜서)' },
  { rate: 8.8, label: '8.8% (일반)' },
  { rate: -1, label: '기타' }, // 기타는 직접 입력을 위한 마커
];

/** 세금 적용 대상 항목 설정 (기본급은 항상 적용되므로 제외) */
const TAXABLE_ITEM_OPTIONS: { key: keyof TaxableItems; label: string }[] = [
  { key: 'meal', label: '식비' },
  { key: 'transportation', label: '교통비' },
  { key: 'accommodation', label: '숙박비' },
  { key: 'additional', label: '추가수당' },
];

// ============================================================================
// Component
// ============================================================================

export const TaxSettingsEditor = memo(function TaxSettingsEditor({
  taxSettings,
  onChange,
  totalAmount,
  disabled = false,
  showLabel = true,
  showPreview = true,
  className = '',
}: TaxSettingsEditorProps) {
  // 현재 taxableItems (기본값 적용)
  const currentTaxableItems = useMemo(
    () => taxSettings.taxableItems || DEFAULT_TAXABLE_ITEMS,
    [taxSettings.taxableItems]
  );

  // 세금 타입 변경 핸들러
  const handleTypeChange = useCallback(
    (type: TaxType) => {
      if (disabled) return;

      let value = 0;
      if (type === 'rate') {
        value = 3.3; // 기본 세율
      } else if (type === 'fixed') {
        value = 10000; // 기본 고정 금액
      }

      // 기존 taxableItems 유지, 없으면 기본값 설정
      onChange({
        type,
        value,
        taxableItems: taxSettings.taxableItems || DEFAULT_TAXABLE_ITEMS,
      });
    },
    [disabled, onChange, taxSettings.taxableItems]
  );

  // 세율 변경 핸들러
  const handleRateChange = useCallback(
    (text: string) => {
      if (disabled) return;
      const numericValue = text.replace(/[^0-9.]/g, '');
      const rate = parseFloat(numericValue) || 0;
      // 최대 100%로 제한
      onChange({
        ...taxSettings,
        type: 'rate',
        value: Math.min(rate, 100),
      });
    },
    [disabled, onChange, taxSettings]
  );

  // 고정 금액 변경 핸들러
  const handleFixedAmountChange = useCallback(
    (text: string) => {
      if (disabled) return;
      const numericValue = text.replace(/[^0-9]/g, '');
      const amount = parseInt(numericValue, 10) || 0;
      onChange({
        ...taxSettings,
        type: 'fixed',
        value: amount,
      });
    },
    [disabled, onChange, taxSettings]
  );

  // 빠른 세율 선택
  const handleQuickRateSelect = useCallback(
    (rate: number) => {
      if (disabled) return;
      onChange({
        ...taxSettings,
        type: 'rate',
        value: rate,
      });
    },
    [disabled, onChange, taxSettings]
  );

  // 적용 대상 항목 토글 핸들러
  const handleTaxableItemToggle = useCallback(
    (key: keyof TaxableItems) => {
      if (disabled) return;
      const newTaxableItems = {
        ...currentTaxableItems,
        [key]: !currentTaxableItems[key],
      };
      onChange({
        ...taxSettings,
        taxableItems: newTaxableItems,
      });
    },
    [disabled, onChange, taxSettings, currentTaxableItems]
  );

  // 포맷된 값
  const formattedRate = useMemo(() => {
    if (taxSettings.type !== 'rate') return '';
    return taxSettings.value > 0 ? taxSettings.value.toString() : '';
  }, [taxSettings]);

  const formattedFixedAmount = useMemo(() => {
    if (taxSettings.type !== 'fixed') return '';
    return taxSettings.value > 0 ? taxSettings.value.toLocaleString('ko-KR') : '';
  }, [taxSettings]);

  // 세금 금액 및 세후 금액 계산
  const taxAmount = useMemo(() => {
    if (!totalAmount || totalAmount <= 0) return 0;
    return calculateTaxAmount(taxSettings, totalAmount);
  }, [taxSettings, totalAmount]);

  const afterTaxAmount = useMemo(() => {
    if (!totalAmount || totalAmount <= 0) return 0;
    return calculateAfterTaxAmount(taxSettings, totalAmount);
  }, [taxSettings, totalAmount]);

  return (
    <View className={className}>
      {/* 레이블 */}
      {showLabel && (
        <Text className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          세금 설정
        </Text>
      )}

      {/* 세금 타입 선택 (수평 라디오) */}
      <View className="flex-row flex-wrap gap-2 mb-3">
        {TAX_TYPE_OPTIONS.map(({ type, label }) => {
          const isSelected = taxSettings.type === type;
          return (
            <Pressable
              key={type}
              onPress={() => handleTypeChange(type)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={label}
              className={`
                px-4 py-2 rounded-lg border min-w-[70px] items-center
                ${isSelected
                  ? 'bg-primary-500 border-primary-500'
                  : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
                }
                ${disabled ? 'opacity-50' : 'active:opacity-80'}
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
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 세율 입력 */}
      {taxSettings.type === 'rate' && (
        <View className="mb-3">
          <View
            className={`
              flex-row items-center rounded-lg border px-3 h-12
              bg-white dark:bg-surface
              border-gray-300 dark:border-surface-overlay
              ${disabled ? 'opacity-50' : ''}
            `}
          >
            <TextInput
              value={formattedRate}
              onChangeText={handleRateChange}
              keyboardType="decimal-pad"
              editable={!disabled}
              placeholder="3.3"
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-base text-gray-900 dark:text-white"
              accessibilityLabel="세율"
            />
            <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              %
            </Text>
          </View>

          {/* 빠른 세율 선택 버튼 */}
          <View className="flex-row flex-wrap gap-2 mt-2">
            {COMMON_TAX_RATES.map(({ rate, label }) => {
              // "기타" 선택 여부 확인 (3.3, 8.8이 아닌 값)
              const isOtherSelected = rate === -1 &&
                taxSettings.value !== 3.3 &&
                taxSettings.value !== 8.8;
              const isSelected = rate === -1 ? isOtherSelected : taxSettings.value === rate;

              return (
                <Pressable
                  key={rate}
                  onPress={() => {
                    if (rate === -1) {
                      // 기타 선택 시 빈 값으로 설정하여 직접 입력 유도
                      handleQuickRateSelect(0);
                    } else {
                      handleQuickRateSelect(rate);
                    }
                  }}
                  disabled={disabled}
                  className={`
                    px-3 py-1.5 rounded-full
                    ${isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-900/30'
                      : 'bg-gray-100 dark:bg-surface'
                    }
                    ${disabled ? 'opacity-50' : 'active:opacity-70'}
                  `}
                >
                  <Text
                    className={`text-xs ${
                      isSelected
                        ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* 고정 금액 입력 */}
      {taxSettings.type === 'fixed' && (
        <View className="mb-3">
          <View
            className={`
              flex-row items-center rounded-lg border px-3 h-12
              bg-white dark:bg-surface
              border-gray-300 dark:border-surface-overlay
              ${disabled ? 'opacity-50' : ''}
            `}
          >
            <TextInput
              value={formattedFixedAmount}
              onChangeText={handleFixedAmountChange}
              keyboardType="numeric"
              editable={!disabled}
              placeholder="10,000"
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-base text-gray-900 dark:text-white"
              accessibilityLabel="고정 세금 금액"
            />
            <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              원
            </Text>
          </View>
        </View>
      )}

      {/* 적용 대상 (세금 타입이 none이 아닐 때만) */}
      {taxSettings.type !== 'none' && (
        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            적용 대상
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {TAXABLE_ITEM_OPTIONS.map(({ key, label }) => {
              const isChecked = currentTaxableItems[key] !== false;
              return (
                <Pressable
                  key={key}
                  onPress={() => handleTaxableItemToggle(key)}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked, disabled }}
                  accessibilityLabel={`${label} 세금 적용`}
                  className={`
                    flex-row items-center px-3 py-2 rounded-lg border
                    ${isChecked
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                      : 'bg-white dark:bg-surface border-gray-300 dark:border-surface-overlay'
                    }
                    ${disabled ? 'opacity-50' : 'active:opacity-70'}
                  `}
                >
                  <View
                    className={`
                      h-4 w-4 rounded border items-center justify-center mr-2
                      ${isChecked
                        ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500'
                        : 'bg-transparent border-gray-400 dark:border-surface-overlay'
                      }
                    `}
                  >
                    {isChecked && (
                      <Ionicons name="checkmark" size={12} color="white" />
                    )}
                  </View>
                  <Text
                    className={`text-sm ${
                      isChecked
                        ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            체크된 항목에만 세금이 적용됩니다
          </Text>
        </View>
      )}

      {/* 세후 금액 미리보기 */}
      {showPreview && totalAmount && totalAmount > 0 && taxSettings.type !== 'none' && (
        <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              세금
              {taxSettings.type === 'rate' && (
                <Text className="text-xs"> ({taxSettings.value}%)</Text>
              )}
            </Text>
            <Text className="text-sm text-red-500 dark:text-red-400">
              -{formatCurrency(taxAmount)}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              세후 금액
            </Text>
            <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(afterTaxAmount)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default TaxSettingsEditor;
