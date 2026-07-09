import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { usePublishedAnnouncements } from '@/hooks/useAnnouncement';
import type { Announcement } from '@/types/announcement';
import { formatRelative } from '@/utils/formatters/date';

const MAX_NOTICES = 3;

interface NoticeRowProps {
  notice: Announcement;
  isLast?: boolean;
}

function NoticeRow({ notice, isLast }: NoticeRowProps) {
  // 읽음 상태 추적이 없으므로 중요도(isPinned || priority > 0)로 강조 구분.
  // 추후 readAt 필드가 도입되면 `notice.readAt == null` 로 교체.
  const isHighlighted = notice.isPinned || notice.priority > 0;
  const relativeTime =
    notice.publishedAt !== undefined && notice.publishedAt !== null
      ? formatRelative(notice.publishedAt)
      : '';

  return (
    <Pressable
      onPress={() => router.push(`/(app)/notices/${notice.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`공지: ${notice.title}`}
      className={`flex-row items-start py-2 ${
        isLast === true ? '' : 'border-b border-divider dark:border-surface-overlay'
      }`}
    >
      <View
        className={`w-1.5 h-1.5 rounded-sm mt-1.5 mr-2 ${
          isHighlighted ? 'bg-primary-500' : 'bg-surface-overlay'
        }`}
      />
      <View className="flex-1">
        <Text className="text-content-primary text-xs font-sans-semibold" numberOfLines={1}>
          {notice.title}
        </Text>
        {notice.authorName ? (
          <Text className="text-content-muted text-micro mt-0.5">{notice.authorName}</Text>
        ) : null}
      </View>
      {relativeTime ? (
        <NumericText className="text-content-muted text-micro ml-2">{relativeTime}</NumericText>
      ) : null}
    </Pressable>
  );
}

export function RecentNoticesWidget() {
  const { data, isLoading, error, refetch } = usePublishedAnnouncements();

  const notices: Announcement[] = data?.pages?.[0]?.announcements?.slice(0, MAX_NOTICES) ?? [];
  const hasNotices = notices.length > 0;

  return (
    <DashboardWidgetShell
      variant="section"
      title="최근 공지"
      isLoading={isLoading}
      error={error as Error | null}
      onRetry={refetch}
      emptyState={!hasNotices ? { message: '새 공지가 없습니다' } : undefined}
      action={
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/board/notice')}
          accessibilityRole="button"
          accessibilityLabel="전체 공지 게시판으로 이동"
          hitSlop={8}
        >
          <Text className="text-primary-500 text-micro font-sans-bold">게시판 →</Text>
        </Pressable>
      }
    >
      {hasNotices ? (
        <View>
          {notices.map((notice, i) => (
            <NoticeRow key={notice.id} notice={notice} isLast={i === notices.length - 1} />
          ))}
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}
