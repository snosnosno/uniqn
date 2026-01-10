/**
 * UNIQN Mobile - 비밀번호 강도 표시 컴포넌트
 *
 * @description 비밀번호 입력 시 강도와 요구사항 충족 상태 표시
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { CheckIcon, XMarkIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

interface PasswordStrengthProps {
  /** 현재 입력된 비밀번호 */
  password: string;
  /** 추가 클래스명 */
  className?: string;
  /** 요구사항 체크리스트 표시 여부 */
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
  {
    key: 'length',
    label: '최소 8자 이상',
    test: (p) => p.length >= 8,
  },
  {
    key: 'lowercase',
    label: '소문자 포함',
    test: (p) => /[a-z]/.test(p),
  },
  {
    key: 'uppercase',
    label: '대문자 포함',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    key: 'number',
    label: '숫자 포함',
    test: (p) => /[0-9]/.test(p),
  },
  {
    key: 'special',
    label: '특수문자 포함 (!@#$%^&*)',
    test: (p) => /[!@#$%^&*]/.test(p),
  },
  {
    key: 'sequential',
    label: '연속 문자 3자 이상 금지',
    test: (p) => {
      for (let i = 0; i < p.length - 2; i++) {
        const c1 = p.charCodeAt(i);
        const c2 = p.charCodeAt(i + 1);
        const c3 = p.charCodeAt(i + 2);
        // 오름차순 또는 내림차순 연속
        if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
          return false;
        }
      }
      return true;
    },
  },
];

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; bgColor: string }> = {
  weak: {
    label: '약함',
    color: 'text-error-600 dark:text-error-400',
    bgColor: 'bg-error-500',
  },
  medium: {
    label: '보통',
    color: 'text-warning-600 dark:text-warning-400',
    bgColor: 'bg-warning-500',
  },
  strong: {
    label: '강함',
    color: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-500',
  },
  'very-strong': {
    label: '매우 강함',
    color: 'text-success-600 dark:text-success-400',
    bgColor: 'bg-success-600',
  },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * 비밀번호 강도 계산
 */
function calculateStrength(password: string): { level: StrengthLevel; score: number } {
  if (!password) {
    return { level: 'weak', score: 0 };
  }

  let score = 0;

  // 길이 점수
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // 문자 종류 점수
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

  // 레벨 결정
  let level: StrengthLevel;
  if (score < 40) {
    level = 'weak';
  } else if (score < 60) {
    level = 'medium';
  } else if (score < 80) {
    level = 'strong';
  } else {
    level = 'very-strong';
  }

  return { level, score: Math.max(0, Math.min(100, score)) };
}

// ============================================================================
// Component
// ============================================================================

export function PasswordStrength({
  password,
  className = '',
  showRequirements = true,
}: PasswordStrengthProps) {
  const { level, score } = useMemo(() => calculateStrength(password), [password]);
  const config = STRENGTH_CONFIG[level];

  const requirementResults = useMemo(
    () =>
      REQUIREMENTS.map((req) => ({
        ...req,
        passed: req.test(password),
      })),
    [password]
  );

  const passedCount = requirementResults.filter((r) => r.passed).length;

  return (
    <View className={className}>
      {/* 강도 바 */}
      <View className="mb-2">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-xs text-gray-500 dark:text-gray-400">비밀번호 강도</Text>
          <Text className={`text-xs font-medium ${config.color}`}>{config.label}</Text>
        </View>
        <View className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <View
            className={`h-full rounded-full ${config.bgColor}`}
            style={{ width: `${score}%` }}
          />
        </View>
      </View>

      {/* 요구사항 체크리스트 */}
      {showRequirements && (
        <View className="space-y-1">
          <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            요구사항 ({passedCount}/{REQUIREMENTS.length})
          </Text>
          {requirementResults.map((req) => (
            <View key={req.key} className="flex-row items-center">
              {req.passed ? (
                <CheckIcon size={14} color="#22C55E" />
              ) : (
                <XMarkIcon size={14} color="#9CA3AF" />
              )}
              <Text
                className={`ml-1.5 text-xs ${
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
}
