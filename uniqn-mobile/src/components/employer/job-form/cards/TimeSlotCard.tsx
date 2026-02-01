/**
 * UNIQN Mobile - 시간대 카드
 *
 * @description 날짜별 요구사항의 시간대를 표시하고 편집하는 카드
 * @version 3.0.0 - TimePicker 통합, 역할 편집 기능 추가
 *
 * 주요 기능:
 * - 시작시간 선택 (TimePicker 통합)
 * - 시간 미정 토글
 * - 역할 추가/삭제/인원 조절
 */

import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Pressable, TextInput, Switch } from 'react-native';
import {
  XCircleIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@/components/icons';
import { TimePicker } from '@/components/ui/TimePicker';
import { RoleSelectModal, NumberPickerModal } from '../modals';
import { ROLE_ICONS, DEFAULT_ROLE_ICON, STAFF_ROLES, MAX_ROLES_PER_SLOT } from '@/constants';
import type { TimeSlot, RoleRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

export interface TimeSlotCardProps {
  /** 시간대 데이터 */
  timeSlot: TimeSlot;
  /** 시간대 인덱스 */
  index: number;
  /** 삭제 가능 여부 (최소 1개 유지) */
  canRemove: boolean;
  /** 시간대 업데이트 콜백 */
  onUpdate: (index: number, timeSlot: Partial<TimeSlot>) => void;
  /** 시간대 삭제 콜백 */
  onRemove: (index: number) => void;
}

// ============================================================================
// RoleCard Component (시간대 내 역할 카드)
// ============================================================================

interface RoleCardProps {
  role: RoleRequirement;
  roleIndex: number;
  canRemove: boolean;
  onCountChange: (roleIndex: number, delta: number) => void;
  onCountSet: (roleIndex: number, count: number) => void;
  onRemove: (roleIndex: number) => void;
  onCustomNameChange?: (roleIndex: number, name: string) => void;
}

const RoleCard = React.memo(function RoleCard({
  role,
  roleIndex,
  canRemove,
  onCountChange,
  onCountSet,
  onRemove,
  onCustomNameChange,
}: RoleCardProps) {
  const [showNumberPicker, setShowNumberPicker] = useState(false);

  // 역할명 가져오기
  const roleKey = role.role ?? 'dealer';
  const roleName =
    roleKey === 'other' && role.customRole
      ? role.customRole
      : STAFF_ROLES.find((r) => r.key === roleKey)?.name || roleKey;

  const icon = ROLE_ICONS[roleName] || DEFAULT_ROLE_ICON;
  // 인원수
  const headcount = role.headcount ?? 1;
  const isCustom = roleKey === 'other';

  // 휠 피커 확인 핸들러
  const handlePickerConfirm = useCallback(
    (value: number) => {
      onCountSet(roleIndex, value);
      setShowNumberPicker(false);
    },
    [roleIndex, onCountSet]
  );

  return (
    <View className="flex-row items-center py-2 border-b border-gray-100 dark:border-surface-overlay last:border-b-0">
      {/* 역할 아이콘 및 이름 */}
      <View className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 items-center justify-center mr-2">
        <Text className="text-base">{icon}</Text>
      </View>

      <View className="flex-1">
        {isCustom && onCustomNameChange ? (
          <TextInput
            value={role.customRole || ''}
            onChangeText={(text) => onCustomNameChange(roleIndex, text)}
            placeholder="역할명 입력"
            placeholderTextColor="#9CA3AF"
            className="text-sm text-gray-900 dark:text-white py-1 px-0 border-b border-gray-300 dark:border-surface-overlay"
          />
        ) : (
          <Text className="text-sm font-medium text-gray-900 dark:text-white">{roleName}</Text>
        )}
      </View>

      {/* 인원 조절 */}
      <View className="flex-row items-center">
        <Pressable
          onPress={() => onCountChange(roleIndex, -1)}
          disabled={headcount <= 1}
          className={`w-7 h-7 items-center justify-center bg-gray-100 dark:bg-surface rounded-l-md ${
            headcount <= 1 ? 'opacity-50' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel="인원 감소"
        >
          <MinusIcon size={14} color="#6B7280" />
        </Pressable>

        {/* 숫자 탭 → 휠 피커 */}
        <Pressable
          onPress={() => setShowNumberPicker(true)}
          className="w-12 h-7 items-center justify-center bg-white dark:bg-surface border-y border-gray-200 dark:border-surface-overlay"
          accessibilityRole="button"
          accessibilityLabel="인원 선택"
        >
          <Text className="font-bold text-sm text-gray-900 dark:text-white">{headcount}</Text>
        </Pressable>

        <Pressable
          onPress={() => onCountChange(roleIndex, 1)}
          disabled={headcount >= 200}
          className={`w-7 h-7 items-center justify-center bg-gray-100 dark:bg-surface rounded-r-md ${
            headcount >= 200 ? 'opacity-50' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel="인원 증가"
        >
          <PlusIcon size={14} color="#6B7280" />
        </Pressable>

        {/* 삭제 버튼 */}
        {canRemove && (
          <Pressable
            onPress={() => onRemove(roleIndex)}
            className="ml-2 p-1.5 rounded-md bg-red-50 dark:bg-red-900/20"
            accessibilityRole="button"
            accessibilityLabel="역할 삭제"
          >
            <TrashIcon size={14} color="#EF4444" />
          </Pressable>
        )}
      </View>

      {/* 숫자 휠 피커 모달 */}
      <NumberPickerModal
        visible={showNumberPicker}
        value={headcount}
        min={1}
        max={200}
        title={`${roleName} 인원`}
        onConfirm={handlePickerConfirm}
        onClose={() => setShowNumberPicker(false)}
      />
    </View>
  );
});

// ============================================================================
// Component
// ============================================================================

export function TimeSlotCard({
  timeSlot,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: TimeSlotCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // 이미 추가된 역할명 목록 (중복 방지)
  const existingRoleNames = useMemo(() => {
    return timeSlot.roles.map((r) => {
      const roleKey = r.role ?? 'dealer';
      if (roleKey === 'other' && r.customRole) {
        return r.customRole;
      }
      return STAFF_ROLES.find((sr) => sr.key === roleKey)?.name || roleKey;
    });
  }, [timeSlot.roles]);

  // 시작시간 변경
  const handleStartTimeChange = useCallback(
    (time: string) => {
      onUpdate(index, { startTime: time });
    },
    [index, onUpdate]
  );

  // 시간 미정 토글
  const handleTimeToBeAnnouncedToggle = useCallback(
    (value: boolean) => {
      // 미정 체크 시 startTime 초기화
      if (value) {
        onUpdate(index, { isTimeToBeAnnounced: value, startTime: '' });
      } else {
        onUpdate(index, { isTimeToBeAnnounced: value });
      }
    },
    [index, onUpdate]
  );

  // 미정 설명 변경
  const handleTentativeDescriptionChange = useCallback(
    (text: string) => {
      onUpdate(index, { tentativeDescription: text });
    },
    [index, onUpdate]
  );

  // 역할 추가
  const handleAddRole = useCallback(
    (roleKey: string, customName?: string) => {
      if (timeSlot.roles.length >= MAX_ROLES_PER_SLOT) {
        return;
      }

      const newRole: RoleRequirement = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: roleKey as RoleRequirement['role'],
        headcount: 1,
        ...(roleKey === 'other' && customName ? { customRole: customName } : {}),
      };

      onUpdate(index, { roles: [...timeSlot.roles, newRole] });
    },
    [index, timeSlot.roles, onUpdate]
  );

  // 역할 인원 변경 (증감)
  const handleRoleCountChange = useCallback(
    (roleIndex: number, delta: number) => {
      const updatedRoles = [...timeSlot.roles];
      const role = updatedRoles[roleIndex];
      if (role) {
        const currentCount = role.headcount ?? 1;
        const newCount = Math.max(1, Math.min(200, currentCount + delta));
        updatedRoles[roleIndex] = { ...role, headcount: newCount };
        onUpdate(index, { roles: updatedRoles });
      }
    },
    [index, timeSlot.roles, onUpdate]
  );

  // 역할 인원 직접 설정
  const handleRoleCountSet = useCallback(
    (roleIndex: number, count: number) => {
      const updatedRoles = [...timeSlot.roles];
      const role = updatedRoles[roleIndex];
      if (role) {
        const newCount = Math.max(1, Math.min(200, count));
        updatedRoles[roleIndex] = { ...role, headcount: newCount };
        onUpdate(index, { roles: updatedRoles });
      }
    },
    [index, timeSlot.roles, onUpdate]
  );

  // 역할 삭제
  const handleRemoveRole = useCallback(
    (roleIndex: number) => {
      if (timeSlot.roles.length <= 1) {
        return;
      }
      const updatedRoles = timeSlot.roles.filter((_, i) => i !== roleIndex);
      onUpdate(index, { roles: updatedRoles });
    },
    [index, timeSlot.roles, onUpdate]
  );

  // 커스텀 역할명 변경
  const handleCustomRoleNameChange = useCallback(
    (roleIndex: number, name: string) => {
      const updatedRoles = [...timeSlot.roles];
      const role = updatedRoles[roleIndex];
      if (role) {
        updatedRoles[roleIndex] = { ...role, customRole: name };
        onUpdate(index, { roles: updatedRoles });
      }
    },
    [index, timeSlot.roles, onUpdate]
  );

  // 총 인원 계산
  const totalHeadcount = useMemo(
    () => timeSlot.roles.reduce((sum, r) => sum + (r.headcount ?? 0), 0),
    [timeSlot.roles]
  );

  const canAddRole = timeSlot.roles.length < MAX_ROLES_PER_SLOT;

  return (
    <View className="p-4 bg-gray-50 dark:bg-surface/50 rounded-lg border border-gray-200 dark:border-surface-overlay">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-3">
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? '접기' : '펼치기'}
        >
          {isExpanded ? (
            <ChevronUpIcon size={18} color="#6B7280" />
          ) : (
            <ChevronDownIcon size={18} color="#6B7280" />
          )}
          <Text className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            시간대 {index + 1}
            {timeSlot.isTimeToBeAnnounced ? ' (시간 미정)' : ` (${timeSlot.startTime || '미설정'})`}
          </Text>
          <View className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 rounded-full">
            <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
              {totalHeadcount}명
            </Text>
          </View>
        </Pressable>

        {/* 삭제 버튼 */}
        {canRemove && (
          <Pressable
            onPress={() => onRemove(index)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            accessibilityRole="button"
            accessibilityLabel="시간대 삭제"
          >
            <XCircleIcon size={20} color="#EF4444" />
          </Pressable>
        )}
      </View>

      {/* 내용 */}
      {isExpanded && (
        <View className="gap-4">
          {/* 시간 미정 토글 */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-700 dark:text-gray-300">시간 미정</Text>
            <Switch
              value={timeSlot.isTimeToBeAnnounced}
              onValueChange={handleTimeToBeAnnouncedToggle}
              trackColor={{ false: '#D1D5DB', true: '#A855F7' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 시작시간 입력 또는 미정 설명 */}
          {timeSlot.isTimeToBeAnnounced ? (
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                미정 사유 (선택)
              </Text>
              <TextInput
                value={timeSlot.tentativeDescription || ''}
                onChangeText={handleTentativeDescriptionChange}
                placeholder="예: 토너먼트 진행 상황에 따라 결정"
                className="px-3 py-2 bg-white dark:bg-surface border border-gray-300 dark:border-surface-overlay rounded-lg text-gray-900 dark:text-white text-sm"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={200}
              />
            </View>
          ) : (
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                시작 시간
              </Text>
              <TimePicker
                value={timeSlot.startTime ?? '09:00'}
                onChange={handleStartTimeChange}
                placeholder="시간을 선택하세요"
              />
            </View>
          )}

          {/* 역할 목록 */}
          <View className="pt-3 border-t border-gray-200 dark:border-surface-overlay">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                필요 역할 ({timeSlot.roles.length}/{MAX_ROLES_PER_SLOT})
              </Text>
              {canAddRole && (
                <Pressable
                  onPress={() => setShowRoleModal(true)}
                  className="flex-row items-center px-2 py-1 bg-primary-500 dark:bg-primary-600 rounded-md"
                  accessibilityRole="button"
                  accessibilityLabel="역할 추가"
                >
                  <PlusIcon size={14} color="#FFFFFF" />
                  <Text className="ml-1 text-xs font-medium text-white">추가</Text>
                </Pressable>
              )}
            </View>

            {/* 역할 카드 목록 */}
            <View className="bg-white dark:bg-surface rounded-lg border border-gray-200 dark:border-surface-overlay px-3">
              {timeSlot.roles.map((role, roleIndex) => (
                <RoleCard
                  key={role.id || roleIndex}
                  role={role}
                  roleIndex={roleIndex}
                  canRemove={timeSlot.roles.length > 1}
                  onCountChange={handleRoleCountChange}
                  onCountSet={handleRoleCountSet}
                  onRemove={handleRemoveRole}
                  onCustomNameChange={
                    role.role === 'other' ? handleCustomRoleNameChange : undefined
                  }
                />
              ))}
            </View>

            {/* 총 인원 표시 */}
            <View className="mt-2 flex-row items-center justify-center py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Text className="text-sm font-bold text-primary-600 dark:text-primary-400">
                총 {totalHeadcount}명 필요
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 역할 선택 모달 */}
      <RoleSelectModal
        visible={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        onSelect={handleAddRole}
        existingRoleNames={existingRoleNames}
        title="역할 추가"
      />
    </View>
  );
}
