import { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { BoardCommentItem } from '@/components/board/BoardCommentItem';
import { BoardImageViewerOverlay } from '@/components/board/BoardImageViewerOverlay';
import { type BoardDetailListItem } from '@/components/board/boardDetailListItems';
import { ActionSheet, Button, Card, EmptyState, ErrorState, Input, Modal } from '@/components/ui';
import { FlagOutlineIcon } from '@/components/icons';
import { BOARD_TYPE_LABELS } from '@/types/board';
import { BoardPostDetailSkeleton } from '@/features/board/postDetail/BoardPostDetailSkeleton';
import { CommentSectionHeader } from '@/features/board/postDetail/CommentSectionHeader';
import {
  BoardDetailComposerContext,
  InlineComposerRow,
} from '@/features/board/postDetail/InlineComposerRow';
import { PostHeader } from '@/features/board/postDetail/PostHeader';
import { useBoardPostDetailScreen } from '@/features/board/postDetail/useBoardPostDetailScreen';

export default function BoardPostDetailScreen() {
  const {
    postId,
    user,
    isAdmin,
    data,
    post,
    isLoading,
    error,
    refetch,
    isRefetching,
    canInteract,
    canManagePost,
    canReportPost,
    isVoteSubmitting,
    isReportSubmitting,
    isReportSubmitDisabled,
    postFallbackHref,
    postCreatedAtLabel,
    postLastActivityLabel,
    listRef,
    detailItems,
    bottomPadding,
    composerContextValue,
    postMenuVisible,
    setPostMenuVisible,
    postMenuOptions,
    handlePostMenuSelect,
    reportTarget,
    resetReportForm,
    reportReason,
    setReportReason,
    reportDetails,
    setReportDetails,
    handleReportSubmit,
    imageViewerState,
    setImageViewerState,
    openImageViewer,
    voteMutation,
    handleReply,
    handleEdit,
    handleDeleteComment,
    handleHideComment,
    handleTogglePin,
    handleToggleReaction,
    setReportTarget,
  } = useBoardPostDetailScreen();

  const renderItem = useCallback(
    ({ item }: { item: BoardDetailListItem }) => {
      if (item.type === 'section') {
        return <CommentSectionHeader item={item} />;
      }

      if (item.type === 'empty') {
        return (
          <Card className="mb-3 border border-dashed border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface">
            <EmptyState title={item.title} description={item.description} />
          </Card>
        );
      }

      if (item.type === 'composer') {
        return <InlineComposerRow item={item} />;
      }

      return (
        <BoardCommentItem
          comment={item.comment}
          depth={item.depth}
          currentUserId={user?.uid}
          myReactions={data?.myReactions ?? {}}
          canInteract={canInteract}
          canManagePost={canManagePost}
          isAdmin={isAdmin}
          onPressImage={(comment, index) => openImageViewer(comment.imageAttachments, index)}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDeleteComment}
          onHide={handleHideComment}
          onTogglePin={handleTogglePin}
          onToggleReaction={handleToggleReaction}
          onReport={(comment) =>
            setReportTarget({
              targetType: 'comment',
              targetId: comment.id,
            })
          }
        />
      );
    },
    [
      canInteract,
      canManagePost,
      data?.myReactions,
      handleDeleteComment,
      handleEdit,
      handleHideComment,
      handleReply,
      handleTogglePin,
      handleToggleReaction,
      isAdmin,
      openImageViewer,
      user?.uid,
      setReportTarget,
    ]
  );

  if (!postId) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="게시글" fallbackHref="/(app)/(tabs)/board" />
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시글을 찾을 수 없어요"
            message="잘못된 게시글 경로예요."
            onRetry={() => router.replace('/(app)/(tabs)/board')}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="게시글" fallbackHref={postFallbackHref} />
        <BoardPostDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !post || !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="게시글" fallbackHref={postFallbackHref} />
        <View className="flex-1 items-center justify-center p-4">
          <ErrorState
            title="게시글을 불러오지 못했어요"
            message={error?.message ?? '게시글 정보가 없어요.'}
            onRetry={refetch}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title={BOARD_TYPE_LABELS[post.boardType]} fallbackHref={postFallbackHref} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BoardDetailComposerContext.Provider value={composerContextValue}>
          <FlashList
            ref={listRef}
            data={detailItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.type}
            // @ts-expect-error - FlashList 2.x runtime prop is available but project types lag behind
            estimatedItemSize={220}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            ListHeaderComponent={
              <PostHeader
                post={post}
                data={data}
                canManagePost={canManagePost}
                isAdmin={isAdmin}
                canReportPost={canReportPost}
                canInteract={canInteract}
                isVoteSubmitting={isVoteSubmitting}
                postCreatedAtLabel={postCreatedAtLabel}
                postLastActivityLabel={postLastActivityLabel}
                onPressMenu={() => setPostMenuVisible(true)}
                onPressImage={openImageViewer}
                onVote={voteMutation.mutate}
              />
            }
          />
        </BoardDetailComposerContext.Provider>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={postMenuVisible}
        onClose={() => setPostMenuVisible(false)}
        options={postMenuOptions}
        onSelect={handlePostMenuSelect}
      />

      <Modal visible={Boolean(reportTarget)} onClose={resetReportForm} title="신고 접수" size="md">
        <Input
          label="신고 사유"
          value={reportReason}
          onChangeText={setReportReason}
          maxLength={80}
          placeholder="신고 사유를 입력해 주세요."
        />
        <View className="mt-4">
          <Input
            label="상세 설명"
            value={reportDetails}
            onChangeText={setReportDetails}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
            placeholder="추가 설명이 있다면 입력해 주세요."
          />
        </View>

        <View className="mt-6 flex-row gap-3">
          <Button variant="outline" className="flex-1" onPress={resetReportForm}>
            취소
          </Button>
          <Button
            className="flex-1"
            loading={isReportSubmitting}
            icon={<FlagOutlineIcon size={16} color="#09090B" />}
            onPress={() => void handleReportSubmit()}
            disabled={isReportSubmitDisabled}
          >
            신고하기
          </Button>
        </View>
      </Modal>

      <BoardImageViewerOverlay
        visible={Boolean(imageViewerState)}
        images={imageViewerState?.images ?? []}
        currentIndex={imageViewerState?.currentIndex ?? 0}
        onClose={() => setImageViewerState(null)}
        onChangeIndex={(nextIndex) =>
          setImageViewerState((prev) => (prev ? { ...prev, currentIndex: nextIndex } : prev))
        }
      />
    </SafeAreaView>
  );
}
