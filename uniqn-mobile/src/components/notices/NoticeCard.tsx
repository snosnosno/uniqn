/**
 * UNIQN Mobile - 공지사항 카드 (사용자용)
 *
 * @description 발행된 공지사항 목록에서 표시되는 카드 컴포넌트
 * @version 1.0.0
 */

import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Card, Badge } from '@/components/ui';
import { MegaphoneIcon, GiftIcon, WrenchScrewdriverIcon, ArrowPathIcon } from '@/components/icons';
import type { Announcement, AnnouncementCategory, AnnouncementPriority } from '@/types';
import { toDate } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface NoticeCardProps {
  notice: Announcement;
}

// 카테고리별 아이콘
const CATEGORY_ICONS: Record<AnnouncementCategory, React.ReactNode> = {
  notice: <MegaphoneIcon size={18} color="#3B82F6" />,
  update: <ArrowPathIcon size={18} color="#8B5CF6" />,
  event: <GiftIcon size={18} color="#F59E0B" />,
  maintenance: <WrenchScrewdriverIcon size={18} color="#6B7280" />,
};

// 카테고리별 라벨
const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  notice: '공지',
  update: '업데이트',
  event: '이벤트',
  maintenance: '점검',
};

// 카테고리별 배지 스타일 (BadgeVariant: default, primary, secondary, success, warning, error)
const CATEGORY_BADGE_VARIANT: Record<AnnouncementCategory, 'primary' | 'success' | 'warning' | 'default'> = {
  notice: 'primary',
  update: 'success',
  event: 'warning',
  maintenance: 'default',
};

// 우선순위별 스타일
const PRIORITY_STYLES: Record<AnnouncementPriority, { bg: string; border: string }> = {
  0: { bg: '', border: '' },
  1: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-l-4 border-l-blue-500' },
  2: { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-l-4 border-l-red-500' },
};

export function NoticeCard({ notice }: NoticeCardProps) {
  const priorityStyle = PRIORITY_STYLES[notice.priority];

  // 날짜 포맷팅 (publishedAt 또는 createdAt 사용)
  const dateValue = notice.publishedAt ?? notice.createdAt;
  const convertedDate = dateValue ? toDate(dateValue) : undefined;
  const formattedDate = convertedDate
    ? formatDistanceToNow(convertedDate, { addSuffix: true, locale: ko })
    : '';

  return (
    <Pressable onPress={() => router.push(`/(app)/notices/${notice.id}`)}>
      <Card className={`mb-3 ${priorityStyle.bg} ${priorityStyle.border}`}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 flex-row items-center">
            {/* 카테고리 아이콘 */}
            <View className="mr-3">{CATEGORY_ICONS[notice.category]}</View>

            {/* 내용 */}
            <View className="flex-1">
              {/* 상단 배지 영역 */}
              <View className="mb-1.5 flex-row flex-wrap items-center gap-1.5">
                {/* 고정 배지 */}
                {notice.isPinned && (
                  <Badge variant="error" size="sm">
                    고정
                  </Badge>
                )}

                {/* 우선순위 배지 */}
                {notice.priority === 2 && (
                  <Badge variant="error" size="sm">
                    긴급
                  </Badge>
                )}
                {notice.priority === 1 && (
                  <Badge variant="primary" size="sm">
                    중요
                  </Badge>
                )}

                {/* 카테고리 배지 */}
                <Badge variant={CATEGORY_BADGE_VARIANT[notice.category]} size="sm">
                  {CATEGORY_LABELS[notice.category]}
                </Badge>
              </View>

              {/* 제목 */}
              <Text
                className="text-base font-semibold text-gray-900 dark:text-gray-100"
                numberOfLines={2}
              >
                {notice.title}
              </Text>

              {/* 내용 미리보기 */}
              <Text
                className="mt-1 text-sm text-gray-600 dark:text-gray-400"
                numberOfLines={2}
              >
                {notice.content}
              </Text>

              {/* 날짜 */}
              <Text className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                {formattedDate}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default NoticeCard;
