/**
 * UNIQN Mobile - 공고 작성 Step 3: 역할/인원
 *
 * @description 역할별 모집 인원 설정
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Button, Card } from '@/components';
import { PlusIcon, MinusIcon, UsersIcon, BriefcaseIcon } from '@/components/icons';
import type { JobPostingFormData, RoleRequirement, StaffRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step3RolesProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onNext: () => void;
  onPrev: () => void;
  disabled?: boolean;
}

// 역할 정보
const ROLE_INFO: Record<StaffRole, { label: string; description: string; icon: string }> = {
  dealer: {
    label: '딜러',
    description: '카드 딜링, 게임 진행',
    icon: '🃏',
  },
  manager: {
    label: '매니저',
    description: '매장 관리, 고객 응대',
    icon: '👔',
  },
  chiprunner: {
    label: '칩러너',
    description: '칩 교환, 서빙',
    icon: '🏃',
  },
  admin: {
    label: '관리자',
    description: '전체 운영 관리',
    icon: '⚙️',
  },
};

const AVAILABLE_ROLES: StaffRole[] = ['dealer', 'manager', 'chiprunner', 'admin'];

// ============================================================================
// Component
// ============================================================================

export function Step3Roles({ data, onUpdate, onNext, onPrev, disabled = false }: Step3RolesProps) {
  const [error, setError] = useState<string>('');

  // 역할 추가/제거
  const toggleRole = useCallback((role: StaffRole) => {
    if (disabled) return;
    const existingIndex = data.roles.findIndex((r) => r.role === role);

    if (existingIndex >= 0) {
      // 역할 제거
      const newRoles = data.roles.filter((r) => r.role !== role);
      onUpdate({ roles: newRoles });
    } else {
      // 역할 추가
      const newRole: RoleRequirement = {
        role,
        count: 1,
        filled: 0,
      };
      onUpdate({ roles: [...data.roles, newRole] });
    }
    setError('');
  }, [data.roles, onUpdate]);

  // 인원 수 변경
  const updateRoleCount = useCallback((role: StaffRole, delta: number) => {
    if (disabled) return;
    const newRoles = data.roles.map((r) => {
      if (r.role === role) {
        const newCount = Math.max(1, Math.min(100, r.count + delta));
        return { ...r, count: newCount };
      }
      return r;
    });
    onUpdate({ roles: newRoles });
  }, [data.roles, onUpdate]);

  // 유효성 검증
  const validate = useCallback(() => {
    if (data.roles.length === 0) {
      setError('최소 1개 역할을 선택해주세요');
      return false;
    }
    setError('');
    return true;
  }, [data.roles]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  // 총 인원 계산
  const totalCount = data.roles.reduce((sum, r) => sum + r.count, 0);

  return (
    <View className="flex-1 p-4">
      {/* 비활성화 경고 */}
      {disabled && (
        <View className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            확정된 지원자가 있어 역할을 수정할 수 없습니다.
          </Text>
        </View>
      )}

      {/* 안내 문구 */}
      {!disabled && (
        <View className="flex-row items-center mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <UsersIcon size={20} color="#2563EB" />
          <Text className="ml-2 text-sm text-blue-700 dark:text-blue-300">
            모집할 역할을 선택하고 인원을 설정해주세요
          </Text>
        </View>
      )}

      {/* 역할 선택 */}
      <View className="gap-3">
        {AVAILABLE_ROLES.map((role) => {
          const info = ROLE_INFO[role];
          const selectedRole = data.roles.find((r) => r.role === role);
          const isSelected = !!selectedRole;

          return (
            <Card
              key={role}
              variant={isSelected ? 'elevated' : 'outlined'}
              padding="md"
              className={`${isSelected ? 'border-2 border-primary-500' : ''} ${disabled ? 'opacity-60' : ''}`}
            >
              <Pressable onPress={() => toggleRole(role)} disabled={disabled}>
                <View className="flex-row items-center">
                  {/* 역할 아이콘 */}
                  <View className={`w-12 h-12 rounded-full items-center justify-center ${
                    isSelected
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Text className="text-2xl">{info.icon}</Text>
                  </View>

                  {/* 역할 정보 */}
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-gray-900 dark:text-white">
                      {info.label}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      {info.description}
                    </Text>
                  </View>

                  {/* 체크박스 또는 인원 설정 */}
                  {isSelected ? (
                    <View className="flex-row items-center">
                      {/* 인원 감소 */}
                      <Pressable
                        onPress={() => updateRoleCount(role, -1)}
                        disabled={disabled}
                        className="w-10 h-10 items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-l-lg"
                      >
                        <MinusIcon size={20} color="#6B7280" />
                      </Pressable>

                      {/* 인원 수 */}
                      <View className="w-12 h-10 items-center justify-center bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-600">
                        <Text className="font-bold text-gray-900 dark:text-white">
                          {selectedRole?.count || 0}
                        </Text>
                      </View>

                      {/* 인원 증가 */}
                      <Pressable
                        onPress={() => updateRoleCount(role, 1)}
                        disabled={disabled}
                        className="w-10 h-10 items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-r-lg"
                      >
                        <PlusIcon size={20} color="#6B7280" />
                      </Pressable>
                    </View>
                  ) : (
                    <View className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </View>
              </Pressable>
            </Card>
          );
        })}
      </View>

      {/* 에러 메시지 */}
      {error && (
        <Text className="mt-3 text-sm text-error-600 dark:text-error-400">
          {error}
        </Text>
      )}

      {/* 총 인원 표시 */}
      {totalCount > 0 && (
        <View className="mt-4 flex-row items-center justify-center py-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <BriefcaseIcon size={20} color="#2563EB" />
          <Text className="ml-2 text-lg font-bold text-primary-600 dark:text-primary-400">
            총 {totalCount}명 모집
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
