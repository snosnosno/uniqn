/**
 * UNIQN Mobile - 역할 요구사항 행
 *
 * @description 시간대별 역할과 필요 인원을 입력하는 컴포넌트
 * @version 2.0.0
 *
 * 주요 기능:
 * - 역할 선택 (dealer, floorman, supervisor, chip_runner, other)
 * - 커스텀 역할명 입력 (other 선택 시)
 * - 필요 인원 입력 (1-200명)
 * - 중복 역할 방지
 */

import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Pressable, TextInput, FlatList } from 'react-native';
import { XCircleIcon, ChevronDownIcon, CheckIcon } from '@/components/icons';
import { Modal } from '@/components/ui';
import { STAFF_ROLES } from '@/constants';
import { clampHeadcount } from '@/utils/job-posting/dateUtils';
import type { RoleRequirement } from '@/types/jobPosting/dateRequirement';
import type { StaffRole } from '@/types/common';
import { getRoleDisplayName } from '@/types/unified';

// ============================================================================
// Types
// ============================================================================

export interface RoleRequirementRowProps {
  /** 역할 데이터 */
  role: RoleRequirement;
  /** 역할 인덱스 */
  index: number;
  /** 삭제 가능 여부 (최소 1개 유지) */
  canRemove: boolean;
  /** 이미 선택된 역할 목록 (중복 방지) */
  usedRoles: (StaffRole | 'other')[];
  /** 역할 업데이트 콜백 */
  onUpdate: (index: number, role: Partial<RoleRequirement>) => void;
  /** 역할 삭제 콜백 */
  onRemove: (index: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function RoleRequirementRow({
  role,
  index,
  canRemove,
  usedRoles,
  onUpdate,
  onRemove,
}: RoleRequirementRowProps) {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  // 이미 선택된 역할 제외 (현재 역할은 포함)
  const availableRoles = useMemo(() => {
    const currentRole = role.role ?? 'dealer';
    return STAFF_ROLES.filter(
      (r) => r.key === currentRole || r.key === 'other' || !usedRoles.includes(r.key as StaffRole | 'other')
    );
  }, [usedRoles, role.role]);

  // 역할 변경
  const handleRoleChange = useCallback(
    (newRole: StaffRole | 'other') => {
      onUpdate(index, { role: newRole, customRole: newRole === 'other' ? '' : undefined });
      setIsRoleModalOpen(false);
    },
    [index, onUpdate]
  );

  // 커스텀 역할명 변경
  const handleCustomRoleChange = useCallback(
    (text: string) => {
      onUpdate(index, { customRole: text });
    },
    [index, onUpdate]
  );

  // 인원 변경
  const handleHeadcountChange = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (isNaN(num)) {
        onUpdate(index, { headcount: 1 });
        return;
      }
      const clamped = clampHeadcount(num);
      onUpdate(index, { headcount: clamped });
    },
    [index, onUpdate]
  );

  const currentRoleKey = role.role ?? 'dealer';
  const currentRoleInfo = STAFF_ROLES.find((r) => r.key === currentRoleKey);

  return (
    <View className="flex-row items-center gap-2 mb-2">
      {/* 역할 선택 버튼 */}
      <Pressable
        onPress={() => setIsRoleModalOpen(true)}
        className="flex-1 flex-row items-center justify-between bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 active:bg-gray-100 dark:active:bg-gray-700"
        accessibilityRole="button"
        accessibilityLabel={`역할 선택: ${getRoleDisplayName(currentRoleKey, role.customRole)}`}
        accessibilityHint="탭하여 역할 변경"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-base">{currentRoleInfo?.icon ?? '👤'}</Text>
          <Text className="text-sm text-gray-900 dark:text-white">
            {getRoleDisplayName(currentRoleKey, role.customRole)}
          </Text>
        </View>
        <ChevronDownIcon size={16} color="#9CA3AF" />
      </Pressable>

      {/* 역할 선택 모달 */}
      <Modal
        visible={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="역할 선택"
        position="bottom"
        size="full"
      >
        <FlatList
          data={availableRoles}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const isSelected = item.key === currentRoleKey;
            const isDisabled = item.key !== 'other' && item.key !== currentRoleKey && usedRoles.includes(item.key as StaffRole | 'other');

            return (
              <Pressable
                onPress={() => !isDisabled && handleRoleChange(item.key as StaffRole | 'other')}
                disabled={isDisabled}
                className={`flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                } ${isDisabled ? 'opacity-40' : 'active:bg-gray-100 dark:active:bg-gray-700'}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                accessibilityLabel={`${item.name}${isSelected ? ', 선택됨' : ''}`}
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-lg">{item.icon}</Text>
                  <Text
                    className={`text-base ${
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {item.name}
                  </Text>
                </View>
                {isSelected && <CheckIcon size={20} color="#3B82F6" />}
              </Pressable>
            );
          }}
          className="max-h-80"
        />
      </Modal>

      {/* 커스텀 역할명 입력 (other 선택 시) */}
      {role.role === 'other' && (
        <TextInput
          value={role.customRole || ''}
          onChangeText={handleCustomRoleChange}
          placeholder="역할명 입력"
          className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
          placeholderTextColor="#9CA3AF"
          maxLength={20}
        />
      )}

      {/* 인원 입력 */}
      <View className="w-20">
        <TextInput
          value={String(role.headcount)}
          onChangeText={handleHeadcountChange}
          placeholder="1"
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm text-center"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>

      {/* 삭제 버튼 */}
      {canRemove ? (
        <Pressable
          onPress={() => onRemove(index)}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="역할 삭제"
        >
          <XCircleIcon size={20} color="#EF4444" />
        </Pressable>
      ) : (
        <View className="w-9" />
      )}
    </View>
  );
}
