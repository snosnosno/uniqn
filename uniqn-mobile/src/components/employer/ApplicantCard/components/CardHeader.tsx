/**
 * UNIQN Mobile - ApplicantCard 헤더 컴포넌트
 *
 * @description 지원자 카드 헤더 (아바타, 이름, 상태, 펼침 버튼)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';
import { Avatar } from '../../../ui/Avatar';
import { Badge } from '../../../ui/Badge';
import { ChevronUpIcon, ChevronDownIcon } from '../../../icons';
import { APPLICATION_STATUS_LABELS } from '@/types';
import type { ApplicationStatus } from '@/types';
import { STATUS_BADGE_VARIANT } from '../constants';
import { getIconColor } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface CardHeaderProps {
  /** 표시 이름 */
  displayName: string;
  /** 프로필 사진 URL */
  profilePhotoURL?: string;
  /** 읽음 여부 */
  isRead: boolean;
  /** 지원 상태 */
  status: ApplicationStatus;
  /** 펼침 상태 */
  isExpanded: boolean;
  /** 펼침/접힘 토글 */
  onToggleExpand: () => void;
  /** 프로필 보기 (없으면 비활성화) */
  onViewProfile?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const CardHeader = React.memo(function CardHeader({
  displayName,
  profilePhotoURL,
  isRead,
  status,
  isExpanded,
  onToggleExpand,
  onViewProfile,
}: CardHeaderProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const chevronColor = getIconColor(isDarkMode, 'secondary');

  return (
    <View className="flex-row items-center">
      {/* 메인 영역 - 프로필 모달 열기 */}
      <Pressable
        onPress={onViewProfile}
        disabled={!onViewProfile}
        className="flex-1 flex-row items-center active:opacity-80"
      >
        <Avatar
          source={profilePhotoURL}
          name={displayName}
          size="md"
          className="mr-3"
        />
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {displayName}
            </Text>
            {!isRead && (
              <View className="ml-2 h-2 w-2 rounded-full bg-primary-500" />
            )}
          </View>
        </View>
        <Badge
          variant={STATUS_BADGE_VARIANT[status]}
          size="sm"
          dot
        >
          {APPLICATION_STATUS_LABELS[status]}
        </Badge>
      </Pressable>

      {/* 펼침/접힘 버튼 */}
      <Pressable
        onPress={onToggleExpand}
        className="ml-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 active:opacity-60 flex-row items-center"
        hitSlop={8}
      >
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {isExpanded ? '접기' : '열기'}
        </Text>
        {isExpanded ? (
          <ChevronUpIcon size={14} color={chevronColor} />
        ) : (
          <ChevronDownIcon size={14} color={chevronColor} />
        )}
      </Pressable>
    </View>
  );
});

export default CardHeader;
