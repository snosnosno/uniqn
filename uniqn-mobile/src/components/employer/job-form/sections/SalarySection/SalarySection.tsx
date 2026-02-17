/**
 * UNIQN Mobile - 공고 작성 급여 섹션 (v4.0)
 *
 * @description 역할별 급여 설정이 기본, 전체 동일 급여 옵션
 * @version 4.0.0 - 서브컴포넌트 모듈화
 */

import React, { useCallback, useMemo, memo, useEffect } from 'react';
import { View, Text, Switch } from 'react-native';
import { useAllowances } from '@/hooks';
import {
  extractRolesFromPosting,
  syncRolesWithExtracted,
  parseCurrency,
  calculateEstimatedCost,
  calculateTotalCount,
} from '@/utils/salary';
import type { SalaryType, SalaryInfo, TaxSettings } from '@/types';
import { TaxSettingsEditor } from '@/components/employer/settlement/TaxSettingsEditor';
import { DEFAULT_TAX_SETTINGS } from '@/utils/settlement';

// Sub-components
import { RoleSalaryInput } from './RoleSalaryInput';
import { AllowanceInput } from './AllowanceInput';
import { EstimatedCostCard } from './EstimatedCostCard';
import type { SalarySectionProps } from './types';

// Re-export types for backward compatibility
export type { SalarySectionProps } from './types';

// ============================================================================
// Component
// ============================================================================

export const SalarySection = memo(function SalarySection({
  data,
  onUpdate,
  errors = {},
}: SalarySectionProps) {
  // ============================================================================
  // 역할 추출 로직 (유틸리티 함수 사용)
  // ============================================================================
  const extractedRoles = useMemo(
    () => extractRolesFromPosting(data.postingType, data.roles, data.dateSpecificRequirements),
    [data.postingType, data.roles, data.dateSpecificRequirements]
  );

  // ============================================================================
  // 역할 변경 시 data.roles 동기화
  // ============================================================================
  useEffect(() => {
    // fixed 타입은 이미 data.roles를 직접 사용하므로 동기화 불필요
    if (data.postingType === 'fixed') return;

    const updatedRoles = syncRolesWithExtracted(
      extractedRoles,
      data.roles,
      data.useSameSalary ?? false
    );

    if (updatedRoles) {
      onUpdate({ roles: updatedRoles });
    }
  }, [extractedRoles, data.postingType, data.roles, data.useSameSalary, onUpdate]);

  // 실제 표시할 역할 목록
  const roles = data.roles;

  // 전체 동일 급여 토글
  const handleUseSameSalaryToggle = useCallback(
    (value: boolean) => {
      if (value && roles.length > 0) {
        const firstSalary = roles[0]?.salary || { type: 'hourly' as SalaryType, amount: 0 };
        const updatedRoles = roles.map((role) => ({
          ...role,
          salary: { ...firstSalary },
        }));
        onUpdate({
          useSameSalary: true,
          defaultSalary: { ...firstSalary },
          roles: updatedRoles,
        });
      } else {
        onUpdate({ useSameSalary: false });
      }
    },
    [roles, onUpdate]
  );

  // 역할별 급여 타입 변경
  const handleRoleSalaryTypeChange = useCallback(
    (roleIndex: number, type: SalaryType) => {
      const currentRole = roles[roleIndex];
      const newSalary: SalaryInfo = {
        type,
        amount: type === 'other' ? 0 : currentRole?.salary?.amount || 0,
      };

      if (data.useSameSalary) {
        const updatedRoles = roles.map((role) => ({
          ...role,
          salary: { ...newSalary },
        }));
        onUpdate({
          roles: updatedRoles,
          defaultSalary: { ...newSalary },
        });
      } else {
        const updatedRoles = [...roles];
        updatedRoles[roleIndex] = {
          ...currentRole,
          salary: newSalary,
        };
        onUpdate({ roles: updatedRoles });
      }
    },
    [data.useSameSalary, roles, onUpdate]
  );

  // 역할별 급여 금액 변경
  const handleRoleSalaryAmountChange = useCallback(
    (roleIndex: number, value: string) => {
      const amount = parseCurrency(value);
      const currentRole = roles[roleIndex];
      const newSalary: SalaryInfo = {
        type: currentRole?.salary?.type || 'hourly',
        amount,
      };

      if (data.useSameSalary) {
        const updatedRoles = roles.map((role) => ({
          ...role,
          salary: {
            type: role.salary?.type || 'hourly',
            amount,
          },
        }));
        onUpdate({
          roles: updatedRoles,
          defaultSalary: { ...newSalary },
        });
      } else {
        const updatedRoles = [...roles];
        updatedRoles[roleIndex] = {
          ...currentRole,
          salary: newSalary,
        };
        onUpdate({ roles: updatedRoles });
      }
    },
    [data.useSameSalary, roles, onUpdate]
  );

  // 수당 관리 (훅 사용)
  const { handleGuaranteedHoursChange, handleAllowanceChange, handleAllowanceProvidedToggle } =
    useAllowances(data.allowances, onUpdate);

  // 세금 설정 변경
  const handleTaxSettingsChange = useCallback(
    (settings: TaxSettings) => {
      onUpdate({ taxSettings: settings });
    },
    [onUpdate]
  );

  // 계산된 값들
  const totalCount = useMemo(() => calculateTotalCount(roles), [roles]);
  const estimatedCost = useMemo(() => calculateEstimatedCost(roles), [roles]);

  // 세금 미리보기용 1인 기준 금액
  const previewTotalAmount = useMemo(() => {
    if (!estimatedCost || estimatedCost <= 0 || totalCount <= 0) return 0;
    return Math.round(estimatedCost / totalCount);
  }, [estimatedCost, totalCount]);

  return (
    <View>
      {/* 전체 동일 급여 토글 (2개 이상 역할만) */}
      {roles.length > 1 && (
        <View className="mb-4 flex-row items-center justify-between p-3 bg-gray-50 dark:bg-surface rounded-lg">
          <View>
            <Text className="text-gray-900 dark:text-white font-medium">전체 동일 급여</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              모든 역할에 같은 급여를 적용합니다
            </Text>
          </View>
          <Switch
            value={data.useSameSalary}
            onValueChange={handleUseSameSalaryToggle}
            trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
            thumbColor={data.useSameSalary ? '#4F46E5' : '#F3F4F6'}
          />
        </View>
      )}

      {/* 역할별 급여 입력 */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          역할별 급여 <Text className="text-red-500">*</Text>
        </Text>

        {errors.roleSalary && (
          <Text className="text-sm text-red-500 mb-2">{errors.roleSalary}</Text>
        )}

        {roles.map((role, index) => (
          <RoleSalaryInput
            key={`${role.name}-${index}`}
            role={role}
            index={index}
            isReadOnly={!!data.useSameSalary && index > 0}
            onSalaryTypeChange={handleRoleSalaryTypeChange}
            onSalaryAmountChange={handleRoleSalaryAmountChange}
          />
        ))}

        {/* 역할이 없을 때 */}
        {roles.length === 0 && (
          <View className="p-4 bg-gray-50 dark:bg-surface rounded-lg">
            <Text className="text-center text-gray-500 dark:text-gray-400 text-sm">
              역할 단계에서 역할을 먼저 추가해주세요
            </Text>
          </View>
        )}
      </View>

      {/* 수당 설정 */}
      <AllowanceInput
        allowances={data.allowances}
        onGuaranteedHoursChange={handleGuaranteedHoursChange}
        onAllowanceChange={handleAllowanceChange}
        onAllowanceProvidedToggle={handleAllowanceProvidedToggle}
      />

      {/* 세금 설정 */}
      <TaxSettingsEditor
        taxSettings={data.taxSettings ?? DEFAULT_TAX_SETTINGS}
        onChange={handleTaxSettingsChange}
        totalAmount={previewTotalAmount}
        showLabel={true}
        showPreview={true}
        className="mb-4"
      />

      {/* 예상 총 비용 */}
      {estimatedCost !== null && (
        <EstimatedCostCard estimatedCost={estimatedCost} totalCount={totalCount} />
      )}

      {/* 에러 메시지 */}
      {errors.salary && <Text className="mt-2 text-sm text-red-500">{errors.salary}</Text>}
    </View>
  );
});

export default SalarySection;
