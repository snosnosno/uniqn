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

import React, { useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { XCircleIcon } from '@/components/icons';
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
  usedRoles: _usedRoles, // TODO: 역할 선택 UI 구현 시 사용
  onUpdate,
  onRemove,
}: RoleRequirementRowProps) {
  // TODO: 역할 변경 (역할 선택 UI 구현 시 사용)
  // const handleRoleChange = useCallback(
  //   (newRole: StaffRole | 'other') => {
  //     onUpdate(index, { role: newRole });
  //   },
  //   [index, onUpdate]
  // );

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

  return (
    <View className="flex-row items-center gap-2 mb-2">
      {/* 역할 선택 (간소화: 버튼으로 표시) */}
      <View className="flex-1">
        <View className="flex-row items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
          <Text className="text-sm text-gray-900 dark:text-white">
            {getRoleDisplayName(role.role ?? role.name ?? 'dealer', role.customRole)}
          </Text>
        </View>
        {/* TODO: 역할 선택 모달/드롭다운 추가 */}
      </View>

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
