import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { CheckIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { STAFF_ROLES, type StaffRoleOption } from '@/constants';

export interface RoleSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (roleKey: string, customName?: string) => void;
  existingRoleNames: string[];
  title?: string;
}

export const RoleSelectModal = memo(function RoleSelectModal({
  visible,
  onClose,
  onSelect,
  existingRoleNames,
  title = '역할 선택',
}: RoleSelectModalProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const [customRoleName, setCustomRoleName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const existingRoleNameSet = useMemo(() => new Set(existingRoleNames), [existingRoleNames]);

  useEffect(() => {
    if (!visible) {
      setCustomRoleName('');
      setShowCustomInput(false);
    }
  }, [visible]);

  const handleSelectRole = useCallback(
    (role: StaffRoleOption) => {
      if (role.key === 'other') {
        setShowCustomInput(true);
        return;
      }

      if (existingRoleNameSet.has(role.name)) {
        return;
      }

      onSelect(role.key);
      onClose();
    },
    [existingRoleNameSet, onClose, onSelect]
  );

  const handleAddCustomRole = useCallback(() => {
    const trimmedName = customRoleName.trim();
    if (!trimmedName || existingRoleNameSet.has(trimmedName)) {
      return;
    }

    onSelect('other', trimmedName);
    setCustomRoleName('');
    setShowCustomInput(false);
    onClose();
  }, [customRoleName, existingRoleNameSet, onClose, onSelect]);

  const handleClose = useCallback(() => {
    setCustomRoleName('');
    setShowCustomInput(false);
    onClose();
  }, [onClose]);

  const renderRoleItem = useCallback(
    (item: StaffRoleOption) => {
      const isExisting = existingRoleNameSet.has(item.name);
      const isOther = item.key === 'other';

      return (
        <Pressable
          key={item.key}
          onPress={() => handleSelectRole(item)}
          disabled={isExisting && !isOther}
          className={`flex-row items-center justify-between px-4 py-4 border-b border-secondary-100 dark:border-surface-overlay ${
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
                  ? 'text-secondary-400 dark:text-secondary-500'
                  : 'text-secondary-900 dark:text-off-white'
              }`}
            >
              {item.name}
              {isOther ? ' (직접 입력)' : ''}
            </Text>
          </View>
          {isExisting && !isOther ? (
            <CheckIcon size={20} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
          ) : null}
        </Pressable>
      );
    },
    [existingRoleNameSet, handleSelectRole, isDarkMode]
  );

  return (
    <Modal visible={visible} onClose={handleClose} title={title} position="bottom" showCloseButton>
      <View className="-mx-5 -mb-5">
        {showCustomInput ? (
          <View className="p-4">
            <Text className="text-sm text-secondary-600 dark:text-secondary-400 mb-2">
              역할 이름을 입력해 주세요.
            </Text>
            <TextInput
              value={customRoleName}
              onChangeText={setCustomRoleName}
              placeholder="예: 플로어 매니저"
              placeholderTextColor="#A89C84"
              autoFocus
              className="border-2 border-secondary-300 dark:border-surface-overlay rounded-lg px-4 py-3 text-base text-secondary-900 dark:text-off-white bg-white dark:bg-surface"
            />
            <View className="flex-row gap-3 mt-4">
              <Pressable
                onPress={() => {
                  setShowCustomInput(false);
                  setCustomRoleName('');
                }}
                className="flex-1 py-3 rounded-lg bg-secondary-100 dark:bg-surface"
              >
                <Text className="text-center font-medium text-secondary-700 dark:text-secondary-300">
                  취소
                </Text>
              </Pressable>
              <Pressable
                onPress={handleAddCustomRole}
                disabled={!customRoleName.trim()}
                className={`flex-1 py-3 rounded-lg ${
                  customRoleName.trim()
                    ? 'bg-primary-500'
                    : 'bg-secondary-300 dark:bg-surface-elevated'
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    customRoleName.trim()
                      ? 'text-surface-dark'
                      : 'text-secondary-500 dark:text-secondary-400'
                  }`}
                >
                  추가
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="pb-8">{STAFF_ROLES.map(renderRoleItem)}</View>
        )}
      </View>
    </Modal>
  );
});

export default RoleSelectModal;
