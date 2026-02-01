/**
 * UNIQN Mobile - 역할 선택 모달
 *
 * @description 역할 선택을 위한 공통 모달 컴포넌트
 * @version 1.0.0
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Modal } from '@/components/ui/Modal';
import { CheckIcon } from '@/components/icons';
import { STAFF_ROLES, type StaffRoleOption } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface RoleSelectModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 역할 선택 콜백 (roleKey, customName?) */
  onSelect: (roleKey: string, customName?: string) => void;
  /** 이미 추가된 역할명 목록 (중복 방지) */
  existingRoleNames: string[];
  /** 모달 제목 */
  title?: string;
}

// ============================================================================
// Component
// ============================================================================

export const RoleSelectModal = memo(function RoleSelectModal({
  visible,
  onClose,
  onSelect,
  existingRoleNames,
  title = '역할 선택',
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
        return;
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
          className={`flex-row items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-surface-overlay ${
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
          {isExisting && !isOther && <CheckIcon size={20} color="#4F46E5" />}
        </Pressable>
      );
    },
    [existingRoleNames, handleSelectRole]
  );

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title={title}
      position="bottom"
      showCloseButton
    >
      <View className="-mx-5 -mb-5">
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
              className="border-2 border-gray-300 dark:border-surface-overlay rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white bg-white dark:bg-surface"
            />
            <View className="flex-row gap-3 mt-4">
              <Pressable
                onPress={() => {
                  setShowCustomInput(false);
                  setCustomRoleName('');
                }}
                className="flex-1 py-3 rounded-lg bg-gray-100 dark:bg-surface"
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
                    : 'bg-gray-300 dark:bg-surface-elevated'
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
          <View style={{ height: 350 }}>
            <FlashList
              data={STAFF_ROLES}
              renderItem={renderRoleItem}
              keyExtractor={(item) => item.key}
              contentContainerStyle={{ paddingBottom: 34 }}
              showsVerticalScrollIndicator={false}
              // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
              estimatedItemSize={56}
            />
          </View>
        )}
      </View>
    </Modal>
  );
});

export default RoleSelectModal;
