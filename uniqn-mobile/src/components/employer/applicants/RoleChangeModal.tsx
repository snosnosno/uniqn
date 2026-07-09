/**
 * UNIQN Mobile - 역할 변경 모달
 *
 * @description 구인자가 확정 스태프의 역할을 변경하는 모달
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { buildPostingFacts } from '@/domains/job-posting';
import { Modal } from '@/components/ui/Modal';
import { ModalFooterButtons } from '@/components/ui/ModalFooterButtons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { UserIcon, CheckIcon, AlertCircleIcon, EditIcon } from '@/components/icons';
import type { ConfirmedStaff, JobPosting } from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { STAFF_ROLES } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface RoleChangeModalProps {
  visible: boolean;
  onClose: () => void;
  staff: ConfirmedStaff | null;
  jobPosting?: JobPosting | null;
  availableRoles?: string[];
  onSave: (data: { staffId: string; workLogId: string; newRole: string; reason: string }) => void;
  isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** 기본 역할 목록 (STAFF_ROLES에서 추출) */
const DEFAULT_ROLES = STAFF_ROLES.map((r) => r.key);

// ============================================================================
// Sub-components
// ============================================================================

interface RoleOptionProps {
  role: string;
  isSelected: boolean;
  isCurrentRole: boolean;
  onSelect: () => void;
}

function RoleOption({ role, isSelected, isCurrentRole, onSelect }: RoleOptionProps) {
  // 역할 키를 한글로 변환
  const roleDisplayName = getRoleDisplayName(role);

  return (
    <Pressable
      onPress={onSelect}
      disabled={isCurrentRole}
      accessibilityRole="radio"
      accessibilityLabel={`${roleDisplayName}${isCurrentRole ? ' (현재 역할)' : ''}`}
      accessibilityHint={
        isCurrentRole ? '현재 역할이므로 선택할 수 없습니다' : '이 역할로 변경합니다'
      }
      accessibilityState={{
        selected: isSelected,
        disabled: isCurrentRole,
      }}
      className={`
        flex-row items-center justify-between p-4 rounded-md mb-2
        ${
          isCurrentRole
            ? 'bg-secondary-100 dark:bg-surface opacity-50'
            : isSelected
              ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
              : 'bg-surface-card border border-secondary-200 dark:border-surface-overlay'
        }
      `}
    >
      <View className="flex-row items-center">
        <View
          className={`
            h-10 w-10 rounded-sm items-center justify-center
            ${isSelected ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-surface'}
          `}
        >
          <UserIcon size={20} color={isSelected ? '#FFFFFF' : SECONDARY_PALETTE[500]} />
        </View>
        <Text
          className={`
            ml-3 text-base font-sans-medium
            ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-content-primary'}
          `}
        >
          {roleDisplayName}
        </Text>
        {isCurrentRole && (
          <Badge variant="default" size="sm" className="ml-2">
            현재 역할
          </Badge>
        )}
      </View>

      {isSelected && !isCurrentRole && (
        <View className="h-6 w-6 rounded-sm bg-primary-600 items-center justify-center">
          <CheckIcon size={14} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RoleChangeModal({
  visible,
  onClose,
  staff,
  jobPosting,
  availableRoles,
  onSave,
  isLoading = false,
}: RoleChangeModalProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [reason, setReason] = useState('');

  // 역할 목록 (공고에서 추출 또는 기본값)
  const roles = useMemo(() => {
    if (availableRoles && availableRoles.length > 0) {
      return availableRoles;
    }
    // v2.0: 공고의 역할 배열에서 추출
    if (jobPosting) {
      const postingFacts = buildPostingFacts(jobPosting);
      if (postingFacts.roleAvailability.items.length > 0) {
        return postingFacts.roleAvailability.items.map((role) => role.key);
      }
    }
    // 기본 역할
    return DEFAULT_ROLES;
  }, [availableRoles, jobPosting]);

  // staff 변경 시 선택 초기화
  useEffect(() => {
    if (staff) {
      setSelectedRole('');
      setReason('');
    }
  }, [staff]);

  // 현재 역할
  const currentRole = staff?.role || '';

  // 역할 선택 핸들러
  const handleSelectRole = useCallback(
    (role: string) => {
      if (role !== currentRole) {
        setSelectedRole(role);
      }
    },
    [currentRole]
  );

  // 저장 유효성
  const isValid = useMemo(() => {
    return selectedRole.length > 0 && selectedRole !== currentRole && reason.trim().length > 0;
  }, [selectedRole, currentRole, reason]);

  // 저장 핸들러
  const handleSave = useCallback(() => {
    if (!isValid || !staff) return;

    onSave({
      staffId: staff.staffId,
      workLogId: staff.id,
      newRole: selectedRole,
      reason: reason.trim(),
    });
  }, [isValid, staff, selectedRole, reason, onSave]);

  // 닫기 핸들러
  const handleClose = useCallback(() => {
    setSelectedRole('');
    setReason('');
    onClose();
  }, [onClose]);

  if (!staff) return null;

  return (
    <Modal visible={visible} onClose={handleClose} title="역할 변경" position="bottom">
      <View>
        {/* 스태프 정보 */}
        <Card variant="filled" padding="sm" className="mb-3">
          <View className="flex-row items-center">
            <View className="h-12 w-12 rounded-sm bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
              <Text className="text-xl font-display text-primary-600 dark:text-primary-400">
                {staff.staffName.charAt(0)}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                {staff.staffName}
                {staff.staffNickname ? ` (${staff.staffNickname})` : ''}
              </Text>
              <View className="flex-row items-center mt-1">
                <Badge variant="default" size="sm">
                  {getRoleDisplayName(currentRole, staff?.customRole)}
                </Badge>
                <Text className="ml-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  {staff.date}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* 역할 선택 */}
        <Text className="text-sm font-sans-medium text-content-secondary mb-2">
          변경할 역할 선택
        </Text>

        <ScrollView className="max-h-56 mb-3" showsVerticalScrollIndicator={true}>
          {roles.map((role) => (
            <RoleOption
              key={role}
              role={role}
              isSelected={selectedRole === role}
              isCurrentRole={role === currentRole}
              onSelect={() => handleSelectRole(role)}
            />
          ))}
        </ScrollView>

        {/* 변경 사유 */}
        <View className="mb-3">
          <Text className="text-sm font-sans-medium text-content-secondary mb-1.5">
            변경 사유 <Text className="text-error-500 font-sans">*</Text>
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="역할 변경 사유를 입력하세요"
            placeholderTextColor={SECONDARY_PALETTE[400]}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            accessibilityLabel="역할 변경 사유 입력"
            accessibilityHint="역할 변경 사유를 입력하세요. 필수 입력 항목입니다."
            className="p-2.5 border border-divider rounded-lg bg-surface-card text-content-primary dark:text-off-white min-h-[48px]"
          />
        </View>

        {/* 안내 메시지 */}
        <View className="flex-row items-start p-2.5 bg-warning-50 dark:bg-warning-900/20 rounded-lg mb-3">
          <AlertCircleIcon size={14} color="#D4A017" />
          <Text className="ml-2 text-xs text-warning-700 dark:text-warning-300 flex-1 font-sans">
            역할 변경 시 해당 역할의 시급이 적용되며, 스태프에게 알림이 발송됩니다.
          </Text>
        </View>

        {/* 버튼 */}
        <ModalFooterButtons
          onCancel={handleClose}
          onSubmit={handleSave}
          isLoading={isLoading}
          submitText="역할 변경"
          submitDisabled={!isValid}
          submitIcon={<EditIcon size={18} color="#FFFFFF" />}
        />
      </View>
    </Modal>
  );
}
