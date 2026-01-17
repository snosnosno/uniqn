/**
 * UNIQN Mobile - 비밀번호 강도 표시 컴포넌트
 *
 * @description 비밀번호 입력 시 강도와 요구사항 충족 상태 표시
 * @version 1.1.0
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckIcon, XMarkIcon } from '@/components/icons';

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

const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  weak: '#ef4444',
  medium: '#f59e0b',
  strong: '#22c55e',
  'very-strong': '#16a34a',
};

const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  weak: '약함',
  medium: '보통',
  strong: '강함',
  'very-strong': '매우 강함',
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

export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const { level, score } = useMemo(() => calculateStrength(password), [password]);
  const color = STRENGTH_COLORS[level];
  const label = STRENGTH_LABELS[level];

  const requirementResults = useMemo(
    () => REQUIREMENTS.map((req) => ({ ...req, passed: req.test(password) })),
    [password]
  );

  const passedCount = requirementResults.filter((r) => r.passed).length;

  return (
    <View>
      <View style={styles.barSection}>
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>비밀번호 강도</Text>
          <Text style={[styles.strengthLabel, { color }]}>{label}</Text>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${score}%`, backgroundColor: color }]} />
        </View>
      </View>

      {showRequirements && (
        <View style={styles.requirementsSection}>
          <Text style={styles.requirementsTitle}>
            요구사항 ({passedCount}/{REQUIREMENTS.length})
          </Text>
          {requirementResults.map((req) => (
            <View key={req.key} style={styles.requirementRow}>
              {req.passed ? (
                <CheckIcon size={14} color="#22C55E" />
              ) : (
                <XMarkIcon size={14} color="#9CA3AF" />
              )}
              <Text style={[styles.requirementText, req.passed && styles.requirementPassed]}>
                {req.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  barSection: {
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelText: {
    fontSize: 12,
    color: '#6b7280',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  requirementsSection: {
    gap: 4,
  },
  requirementsTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  requirementPassed: {
    color: '#16a34a',
  },
});

export default PasswordStrength;
