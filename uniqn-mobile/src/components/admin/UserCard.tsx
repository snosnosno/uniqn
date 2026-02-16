/**
 * UNIQN Mobile - 사용자 카드 컴포넌트 (관리자용)
 *
 * @description 사용자 목록에서 개별 사용자 정보를 표시하는 카드
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';

import { Card, Badge, Avatar } from '@/components/ui';
import { UserIcon, PhoneIcon, ClockIcon, CheckIcon, ChevronRightIcon } from '@/components/icons';
import { USER_ROLE_LABELS, USER_ROLE_BADGE_VARIANT } from '@/types';
import { formatRelativeTime } from '@/utils/date';
import type { AdminUser } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface UserCardProps {
  user: AdminUser;
  onPress?: (user: AdminUser) => void;
  onEdit?: (user: AdminUser) => void;
  showActions?: boolean;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const UserCard = React.memo(function UserCard({
  user,
  onPress,
  onEdit,
  showActions = false,
  compact = false,
}: UserCardProps) {
  // 가입일 계산
  const createdAtDisplay = useMemo(() => {
    if (!user.createdAt) return '';
    const date =
      typeof user.createdAt === 'string'
        ? new Date(user.createdAt)
        : user.createdAt instanceof Date
          ? user.createdAt
          : (user.createdAt as { toDate: () => Date }).toDate?.() || new Date();
    return formatRelativeTime(date);
  }, [user.createdAt]);

  // 최근 로그인
  const lastLoginDisplay = useMemo(() => {
    if (!user.lastLoginAt) return '기록 없음';
    const date =
      typeof user.lastLoginAt === 'string'
        ? new Date(user.lastLoginAt)
        : user.lastLoginAt instanceof Date
          ? user.lastLoginAt
          : (user.lastLoginAt as { toDate: () => Date }).toDate?.() || new Date();
    return formatRelativeTime(date);
  }, [user.lastLoginAt]);

  // 카드 클릭 핸들러
  const handlePress = useCallback(() => {
    onPress?.(user);
  }, [user, onPress]);

  // 수정 클릭 핸들러
  const handleEdit = useCallback(() => {
    onEdit?.(user);
  }, [user, onEdit]);

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        className="flex-row items-center py-3 px-4 bg-white dark:bg-surface active:bg-gray-50 dark:active:bg-gray-700"
      >
        <Avatar name={user.name} source={user.photoURL} size="sm" />
        <View className="flex-1 ml-3">
          <Text className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">{user.email}</Text>
        </View>
        <Badge variant={USER_ROLE_BADGE_VARIANT[user.role]} size="sm">
          {USER_ROLE_LABELS[user.role]}
        </Badge>
        <View className="ml-2">
          <ChevronRightIcon size={16} color="#9CA3AF" />
        </View>
      </Pressable>
    );
  }

  return (
    <Card variant="elevated" padding="md" onPress={handlePress}>
      {/* 헤더: 프로필 + 이름 + 역할 */}
      <View className="flex-row items-center mb-3">
        <Avatar name={user.name} source={user.photoURL} size="md" className="mr-3" />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {user.name}
            </Text>
            <Badge variant={USER_ROLE_BADGE_VARIANT[user.role]} size="sm" dot>
              {USER_ROLE_LABELS[user.role]}
            </Badge>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">{user.email}</Text>
        </View>
      </View>

      {/* 정보 섹션 */}
      <View className="flex-col gap-2">
        {/* 연락처 */}
        {user.phone && (
          <View className="flex-row items-center">
            <PhoneIcon size={14} color="#9CA3AF" />
            <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">{user.phone}</Text>
          </View>
        )}

        {/* 가입일 */}
        <View className="flex-row items-center">
          <ClockIcon size={14} color="#9CA3AF" />
          <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            가입: {createdAtDisplay}
          </Text>
        </View>

        {/* 최근 로그인 */}
        <View className="flex-row items-center">
          <UserIcon size={14} color="#9CA3AF" />
          <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            최근 로그인: {lastLoginDisplay}
          </Text>
        </View>
      </View>

      {/* 상태 표시 */}
      <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100 dark:border-surface-overlay">
        {/* 활성 상태 */}
        <View className="flex-row items-center mr-4">
          <View
            className={`h-2 w-2 rounded-full mr-1.5 ${
              user.isActive ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {user.isActive ? '활성' : '비활성'}
          </Text>
        </View>

        {/* 인증 상태 */}
        <View className="flex-row items-center">
          {user.isVerified ? (
            <>
              <CheckIcon size={12} color="#22C55E" />
              <Text className="ml-1 text-xs text-green-600 dark:text-green-400">인증됨</Text>
            </>
          ) : (
            <Text className="text-xs text-gray-400">미인증</Text>
          )}
        </View>

        {/* 수정 버튼 */}
        {showActions && onEdit && (
          <Pressable
            onPress={handleEdit}
            className="ml-auto px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-surface active:opacity-70"
          >
            <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">수정</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
});

export default UserCard;
