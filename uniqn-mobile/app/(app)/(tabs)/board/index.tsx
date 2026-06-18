import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { TabHeader } from '@/components/headers';
import { EmptyState, ErrorState, SkeletonListItem } from '@/components/ui';
import { BoardPostCard } from '@/components/board/BoardPostCard';
import { BoardTabBar, type BoardTabKey } from '@/components/board/BoardTabBar';
import { PinnedNoticeBanner } from '@/components/board/PinnedNoticeBanner';
import { useBoardHome } from '@/hooks/useBoard';
import { useAuth } from '@/hooks/useAuth';
import type { BoardPost, BoardType } from '@/types';

interface BoardSectionProps {
  title: string;
  emptyTitle: string;
  posts: BoardPost[];
  moreBoardType?: BoardType;
}

function BoardSection({ title, emptyTitle, posts, moreBoardType }: BoardSectionProps) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-sans-semibold uppercase tracking-wider text-secondary-600 dark:text-secondary-400">
          {title}
        </Text>
        {moreBoardType ? (
          <Pressable
            onPress={() => router.replace(`/(app)/(tabs)/board/${moreBoardType}`)}
            accessibilityRole="button"
            accessibilityLabel={`${title} 더보기`}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            className="active:opacity-70"
          >
            <Text className="text-xs font-sans text-primary-700 dark:text-primary-300">
              더보기 ›
            </Text>
          </Pressable>
        ) : null}
      </View>

      {posts.length === 0 ? (
        <EmptyState title={emptyTitle} description="아직 표시할 게시글이 없어요." compact />
      ) : (
        posts.map((post) => (
          <BoardPostCard
            key={post.id}
            post={post}
            onPress={(targetPost) => router.push(`/(app)/(tabs)/board/post/${targetPost.id}`)}
          />
        ))
      )}
    </View>
  );
}

function navigateToTab(tab: BoardTabKey) {
  if (tab === 'home') return;
  router.replace(`/(app)/(tabs)/board/${tab}`);
}

export default function BoardHomeScreen() {
  const { role, isAdmin } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useBoardHome();

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title="게시판" />
      <BoardTabBar activeTab="home" onTabPress={navigateToTab} />

      {isLoading ? (
        <ScrollView className="flex-1" contentContainerClassName="p-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <SkeletonListItem key={item} />
          ))}
        </ScrollView>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시판 홈을 불러오지 못했어요"
            message={error.message}
            onRetry={refetch}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-8"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...PTR_REFRESH_PROPS} />
          }
        >
          <PinnedNoticeBanner
            notices={data?.pinnedNotices ?? []}
            onPress={(notice) => router.push(`/(app)/(tabs)/board/post/${notice.id}`)}
          />

          <BoardSection
            title="인기글"
            emptyTitle="아직 인기글이 없어요"
            posts={data?.popularCommunityPosts ?? []}
            moreBoardType="free"
          />
          <BoardSection
            title={
              isAdmin
                ? '최근 일정 활동'
                : role === 'employer'
                  ? '내 공고 최근 활동'
                  : '내 일정 최근 활동'
            }
            emptyTitle="표시할 일정 활동이 없어요"
            posts={data?.recentSchedulePosts ?? []}
            moreBoardType="schedule"
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
