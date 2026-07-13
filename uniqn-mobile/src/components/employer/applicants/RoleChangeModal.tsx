/**
 * UNIQN Mobile - 역할 변경 모달
 *
 * @description 구인자가 확정 스태프의 역할을 변경하는 모달
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { selectPostingRoleAvailability } from '@/domains/job-posting';
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
  /**
   * 역할키(DB `_posting_role_key`)별 실확정 인원 (aggregateRoleFilledFromSubmap 결과).
   * 주입 시 마감(remaining 0) 역할을 비활성+"(마감)" 표기한다. 미주입 시 기존 동작(전 역할 선택 가능).
   */
  filledByRole?: Record<string, number>;
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
  isFull: boolean;
  onSelect: () => void;
}

function RoleOption({ role, isSelected, isCurrentRole, isFull, onSelect }: RoleOptionProps) {
  // 역할 키를 한글로 변환
  const roleDisplayName = getRoleDisplayName(role);
  // 현재 역할은 항상 선택 가능 — 마감이어도 현재 역할이면 비활성하지 않는다.
  const disabled = isCurrentRole || isFull;

  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${roleDisplayName}${
        isCurrentRole ? ' (현재 역할)' : isFull ? ' (마감)' : ''
      }`}
      accessibilityHint={
        isCurrentRole
          ? '현재 역할이므로 선택할 수 없습니다'
          : isFull
            ? '모집이 마감된 역할이라 선택할 수 없습니다'
            : '이 역할로 변경합니다'
      }
      accessibilityState={{
        selected: isSelected,
        disabled,
      }}
      className={`
        flex-row items-center justify-between p-4 rounded-md mb-2
        ${
          disabled
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
        {/* disabled 행(opacity-50)의 default variant 는 배경과 동화 — warning 으로 시인성 확보 */}
        {isFull && !isCurrentRole && (
          <Badge preset="closed" variant="warning" size="sm" className="ml-2" />
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
  filledByRole,
  onSave,
  isLoading = false,
}: RoleChangeModalProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [reason, setReason] = useState('');

  // 역할별 실카운트 가용성 — filledByRole 주입 시 마감 역할 판정에 사용(미주입 시 전 역할 여유).
  const roleAvailability = useMemo(
    () =>
      jobPosting
        ? selectPostingRoleAvailability(jobPosting, filledByRole ? { filledByRole } : undefined)
        : undefined,
    [jobPosting, filledByRole]
  );

  // 역할 목록 (공고에서 추출 또는 기본값)
  const roles = useMemo(() => {
    if (availableRoles && availableRoles.length > 0) {
      return availableRoles;
    }
    // v2.0: 공고의 역할 배열에서 추출
    if (roleAvailability && roleAvailability.items.length > 0) {
      return roleAvailability.items.map((item) => item.key);
    }
    // 기본 역할
    return DEFAULT_ROLES;
  }, [availableRoles, roleAvailability]);

  // 마감(remaining 0) 역할키 집합 — 표시 비활성 판정용. 현재 역할 예외는 렌더 시점에 적용.
  const fullRoleKeys = useMemo(
    () =>
      new Set(
        (roleAvailability?.items ?? []).filter((item) => !item.isAvailable).map((item) => item.key)
      ),
    [roleAvailability]
  );

  // staff 변경 시 선택 초기화
  useEffect(() => {
    if (staff) {
      setSelectedRole('');
      setReason('');
    }
  }, [staff]);

  // 현재 역할
  const currentRole = staff?.role || '';
  // 역할 목록 키와의 비교용 정규화 키 — custom 스태프는 role='other'+customRole 분리 저장이라
  // raw role 로 비교하면 본인 역할이 "(마감)" 으로 오표기된다(목록 키는 raw customRole).
  const currentRoleKey =
    staff?.role === 'other' && staff.customRole ? staff.customRole : currentRole;

  // 역할 선택 핸들러
  const handleSelectRole = useCallback(
    (role: string) => {
      if (role !== currentRoleKey) {
        setSelectedRole(role);
      }
    },
    [currentRoleKey]
  );

  // 저장 유효성
  const isValid = useMemo(() => {
    return selectedRole.length > 0 && selectedRole !== currentRoleKey && reason.trim().length > 0;
  }, [selectedRole, currentRoleKey, reason]);

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
              isCurrentRole={role === currentRoleKey}
              isFull={role !== currentRoleKey && fullRoleKeys.has(role)}
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
