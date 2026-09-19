/**
 * UNIQN Mobile - 스태프 프로필 헤더 컴포넌트
 *
 * @description 스태프 아바타, 이름, 역할·날짜 표시
 *   구인자 IA S2 — 지급 상태 배지는 없앴다. 앱은 돈을 보내지 않는다.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/utils/date';
import { getRoleDisplayName } from '@/types/unified';

export interface StaffProfileHeaderProps {
  /** 프로필 사진 URL */
  profilePhotoURL?: string;
  /** 프로필 사진 blurhash 플레이스홀더 */
  profilePhotoURLBlurhash?: string | null;
  /** 표시 이름 */
  displayName: string;
  /** 역할 */
  role?: string;
  /** 커스텀 역할 */
  customRole?: string;
  /** 근무 날짜 (Date 객체) */
  workDate: Date | null;
}

export function StaffProfileHeader({
  profilePhotoURL,
  profilePhotoURLBlurhash,
  displayName,
  role,
  customRole,
  workDate,
}: StaffProfileHeaderProps) {
  return (
    <View className="items-center py-6 bg-surface-page dark:bg-surface">
      <Avatar
        source={profilePhotoURL}
        name={displayName}
        size="xl"
        className="mb-3"
        blurhash={profilePhotoURLBlurhash}
      />
      <Text className="mb-1 text-xl font-display text-content-primary dark:text-off-white">
        {displayName}
      </Text>
      <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
        {role ? getRoleDisplayName(role, customRole) : '역할 없음'} •{' '}
        {workDate ? formatDate(workDate) : '날짜 없음'}
      </Text>
    </View>
  );
}
