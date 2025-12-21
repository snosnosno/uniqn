/**
 * UNIQN Mobile - 공고 작성 Step 4: 급여
 *
 * @description 급여 타입, 금액, 수당 설정
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Button, Input, FormField, Card } from '@/components';
import { CurrencyDollarIcon, GiftIcon } from '@/components/icons';
import { salaryInfoSchema } from '@/schemas/jobPosting.schema';
import type { JobPostingFormData, SalaryType, RoleRequirement } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step4SalaryProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// 급여 타입 옵션
const SALARY_TYPES: { value: SalaryType; label: string; example: string }[] = [
  { value: 'hourly', label: '시급', example: '15,000원/시간' },
  { value: 'daily', label: '일급', example: '150,000원/일' },
  { value: 'monthly', label: '월급', example: '3,000,000원/월' },
  { value: 'other', label: '기타', example: '협의 가능' },
];

// 수당 종류
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

export function Step4Salary({ data, onUpdate, onNext, onPrev }: Step4SalaryProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // 유효성 검증
  const validate = useCallback(() => {
    const result = salaryInfoSchema.safeParse(data.salary);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }

    if (data.salary.amount <= 0 && data.salary.type !== 'other') {
      setErrors({ amount: '급여 금액을 입력해주세요' });
      return false;
    }

    setErrors({});
    return true;
  }, [data.salary]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  return (
    <View className="flex-1 p-4">
      {/* 급여 타입 선택 */}
      <FormField label="급여 타입" required>
        <View className="flex-row flex-wrap gap-2 mt-1">
          {SALARY_TYPES.map((type) => {
            const isSelected = data.salary.type === type.value;
            return (
              <Pressable
                key={type.value}
                onPress={() => handleSalaryTypeChange(type.value)}
                className={`px-4 py-3 rounded-lg border ${
                  isSelected
                    ? 'bg-primary-600 border-primary-600'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <Text className={`font-medium ${
                  isSelected ? 'text-white' : 'text-gray-900 dark:text-white'
                }`}>
                  {type.label}
                </Text>
                <Text className={`text-xs mt-0.5 ${
                  isSelected ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {type.example}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormField>

      {/* 급여 금액 */}
      {data.salary.type !== 'other' && (
        <FormField label="급여 금액" required error={errors.amount} className="mt-4">
          <View className="flex-row items-center">
            <CurrencyDollarIcon size={20} color="#6B7280" />
            <Input
              placeholder="0"
              value={data.salary.amount > 0 ? formatCurrency(data.salary.amount) : ''}
              onChangeText={handleSalaryAmountChange}
              keyboardType="numeric"
              className="flex-1 ml-2"
            />
            <Text className="ml-2 text-gray-600 dark:text-gray-400">원</Text>
          </View>
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {data.salary.type === 'hourly' && '시간당 급여를 입력해주세요'}
            {data.salary.type === 'daily' && '일당 급여를 입력해주세요'}
            {data.salary.type === 'monthly' && '월 급여를 입력해주세요'}
          </Text>
        </FormField>
      )}

      {/* 수당 설정 */}
      <View className="mt-6">
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
      {data.salary.amount > 0 && data.roles.length > 0 && (
        <View className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            예상 총 인건비 (1일 기준)
          </Text>
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(
              data.salary.amount *
                data.roles.reduce((sum: number, r: RoleRequirement) => sum + r.count, 0) *
                (data.salary.type === 'hourly' ? 8 : 1) // 시급은 8시간 기준
            )}원
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {data.roles.reduce((sum: number, r: RoleRequirement) => sum + r.count, 0)}명 ×{' '}
            {formatCurrency(data.salary.amount)}원
            {data.salary.type === 'hourly' && ' × 8시간'}
          </Text>
        </View>
      )}

      {/* 버튼 영역 */}
      <View className="mt-6 flex-row gap-3">
        <Button variant="outline" size="lg" onPress={onPrev} className="flex-1">
          이전
        </Button>
        <Button variant="primary" size="lg" onPress={handleNext} className="flex-[2]">
          다음 단계
        </Button>
      </View>
    </View>
  );
}
