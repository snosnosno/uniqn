/**
 * UNIQN Mobile - 역할 변경 모달
 *
 * @description 구인자가 확정 스태프의 역할을 변경하는 모달
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  UserIcon,
  CheckIcon,
  AlertCircleIcon,
  EditIcon,
} from '../icons';
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
      className={`
        flex-row items-center justify-between p-4 rounded-xl mb-2
        ${isCurrentRole
          ? 'bg-gray-100 dark:bg-gray-800 opacity-50'
          : isSelected
          ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        }
      `}
    >
      <View className="flex-row items-center">
        <View
          className={`
            h-10 w-10 rounded-full items-center justify-center
            ${isSelected
              ? 'bg-primary-600'
              : 'bg-gray-200 dark:bg-gray-700'
            }
          `}
        >
          <UserIcon size={20} color={isSelected ? '#FFFFFF' : '#6B7280'} />
        </View>
        <Text
          className={`
            ml-3 text-base font-medium
            ${isSelected
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-900 dark:text-white'
            }
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
        <View className="h-6 w-6 rounded-full bg-primary-600 items-center justify-center">
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
    if (jobPosting?.roles && jobPosting.roles.length > 0) {
      return jobPosting.roles.map((r) => r.role).filter(Boolean) as string[];
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
  const handleSelectRole = useCallback((role: string) => {
    if (role !== currentRole) {
      setSelectedRole(role);
    }
  }, [currentRole]);

  // 저장 유효성
  const isValid = useMemo(() => {
    return (
      selectedRole.length > 0 &&
      selectedRole !== currentRole &&
      reason.trim().length > 0
    );
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
    <Modal
      visible={visible}
      onClose={handleClose}
      title="역할 변경"
      position="bottom"
    >
      <View>
        {/* 스태프 정보 */}
        <Card variant="filled" padding="sm" className="mb-3">
          <View className="flex-row items-center">
            <View className="h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
              <Text className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {staff.staffName.charAt(0)}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {staff.staffName}{staff.staffNickname ? ` (${staff.staffNickname})` : ''}
              </Text>
              <View className="flex-row items-center mt-1">
                <Badge variant="default" size="sm">
                  {getRoleDisplayName(currentRole, staff?.customRole)}
                </Badge>
                <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {staff.date}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* 역할 선택 */}
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          변경할 역할 선택
        </Text>

        <ScrollView
          className="max-h-56 mb-3"
          showsVerticalScrollIndicator={true}
        >
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
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            변경 사유 <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="역할 변경 사유를 입력하세요"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            className="p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[48px]"
          />
        </View>

        {/* 안내 메시지 */}
        <View className="flex-row items-start p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3">
          <AlertCircleIcon size={14} color="#D97706" />
          <Text className="ml-2 text-xs text-yellow-700 dark:text-yellow-300 flex-1">
            역할 변경 시 해당 역할의 시급이 적용되며, 스태프에게 알림이 발송됩니다.
          </Text>
        </View>

        {/* 버튼 */}
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            onPress={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            variant="primary"
            onPress={handleSave}
            loading={isLoading}
            disabled={!isValid}
            className="flex-1"
            icon={<EditIcon size={18} color="#FFFFFF" />}
          >
            역할 변경
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default RoleChangeModal;
