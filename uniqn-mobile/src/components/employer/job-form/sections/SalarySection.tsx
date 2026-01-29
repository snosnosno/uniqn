/**
 * UNIQN Mobile - 공고 작성 급여 섹션 (v3.1)
 *
 * @description 역할별 급여 설정이 기본, 전체 동일 급여 옵션
 * @version 3.1.0 - dateSpecificRequirements 역할 추출 로직 복원
 */

import React, { useCallback, useMemo, memo, useEffect } from 'react';
import { View, Text, Pressable, Switch, TextInput } from 'react-native';
import { Card } from '@/components';
import { GiftIcon } from '@/components/icons';
import { PROVIDED_FLAG } from '@/utils/settlement';
import { RoleResolver } from '@/shared/role';
import type { JobPostingFormData, SalaryType, SalaryInfo, FormRoleWithCount } from '@/types';

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

/** 역할별 급여 타입 (협의 포함) */
const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'hourly', label: '시급' },
  { value: 'daily', label: '일급' },
  { value: 'monthly', label: '월급' },
  { value: 'other', label: '협의' },
];

const ALLOWANCE_TYPES = [
  { key: 'meal', label: '식비', providedLabel: '식사제공', placeholder: '0', icon: '🍱' },
  { key: 'transportation', label: '교통비', providedLabel: '교통비제공', placeholder: '0', icon: '🚗' },
  { key: 'accommodation', label: '숙박비', providedLabel: '숙박제공', placeholder: '0', icon: '🏨' },
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

// 역할 변환은 RoleResolver 사용
const getRoleDisplayName = RoleResolver.toDisplayName.bind(RoleResolver);
const getRoleKey = RoleResolver.toKey.bind(RoleResolver);

/** 추출된 역할 정보 */
interface ExtractedRole {
  /** 역할 키 (저장용) */
  key: string;
  /** 표시용 이름 */
  displayName: string;
  /** 인원수 */
  count: number;
  /** 커스텀 역할 여부 */
  isCustom: boolean;
  /** 기존 급여 정보 (있으면) */
  existingSalary?: SalaryInfo;
}

// ============================================================================
// Component
// ============================================================================

export const SalarySection = memo(function SalarySection({
  data,
  onUpdate,
  errors = {},
}: SalarySectionProps) {
  // ============================================================================
  // 역할 추출 로직 (dateSpecificRequirements 또는 data.roles에서)
  // ============================================================================
  const extractedRoles = useMemo<ExtractedRole[]>(() => {
    // fixed 타입은 data.roles 직접 사용
    if (data.postingType === 'fixed') {
      return data.roles.map((r) => ({
        key: getRoleKey(r.name),
        displayName: getRoleDisplayName(r.name),
        count: r.count,
        isCustom: r.isCustom ?? false,
        existingSalary: r.salary,
      }));
    }

    // 다른 타입은 dateSpecificRequirements에서 추출
    const roleMap = new Map<string, { displayName: string; count: number; isCustom: boolean; existingSalary?: SalaryInfo }>();

    data.dateSpecificRequirements?.forEach((dateReq) => {
      dateReq.timeSlots?.forEach((slot) => {
        slot.roles?.forEach((roleReq) => {
          const rawRole = (roleReq.role ?? 'dealer') as string;
          const isCustomRole = rawRole === 'other' && !!roleReq.customRole;
          // 커스텀 역할이면 customRole을 키로 사용
          const roleKey = isCustomRole
            ? roleReq.customRole!
            : getRoleKey(rawRole);
          // 커스텀 역할이면 customRole을 표시명으로 사용
          const displayName = isCustomRole
            ? roleReq.customRole!
            : getRoleDisplayName(rawRole);
          const existing = roleMap.get(roleKey);
          const headcount = roleReq.headcount ?? 0;

          // 같은 역할이면 인원 합산
          roleMap.set(roleKey, {
            displayName: existing?.displayName || displayName,
            count: (existing?.count || 0) + headcount,
            isCustom: existing?.isCustom || isCustomRole,
            existingSalary: existing?.existingSalary || roleReq.salary,
          });
        });
      });
    });

    return Array.from(roleMap.entries()).map(([key, { displayName, count, isCustom, existingSalary }]) => ({
      key,
      displayName,
      count,
      isCustom,
      existingSalary,
    }));
  }, [data.postingType, data.roles, data.dateSpecificRequirements]);

  // ============================================================================
  // 역할 변경 시 data.roles 동기화
  // ============================================================================
  useEffect(() => {
    // fixed 타입은 이미 data.roles를 직접 사용하므로 동기화 불필요
    if (data.postingType === 'fixed') return;

    const currentRoleKeys = extractedRoles.map((r) => r.key);
    const existingRoleKeys = data.roles.map((r) => getRoleKey(r.name));

    // 새로운 역할 찾기
    const newRoles = extractedRoles.filter(
      (r) => !existingRoleKeys.includes(r.key)
    );
    // 삭제된 역할 찾기
    const deletedRoleKeys = existingRoleKeys.filter(
      (key) => !currentRoleKeys.includes(key)
    );

    // 변경이 있을 때만 업데이트
    if (newRoles.length > 0 || deletedRoleKeys.length > 0) {
      // 기존 역할 유지 (삭제된 것 제외)
      const updatedRoles: FormRoleWithCount[] = data.roles.filter(
        (r) => !deletedRoleKeys.includes(getRoleKey(r.name))
      );

      // 새로운 역할 추가
      newRoles.forEach((role) => {
        // 전체 동일 급여 모드면 첫 역할 급여 복사
        let salary: SalaryInfo = { type: 'hourly', amount: 0 };
        if (role.existingSalary) {
          salary = role.existingSalary;
        } else if (data.useSameSalary && updatedRoles.length > 0) {
          const firstSalary = updatedRoles[0]?.salary;
          if (firstSalary) {
            salary = { ...firstSalary };
          }
        }

        updatedRoles.push({
          name: role.displayName,
          count: role.count,
          isCustom: role.isCustom,
          salary,
        });
      });

      // 인원수 업데이트 (역할은 같지만 인원이 변경된 경우)
      extractedRoles.forEach((extracted) => {
        const existing = updatedRoles.find((r) => getRoleKey(r.name) === extracted.key);
        if (existing && existing.count !== extracted.count) {
          existing.count = extracted.count;
        }
      });

      onUpdate({ roles: updatedRoles });
    }
  }, [extractedRoles, data.postingType, data.roles, data.useSameSalary, onUpdate]);

  // 실제 표시할 역할 목록 (data.roles 기반, extractedRoles 순서 유지)
  const roles = data.roles;

  // 전체 동일 급여 토글
  const handleUseSameSalaryToggle = useCallback(
    (value: boolean) => {
      if (value && roles.length > 0) {
        // ON: 첫 역할의 급여를 모든 역할에 복사하고 defaultSalary에도 저장
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
        // 전체 동일: 모든 역할에 적용
        const updatedRoles = roles.map((role) => ({
          ...role,
          salary: { ...newSalary },
        }));
        onUpdate({
          roles: updatedRoles,
          defaultSalary: { ...newSalary },
        });
      } else {
        // 개별: 해당 역할만 변경
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
        // 전체 동일: 모든 역할에 적용
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
        // 개별: 해당 역할만 변경
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

  // 보장시간 변경
  const handleGuaranteedHoursChange = useCallback(
    (value: string) => {
      const hours = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
      onUpdate({
        allowances: {
          ...data.allowances,
          guaranteedHours: hours > 0 ? hours : undefined,
        },
      });
    },
    [data.allowances, onUpdate]
  );

  // 수당 금액 변경
  const handleAllowanceChange = useCallback(
    (key: string, value: string) => {
      const amount = parseCurrency(value);
      onUpdate({
        allowances: {
          ...data.allowances,
          [key]: amount > 0 ? amount : undefined,
        },
      });
    },
    [data.allowances, onUpdate]
  );

  // 수당 "제공" 토글
  const handleAllowanceProvidedToggle = useCallback(
    (key: string, isProvided: boolean) => {
      onUpdate({
        allowances: {
          ...data.allowances,
          [key]: isProvided ? PROVIDED_FLAG : undefined,
        },
      });
    },
    [data.allowances, onUpdate]
  );

  // 총 인원 계산
  const totalCount = useMemo(
    () => roles.reduce((sum, r) => sum + r.count, 0),
    [roles]
  );

  // 예상 총 비용 계산
  const estimatedCost = useMemo(() => {
    let total = 0;
    let hasValidSalary = false;

    roles.forEach((role) => {
      const roleSalary = role.salary;
      if (roleSalary && roleSalary.type !== 'other' && roleSalary.amount > 0) {
        hasValidSalary = true;
        let roleTotal = roleSalary.amount * role.count;
        if (roleSalary.type === 'hourly') {
          roleTotal *= 8; // 시급 × 8시간
        }
        total += roleTotal;
      }
    });

    return hasValidSalary ? total : null;
  }, [roles]);

  return (
    <View>
      {/* 전체 동일 급여 토글 (2개 이상 역할만) */}
      {roles.length > 1 && (
        <View className="mb-4 flex-row items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <View>
            <Text className="text-gray-900 dark:text-white font-medium">
              전체 동일 급여
            </Text>
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

        {roles.map((role, index) => {
          const roleSalary = role.salary;
          const roleType = roleSalary?.type || 'hourly';
          const isOther = roleType === 'other';
          // 전체 동일 모드에서 첫 번째가 아닌 역할은 읽기 전용으로 표시
          const isReadOnly = data.useSameSalary && index > 0;
          const displayName = getRoleDisplayName(role.name);

          return (
            <View
              key={`${role.name}-${index}`}
              className={`mb-3 p-3 border rounded-lg ${
                isReadOnly
                  ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* 역할명 + 인원 */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-medium text-gray-900 dark:text-white text-sm">
                  {displayName}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {role.count}명
                </Text>
              </View>

              {/* 급여 타입 선택 */}
              <View className="flex-row gap-1 mb-2">
                {SALARY_TYPES.map((type) => {
                  const isSelected = roleType === type.value;
                  return (
                    <Pressable
                      key={type.value}
                      onPress={() =>
                        !isReadOnly &&
                        handleRoleSalaryTypeChange(index, type.value)
                      }
                      disabled={isReadOnly}
                      className={`flex-1 py-1.5 rounded-md ${
                        isSelected
                          ? 'bg-primary-500'
                          : isReadOnly
                            ? 'bg-gray-100 dark:bg-gray-700/50'
                            : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected, disabled: isReadOnly }}
                    >
                      <Text
                        className={`text-center text-xs font-medium ${
                          isSelected
                            ? 'text-white'
                            : isReadOnly
                              ? 'text-gray-400 dark:text-gray-500'
                              : 'text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 금액 입력 (협의가 아닐 때만) */}
              {!isOther && (
                <View className="flex-row items-center justify-end">
                  <Text className="text-gray-500 dark:text-gray-400 text-sm mr-2">
                    ₩
                  </Text>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    value={
                      roleSalary?.amount && roleSalary.amount > 0
                        ? formatCurrency(roleSalary.amount)
                        : ''
                    }
                    onChangeText={(v) =>
                      handleRoleSalaryAmountChange(index, v)
                    }
                    keyboardType="numeric"
                    editable={!isReadOnly}
                    className={`w-32 py-2 px-2 text-right text-sm rounded-md ${
                      isReadOnly
                        ? 'bg-gray-100 dark:bg-gray-700/50 text-gray-400'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  />
                  <Text className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
                    원
                  </Text>
                </View>
              )}

              {/* 협의 선택 시 안내 */}
              {isOther && (
                <Text className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                  급여는 개별 협의로 진행됩니다
                </Text>
              )}

              {/* 전체 동일 모드 안내 */}
              {isReadOnly && (
                <Text className="text-xs text-primary-500 dark:text-primary-400 mt-1">
                  첫 번째 역할과 동일하게 적용됩니다
                </Text>
              )}
            </View>
          );
        })}

        {/* 역할이 없을 때 */}
        {roles.length === 0 && (
          <View className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Text className="text-center text-gray-500 dark:text-gray-400 text-sm">
              역할 단계에서 역할을 먼저 추가해주세요
            </Text>
          </View>
        )}
      </View>

      {/* 수당 설정 */}
      <View className="mb-4">
        <View className="flex-row items-center mb-3">
          <GiftIcon size={20} color="#6B7280" />
          <Text className="ml-2 font-semibold text-gray-900 dark:text-white">
            추가 수당 (선택)
          </Text>
        </View>

        <Card variant="outlined" padding="md">
          {/* 보장시간 */}
          <View className="pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-xl mr-2">⏰</Text>
                <Text className="text-sm text-gray-900 dark:text-white">
                  보장시간
                </Text>
              </View>
              <View className="flex-row items-center">
                <TextInput
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  value={data.allowances?.guaranteedHours ? String(data.allowances.guaranteedHours) : ''}
                  onChangeText={handleGuaranteedHoursChange}
                  keyboardType="numeric"
                  className="w-16 py-2 px-2 text-right text-sm rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <Text className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
                  시간
                </Text>
              </View>
            </View>
          </View>

          {ALLOWANCE_TYPES.map((allowance, index) => {
            const value =
              data.allowances?.[allowance.key as keyof typeof data.allowances];
            const isProvided = value === PROVIDED_FLAG;
            const displayLabel = isProvided ? allowance.providedLabel : allowance.label;

            return (
              <View
                key={allowance.key}
                className={`${
                  index < ALLOWANCE_TYPES.length - 1
                    ? 'pb-3 mb-3 border-b border-gray-100 dark:border-gray-700'
                    : ''
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-xl mr-2">{allowance.icon}</Text>
                    <Text className={`text-sm ${
                      isProvided
                        ? 'text-primary-600 dark:text-primary-400 font-medium'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {displayLabel}
                    </Text>
                  </View>

                  {/* 제공 토글 */}
                  <View className="flex-row items-center">
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                      제공
                    </Text>
                    <Switch
                      value={isProvided}
                      onValueChange={(v) => handleAllowanceProvidedToggle(allowance.key, v)}
                      trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
                      thumbColor={isProvided ? '#4F46E5' : '#F3F4F6'}
                    />
                  </View>
                </View>

                {/* 금액 입력 (제공이 아닐 때만) */}
                {!isProvided && (
                  <View className="flex-row items-center justify-end mt-2">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm mr-2">
                      ₩
                    </Text>
                    <TextInput
                      placeholder={allowance.placeholder}
                      placeholderTextColor="#9CA3AF"
                      value={value && value > 0 ? formatCurrency(value) : ''}
                      onChangeText={(v) => handleAllowanceChange(allowance.key, v)}
                      keyboardType="numeric"
                      className="w-32 py-2 px-2 text-right text-sm rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <Text className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
                      원
                    </Text>
                  </View>
                )}
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
            {totalCount}명 기준 (시급은 8시간 환산)
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
