/**
 * UNIQN Mobile - 스태프 프로필 헤더 컴포넌트
 *
 * @description 스태프 아바타, 이름, 상태 배지 표시
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '../../../ui/Avatar';
import { Badge } from '../../../ui/Badge';
import { formatDate } from '@/utils/dateUtils';
import { getRoleDisplayName } from '@/types/unified';
import { PAYROLL_STATUS_CONFIG } from './constants';
import type { PayrollStatus } from '@/types';

export interface StaffProfileHeaderProps {
  /** 프로필 사진 URL */
  profilePhotoURL?: string;
  /** 표시 이름 */
  displayName: string;
  /** 정산 상태 */
  payrollStatus: PayrollStatus;
  /** 역할 */
  role?: string;
  /** 커스텀 역할 */
  customRole?: string;
  /** 근무 날짜 (Date 객체) */
  workDate: Date | null;
}

/**
 * 스태프 프로필 헤더
 *
 * @example
 * <StaffProfileHeader
 *   profilePhotoURL="https://..."
 *   displayName="홍길동"
 *   payrollStatus="pending"
 *   role="dealer"
 *   workDate={new Date()}
 * />
 */
export function StaffProfileHeader({
  profilePhotoURL,
  displayName,
  payrollStatus,
  role,
  customRole,
  workDate,
}: StaffProfileHeaderProps) {
  const statusConfig = PAYROLL_STATUS_CONFIG[payrollStatus];

  return (
    <View className="items-center py-6 bg-gray-50 dark:bg-surface">
      <Avatar source={profilePhotoURL} name={displayName} size="xl" className="mb-3" />
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</Text>
        <Badge variant={statusConfig.variant} size="sm" dot>
          {statusConfig.label}
        </Badge>
      </View>
      <Text className="text-sm text-gray-500 dark:text-gray-400">
        {role ? getRoleDisplayName(role, customRole) : '역할 없음'} •{' '}
        {workDate ? formatDate(workDate) : '날짜 없음'}
      </Text>
    </View>
  );
}
