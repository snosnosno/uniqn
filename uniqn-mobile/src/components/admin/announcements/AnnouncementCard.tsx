/**
 * UNIQN Mobile - 관리자 공지사항 카드 컴포넌트
 *
 * @description 공지사항 목록에서 사용하는 카드
 */

// 1. React/React Native
import { View, Text, Pressable, useColorScheme } from 'react-native';

// 2. 외부 라이브러리
import { Ionicons } from '@expo/vector-icons';

// 3. 내부 모듈
import { getIconColor } from '@/constants/colors';
import { formatDateKorean } from '@/utils/dateUtils';
import {
  ANNOUNCEMENT_STATUS_CONFIG,
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY_CONFIG,
} from '@/types/announcement';

// 4. 타입
import type { Announcement } from '@/types';

interface AnnouncementCardProps {
  announcement: Announcement;
  onPress?: () => void;
}

export function AnnouncementCard({ announcement, onPress }: AnnouncementCardProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const statusConfig = ANNOUNCEMENT_STATUS_CONFIG[announcement.status];
  const priorityConfig = ANNOUNCEMENT_PRIORITY_CONFIG[announcement.priority];
  const categoryLabel = ANNOUNCEMENT_CATEGORY_LABELS[announcement.category];

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 active:opacity-80"
    >
      {/* Header: Title + Badges */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 flex-row items-center flex-wrap gap-2">
          {/* Pinned Icon */}
          {announcement.isPinned && (
            <Ionicons name="pin" size={14} color="#f59e0b" />
          )}

          {/* Priority Badge */}
          {announcement.priority > 0 && (
            <View className={`px-2 py-0.5 rounded ${priorityConfig.bgColor}`}>
              <Text className={`text-xs font-medium ${priorityConfig.color}`}>
                {priorityConfig.label}
              </Text>
            </View>
          )}

          {/* Category Badge */}
          <View className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
            <Text className="text-xs text-gray-600 dark:text-gray-400">
              {categoryLabel}
            </Text>
          </View>
        </View>

        {/* Status Badge */}
        <View className={`px-2 py-0.5 rounded ${statusConfig.bgColor}`}>
          <Text className={`text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text
        className="text-base font-semibold text-gray-900 dark:text-white mb-1"
        numberOfLines={2}
      >
        {announcement.title}
      </Text>

      {/* Content Preview */}
      <Text
        className="text-sm text-gray-500 dark:text-gray-400 mb-3"
        numberOfLines={2}
      >
        {announcement.content}
      </Text>

      {/* Footer: Meta Info */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          {/* Author */}
          <View className="flex-row items-center">
            <Ionicons name="person-outline" size={12} color={getIconColor(isDarkMode, 'secondary')} />
            <Text className="text-xs text-gray-400 ml-1">
              {announcement.authorName}
            </Text>
          </View>

          {/* View Count */}
          <View className="flex-row items-center">
            <Ionicons name="eye-outline" size={12} color={getIconColor(isDarkMode, 'secondary')} />
            <Text className="text-xs text-gray-400 ml-1">
              {announcement.viewCount.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Date */}
        <Text className="text-xs text-gray-400">
          {announcement.status === 'published' && announcement.publishedAt
            ? (formatDateKorean(announcement.publishedAt) || '-')
            : (announcement.createdAt ? formatDateKorean(announcement.createdAt) : '-')}
        </Text>
      </View>

      {/* Target Audience Indicator */}
      {announcement.targetAudience.type === 'roles' && (
        <View className="flex-row items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Ionicons name="people-outline" size={12} color={getIconColor(isDarkMode, 'secondary')} />
          <Text className="text-xs text-gray-400 ml-1">
            대상: {announcement.targetAudience.roles?.map((role) => {
              switch (role) {
                case 'admin': return '관리자';
                case 'employer': return '구인자';
                case 'staff': return '스태프';
                default: return role;
              }
            }).join(', ')}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default AnnouncementCard;
