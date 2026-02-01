/**
 * UNIQN Mobile - 역할별 급여 표시 컴포넌트
 *
 * @description 역할별 급여를 통일된 형식으로 표시
 * @version 2.0.0 - roles[].salary 통합 구조
 */

import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import type { SalaryInfo } from '@/types';
import { getRoleDisplayName } from '@/types/unified';

// ============================================================================
// Types
// ============================================================================

/** 역할 정보 (급여 포함) */
interface RoleWithSalary {
  role?: string;
  name?: string;
  customRole?: string;
  salary?: SalaryInfo;
}

interface RoleSalaryDisplayProps {
  /** 역할 목록 (salary 포함) */
  roles?: RoleWithSalary[];
  /** 전체 동일 급여 여부 */
  useSameSalary?: boolean;
  /** 기본 급여 (동일 급여 시 사용) */
  defaultSalary?: SalaryInfo;
  /** 컴팩트 모드 (한 줄 표시) */
  compact?: boolean;
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

/**
 * 역할 키 가져오기
 */
function getRoleKey(role: RoleWithSalary): string {
  if ((role.role === 'other' || role.name === 'other') && role.customRole) {
    return role.customRole;
  }
  return role.role || role.name || 'unknown';
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
      <Text
        className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900 dark:text-white`}
      >
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
  roles,
  useSameSalary = false,
  defaultSalary,
  compact = false,
}: RoleSalaryDisplayProps) {
  // 유효한 역할 목록 (급여 정보가 있는 것만)
  const rolesWithSalary = useMemo(() => {
    if (!roles || roles.length === 0) return [];
    return roles.filter((r) => r.salary);
  }, [roles]);

  // 표시할 급여 결정
  const displaySalary = useMemo<SalaryInfo | null>(() => {
    // defaultSalary가 있으면 사용
    if (defaultSalary && (defaultSalary.amount > 0 || defaultSalary.type === 'other')) {
      return defaultSalary;
    }
    // 첫 번째 역할 급여 사용
    if (rolesWithSalary.length > 0 && rolesWithSalary[0].salary) {
      return rolesWithSalary[0].salary;
    }
    return null;
  }, [defaultSalary, rolesWithSalary]);

  // 동일 급여인 경우 또는 역할이 없는 경우 단순 표시
  if (useSameSalary || rolesWithSalary.length === 0) {
    if (!displaySalary) {
      return (
        <View className={compact ? '' : 'py-1'}>
          <Text
            className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-gray-500 dark:text-gray-400`}
          >
            💰 급여 미설정
          </Text>
        </View>
      );
    }

    return (
      <View className={compact ? '' : 'py-1'}>
        <Text
          className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-primary-600 dark:text-primary-400`}
        >
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
        {rolesWithSalary.map((role, index) => {
          const roleKey = getRoleKey(role);
          const salary = role.salary!;
          return (
            <RoleSalaryRow
              key={`${roleKey}-${index}`}
              role={roleKey}
              salary={salary}
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
  roles,
  useSameSalary = false,
  defaultSalary,
}: Pick<RoleSalaryDisplayProps, 'roles' | 'useSameSalary' | 'defaultSalary'>) {
  // 유효한 역할 목록
  const rolesWithSalary = useMemo(() => {
    if (!roles || roles.length === 0) return [];
    return roles.filter((r) => r.salary);
  }, [roles]);

  // 표시할 급여 결정
  const displaySalary = useMemo<SalaryInfo | null>(() => {
    if (defaultSalary && (defaultSalary.amount > 0 || defaultSalary.type === 'other')) {
      return defaultSalary;
    }
    if (rolesWithSalary.length > 0 && rolesWithSalary[0].salary) {
      return rolesWithSalary[0].salary;
    }
    return null;
  }, [defaultSalary, rolesWithSalary]);

  // 동일 급여
  if (useSameSalary || rolesWithSalary.length === 0) {
    if (!displaySalary) {
      return (
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">💰 급여 미설정</Text>
      );
    }

    return (
      <Text className="text-sm font-medium text-gray-900 dark:text-white">
        💰 {formatSalary(displaySalary.type, displaySalary.amount)}
      </Text>
    );
  }

  // 역할별 급여 요약 (최저~최고)
  const amounts = rolesWithSalary
    .filter((r) => r.salary && r.salary.type !== 'other')
    .map((r) => r.salary!.amount);

  if (amounts.length === 0) {
    return <Text className="text-sm font-medium text-gray-900 dark:text-white">💰 협의</Text>;
  }

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const firstType =
    rolesWithSalary.find((r) => r.salary && r.salary.type !== 'other')?.salary?.type || 'hourly';

  if (min === max) {
    return (
      <Text className="text-sm font-medium text-gray-900 dark:text-white">
        💰 {formatSalaryShort(firstType, min)}
      </Text>
    );
  }

  return (
    <Text className="text-sm font-medium text-gray-900 dark:text-white">
      💰 {formatSalaryShort(firstType, min)} ~ {formatSalaryShort(firstType, max)}
    </Text>
  );
});

export default RoleSalaryDisplay;
