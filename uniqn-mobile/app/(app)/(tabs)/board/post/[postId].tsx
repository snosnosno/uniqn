import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { BoardCommentThread } from '@/components/board/BoardCommentThread';
import { BoardImageGrid } from '@/components/board/BoardImageGrid';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal } from '@/components/ui';
import { ROLE_LABELS } from '@/constants';
import {
  CloseCircleOutlineIcon,
  FlagOutlineIcon,
  HeartIcon,
  ImageIcon,
  LockIcon,
  PaperPlaneOutlineIcon,
  PinIcon,
  XMarkIcon,
} from '@/components/icons';
import {
  useBoardCommentMutations,
  useBoardMentionCandidates,
  useBoardPostDetail,
  useCreateBoardComment,
  useCreateBoardReport,
  useHideBoardPost,
  useIncrementBoardViewCount,
  useSetBoardPostLock,
  useToggleBoardPostVote,
} from '@/hooks/useBoard';
import { useAuth } from '@/hooks/useAuth';
import { uploadMultipleAnnouncementImages } from '@/services/auth';
import { useToastStore } from '@/stores/toastStore';
import { BOARD_TYPE_LABELS, type BoardCommentNode, type BoardImageAttachment } from '@/types/board';

function getAuthorBadgeVariant(authorRole: string) {
  if (authorRole === 'admin') {
    return 'error';
  }

  if (authorRole === 'employer') {
    return 'primary';
  }

  return 'secondary';
}

function getAuthorRoleLabel(authorRole: string) {
  if (authorRole === 'system') {
    return '시스템';
  }

  return ROLE_LABELS[authorRole] ?? authorRole;
}

export default function BoardPostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);
  const { data, isLoading, error, refetch, isRefetching } = useBoardPostDetail(postId ?? '');
  const post = data?.post;
  const mentionCandidatesEnabled =
    Boolean(postId) &&
    !!post &&
    post.boardType !== 'notice' &&
    !post.isLocked &&
    !!user?.uid &&
    (post.boardType !== 'schedule' ||
      isAdmin ||
      post.authorId === user.uid ||
      !!data?.membership?.canComment);
  const mentionCandidatesQuery = useBoardMentionCandidates(postId ?? '', mentionCandidatesEnabled);
  const incrementViewCount = useIncrementBoardViewCount();
  const createComment = useCreateBoardComment(postId ?? '');
  const commentMutations = useBoardCommentMutations(postId ?? '');
  const voteMutation = useToggleBoardPostVote(postId ?? '');
  const lockMutation = useSetBoardPostLock(postId ?? '');
  const hidePostMutation = useHideBoardPost(postId ?? '');
  const createReport = useCreateBoardReport();
  const viewedPostIdRef = useRef<string | null>(null);

  const [draftBody, setDraftBody] = useState('');
  const [draftImages, setDraftImages] = useState<BoardImageAttachment[]>([]);
  const [replyTarget, setReplyTarget] = useState<BoardCommentNode | null>(null);
  const [editingComment, setEditingComment] = useState<BoardCommentNode | null>(null);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [isUploadingCommentImages, setIsUploadingCommentImages] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'post' | 'comment';
    targetId: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    if (data?.post.id && viewedPostIdRef.current !== data.post.id) {
      viewedPostIdRef.current = data.post.id;
      incrementViewCount.mutate(data.post.id);
    }
  }, [data?.post.id, incrementViewCount]);

  const mentionCandidates = useMemo(
    () => (mentionCandidatesQuery.data ?? []).filter((candidate) => candidate.userId !== user?.uid),
    [mentionCandidatesQuery.data, user?.uid]
  );
  const pinnedComments = useMemo(
    () => data?.commentTree.filter((comment) => comment.isPinned) ?? [],
    [data?.commentTree]
  );
  const regularComments = useMemo(
    () => data?.commentTree.filter((comment) => !comment.isPinned) ?? [],
    [data?.commentTree]
  );

  const canManagePost =
    !!post && post.boardType !== 'notice' && !!user?.uid && (isAdmin || post.authorId === user.uid);
  const canInteract =
    !!post &&
    post.boardType !== 'notice' &&
    !post.isLocked &&
    !!user?.uid &&
    (post.boardType !== 'schedule' ||
      isAdmin ||
      post.authorId === user.uid ||
      !!data?.membership?.canComment);
  const canSelectMentions = canInteract && !editingComment && mentionCandidates.length > 0;
  const isCommentSubmitting =
    createComment.isPending || commentMutations.updateComment.isPending || isUploadingCommentImages;
  const isCommentSubmitDisabled = !canInteract || !draftBody.trim() || isCommentSubmitting;
  const isReportSubmitting = createReport.isPending;
  const isReportSubmitDisabled = !reportReason.trim() || isReportSubmitting;
  const isVoteSubmitting = voteMutation.isPending;
  const isPostActionPending = lockMutation.isPending || hidePostMutation.isPending;
  const canReportPost =
    !!post && post.boardType !== 'notice' && !!user?.uid && user.uid !== post.authorId;

  const resetComposer = () => {
    setDraftBody('');
    setDraftImages([]);
    setReplyTarget(null);
    setEditingComment(null);
    setSelectedMentionIds([]);
  };

  const toggleMentionSelection = (candidateUserId: string) => {
    setSelectedMentionIds((prev) => {
      if (prev.includes(candidateUserId)) {
        return prev.filter((id) => id !== candidateUserId);
      }

      if (prev.length >= 10) {
        addToast({
          type: 'warning',
          message: '멘션은 최대 10명까지 선택할 수 있어요.',
        });
        return prev;
      }

      return [...prev, candidateUserId];
    });
  };

  const handlePickCommentImages = async () => {
    if (!user?.uid || isUploadingCommentImages || !canInteract) {
      return;
    }

    const remainingSlots = 3 - draftImages.length;
    if (remainingSlots <= 0) {
      addToast({
        type: 'warning',
        message: '댓글 이미지는 최대 3장까지 첨부할 수 있어요.',
      });
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      addToast({ type: 'error', message: '사진 접근 권한이 필요해요.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setIsUploadingCommentImages(true);
    try {
      const uploadedImages = await uploadMultipleAnnouncementImages(
        user.uid,
        result.assets.map((asset) => asset.uri)
      );

      setDraftImages((prev) => [
        ...prev,
        ...uploadedImages.slice(0, remainingSlots).map((image, index) => ({
          ...image,
          order: prev.length + index,
        })),
      ]);
    } catch (uploadError) {
      addToast({
        type: 'error',
        message: uploadError instanceof Error ? uploadError.message : '이미지 업로드에 실패했어요.',
      });
    } finally {
      setIsUploadingCommentImages(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!post) {
      return;
    }

    try {
      if (editingComment) {
        await commentMutations.updateComment.mutateAsync({
          commentId: editingComment.id,
          input: {
            body: draftBody,
            imageAttachments: draftImages,
          },
        });
        resetComposer();
        return;
      }

      await createComment.mutateAsync({
        body: draftBody,
        parentCommentId: replyTarget?.id ?? null,
        mentionedUserIds: selectedMentionIds,
        imageAttachments: draftImages,
      });
      resetComposer();
    } catch {
      // Toast feedback is handled in the mutation hook.
    }
  };

  const handleReportSubmit = async () => {
    if (!post || !reportTarget) {
      return;
    }

    try {
      await createReport.mutateAsync({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        postId: post.id,
        reason: reportReason,
        details: reportDetails,
      });

      setReportTarget(null);
      setReportReason('');
      setReportDetails('');
    } catch {
      // Toast feedback is handled in the mutation hook.
    }
  };

  const handleDeleteComment = (comment: BoardCommentNode) => {
    Alert.alert('댓글 삭제', '이 댓글을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void commentMutations.setStatus
            .mutateAsync({
              commentId: comment.id,
              status: 'deleted',
            })
            .catch(() => undefined);
        },
      },
    ]);
  };

  const handleHideComment = (comment: BoardCommentNode) => {
    Alert.alert('댓글 숨김', '관리자 숨김 처리할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '숨김',
        style: 'destructive',
        onPress: () => {
          void commentMutations.setStatus
            .mutateAsync({
              commentId: comment.id,
              status: 'hidden',
            })
            .catch(() => undefined);
        },
      },
    ]);
  };

  const handleTogglePostLock = () => {
    if (!post) {
      return;
    }

    Alert.alert(
      post.isLocked ? '잠금 해제' : '게시글 잠금',
      post.isLocked ? '이 게시글의 잠금을 해제할까요?' : '이 게시글을 잠가서 새 활동을 막을까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: post.isLocked ? '해제' : '잠금',
          onPress: () => {
            void lockMutation.mutateAsync(!post.isLocked).catch(() => undefined);
          },
        },
      ]
    );
  };

  const handleHidePost = () => {
    if (!post) {
      return;
    }

    Alert.alert('게시글 숨김', '관리자 숨김 처리할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '숨김',
        style: 'destructive',
        onPress: async () => {
          try {
            await hidePostMutation.mutateAsync();
            router.replace(`/(app)/(tabs)/board/${post.boardType}`);
          } catch {
            // Toast feedback is handled in the mutation hook.
          }
        },
      },
    ]);
  };

  const renderDraftImages = () => {
    if (draftImages.length === 0) {
      return null;
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
        <View className="flex-row gap-3">
          {draftImages.map((image) => (
            <View key={image.id} className="relative">
              <Image
                source={{ uri: image.url }}
                style={{ width: 88, height: 88, borderRadius: 12 }}
                contentFit="cover"
              />
              <Pressable
                onPress={() =>
                  setDraftImages((prev) => prev.filter((item) => item.id !== image.id))
                }
                className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1"
              >
                <XMarkIcon size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  if (!postId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="게시글" />
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
        <TabHeader title="게시글" />
      </SafeAreaView>
    );
  }

  if (error || !post || !data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
        <TabHeader title="게시글" />
        <ErrorState
          title="게시글을 불러오지 못했어요"
          message={error?.message ?? '게시글 정보가 없어요.'}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      <TabHeader title={BOARD_TYPE_LABELS[post.boardType]} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-8"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Card className="mb-4">
          <View className="mb-3 flex-row flex-wrap items-center gap-2">
            <Badge variant={getAuthorBadgeVariant(post.authorRole)} size="sm">
              {BOARD_TYPE_LABELS[post.boardType]}
            </Badge>
            <Badge variant={getAuthorBadgeVariant(post.authorRole)} size="sm">
              {getAuthorRoleLabel(post.authorRole)}
            </Badge>
            {post.isPinned ? (
              <Badge variant="warning" size="sm">
                공지
              </Badge>
            ) : null}
            {post.isLocked ? (
              <Badge variant="error" size="sm">
                잠금
              </Badge>
            ) : null}
          </View>

          <Text className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            {post.title}
          </Text>
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">{post.authorName}</Text>
          <Text className="text-base leading-7 text-gray-700 dark:text-gray-300">{post.body}</Text>

          {post.jobSummary ? (
            <Card className="mt-4 bg-gray-50 dark:bg-surface-elevated">
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                일정 요약
              </Text>
              <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                날짜: {post.jobSummary.workDates?.join(', ') || post.jobSummary.workDate}
              </Text>
              <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                장소: {post.jobSummary.locationName || '미정'}
              </Text>
              <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                인원: {post.jobSummary.filledPositions ?? 0}/{post.jobSummary.totalPositions ?? 0}
              </Text>
              {post.jobSummary.compensationLabel ? (
                <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  급여: {post.jobSummary.compensationLabel}
                </Text>
              ) : null}
            </Card>
          ) : null}

          <BoardImageGrid images={post.imageAttachments} />

          {post.boardType !== 'notice' ? (
            <View className="mt-4 flex-row flex-wrap gap-2">
              <Button
                variant={data.myVote === 'like' ? 'primary' : 'outline'}
                size="sm"
                icon={
                  <HeartIcon size={16} color={data.myVote === 'like' ? '#FFFFFF' : '#16A34A'} />
                }
                onPress={() => voteMutation.mutate('like')}
                disabled={!canInteract || isVoteSubmitting}
              >
                좋아요 {post.likeCount}
              </Button>
              <Button
                variant={data.myVote === 'dislike' ? 'danger' : 'outline'}
                size="sm"
                icon={
                  <CloseCircleOutlineIcon
                    size={16}
                    color={data.myVote === 'dislike' ? '#FFFFFF' : '#DC2626'}
                  />
                }
                onPress={() => voteMutation.mutate('dislike')}
                disabled={!canInteract || isVoteSubmitting}
              >
                싫어요 {post.dislikeCount}
              </Button>
            </View>
          ) : null}

          <View className="mt-4 flex-row flex-wrap gap-3">
            {canManagePost && post.boardType !== 'schedule' && !post.isLocked ? (
              <Pressable
                onPress={() => router.push(`/(app)/(tabs)/board/edit/${post.id}`)}
                className="active:opacity-70"
              >
                <Text className="text-sm text-primary-600 dark:text-primary-400">수정</Text>
              </Pressable>
            ) : null}
            {canManagePost ? (
              <Pressable
                onPress={handleTogglePostLock}
                disabled={isPostActionPending}
                className={isPostActionPending ? 'opacity-50' : 'active:opacity-70'}
              >
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {post.isLocked ? '잠금 해제' : '잠금'}
                </Text>
              </Pressable>
            ) : null}
            {isAdmin && post.boardType !== 'notice' ? (
              <Pressable
                onPress={handleHidePost}
                disabled={isPostActionPending}
                className={isPostActionPending ? 'opacity-50' : 'active:opacity-70'}
              >
                <Text className="text-sm text-error-600 dark:text-error-400">숨김</Text>
              </Pressable>
            ) : null}
            {canReportPost ? (
              <Pressable
                onPress={() =>
                  setReportTarget({
                    targetType: 'post',
                    targetId: post.id,
                  })
                }
                className="active:opacity-70"
              >
                <Text className="text-sm text-gray-500 dark:text-gray-400">신고</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {post.boardType !== 'notice' ? (
          <>
            {pinnedComments.length > 0 ? (
              <View className="mb-4">
                <View className="mb-3 flex-row items-center gap-2">
                  <PinIcon size={16} color="#F59E0B" />
                  <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    고정 댓글
                  </Text>
                </View>
                <BoardCommentThread
                  comments={pinnedComments}
                  currentUserId={user?.uid}
                  myReactions={data.myReactions}
                  canInteract={canInteract}
                  canManagePost={canManagePost}
                  isAdmin={isAdmin}
                  onReply={(comment) => {
                    setReplyTarget(comment);
                    setEditingComment(null);
                    setDraftBody('');
                    setDraftImages([]);
                    setSelectedMentionIds(
                      comment.authorId === user?.uid ||
                        !mentionCandidates.some(
                          (candidate) => candidate.userId === comment.authorId
                        )
                        ? []
                        : [comment.authorId]
                    );
                  }}
                  onEdit={(comment) => {
                    setEditingComment(comment);
                    setReplyTarget(null);
                    setDraftBody(comment.body);
                    setDraftImages(comment.imageAttachments);
                    setSelectedMentionIds([]);
                  }}
                  onDelete={handleDeleteComment}
                  onHide={handleHideComment}
                  onTogglePin={(comment) =>
                    commentMutations.setPinned.mutate({
                      commentId: comment.id,
                    })
                  }
                  onToggleReaction={(comment, reactionType) =>
                    commentMutations.toggleReaction.mutate({
                      commentId: comment.id,
                      type: reactionType,
                    })
                  }
                  onReport={(comment) =>
                    setReportTarget({
                      targetType: 'comment',
                      targetId: comment.id,
                    })
                  }
                />
              </View>
            ) : null}

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                댓글 {post.commentCount}
              </Text>
              {post.isLocked ? (
                <View className="flex-row items-center gap-1">
                  <LockIcon size={14} color="#DC2626" />
                  <Text className="text-xs text-error-600 dark:text-error-400">잠금 상태</Text>
                </View>
              ) : null}
            </View>

            {regularComments.length > 0 ? (
              <BoardCommentThread
                comments={regularComments}
                currentUserId={user?.uid}
                myReactions={data.myReactions}
                canInteract={canInteract}
                canManagePost={canManagePost}
                isAdmin={isAdmin}
                onReply={(comment) => {
                  setReplyTarget(comment);
                  setEditingComment(null);
                  setDraftBody('');
                  setDraftImages([]);
                  setSelectedMentionIds(
                    comment.authorId === user?.uid ||
                      !mentionCandidates.some((candidate) => candidate.userId === comment.authorId)
                      ? []
                      : [comment.authorId]
                  );
                }}
                onEdit={(comment) => {
                  setEditingComment(comment);
                  setReplyTarget(null);
                  setDraftBody(comment.body);
                  setDraftImages(comment.imageAttachments);
                  setSelectedMentionIds([]);
                }}
                onDelete={handleDeleteComment}
                onHide={handleHideComment}
                onTogglePin={(comment) =>
                  commentMutations.setPinned.mutate({
                    commentId: comment.id,
                  })
                }
                onToggleReaction={(comment, reactionType) =>
                  commentMutations.toggleReaction.mutate({
                    commentId: comment.id,
                    type: reactionType,
                  })
                }
                onReport={(comment) =>
                  setReportTarget({
                    targetType: 'comment',
                    targetId: comment.id,
                  })
                }
              />
            ) : (
              <Card>
                <EmptyState
                  title="아직 댓글이 없어요"
                  description="첫 댓글로 대화를 시작해 보세요."
                />
              </Card>
            )}

            <Card className="mt-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {editingComment ? '댓글 수정' : replyTarget ? '답글 작성' : '댓글 작성'}
                </Text>
                {replyTarget || editingComment ? (
                  <Pressable onPress={resetComposer} className="active:opacity-70">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">취소</Text>
                  </Pressable>
                ) : null}
              </View>

              {replyTarget ? (
                <Text className="mb-2 text-sm text-primary-600 dark:text-primary-400">
                  @{replyTarget.authorName} 에게 답글을 남기는 중이에요.
                </Text>
              ) : null}

              <Input
                value={draftBody}
                onChangeText={setDraftBody}
                placeholder={post.isLocked ? '잠긴 게시글입니다.' : '댓글을 입력해 주세요'}
                multiline
                textAlignVertical="top"
                numberOfLines={5}
                editable={canInteract}
              />

              {canSelectMentions ? (
                <View className="mt-3">
                  <Text className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    멘션
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {mentionCandidates.map((candidate) => {
                      const isSelected = selectedMentionIds.includes(candidate.userId);
                      return (
                        <Pressable
                          key={candidate.userId}
                          onPress={() => toggleMentionSelection(candidate.userId)}
                          className={`rounded-full px-3 py-1.5 ${
                            isSelected
                              ? 'bg-primary-100 dark:bg-primary-900/30'
                              : 'bg-gray-100 dark:bg-surface-elevated'
                          }`}
                        >
                          <Text className="text-xs text-gray-700 dark:text-gray-200">
                            @{candidate.displayName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {renderDraftImages()}

              <View className="mt-4 flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  icon={<ImageIcon size={18} color="#6B7280" />}
                  onPress={handlePickCommentImages}
                  disabled={!canInteract || isUploadingCommentImages}
                >
                  이미지
                </Button>
                <Button
                  className="flex-1"
                  loading={isCommentSubmitting}
                  icon={<PaperPlaneOutlineIcon size={18} color="#FFFFFF" />}
                  onPress={() => void handleSubmitComment()}
                  disabled={isCommentSubmitDisabled}
                >
                  등록
                </Button>
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={Boolean(reportTarget)}
        onClose={() => {
          setReportTarget(null);
          setReportReason('');
          setReportDetails('');
        }}
        title="신고 접수"
        size="md"
      >
        <Input
          label="신고 사유"
          value={reportReason}
          onChangeText={setReportReason}
          maxLength={80}
          placeholder="신고 사유를 입력해 주세요"
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
            placeholder="추가 설명이 있다면 입력해 주세요"
          />
        </View>

        <View className="mt-6 flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onPress={() => {
              setReportTarget(null);
              setReportReason('');
              setReportDetails('');
            }}
          >
            취소
          </Button>
          <Button
            className="flex-1"
            loading={isReportSubmitting}
            icon={<FlagOutlineIcon size={16} color="#FFFFFF" />}
            onPress={() => void handleReportSubmit()}
            disabled={isReportSubmitDisabled}
          >
            신고하기
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
