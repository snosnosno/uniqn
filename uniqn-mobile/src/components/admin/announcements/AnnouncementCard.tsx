/**
 * UNIQN Mobile - 관리자 공지사항 카드 컴포넌트
 *
 * @description 공지사항 목록에서 사용하는 카드
 *
 * 디자인 토큰 (Tier B):
 * - CardStripe tone="gold" (published/draft) / "muted" (archived)
 * - 제목: font-sans-bold + letterSpacing -0.32
 * - 날짜/조회수: fontVariant tabular-nums
 */

// 1. React/React Native
import { View, Text, Pressable, useColorScheme } from 'react-native';

// 2. 외부 라이브러리
import { EyeOutlineIcon, PeopleOutlineIcon, PersonOutlineIcon, PinIcon } from '@/components/icons';

// 3. 내부 모듈
import { getIconColor } from '@/constants/colors';
import { formatDateKorean } from '@/utils/date';
import { CardStripe, NumericText, type CardStripeTone } from '@/components/ui';
import {
  ANNOUNCEMENT_STATUS_CONFIG,
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY_CONFIG,
} from '@/types/announcement';

// 4. 타입
import type { Announcement } from '@/types';
import { STATUS } from '@/constants';

interface AnnouncementCardProps {
  announcement: Announcement;
  onPress?: () => void;
}

function getStripeTone(announcement: Announcement): CardStripeTone {
  if (announcement.status === STATUS.ANNOUNCEMENT.ARCHIVED) return 'muted';
  return 'gold';
}

export function AnnouncementCard({ announcement, onPress }: AnnouncementCardProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const statusConfig = ANNOUNCEMENT_STATUS_CONFIG[announcement.status];
  const priorityConfig = ANNOUNCEMENT_PRIORITY_CONFIG[announcement.priority];
  const categoryLabel = ANNOUNCEMENT_CATEGORY_LABELS[announcement.category];
  const stripeTone = getStripeTone(announcement);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${announcement.title} 공지사항 상세 보기`}
      className="bg-surface-card rounded-md border border-secondary-100 dark:border-surface-overlay active:opacity-80"
    >
      <CardStripe tone={stripeTone}>
        <View className="pl-4 pr-4 py-4">
          {/* Header: Title + Badges */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 flex-row items-center flex-wrap gap-2">
              {/* Pinned Icon */}
              {announcement.isPinned && <PinIcon size={14} color="#D4A017" />}

              {/* Priority Badge */}
              {announcement.priority > 0 && (
                <View className={`px-2 py-0.5 rounded ${priorityConfig.bgColor}`}>
                  <Text className={`text-xs font-sans-medium ${priorityConfig.color}`}>
                    {priorityConfig.label}
                  </Text>
                </View>
              )}

              {/* Category Badge */}
              <View className="px-2 py-0.5 rounded bg-surface-card dark:bg-surface">
                <Text className="text-xs text-content-muted dark:text-secondary-400 font-sans">
                  {categoryLabel}
                </Text>
              </View>
            </View>

            {/* Status Badge */}
            <View className={`px-2 py-0.5 rounded ${statusConfig.bgColor}`}>
              <Text className={`text-xs font-sans-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text
            className="text-base font-sans-bold text-content-primary dark:text-off-white mb-1"
            style={{ letterSpacing: -0.32 }}
            numberOfLines={2}
          >
            {announcement.title}
          </Text>

          {/* Content Preview */}
          <Text
            className="text-sm text-secondary-500 dark:text-secondary-400 mb-3 font-sans"
            numberOfLines={2}
          >
            {announcement.content}
          </Text>

          {/* Footer: Meta Info */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              {/* Author */}
              <View className="flex-row items-center">
                <PersonOutlineIcon size={12} color={getIconColor(isDarkMode, 'secondary')} />
                <Text className="text-xs text-content-placeholder ml-1 font-sans">
                  {announcement.authorName}
                </Text>
              </View>

              {/* View Count */}
              <View className="flex-row items-center">
                <EyeOutlineIcon size={12} color={getIconColor(isDarkMode, 'secondary')} />
                <NumericText className="text-xs text-content-placeholder ml-1 font-sans">
                  {announcement.viewCount.toLocaleString()}
                </NumericText>
              </View>
            </View>

            {/* Date */}
            <NumericText className="text-xs text-content-placeholder font-sans">
              {announcement.status === STATUS.ANNOUNCEMENT.PUBLISHED && announcement.publishedAt
                ? formatDateKorean(announcement.publishedAt) || '-'
                : announcement.createdAt
                  ? formatDateKorean(announcement.createdAt)
                  : '-'}
            </NumericText>
          </View>

          {/* Target Audience Indicator */}
          {announcement.targetAudience.type === 'roles' && (
            <View className="flex-row items-center mt-2 pt-2 border-t border-secondary-100 dark:border-surface-overlay">
              <PeopleOutlineIcon size={12} color={getIconColor(isDarkMode, 'secondary')} />
              <Text className="text-xs text-content-placeholder ml-1 font-sans">
                대상:{' '}
                {announcement.targetAudience.roles
                  ?.map((role) => {
                    switch (role) {
                      case 'admin':
                        return '관리자';
                      case 'employer':
                        return '구인자';
                      case 'staff':
                        return '스태프';
                      default:
                        return role;
                    }
                  })
                  .join(', ')}
              </Text>
            </View>
          )}
        </View>
      </CardStripe>
    </Pressable>
  );
}

export default AnnouncementCard;
