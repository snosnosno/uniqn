/**
 * UNIQN Mobile - 공고 작성 Step 3: 역할/인원
 *
 * @description 역할별 모집 인원 설정 (기본: 딜러, 플로어 + 동적 추가)
 * @version 2.0.0 - 기본 역할 2개 + 커스텀 역할 추가 기능
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Button } from '@/components';
import {
  PlusIcon,
  MinusIcon,
  TrashIcon,
  UsersIcon,
  BriefcaseIcon,
} from '@/components/icons';
import type { JobPostingFormData, FormRoleWithCount } from '@/types';
import { DEFAULT_ROLES } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step3RolesProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const ROLE_ICONS: Record<string, string> = {
  딜러: '🃏',
  플로어: '👔',
};

const DEFAULT_ICON = '👤';

// ============================================================================
// Sub Components
// ============================================================================

interface RoleCardProps {
  role: FormRoleWithCount;
  onCountChange: (delta: number) => void;
  onDelete?: () => void;
  onNameChange?: (name: string) => void;
}

const RoleCard = React.memo(function RoleCard({
  role,
  onCountChange,
  onDelete,
  onNameChange,
}: RoleCardProps) {
  const icon = ROLE_ICONS[role.name] || DEFAULT_ICON;
  const isCustom = role.isCustom;

  return (
    <View className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-3">
      <View className="flex-row items-center">
        {/* 역할 아이콘 */}
        <View className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
          <Text className="text-2xl">{icon}</Text>
        </View>

        {/* 역할 정보 */}
        <View className="flex-1 ml-3">
          {isCustom ? (
            <TextInput
              value={role.name}
              onChangeText={onNameChange}
              placeholder="역할 이름 입력"
              placeholderTextColor="#9CA3AF"
              className="font-semibold text-gray-900 dark:text-white text-base px-0 py-1 border-b border-gray-300 dark:border-gray-600"
            />
          ) : (
            <Text className="font-semibold text-gray-900 dark:text-white text-base">
              {role.name}
            </Text>
          )}
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {role.count}명 모집
          </Text>
        </View>

        {/* 인원 조절 */}
        <View className="flex-row items-center">
          {/* 인원 감소 */}
          <Pressable
            onPress={() => onCountChange(-1)}
            disabled={role.count <= 1}
            className={`w-10 h-10 items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-l-lg ${
              role.count <= 1 ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="인원 감소"
          >
            <MinusIcon size={20} color="#6B7280" />
          </Pressable>

          {/* 인원 수 */}
          <View className="w-12 h-10 items-center justify-center bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-600">
            <Text className="font-bold text-gray-900 dark:text-white">
              {role.count}
            </Text>
          </View>

          {/* 인원 증가 */}
          <Pressable
            onPress={() => onCountChange(1)}
            disabled={role.count >= 99}
            className={`w-10 h-10 items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-r-lg ${
              role.count >= 99 ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="인원 증가"
          >
            <PlusIcon size={20} color="#6B7280" />
          </Pressable>

          {/* 삭제 버튼 (커스텀 역할만) */}
          {isCustom && onDelete && (
            <Pressable
              onPress={onDelete}
              className="ml-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20"
              accessibilityRole="button"
              accessibilityLabel="역할 삭제"
            >
              <TrashIcon size={18} color="#EF4444" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export function Step3Roles({ data, onUpdate, onNext, onBack }: Step3RolesProps) {
  const [error, setError] = useState<string>('');

  // 역할이 비어있으면 기본 역할로 초기화
  const roles = useMemo(() => {
    if (!data.roles || data.roles.length === 0) {
      return [...DEFAULT_ROLES];
    }
    return data.roles;
  }, [data.roles]);

  // 인원 수 변경
  const handleCountChange = useCallback((index: number, delta: number) => {
    const newRoles = [...roles];
    const newCount = Math.max(1, Math.min(99, newRoles[index].count + delta));
    newRoles[index] = { ...newRoles[index], count: newCount };
    onUpdate({ roles: newRoles });
    setError('');
  }, [roles, onUpdate]);

  // 역할명 변경 (커스텀 역할)
  const handleNameChange = useCallback((index: number, name: string) => {
    const newRoles = [...roles];
    newRoles[index] = { ...newRoles[index], name };
    onUpdate({ roles: newRoles });
    setError('');
  }, [roles, onUpdate]);

  // 역할 추가
  const handleAddRole = useCallback(() => {
    const newRole: FormRoleWithCount = {
      name: '',
      count: 1,
      isCustom: true,
    };
    onUpdate({ roles: [...roles, newRole] });
    setError('');
  }, [roles, onUpdate]);

  // 역할 삭제
  const handleDeleteRole = useCallback((index: number) => {
    const newRoles = roles.filter((_, i) => i !== index);
    onUpdate({ roles: newRoles });
    setError('');
  }, [roles, onUpdate]);

  // 유효성 검증
  const validate = useCallback(() => {
    if (roles.length === 0) {
      setError('최소 1개 역할을 선택해주세요');
      return false;
    }

    // 역할명 중복 확인
    const names = roles.map(r => r.name.trim()).filter(Boolean);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      setError('중복된 역할명이 있습니다');
      return false;
    }

    // 빈 역할명 확인
    const hasEmptyName = roles.some(r => !r.name.trim());
    if (hasEmptyName) {
      setError('역할 이름을 입력해주세요');
      return false;
    }

    // 인원 확인
    const invalidCount = roles.some(r => r.count < 1);
    if (invalidCount) {
      setError('각 역할의 인원은 1명 이상이어야 합니다');
      return false;
    }

    setError('');
    return true;
  }, [roles]);

  // 다음 단계
  const handleNext = useCallback(() => {
    if (validate()) {
      onNext();
    }
  }, [validate, onNext]);

  // 총 인원 계산
  const totalCount = useMemo(() =>
    roles.reduce((sum, r) => sum + r.count, 0),
    [roles]
  );

  // 기본 역할과 커스텀 역할 분리
  const defaultRoles = roles.filter(r => !r.isCustom);
  const customRoles = roles.filter(r => r.isCustom);

  return (
    <View className="flex-1 p-4">
      {/* 안내 문구 */}
      <View className="flex-row items-center mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <UsersIcon size={20} color="#2563EB" />
        <Text className="ml-2 text-sm text-blue-700 dark:text-blue-300">
          모집할 역할과 인원을 설정해주세요
        </Text>
      </View>

      {/* 기본 역할 (딜러, 플로어) */}
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        기본 역할
      </Text>
      {defaultRoles.map((role) => {
        const index = roles.findIndex((r) => r === role);
        return (
          <RoleCard
            key={`default-${role.name}`}
            role={role}
            onCountChange={(delta) => handleCountChange(index, delta)}
          />
        );
      })}

      {/* 커스텀 역할 */}
      {customRoles.length > 0 && (
        <>
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">
            추가 역할
          </Text>
          {customRoles.map((role, customIndex) => {
            const index = roles.findIndex(r => r === role);
            return (
              <RoleCard
                key={`custom-${customIndex}`}
                role={role}
                onCountChange={(delta) => handleCountChange(index, delta)}
                onNameChange={(name) => handleNameChange(index, name)}
                onDelete={() => handleDeleteRole(index)}
              />
            );
          })}
        </>
      )}

      {/* 역할 추가 버튼 */}
      <Pressable
        onPress={handleAddRole}
        className="mt-3 flex-row items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl"
        accessibilityRole="button"
        accessibilityLabel="역할 추가"
      >
        <PlusIcon size={20} color="#6B7280" />
        <Text className="ml-2 text-gray-600 dark:text-gray-400 font-medium">
          역할 추가
        </Text>
      </Pressable>

      {/* 에러 메시지 */}
      {error && (
        <Text className="mt-3 text-sm text-red-500">
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

      {/* 버튼 그룹 */}
      <View className="flex-row gap-3 mt-6">
        <View className="flex-1">
          <Button variant="outline" size="lg" onPress={onBack} fullWidth>
            이전
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="primary" size="lg" onPress={handleNext} fullWidth>
            다음 단계
          </Button>
        </View>
      </View>
    </View>
  );
}

export default Step3Roles;
