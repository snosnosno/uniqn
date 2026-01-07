/**
 * UNIQN Mobile - 공고 작성 역할/인원 섹션
 *
 * @description 역할별 모집 인원 설정 (선택지 제공, 모든 역할 삭제 가능)
 * @version 2.0.0
 */

import React, { useCallback, useMemo, memo, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, FlatList } from 'react-native';
import {
  PlusIcon,
  MinusIcon,
  TrashIcon,
  BriefcaseIcon,
  XMarkIcon,
  CheckIcon,
} from '@/components/icons';
import type { JobPostingFormData, FormRoleWithCount } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface RolesSectionProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  errors?: Record<string, string>;
}

interface StaffRoleOption {
  key: string;
  name: string;
  icon: string;
}

// ============================================================================
// Constants
// ============================================================================

/** 미리 정의된 역할 목록 (웹앱과 동일) */
export const STAFF_ROLES: StaffRoleOption[] = [
  { key: 'dealer', name: '딜러', icon: '🃏' },
  { key: 'floor', name: '플로어', icon: '👔' },
  { key: 'serving', name: '서빙', icon: '🍸' },
  { key: 'manager', name: '매니저', icon: '👔' },
  { key: 'staff', name: '직원', icon: '👤' },
  { key: 'other', name: '기타', icon: '✏️' },
];

/** 역할명 → 아이콘 매핑 */
const ROLE_ICONS: Record<string, string> = Object.fromEntries(
  STAFF_ROLES.map((r) => [r.name, r.icon])
);

const DEFAULT_ICON = '👤';

/** 기본 역할 (폼 초기값) */
const DEFAULT_ROLES: FormRoleWithCount[] = [
  { name: '딜러', count: 1, isCustom: false },
];

// ============================================================================
// RoleSelectModal Component
// ============================================================================

interface RoleSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (roleKey: string, customName?: string) => void;
  existingRoleNames: string[];
}

const RoleSelectModal = memo(function RoleSelectModal({
  visible,
  onClose,
  onSelect,
  existingRoleNames,
}: RoleSelectModalProps) {
  const [customRoleName, setCustomRoleName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // 역할 선택 핸들러
  const handleSelectRole = useCallback(
    (role: StaffRoleOption) => {
      if (role.key === 'other') {
        setShowCustomInput(true);
        return;
      }

      // 이미 추가된 역할인지 확인
      if (existingRoleNames.includes(role.name)) {
        return; // 비활성화된 항목은 선택 불가
      }

      onSelect(role.key);
      onClose();
    },
    [existingRoleNames, onSelect, onClose]
  );

  // 커스텀 역할 추가 핸들러
  const handleAddCustomRole = useCallback(() => {
    const trimmedName = customRoleName.trim();
    if (!trimmedName) return;

    // 중복 확인
    if (existingRoleNames.includes(trimmedName)) {
      return;
    }

    onSelect('other', trimmedName);
    setCustomRoleName('');
    setShowCustomInput(false);
    onClose();
  }, [customRoleName, existingRoleNames, onSelect, onClose]);

  // 모달 닫힐 때 상태 초기화
  const handleClose = useCallback(() => {
    setCustomRoleName('');
    setShowCustomInput(false);
    onClose();
  }, [onClose]);

  // 역할 항목 렌더링
  const renderRoleItem = useCallback(
    ({ item }: { item: StaffRoleOption }) => {
      const isExisting = existingRoleNames.includes(item.name);
      const isOther = item.key === 'other';

      return (
        <Pressable
          onPress={() => handleSelectRole(item)}
          disabled={isExisting && !isOther}
          className={`flex-row items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-700 ${
            isExisting && !isOther ? 'opacity-50' : ''
          }`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isExisting && !isOther }}
          accessibilityLabel={`${item.name} 역할 선택`}
        >
          <View className="flex-row items-center">
            <Text className="text-xl mr-3">{item.icon}</Text>
            <Text
              className={`text-base ${
                isExisting && !isOther
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {item.name}
              {isOther && ' (직접 입력)'}
            </Text>
          </View>
          {isExisting && !isOther && (
            <CheckIcon size={20} color="#4F46E5" />
          )}
        </Pressable>
      );
    },
    [existingRoleNames, handleSelectRole]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white dark:bg-gray-800 rounded-t-2xl max-h-[70%]">
          {/* 헤더 */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              역할 선택
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <XMarkIcon size={24} color="#6B7280" />
            </Pressable>
          </View>

          {showCustomInput ? (
            // 커스텀 역할 입력
            <View className="p-4">
              <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                역할 이름을 입력하세요
              </Text>
              <TextInput
                value={customRoleName}
                onChangeText={setCustomRoleName}
                placeholder="예: 바텐더, 캐셔"
                placeholderTextColor="#9CA3AF"
                autoFocus
                className="border-2 border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-800"
              />
              <View className="flex-row gap-3 mt-4">
                <Pressable
                  onPress={() => {
                    setShowCustomInput(false);
                    setCustomRoleName('');
                  }}
                  className="flex-1 py-3 rounded-lg bg-gray-100 dark:bg-gray-700"
                >
                  <Text className="text-center font-medium text-gray-700 dark:text-gray-300">
                    취소
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleAddCustomRole}
                  disabled={!customRoleName.trim()}
                  className={`flex-1 py-3 rounded-lg ${
                    customRoleName.trim()
                      ? 'bg-indigo-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <Text
                    className={`text-center font-medium ${
                      customRoleName.trim()
                        ? 'text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    추가
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // 역할 목록
            <FlatList
              data={STAFF_ROLES}
              renderItem={renderRoleItem}
              keyExtractor={(item) => item.key}
              contentContainerStyle={{ paddingBottom: 34 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
});

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
  const icon = ROLE_ICONS[role.name] || DEFAULT_ICON;
  const isCustom = role.isCustom;

  return (
    <View className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-3">
      <View className="flex-row items-center">
        {/* 역할 아이콘 */}
        <View className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
          <Text className="text-xl">{icon}</Text>
        </View>

        {/* 역할 정보 */}
        <View className="flex-1 ml-3">
          {isCustom && onNameChange ? (
            <TextInput
              value={role.name}
              onChangeText={onNameChange}
              placeholder="역할 이름 입력"
              placeholderTextColor="#9CA3AF"
              className="font-medium text-gray-900 dark:text-white text-base px-0 py-1 border-b border-gray-300 dark:border-gray-600"
            />
          ) : (
            <Text className="font-medium text-gray-900 dark:text-white text-base">
              {role.name}
            </Text>
          )}
        </View>

        {/* 인원 조절 */}
        <View className="flex-row items-center">
          <Pressable
            onPress={() => onCountChange(-1)}
            disabled={role.count <= 1}
            className={`w-9 h-9 items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-l-lg ${
              role.count <= 1 ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="인원 감소"
          >
            <MinusIcon size={18} color="#6B7280" />
          </Pressable>

          <View className="w-10 h-9 items-center justify-center bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-600">
            <Text className="font-bold text-gray-900 dark:text-white">
              {role.count}
            </Text>
          </View>

          <Pressable
            onPress={() => onCountChange(1)}
            disabled={role.count >= 99}
            className={`w-9 h-9 items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-r-lg ${
              role.count >= 99 ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityLabel="인원 증가"
          >
            <PlusIcon size={18} color="#6B7280" />
          </Pressable>

          {/* 삭제 버튼 - 모든 역할에 표시 */}
          <Pressable
            onPress={onDelete}
            disabled={!canDelete}
            className={`ml-2 p-2 rounded-lg ${
              canDelete
                ? 'bg-red-50 dark:bg-red-900/20'
                : 'bg-gray-100 dark:bg-gray-700 opacity-50'
            }`}
            accessibilityRole="button"
            accessibilityLabel="역할 삭제"
            accessibilityState={{ disabled: !canDelete }}
          >
            <TrashIcon size={16} color={canDelete ? '#EF4444' : '#9CA3AF'} />
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
  const existingRoleNames = useMemo(
    () => roles.map((r) => r.name),
    [roles]
  );

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
        name: roleKey === 'other' ? (customName || '') : roleOption.name,
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
  const totalCount = useMemo(
    () => roles.reduce((sum, r) => sum + r.count, 0),
    [roles]
  );

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
          onNameChange={
            role.isCustom ? (name) => handleNameChange(index, name) : undefined
          }
          onDelete={() => handleDeleteRole(index)}
          canDelete={canDelete}
        />
      ))}

      {/* 역할 추가 버튼 */}
      <Pressable
        onPress={() => setShowModal(true)}
        className="mt-2 flex-row items-center justify-center p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl"
        accessibilityRole="button"
        accessibilityLabel="역할 추가"
      >
        <PlusIcon size={18} color="#6B7280" />
        <Text className="ml-2 text-gray-600 dark:text-gray-400 font-medium text-sm">
          역할 추가
        </Text>
      </Pressable>

      {/* 에러 메시지 */}
      {errors.roles && (
        <Text className="mt-2 text-sm text-red-500">{errors.roles}</Text>
      )}

      {/* 총 인원 표시 */}
      {totalCount > 0 && (
        <View className="mt-4 flex-row items-center justify-center py-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <BriefcaseIcon size={18} color="#2563EB" />
          <Text className="ml-2 text-base font-bold text-primary-600 dark:text-primary-400">
            총 {totalCount}명 모집
          </Text>
        </View>
      )}

      {/* 역할 선택 모달 */}
      <RoleSelectModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleSelectRole}
        existingRoleNames={existingRoleNames}
      />
    </View>
  );
});

export default RolesSection;
