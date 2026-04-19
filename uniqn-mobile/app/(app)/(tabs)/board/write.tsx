import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { ErrorState } from '@/components/ui';
import { BoardPostEditor } from '@/components/board/BoardPostEditor';
import { useCreateBoardPost } from '@/hooks/useBoard';
import { BOARD_TYPE_LABELS, type BoardType } from '@/types/board';

const WRITABLE_BOARD_TYPES: Extract<BoardType, 'free' | 'tda'>[] = ['free', 'tda'];

export default function BoardWriteScreen() {
  const { boardType: rawBoardType } = useLocalSearchParams<{ boardType?: string }>();
  const boardType = (rawBoardType ?? 'free') as Extract<BoardType, 'free' | 'tda'>;
  const isWritableBoard = WRITABLE_BOARD_TYPES.includes(boardType);
  const createPost = useCreateBoardPost();

  if (!isWritableBoard) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="글쓰기" fallbackHref="/(app)/(tabs)/board" />
        <ErrorState
          title="글을 작성할 수 없는 게시판이에요"
          message="자유게시판과 TDA 토론만 직접 글을 작성할 수 있어요."
          onRetry={() => router.replace('/(app)/(tabs)/board')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader
        title={`${BOARD_TYPE_LABELS[boardType]} 글쓰기`}
        fallbackHref={`/(app)/(tabs)/board/${boardType}`}
      />
      <BoardPostEditor
        boardType={boardType}
        mode="create"
        isSubmitting={createPost.isPending}
        onCancel={() => router.back()}
        onSubmit={async ({ title, body, imageAttachments }) => {
          await createPost.mutateAsync({
            boardType,
            title,
            body,
            imageAttachments,
          });
          router.replace(`/(app)/(tabs)/board/${boardType}`);
        }}
      />
    </SafeAreaView>
  );
}
