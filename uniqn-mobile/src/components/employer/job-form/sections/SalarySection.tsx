/**
 * UNIQN Mobile - 공고 작성 급여 섹션
 *
 * @description 급여 타입, 금액, 수당 설정 + 역할별 급여 옵션
 * @version 1.0.0
 */

import React, { useCallback, useMemo, memo } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { Input, Card } from '@/components';
import { CurrencyDollarIcon, GiftIcon } from '@/components/icons';
import type { JobPostingFormData, SalaryType, SalaryInfo } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface SalarySectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

// ============================================================================
// Constants
// ============================================================================

const SALARY_TYPES: { value: SalaryType; label: string; example: string }[] = [
  { value: 'hourly', label: '시급', example: '15,000원/시간' },
  { value: 'daily', label: '일급', example: '150,000원/일' },
  { value: 'monthly', label: '월급', example: '3,000,000원/월' },
  { value: 'other', label: '협의', example: '협의 가능' },
];

const ALLOWANCE_TYPES = [
  { key: 'meal', label: '식대', placeholder: '10,000', icon: '🍱' },
  { key: 'transportation', label: '교통비', placeholder: '10,000', icon: '🚗' },
  { key: 'accommodation', label: '숙박비', placeholder: '50,000', icon: '🏨' },
];

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value: number): string => {
  return value.toLocaleString('ko-KR');
};

const parseCurrency = (value: string): number => {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
};

// ============================================================================
// Component
// ============================================================================

export const SalarySection = memo(function SalarySection({
  data,
  onUpdate,
  errors = {},
}: SalarySectionProps) {
  // 급여 타입 변경
  const handleSalaryTypeChange = useCallback((type: SalaryType) => {
    onUpdate({
      salary: {
        ...data.salary,
        type,
      },
    });
  }, [data.salary, onUpdate]);

  // 급여 금액 변경
  const handleSalaryAmountChange = useCallback((value: string) => {
    const amount = parseCurrency(value);
    onUpdate({
      salary: {
        ...data.salary,
        amount,
      },
    });
  }, [data.salary, onUpdate]);

  // 수당 변경
  const handleAllowanceChange = useCallback((key: string, value: string) => {
    const amount = parseCurrency(value);
    onUpdate({
      allowances: {
        ...data.allowances,
        [key]: amount > 0 ? amount : undefined,
      },
    });
  }, [data.allowances, onUpdate]);

  // 역할별 급여 토글
  const handleUseRoleSalaryToggle = useCallback((value: boolean) => {
    onUpdate({ useRoleSalary: value });
    if (value && Object.keys(data.roleSalaries).length === 0) {
      const initialRoleSalaries: Record<string, SalaryInfo> = {};
      data.roles.forEach((role) => {
        initialRoleSalaries[role.name] = {
          type: data.salary.type,
          amount: data.salary.amount,
          useRoleSalary: false,
        };
      });
      onUpdate({ roleSalaries: initialRoleSalaries });
    }
  }, [data.roles, data.salary, data.roleSalaries, onUpdate]);

  // 역할별 급여 금액 변경
  const handleRoleSalaryChange = useCallback((roleName: string, value: string) => {
    const amount = parseCurrency(value);
    onUpdate({
      roleSalaries: {
        ...data.roleSalaries,
        [roleName]: {
          ...data.roleSalaries[roleName],
          type: data.salary.type,
          amount,
        },
      },
    });
  }, [data.salary.type, data.roleSalaries, onUpdate]);

  // 총 인원 계산
  const totalCount = useMemo(() =>
    data.roles.reduce((sum, r) => sum + r.count, 0),
    [data.roles]
  );

  // 예상 총 비용 계산
  const estimatedCost = useMemo(() => {
    if (data.salary.type === 'other') return null;

    let total = 0;
    if (data.useRoleSalary) {
      data.roles.forEach((role) => {
        const roleSalary = data.roleSalaries[role.name];
        if (roleSalary) {
          total += roleSalary.amount * role.count;
        }
      });
    } else {
      total = data.salary.amount * totalCount;
    }

    // 시급은 8시간 기준
    if (data.salary.type === 'hourly') {
      total *= 8;
    }

    return total;
  }, [data.salary, data.useRoleSalary, data.roleSalaries, data.roles, totalCount]);

  return (
    <View>
      {/* 급여 타입 선택 */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          급여 타입 <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {SALARY_TYPES.map((type) => {
            const isSelected = data.salary.type === type.value;
            return (
              <Pressable
                key={type.value}
                onPress={() => handleSalaryTypeChange(type.value)}
                className={`px-4 py-3 rounded-lg border-2 ${
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-500'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <Text className={`font-medium ${
                  isSelected
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {type.label}
                </Text>
                <Text className={`text-xs mt-0.5 ${
                  isSelected
                    ? 'text-primary-500 dark:text-primary-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {type.example}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 급여 금액 */}
      {data.salary.type !== 'other' && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            급여 금액 <Text className="text-red-500">*</Text>
          </Text>
          <View className="flex-row items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3">
            <CurrencyDollarIcon size={20} color="#6B7280" />
            <Input
              placeholder="0"
              value={data.salary.amount > 0 ? formatCurrency(data.salary.amount) : ''}
              onChangeText={handleSalaryAmountChange}
              keyboardType="numeric"
              className="flex-1 border-0"
            />
            <Text className="text-gray-600 dark:text-gray-400">원</Text>
          </View>
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {data.salary.type === 'hourly' && '시간당 급여를 입력해주세요'}
            {data.salary.type === 'daily' && '일당 급여를 입력해주세요'}
            {data.salary.type === 'monthly' && '월 급여를 입력해주세요'}
          </Text>
          {errors.amount && (
            <Text className="mt-1 text-sm text-red-500">{errors.amount}</Text>
          )}
        </View>
      )}

      {/* 역할별 급여 설정 토글 */}
      {data.salary.type !== 'other' && data.roles.length > 1 && (
        <View className="mb-4 flex-row items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <View>
            <Text className="text-gray-900 dark:text-white font-medium">
              역할별 급여 설정
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              각 역할마다 다른 급여를 설정합니다
            </Text>
          </View>
          <Switch
            value={data.useRoleSalary}
            onValueChange={handleUseRoleSalaryToggle}
            trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
            thumbColor={data.useRoleSalary ? '#4F46E5' : '#F3F4F6'}
          />
        </View>
      )}

      {/* 역할별 급여 입력 */}
      {data.useRoleSalary && data.salary.type !== 'other' && (
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            역할별 급여 설정
          </Text>
          {errors.roleSalary && (
            <Text className="text-sm text-red-500 mb-2">{errors.roleSalary}</Text>
          )}
          {data.roles.map((role) => {
            const roleSalary = data.roleSalaries[role.name];
            return (
              <View
                key={role.name}
                className="flex-row items-center mb-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <Text className="flex-1 font-medium text-gray-900 dark:text-white">
                  {role.name} ({role.count}명)
                </Text>
                <Input
                  placeholder="0"
                  value={roleSalary?.amount > 0 ? formatCurrency(roleSalary.amount) : ''}
                  onChangeText={(v) => handleRoleSalaryChange(role.name, v)}
                  keyboardType="numeric"
                  className="w-28 text-right"
                />
                <Text className="ml-2 text-gray-600 dark:text-gray-400">원</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 수당 설정 */}
      <View className="mb-4">
        <View className="flex-row items-center mb-3">
          <GiftIcon size={20} color="#6B7280" />
          <Text className="ml-2 font-semibold text-gray-900 dark:text-white">
            추가 수당 (선택)
          </Text>
        </View>

        <Card variant="outlined" padding="md">
          {ALLOWANCE_TYPES.map((allowance, index) => {
            const value = data.allowances?.[allowance.key as keyof typeof data.allowances];
            return (
              <View
                key={allowance.key}
                className={`flex-row items-center ${
                  index < ALLOWANCE_TYPES.length - 1
                    ? 'pb-3 mb-3 border-b border-gray-100 dark:border-gray-700'
                    : ''
                }`}
              >
                <Text className="text-xl mr-3">{allowance.icon}</Text>
                <Text className="flex-1 text-gray-900 dark:text-white">
                  {allowance.label}
                </Text>
                <Input
                  placeholder={allowance.placeholder}
                  value={value ? formatCurrency(value) : ''}
                  onChangeText={(v) => handleAllowanceChange(allowance.key, v)}
                  keyboardType="numeric"
                  className="w-24 text-right"
                />
                <Text className="ml-2 text-gray-600 dark:text-gray-400 w-8">원</Text>
              </View>
            );
          })}
        </Card>
      </View>

      {/* 예상 총 비용 */}
      {estimatedCost !== null && estimatedCost > 0 && (
        <View className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <Text className="text-sm text-primary-700 dark:text-primary-300 mb-2">
            예상 총 인건비 (1일 기준)
          </Text>
          <Text className="text-2xl font-bold text-primary-900 dark:text-primary-100">
            {formatCurrency(estimatedCost)}원
          </Text>
          <Text className="text-xs text-primary-600 dark:text-primary-400 mt-1">
            {totalCount}명 기준
            {data.salary.type === 'hourly' && ' × 8시간'}
          </Text>
        </View>
      )}

      {/* 에러 메시지 */}
      {errors.salary && (
        <Text className="mt-2 text-sm text-red-500">{errors.salary}</Text>
      )}
    </View>
  );
});

export default SalarySection;
