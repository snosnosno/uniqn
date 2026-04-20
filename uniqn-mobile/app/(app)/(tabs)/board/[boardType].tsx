import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { EmptyState, ErrorState } from '@/components/ui';
import { DocumentTextOutlineIcon } from '@/components/icons';
import { BoardPostCard } from '@/components/board/BoardPostCard';
import { BoardTabBar, type BoardTabKey } from '@/components/board/BoardTabBar';
import { BoardWriteFab } from '@/components/board/BoardWriteFab';
import { useBoardPosts } from '@/hooks/useBoard';
import { BOARD_TYPE_LABELS, type BoardType } from '@/types/board';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';

const SUPPORTED_BOARD_TYPES: BoardType[] = ['notice', 'schedule', 'free', 'tda', 'substitute'];

function navigateToTab(tab: BoardTabKey) {
  if (tab === 'home') {
    router.replace('/(app)/(tabs)/board');
    return;
  }
  router.replace(`/(app)/(tabs)/board/${tab}`);
}

export default function BoardListScreen() {
  const { boardType: rawBoardType } = useLocalSearchParams<{ boardType: string }>();
  const boardType = rawBoardType as BoardType;
  const isValidBoardType = SUPPORTED_BOARD_TYPES.includes(boardType);
  const safeBoardType = isValidBoardType ? boardType : 'notice';
  const isWritable = safeBoardType === 'free' || safeBoardType === 'tda';
  const { data, isLoading, error, refetch, isRefetching } = useBoardPosts(safeBoardType, 50);

  if (!isValidBoardType) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <TabHeader title="게시판" />
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시판을 찾을 수 없어요"
            message="잘못된 게시판 경로예요."
            onRetry={() => router.replace('/(app)/(tabs)/board')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title={BOARD_TYPE_LABELS[boardType]} />
      <BoardTabBar activeTab={safeBoardType} onTabPress={navigateToTab} />

      {error ? (
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시글 목록을 불러오지 못했어요"
            message={error.message}
            onRetry={refetch}
          />
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...PTR_REFRESH_PROPS} />
          }
          ListEmptyComponent={
            isLoading ? (
              <View className="flex-1 items-center justify-center py-20">
                <Text className="text-sm font-sans text-secondary-500 dark:text-secondary-400">
                  게시글을 불러오는 중이에요...
                </Text>
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
                    : safeBoardType === 'schedule'
                      ? '접근 가능한 일정 게시판이 아직 없어요.'
                      : safeBoardType === 'substitute'
                        ? '현재 대타 구인 글이 없어요.'
                        : '첫 게시글을 등록해 보세요.'
                }
                actionLabel={isWritable ? '글쓰기' : undefined}
                onAction={
                  isWritable
                    ? () => router.push(`/(app)/(tabs)/board/write?boardType=${safeBoardType}`)
                    : undefined
                }
              />
            )
          }
        />
      )}

      {isWritable ? (
        <BoardWriteFab
          onPress={() => router.push(`/(app)/(tabs)/board/write?boardType=${safeBoardType}`)}
        />
      ) : null}
    </SafeAreaView>
  );
}
