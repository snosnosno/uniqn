import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { ErrorState } from '@/components/ui';
import { BoardPostEditor } from '@/components/board/BoardPostEditor';
import { useAuth } from '@/hooks/useAuth';
import { useBoardPostDetail, useUpdateBoardPost } from '@/hooks/useBoard';
import { BOARD_TYPE_LABELS, type BoardType } from '@/types/board';

const EDITABLE_BOARD_TYPES: Extract<BoardType, 'free' | 'tda'>[] = ['free', 'tda'];

export default function BoardEditScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user, isAdmin } = useAuth();
  const { data, isLoading, error, refetch } = useBoardPostDetail(postId ?? '');
  const updatePost = useUpdateBoardPost(postId ?? '');

  if (!postId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="글 수정" />
        <ErrorState
          title="게시글을 찾을 수 없어요"
          message="잘못된 게시글 경로예요."
          onRetry={() => router.replace('/(app)/(tabs)/board')}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="글 수정" />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="글 수정" />
        <ErrorState
          title="게시글을 불러오지 못했어요"
          message={error?.message ?? '게시글 정보가 없어요.'}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  const boardType = data.post.boardType as Extract<BoardType, 'free' | 'tda'>;
  const canManagePost = Boolean(user?.uid) && (isAdmin || data.post.authorId === user?.uid);

  if (!EDITABLE_BOARD_TYPES.includes(boardType)) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="글 수정" />
        <ErrorState
          title="이 게시글은 수정 화면을 지원하지 않아요"
          message="공지사항과 일정게시판 글은 여기에서 직접 수정할 수 없어요."
          onRetry={() => router.replace(`/(app)/(tabs)/board/post/${postId}`)}
        />
      </SafeAreaView>
    );
  }

  if (!canManagePost) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="湲 ?섏젙" />
        <ErrorState
          title="??寃뚯떆湲???섏젙?????놁뼱??"
          message="湲 ?묒꽦?먮굹 愿由ъ옄留?寃뚯떆湲???섏젙?????덉뼱??"
          onRetry={() => router.replace(`/(app)/(tabs)/board/post/${postId}`)}
        />
      </SafeAreaView>
    );
  }

  if (data.post.isLocked) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="湲 ?섏젙" />
        <ErrorState
          title="?좉릿 寃뚯떆湲?낅땲??"
          message="?좉툑???댁젣???댄썑???섏젙?????덉뼱??"
          onRetry={() => router.replace(`/(app)/(tabs)/board/post/${postId}`)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      <TabHeader title={`${BOARD_TYPE_LABELS[boardType]} 글 수정`} />
      <BoardPostEditor
        boardType={boardType}
        mode="edit"
        initialTitle={data.post.title}
        initialBody={data.post.body}
        initialImages={data.post.imageAttachments}
        isSubmitting={updatePost.isPending}
        onCancel={() => router.back()}
        onSubmit={async ({ title, body, imageAttachments }) => {
          await updatePost.mutateAsync({
            title,
            body,
            imageAttachments,
          });
          router.replace(`/(app)/(tabs)/board/post/${postId}`);
        }}
      />
    </SafeAreaView>
  );
}
