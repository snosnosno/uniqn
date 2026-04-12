import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
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
import type { BoardPost, BoardType } from '@/types';

interface BoardEntryCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  boardType: BoardType;
}

function BoardEntryCard({ title, description, icon, boardType }: BoardEntryCardProps) {
  return (
    <Card
      className="min-h-[132px] flex-1"
      onPress={() => router.push(`/(app)/(tabs)/board/${boardType}`)}
    >
      <View className="mb-3">{icon}</View>
      <Text className="mb-1 text-base font-semibold text-secondary-900 dark:text-secondary-100">
        {title}
      </Text>
      <Text className="text-sm leading-5 text-secondary-500 dark:text-secondary-400">
        {description}
      </Text>
    </Card>
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
      <Text className="mb-3 text-lg font-semibold text-secondary-900 dark:text-secondary-100">
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

  const scheduleDescription = isAdmin
    ? '전체 일정 게시판을 관리하고 최근 활동을 확인해요.'
    : role === 'employer'
      ? '내 공고별 운영 글과 최근 댓글을 한 번에 확인해요.'
      : '확정된 내 일정 게시판만 모아서 확인해요.';

  return (
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['top']}>
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
          <View className="mb-6 flex-row flex-wrap gap-3">
            <BoardEntryCard
              title="공지사항"
              description="운영 공지와 업데이트 내용을 확인해요."
              icon={<DocumentTextOutlineIcon size={28} color="#4F46E5" />}
              boardType="notice"
            />
            <BoardEntryCard
              title="내 일정게시판"
              description={scheduleDescription}
              icon={<CalendarIcon size={28} color="#0F766E" />}
              boardType="schedule"
            />
            <BoardEntryCard
              title="자유게시판"
              description="일반 이야기와 소식을 자유롭게 나눠요."
              icon={<MessageIcon size={28} color="#8A7228" />}
              boardType="free"
            />
            <BoardEntryCard
              title="TDA 토론"
              description="규정, 운영, 핸드 리뷰를 주제로 토론해요."
              icon={<HashtagIcon size={28} color="#CA8A04" />}
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
