/**
 * UNIQN Mobile - 공고 작성 역할/인원 섹션
 *
 * @description 역할별 모집 인원 설정 (선택지 제공, 모든 역할 삭제 가능)
 * @version 2.1.0 - 공통 RoleSelectModal 사용
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useCallback, useMemo, memo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { PlusIcon, MinusIcon, TrashIcon, BriefcaseIcon } from '@/components/icons';
import { STAFF_ROLES, ROLE_ICONS, DEFAULT_ROLE_ICON } from '@/constants';
import { RoleSelectModal } from '../modals';
import type { JobPostingFormData, FormRoleWithCount } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface RolesSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

/** 기본 역할 (폼 초기값) */
const DEFAULT_ROLES: FormRoleWithCount[] = [
  { name: '딜러', count: 1, isCustom: false },
  { name: '플로어', count: 1, isCustom: false },
];

// ============================================================================
// RoleCard Component
// ============================================================================

interface RoleCardProps {
  role: FormRoleWithCount;
  onCountChange: (delta: number) => void;
  onDelete: () => void;
  onNameChange?: (name: string) => void;
  canDelete: boolean;
}

const RoleCard = memo(function RoleCard({
  role,
  onCountChange,
  onDelete,
  onNameChange,
  canDelete,
}: RoleCardProps) {
  const icon = ROLE_ICONS[role.name] || DEFAULT_ROLE_ICON;
  const isCustom = role.isCustom;

  return (
    <View className="p-3 bg-white dark:bg-surface rounded-md border border-divider mb-3">
      <View className="flex-row items-center">
        {/* 역할 아이콘 */}
        <View className="w-10 h-10 rounded-sm bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
          <Text className="text-xl font-sans">{icon}</Text>
        </View>

        {/* 역할 정보 */}
        <View className="flex-1 ml-3">
          {isCustom && onNameChange ? (
            <TextInput
              value={role.name}
              onChangeText={onNameChange}
              placeholder="역할 이름 입력"
              placeholderTextColor={SECONDARY_PALETTE[400]}
              className="font-sans-medium text-content-primary dark:text-off-white text-base px-0 py-1 border-b border-secondary-300 dark:border-surface-overlay"
            />
          ) : (
            <Text className="font-sans-medium text-content-primary dark:text-off-white text-base">
              {role.name}
            </Text>
          )}
        </View>

        {/* 인원 조절 */}
        <View className="flex-row items-center">
          <Pressable
            onPress={() => onCountChange(-1)}
            disabled={role.count <= 1}
            className={`w-9 h-9 items-center justify-center bg-surface-card dark:bg-surface rounded-l-lg ${
              role.count <= 1 ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="인원 감소"
          >
            <MinusIcon size={18} color={SECONDARY_PALETTE[500]} />
          </Pressable>

          <View className="w-10 h-9 items-center justify-center bg-white dark:bg-surface border-y border-divider">
            <Text className="font-sans-bold text-content-primary dark:text-off-white">
              {role.count}
            </Text>
          </View>

          <Pressable
            onPress={() => onCountChange(1)}
            disabled={role.count >= 99}
            className={`w-9 h-9 items-center justify-center bg-surface-card dark:bg-surface rounded-r-lg ${
              role.count >= 99 ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="인원 증가"
          >
            <PlusIcon size={18} color={SECONDARY_PALETTE[500]} />
          </Pressable>

          {/* 삭제 버튼 - 모든 역할에 표시 */}
          <Pressable
            onPress={onDelete}
            disabled={!canDelete}
            className={`ml-2 p-2 rounded-lg ${
              canDelete
                ? 'bg-error-50 dark:bg-error-900/20'
                : 'bg-secondary-100 dark:bg-surface opacity-50'
            }`}
            accessibilityRole="button"
            accessibilityLabel="역할 삭제"
            accessibilityState={{ disabled: !canDelete }}
          >
            <TrashIcon size={16} color={canDelete ? '#DC2626' : SECONDARY_PALETTE[400]} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const RolesSection = memo(function RolesSection({
  data,
  onUpdate,
  errors = {},
}: RolesSectionProps) {
  const [showModal, setShowModal] = useState(false);

  // 역할 목록 (기본값: 딜러 1명)
  const roles = useMemo(() => {
    if (!data.roles || data.roles.length === 0) {
      return [...DEFAULT_ROLES];
    }
    return data.roles;
  }, [data.roles]);

  // 이미 추가된 역할명 목록 (중복 방지용)
  const existingRoleNames = useMemo(() => roles.map((r) => r.name), [roles]);

  // 인원 수 변경
  const handleCountChange = useCallback(
    (index: number, delta: number) => {
      const newRoles = [...roles];
      const newCount = Math.max(1, Math.min(99, newRoles[index].count + delta));
      newRoles[index] = { ...newRoles[index], count: newCount };
      onUpdate({ roles: newRoles });
    },
    [roles, onUpdate]
  );

  // 역할명 변경 (커스텀 역할)
  const handleNameChange = useCallback(
    (index: number, name: string) => {
      const newRoles = [...roles];
      newRoles[index] = { ...newRoles[index], name };
      onUpdate({ roles: newRoles });
    },
    [roles, onUpdate]
  );

  // 역할 선택 (모달에서)
  const handleSelectRole = useCallback(
    (roleKey: string, customName?: string) => {
      const roleOption = STAFF_ROLES.find((r) => r.key === roleKey);
      if (!roleOption) return;

      const newRole: FormRoleWithCount = {
        name: roleKey === 'other' ? customName || '' : roleOption.name,
        count: 1,
        isCustom: roleKey === 'other',
      };
      onUpdate({ roles: [...roles, newRole] });
    },
    [roles, onUpdate]
  );

  // 역할 삭제
  const handleDeleteRole = useCallback(
    (index: number) => {
      if (roles.length <= 1) return; // 최소 1개 유지
      const newRoles = roles.filter((_, i) => i !== index);
      onUpdate({ roles: newRoles });
    },
    [roles, onUpdate]
  );

  // 총 인원
  const totalCount = useMemo(() => roles.reduce((sum, r) => sum + r.count, 0), [roles]);

  // 삭제 가능 여부 (최소 1개 이상 유지)
  const canDelete = roles.length > 1;

  return (
    <View>
      {/* 역할 목록 */}
      {roles.map((role, index) => (
        <RoleCard
          key={`role-${index}-${role.name}`}
          role={role}
          onCountChange={(delta) => handleCountChange(index, delta)}
          onNameChange={role.isCustom ? (name) => handleNameChange(index, name) : undefined}
          onDelete={() => handleDeleteRole(index)}
          canDelete={canDelete}
        />
      ))}

      {/* 역할 추가 버튼 */}
      <Pressable
        onPress={() => setShowModal(true)}
        className="mt-2 flex-row items-center justify-center p-3 border-2 border-dashed border-secondary-300 dark:border-surface-overlay rounded-md"
        accessibilityRole="button"
        accessibilityLabel="역할 추가"
      >
        <PlusIcon size={18} color={SECONDARY_PALETTE[500]} />
        <Text className="ml-2 text-content-muted dark:text-secondary-400 font-sans-medium text-sm">
          역할 추가
        </Text>
      </Pressable>

      {/* 에러 메시지 */}
      {errors.roles && (
        <Text className="mt-2 text-sm text-error-500 font-sans">{errors.roles}</Text>
      )}

      {/* 총 인원 표시 */}
      {totalCount > 0 && (
        <View className="mt-3 flex-row items-center justify-center py-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <BriefcaseIcon size={18} color="#B8962E" />
          <Text className="ml-2 text-base font-sans-bold text-primary-600 dark:text-primary-400">
            총 {totalCount}명 모집
          </Text>
        </View>
      )}

      {/* 역할 선택 모달 */}
      {showModal ? (
        <RoleSelectModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          onSelect={handleSelectRole}
          existingRoleNames={existingRoleNames}
        />
      ) : null}
    </View>
  );
});

export default RolesSection;
