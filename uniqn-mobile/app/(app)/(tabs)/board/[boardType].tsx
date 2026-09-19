import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { EmptyState, ErrorState } from '@/components/ui';
import { SkeletonBoardPostItem } from '@/components/ui/Skeleton';
import { DocumentTextOutlineIcon } from '@/components/icons';
import { BoardPostCard } from '@/components/board/BoardPostCard';
import { BoardTabBar, type BoardTabKey } from '@/components/board/BoardTabBar';
import { useBoardPosts } from '@/hooks/useBoard';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useTabBarBottomPadding } from '@/hooks/useTabBarBottomPadding';
import type { BoardType } from '@/types/board';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import { loadFailed, notFound } from '@/constants/messages';

const SUPPORTED_BOARD_TYPES: BoardType[] = ['notice', 'schedule'];

function navigateToTab(tab: BoardTabKey) {
  router.replace(`/(app)/(tabs)/board/${tab}`);
}

export default function BoardListScreen() {
  const bottomPadding = useTabBarBottomPadding();
  const { boardType: rawBoardType } = useLocalSearchParams<{ boardType: string }>();
  const boardType = rawBoardType as BoardType;
  const isValidBoardType = SUPPORTED_BOARD_TYPES.includes(boardType);
  const safeBoardType: BoardTabKey = isValidBoardType ? (boardType as BoardTabKey) : 'schedule';
  const { data, isLoading, error, refetch } = useBoardPosts(safeBoardType, 50);
  // 스피너는 사용자가 당겼을 때만 (useManualRefresh 주석 참고).
  const { refreshing, onRefresh } = useManualRefresh(refetch);

  if (!isValidBoardType) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <TabHeader title="소통" />
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title={notFound('소통 화면')}
            message="지원하지 않는 소통 화면이에요."
            onRetry={() => router.replace('/(app)/(tabs)/board')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title="소통" />
      <BoardTabBar activeTab={safeBoardType} onTabPress={navigateToTab} />

      {error ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState title={loadFailed('게시글 목록')} error={error} onRetry={refetch} />
        </View>
      ) : (
        <FlashList
          data={data ?? []}
          renderItem={({ item }) => (
            <BoardPostCard
              post={item}
              onPress={(post) => router.push(`/(app)/(tabs)/board/post/${post.id}`)}
            />
          )}
          keyExtractor={(item) => item.id}
          // @ts-expect-error - FlashList 2.x runtime prop is available but project types lag behind
          estimatedItemSize={72}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            paddingBottom: bottomPadding,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...PTR_REFRESH_PROPS} />
          }
          ListEmptyComponent={
            isLoading ? (
              <View accessibilityRole="progressbar" accessibilityLabel="게시글 목록 로딩 중">
                <SkeletonBoardPostItem />
                <SkeletonBoardPostItem />
                <SkeletonBoardPostItem />
                <SkeletonBoardPostItem />
                <SkeletonBoardPostItem />
              </View>
            ) : (
              <EmptyState
                icon={<DocumentTextOutlineIcon size={48} color={SECONDARY_PALETTE[400]} />}
                title={
                  safeBoardType === 'notice' ? '아직 등록된 공지가 없어요' : '아직 게시글이 없어요'
                }
                description={
                  safeBoardType === 'notice'
                    ? '새로운 공지가 올라오면 이곳에 표시돼요.'
                    : '근무가 확정되면 일정 소통방이 표시돼요.'
                }
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
