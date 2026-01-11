/**
 * UNIQN Mobile - 역할별 급여 표시 컴포넌트
 *
 * @description 역할별 급여를 통일된 형식으로 표시
 * @version 1.0.0
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import type { SalaryInfo } from '@/types';
import { getRoleDisplayName } from '@/types/unified';

// ============================================================================
// Types
// ============================================================================

interface RoleSalaryDisplayProps {
  /** 역할별 급여 */
  roleSalaries?: Record<string, SalaryInfo>;
  /** 전체 동일 급여 여부 */
  useSameSalary?: boolean;
  /** 기본 급여 (동일 급여 시 사용) */
  salary: SalaryInfo;
  /** 컴팩트 모드 (한 줄 표시) */
  compact?: boolean;
  /** 표시할 역할 목록 (없으면 roleSalaries의 모든 역할) */
  roles?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const SALARY_TYPE_LABELS: Record<string, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '협의',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * 급여 포맷
 */
function formatSalary(type: string, amount: number): string {
  if (type === 'other') return '협의';
  const typeLabel = SALARY_TYPE_LABELS[type] || '';
  const formattedAmount = amount.toLocaleString('ko-KR');
  return `${typeLabel} ${formattedAmount}원`;
}

/**
 * 급여 간단 포맷 (금액만)
 */
function formatSalaryShort(type: string, amount: number): string {
  if (type === 'other') return '협의';
  return `${amount.toLocaleString('ko-KR')}원`;
}

// ============================================================================
// Sub Components
// ============================================================================

/**
 * 단일 역할 급여 행
 */
const RoleSalaryRow = memo(function RoleSalaryRow({
  role,
  salary,
  compact,
}: {
  role: string;
  salary: SalaryInfo;
  compact?: boolean;
}) {
  const label = getRoleDisplayName(role);
  const salaryText = compact
    ? formatSalaryShort(salary.type, salary.amount)
    : formatSalary(salary.type, salary.amount);

  return (
    <View className={`flex-row items-center justify-between ${compact ? 'py-0.5' : 'py-1'}`}>
      <Text className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400`}>
        {label}
      </Text>
      <Text className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900 dark:text-white`}>
        {salaryText}
      </Text>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * 역할별 급여 표시 컴포넌트
 */
export const RoleSalaryDisplay = memo(function RoleSalaryDisplay({
  roleSalaries,
  useSameSalary = false,
  salary,
  compact = false,
  roles,
}: RoleSalaryDisplayProps) {
  // 표시할 역할 목록 계산
  const displayRoles = useMemo(() => {
    if (roles && roles.length > 0) {
      return roles;
    }
    if (roleSalaries && Object.keys(roleSalaries).length > 0) {
      return Object.keys(roleSalaries);
    }
    return [];
  }, [roles, roleSalaries]);

  // 동일 급여인 경우 단순 표시
  if (useSameSalary || !roleSalaries || Object.keys(roleSalaries).length === 0) {
    // salary.amount가 0이고 roleSalaries가 있으면 첫 번째 값 사용 (폴백)
    const hasValidSalary = salary.amount > 0 || salary.type === 'other';
    const roleSalaryEntries = roleSalaries ? Object.entries(roleSalaries) : [];

    let displaySalary = salary;
    if (!hasValidSalary && roleSalaryEntries.length > 0) {
      const [, firstSalary] = roleSalaryEntries[0];
      displaySalary = firstSalary;
    }

    return (
      <View className={compact ? '' : 'py-1'}>
        <Text className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-primary-600 dark:text-primary-400`}>
          💰 {formatSalary(displaySalary.type, displaySalary.amount)}
        </Text>
      </View>
    );
  }

  // 역할별 급여 표시
  return (
    <View className={compact ? '' : 'py-1'}>
      <Text className={`${compact ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 mb-1`}>
        💰 역할별 급여
      </Text>
      <View className={`${compact ? '' : 'pl-4'}`}>
        {displayRoles.map((role) => {
          const roleSalary = roleSalaries[role];
          if (!roleSalary) return null;
          return (
            <RoleSalaryRow
              key={role}
              role={role}
              salary={roleSalary}
              compact={compact}
            />
          );
        })}
      </View>
    </View>
  );
});

/**
 * 급여 요약 표시 (카드용)
 */
export const SalarySummary = memo(function SalarySummary({
  roleSalaries,
  useSameSalary = false,
  salary,
}: Pick<RoleSalaryDisplayProps, 'roleSalaries' | 'useSameSalary' | 'salary'>) {
  // 동일 급여
  if (useSameSalary || !roleSalaries || Object.keys(roleSalaries).length === 0) {
    // salary.amount가 0이고 roleSalaries가 있으면 첫 번째 값 사용 (폴백)
    const hasValidSalary = salary.amount > 0 || salary.type === 'other';
    const roleSalaryEntries = roleSalaries ? Object.entries(roleSalaries) : [];

    let displaySalary = salary;
    if (!hasValidSalary && roleSalaryEntries.length > 0) {
      const [, firstSalary] = roleSalaryEntries[0];
      displaySalary = firstSalary;
    }

    return (
      <Text className="text-sm font-medium text-gray-900 dark:text-white">
        💰 {formatSalary(displaySalary.type, displaySalary.amount)}
      </Text>
    );
  }

  // 역할별 급여 요약 (최저~최고)
  const amounts = Object.values(roleSalaries)
    .filter(s => s.type !== 'other')
    .map(s => s.amount);

  if (amounts.length === 0) {
    return (
      <Text className="text-sm font-medium text-gray-900 dark:text-white">
        💰 협의
      </Text>
    );
  }

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);

  if (min === max) {
    return (
      <Text className="text-sm font-medium text-gray-900 dark:text-white">
        💰 {formatSalaryShort(salary.type, min)}
      </Text>
    );
  }

  return (
    <Text className="text-sm font-medium text-gray-900 dark:text-white">
      💰 {formatSalaryShort(salary.type, min)} ~ {formatSalaryShort(salary.type, max)}
    </Text>
  );
});

export default RoleSalaryDisplay;
