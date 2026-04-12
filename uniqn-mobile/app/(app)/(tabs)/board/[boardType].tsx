import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { EmptyState, ErrorState } from '@/components/ui';
import { AddCircleOutlineIcon, DocumentTextOutlineIcon } from '@/components/icons';
import { BoardPostCard } from '@/components/board/BoardPostCard';
import { useBoardPosts } from '@/hooks/useBoard';
import { BOARD_TYPE_LABELS, type BoardType } from '@/types/board';

const SUPPORTED_BOARD_TYPES: BoardType[] = ['notice', 'schedule', 'free', 'tda'];

export default function BoardListScreen() {
  const { boardType: rawBoardType } = useLocalSearchParams<{ boardType: string }>();
  const boardType = rawBoardType as BoardType;
  const isValidBoardType = SUPPORTED_BOARD_TYPES.includes(boardType);
  const safeBoardType = isValidBoardType ? boardType : 'notice';
  const isWritable = safeBoardType === 'free' || safeBoardType === 'tda';
  const { data, isLoading, error, refetch, isRefetching } = useBoardPosts(safeBoardType, 50);

  if (!isValidBoardType) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['top']}>
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
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['top']}>
      <TabHeader
        title={BOARD_TYPE_LABELS[boardType]}
        rightAction={
          isWritable ? (
            <Pressable
              onPress={() => router.push(`/(app)/(tabs)/board/write?boardType=${safeBoardType}`)}
              className="rounded-sm p-2 active:bg-secondary-100 dark:active:bg-surface"
              accessibilityRole="button"
              accessibilityLabel="글쓰기"
            >
              <AddCircleOutlineIcon size={24} color="#4F46E5" />
            </Pressable>
          ) : null
        }
      />

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
          estimatedItemSize={164}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            isLoading ? (
              <View className="flex-1 items-center justify-center py-20">
                <Text className="text-sm text-secondary-500 dark:text-secondary-400">
                  게시글을 불러오는 중이에요...
                </Text>
              </View>
            ) : (
              <EmptyState
                icon={<DocumentTextOutlineIcon size={48} color="#9CA3AF" />}
                title="아직 게시글이 없어요"
                description={
                  boardType === 'schedule'
                    ? '접근 가능한 일정 게시판이 아직 없어요.'
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
    </SafeAreaView>
  );
}
