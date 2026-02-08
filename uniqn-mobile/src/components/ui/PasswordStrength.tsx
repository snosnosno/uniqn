/**
 * UNIQN Mobile - 비밀번호 강도 표시기 컴포넌트
 *
 * @description 비밀번호 입력 시 강도와 요구사항 충족 상태를 시각적으로 표시
 * @version 2.0.0 - auth/settings 버전 통합
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { CheckIcon, XMarkIcon } from '../icons';

// ============================================================================
// Types
// ============================================================================

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

type StrengthLevel = 'weak' | 'medium' | 'strong' | 'very-strong';

interface Requirement {
  key: string;
  label: string;
  test: (password: string) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const REQUIREMENTS: Requirement[] = [
  { key: 'length', label: '최소 8자 이상', test: (p) => p.length >= 8 },
  { key: 'lowercase', label: '소문자 포함', test: (p) => /[a-z]/.test(p) },
  { key: 'uppercase', label: '대문자 포함', test: (p) => /[A-Z]/.test(p) },
  { key: 'number', label: '숫자 포함', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: '특수문자 포함 (!@#$%^&*)', test: (p) => /[!@#$%^&*]/.test(p) },
  {
    key: 'sequential',
    label: '연속 문자 3자 이상 금지',
    test: (p) => {
      for (let i = 0; i < p.length - 2; i++) {
        const c1 = p.charCodeAt(i);
        const c2 = p.charCodeAt(i + 1);
        const c3 = p.charCodeAt(i + 2);
        if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
          return false;
        }
      }
      return true;
    },
  },
];

const STRENGTH_CONFIG: Record<
  StrengthLevel,
  { label: string; color: string; barColor: string }
> = {
  weak: {
    label: '약함',
    color: 'text-error-600 dark:text-error-400',
    barColor: 'bg-error-500',
  },
  medium: {
    label: '보통',
    color: 'text-warning-600 dark:text-warning-400',
    barColor: 'bg-warning-500',
  },
  strong: {
    label: '강함',
    color: 'text-success-600 dark:text-success-400',
    barColor: 'bg-success-500',
  },
  'very-strong': {
    label: '매우 강함',
    color: 'text-success-700 dark:text-success-300',
    barColor: 'bg-success-600',
  },
};

// ============================================================================
// Helpers
// ============================================================================

function calculateStrength(password: string): { level: StrengthLevel; score: number } {
  if (!password) return { level: 'weak', score: 0 };

  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[!@#$%^&*]/.test(password)) score += 15;

  // 연속 문자 감점
  for (let i = 0; i < password.length - 2; i++) {
    const c1 = password.charCodeAt(i);
    const c2 = password.charCodeAt(i + 1);
    const c3 = password.charCodeAt(i + 2);
    if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
      score -= 20;
      break;
    }
  }

  let level: StrengthLevel;
  if (score < 40) level = 'weak';
  else if (score < 60) level = 'medium';
  else if (score < 80) level = 'strong';
  else level = 'very-strong';

  return { level, score: Math.max(0, Math.min(100, score)) };
}

// ============================================================================
// Component
// ============================================================================

export const PasswordStrength = React.memo(function PasswordStrength({
  password,
  showRequirements = true,
}: PasswordStrengthProps) {
  const { level, score } = useMemo(() => calculateStrength(password), [password]);
  const config = STRENGTH_CONFIG[level];

  const requirementResults = useMemo(
    () =>
      REQUIREMENTS.map((req) => ({
        ...req,
        passed: password.length > 0 ? req.test(password) : false,
      })),
    [password]
  );

  const passedCount = requirementResults.filter((r) => r.passed).length;

  if (!password) {
    return null;
  }

  return (
    <View className="mt-2 flex-col gap-2">
      {/* 강도 바 */}
      <View className="flex-col gap-1">
        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400">비밀번호 강도</Text>
          <Text className={`text-xs font-medium ${config.color}`}>{config.label}</Text>
        </View>
        <View className="h-2 bg-gray-200 dark:bg-surface rounded-full overflow-hidden">
          <View
            className={`h-full rounded-full ${config.barColor}`}
            // eslint-disable-next-line react-native/no-inline-styles
            style={{ width: `${score}%` }}
          />
        </View>
      </View>

      {/* 요구사항 체크리스트 */}
      {showRequirements && (
        <View className="flex-col gap-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            요구사항 ({passedCount}/{REQUIREMENTS.length})
          </Text>
          {requirementResults.map((req) => (
            <View key={req.key} className="flex-row items-center gap-2">
              {req.passed ? (
                <CheckIcon size={14} color="#22C55E" />
              ) : (
                <XMarkIcon size={14} color="#9CA3AF" />
              )}
              <Text
                className={`text-xs ${
                  req.passed
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {req.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

export default PasswordStrength;
