/**
 * UNIQN Mobile - 공지사항 상세 페이지 (사용자용)
 *
 * @description 공지사항 상세 내용을 표시하는 페이지
 */

import { useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from '@/components/ui';
import { MegaphoneIcon, GiftIcon, WrenchScrewdriverIcon, ArrowPathIcon } from '@/components/icons';
import { useAnnouncementDetail, useIncrementViewCount } from '@/hooks/useAnnouncement';
import type { AnnouncementCategory } from '@/types';
import { toDate } from '@/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 카테고리별 아이콘
const CATEGORY_ICONS: Record<AnnouncementCategory, React.ReactNode> = {
  notice: <MegaphoneIcon size={24} color="#3B82F6" />,
  update: <ArrowPathIcon size={24} color="#8B5CF6" />,
  event: <GiftIcon size={24} color="#F59E0B" />,
  maintenance: <WrenchScrewdriverIcon size={24} color="#6B7280" />,
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

export default function NoticeDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: notice, isLoading, error } = useAnnouncementDetail(id ?? '');
  const { mutate: incrementView } = useIncrementViewCount();

  // 조회수 증가 (페이지 진입 시 1회)
  useEffect(() => {
    if (id) {
      incrementView(id);
    }
  }, [id, incrementView]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항' }} />
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !notice) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항' }} />
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-4">
            공지사항을 찾을 수 없습니다
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            삭제되었거나 존재하지 않는 공지사항입니다
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-blue-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">돌아가기</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // 날짜 포맷팅 (publishedAt 또는 createdAt 사용)
  const dateValue = notice.publishedAt ?? notice.createdAt;
  const convertedDate = dateValue ? toDate(dateValue) : undefined;
  const publishedDate = convertedDate
    ? format(convertedDate, 'yyyy년 M월 d일 (EEEE) HH:mm', { locale: ko })
    : '';

  return (
    <>
      <Stack.Screen
        options={{
          title: '공지사항',
          headerBackTitle: '목록',
        }}
      />

      <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="p-4">
          {/* 헤더 카드 */}
          <Card className="mb-4">
            {/* 배지 영역 */}
            <View className="flex-row flex-wrap items-center gap-2 mb-3">
              {/* 카테고리 아이콘 */}
              {CATEGORY_ICONS[notice.category]}

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
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {notice.title}
            </Text>

            {/* 메타 정보 */}
            <View className="flex-row items-center flex-wrap gap-x-3 gap-y-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {notice.authorName}
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500">•</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {publishedDate}
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500">•</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                조회 {notice.viewCount.toLocaleString()}
              </Text>
            </View>
          </Card>

          {/* 본문 카드 */}
          <Card>
            <Text className="text-base leading-7 text-gray-800 dark:text-gray-200">
              {notice.content}
            </Text>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
