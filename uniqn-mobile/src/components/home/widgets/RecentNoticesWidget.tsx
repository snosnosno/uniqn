import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { usePublishedAnnouncements } from '@/hooks/useAnnouncement';
import type { Announcement } from '@/types/announcement';

const MAX_NOTICES = 2;

export function RecentNoticesWidget() {
  const { data, isLoading, error, refetch } = usePublishedAnnouncements();

  const notices: Announcement[] = data?.pages?.[0]?.announcements?.slice(0, MAX_NOTICES) ?? [];
  const hasNotices = notices.length > 0;

  return (
    <DashboardWidgetShell
      title="최근 공지"
      isLoading={isLoading}
      error={error as Error | null}
      onRetry={refetch}
      emptyState={!hasNotices ? { message: '새 공지가 없습니다' } : undefined}
      onSeeMore={() => router.push('/(app)/notices')}
      seeMoreLabel="전체 공지 보기"
    >
      {hasNotices ? (
        <View>
          {notices.map((notice) => (
            <View key={notice.id} className="py-1.5">
              <Text
                className="text-sm font-medium text-secondary-900 dark:text-secondary-50"
                numberOfLines={2}
              >
                {notice.title}
              </Text>
              {notice.publishedAt !== null && notice.publishedAt !== undefined && (
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {notice.publishedAt instanceof Date
                    ? notice.publishedAt.toLocaleDateString('ko-KR')
                    : new Date(notice.publishedAt).toLocaleDateString('ko-KR')}
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : undefined}
    </DashboardWidgetShell>
  );
}

export default RecentNoticesWidget;
