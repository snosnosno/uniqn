/**
 * UNIQN Mobile - 비밀번호 강도 표시기 컴포넌트
 *
 * @description 비밀번호 정책 충족 여부를 시각적으로 표시
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

// ============================================================================
// Types
// ============================================================================

interface PasswordStrengthProps {
  password: string;
  showDetails?: boolean;
}

interface PasswordCriteria {
  label: string;
  test: (password: string) => boolean;
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

// ============================================================================
// Constants
// ============================================================================

const PASSWORD_CRITERIA: PasswordCriteria[] = [
  {
    label: '최소 8자 이상',
    test: (pw) => pw.length >= 8,
  },
  {
    label: '소문자 포함',
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    label: '대문자 포함',
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    label: '숫자 포함',
    test: (pw) => /[0-9]/.test(pw),
  },
  {
    label: '특수문자 포함 (!@#$%^&*)',
    test: (pw) => /[!@#$%^&*]/.test(pw),
  },
  {
    label: '연속 문자 없음',
    test: (pw) => {
      for (let i = 0; i < pw.length - 2; i++) {
        const c1 = pw.charCodeAt(i);
        const c2 = pw.charCodeAt(i + 1);
        const c3 = pw.charCodeAt(i + 2);
        if (c2 === c1 + 1 && c3 === c2 + 1) return false;
        if (c2 === c1 - 1 && c3 === c2 - 1) return false;
      }
      return true;
    },
  },
];

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; bgColor: string }> = {
  weak: { label: '약함', color: 'text-error-600 dark:text-error-400', bgColor: 'bg-error-500' },
  fair: { label: '보통', color: 'text-warning-600 dark:text-warning-400', bgColor: 'bg-warning-500' },
  good: { label: '좋음', color: 'text-primary-600 dark:text-primary-400', bgColor: 'bg-primary-500' },
  strong: { label: '강함', color: 'text-success-600 dark:text-success-400', bgColor: 'bg-success-500' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateStrength(passedCount: number, total: number): StrengthLevel {
  const ratio = passedCount / total;
  if (ratio < 0.4) return 'weak';
  if (ratio < 0.7) return 'fair';
  if (ratio < 1) return 'good';
  return 'strong';
}

// ============================================================================
// Component
// ============================================================================

export function PasswordStrength({ password, showDetails = true }: PasswordStrengthProps) {
  const criteriaResults = useMemo(() => {
    return PASSWORD_CRITERIA.map((criteria) => ({
      ...criteria,
      passed: password.length > 0 ? criteria.test(password) : false,
    }));
  }, [password]);

  const passedCount = criteriaResults.filter((c) => c.passed).length;
  const strength = calculateStrength(passedCount, PASSWORD_CRITERIA.length);
  const strengthConfig = STRENGTH_CONFIG[strength];

  if (!password) {
    return null;
  }

  return (
    <View className="mt-2 flex-col gap-2">
      {/* 강도 바 */}
      <View className="flex-row items-center gap-2">
        <View className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <View className="flex-row h-full">
            {[0, 1, 2, 3].map((index) => {
              const isActive = (passedCount / PASSWORD_CRITERIA.length) * 4 > index;
              return (
                <View
                  key={index}
                  className={`flex-1 h-full ${index > 0 ? 'ml-1' : ''} ${
                    isActive ? strengthConfig.bgColor : 'bg-transparent'
                  }`}
                />
              );
            })}
          </View>
        </View>
        <Text className={`text-sm font-medium ${strengthConfig.color}`}>
          {strengthConfig.label}
        </Text>
      </View>

      {/* 상세 체크리스트 */}
      {showDetails && (
        <View className="flex-col gap-1">
          {criteriaResults.map((criteria, index) => (
            <View key={index} className="flex-row items-center">
              <View
                className={`w-4 h-4 rounded-full items-center justify-center mr-2 ${
                  criteria.passed
                    ? 'bg-success-500 dark:bg-success-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <Text className="text-xs text-white font-bold">
                  {criteria.passed ? '✓' : ''}
                </Text>
              </View>
              <Text
                className={`text-xs ${
                  criteria.passed
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {criteria.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default PasswordStrength;
