import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { Card, EmptyState, ErrorState, SkeletonListItem } from '@/components/ui';
import {
  CalendarIcon,
  DocumentTextOutlineIcon,
  HashtagIcon,
  MessageIcon,
} from '@/components/icons';
import { BoardPostCard } from '@/components/board/BoardPostCard';
import { useBoardHome } from '@/hooks/useBoard';
import { useAuth } from '@/hooks/useAuth';
import { PRIMARY_COLORS } from '@/constants/colors';
import type { BoardPost, BoardType } from '@/types';

interface BoardEntryCardProps {
  title: string;
  icon: ReactNode;
  boardType: BoardType;
}

function BoardEntryCard({ title, icon, boardType }: BoardEntryCardProps) {
  return (
    <Pressable
      className="flex-1 items-center rounded-md border border-secondary-200 bg-white py-4 px-2 active:opacity-70 dark:border-surface-overlay dark:bg-surface-elevated"
      onPress={() => router.push(`/(app)/(tabs)/board/${boardType}`)}
      accessibilityRole="button"
      accessibilityLabel={`${title} 게시판으로 이동`}
    >
      <View className="mb-2">{icon}</View>
      <Text className="text-center text-xs font-sans-semibold text-content-primary dark:text-secondary-100">
        {title}
      </Text>
    </Pressable>
  );
}

interface BoardSectionProps {
  title: string;
  emptyTitle: string;
  posts: BoardPost[];
}

function BoardSection({ title, emptyTitle, posts }: BoardSectionProps) {
  return (
    <View className="mb-6">
      <Text className="mb-3 text-lg font-display-semibold text-content-primary dark:text-secondary-100">
        {title}
      </Text>

      {posts.length === 0 ? (
        <Card>
          <EmptyState title={emptyTitle} description="아직 표시할 게시글이 없어요." />
        </Card>
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

export default function BoardHomeScreen() {
  const { role, isAdmin } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useBoardHome();

  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <TabHeader title="게시판" />

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
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          <View className="mb-6 flex-row gap-2">
            <BoardEntryCard
              title="공지사항"
              icon={<DocumentTextOutlineIcon size={28} color={PRIMARY_COLORS[700]} />}
              boardType="notice"
            />
            <BoardEntryCard
              title="일정게시판"
              icon={<CalendarIcon size={28} color="#0F766E" />}
              boardType="schedule"
            />
            <BoardEntryCard
              title="자유게시판"
              icon={<MessageIcon size={28} color={PRIMARY_COLORS[700]} />}
              boardType="free"
            />
            <BoardEntryCard
              title="TDA 토론"
              icon={<HashtagIcon size={28} color={PRIMARY_COLORS[500]} />}
              boardType="tda"
            />
          </View>

          <BoardSection
            title="고정 공지"
            emptyTitle="등록된 고정 공지가 없어요"
            posts={data?.pinnedNotices ?? []}
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
          />
          <BoardSection
            title="커뮤니티 인기글"
            emptyTitle="아직 인기글이 없어요"
            posts={data?.popularCommunityPosts ?? []}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
