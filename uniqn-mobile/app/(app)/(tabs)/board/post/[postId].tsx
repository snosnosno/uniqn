import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabHeader } from '@/components/headers';
import { BoardCommentComposer } from '@/components/board/BoardCommentComposer';
import { BoardCommentItem } from '@/components/board/BoardCommentItem';
import { BoardImageGrid } from '@/components/board/BoardImageGrid';
import { BoardImageViewerOverlay } from '@/components/board/BoardImageViewerOverlay';
import {
  buildBoardDetailListItems,
  type BoardDetailListItem,
  type BoardDetailComposerItem,
  type BoardDetailSectionItem,
} from '@/components/board/boardDetailListItems';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal } from '@/components/ui';
import { LAYOUT, ROLE_LABELS } from '@/constants';
import {
  CloseCircleOutlineIcon,
  FlagOutlineIcon,
  HeartIcon,
  LockIcon,
  PinIcon,
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
import { uploadMultipleBoardImages } from '@/services/auth';
import { useToastStore } from '@/stores/toastStore';
import { confirmAction } from '@/utils/confirmAction';
import {
  BOARD_TYPE_LABELS,
  type BoardCommentNode,
  type BoardImageAttachment,
  type BoardMentionCandidate,
  type CommentReactionType,
} from '@/types/board';

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

function getComposerPlaceholder(canInteract: boolean, isLocked: boolean) {
  if (isLocked) {
    return '잠긴 게시글입니다.';
  }

  if (!canInteract) {
    return '댓글을 남길 수 없어요.';
  }

  return '댓글을 입력해 주세요.';
}

function CommentSectionHeader({ item }: { item: BoardDetailSectionItem }) {
  if (item.section === 'pinned') {
    return (
      <View className="mb-3 mt-1 flex-row items-center gap-2">
        <PinIcon size={16} color="#F59E0B" />
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {item.title}
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-3 mt-1 flex-row items-center justify-between">
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {item.title} {item.count ?? 0}
      </Text>
      {item.isLocked ? (
        <View className="flex-row items-center gap-1">
          <LockIcon size={14} color="#DC2626" />
          <Text className="text-xs text-error-600 dark:text-error-400">잠금 상태</Text>
        </View>
      ) : null}
    </View>
  );
}

function hasCommentWithId(comments: BoardCommentNode[], targetCommentId: string): boolean {
  const stack = [...comments];

  while (stack.length > 0) {
    const comment = stack.pop();

    if (!comment) {
      continue;
    }

    if (comment.id === targetCommentId) {
      return true;
    }

    if (comment.children.length > 0) {
      stack.push(...comment.children);
    }
  }

  return false;
}

interface BoardDetailComposerContextValue {
  draftBody: string;
  draftImages: BoardImageAttachment[];
  inputRef: RefObject<TextInput | null>;
  replyTargetName?: string;
  canInteract: boolean;
  mentionCandidates: BoardMentionCandidate[];
  selectedMentionIds: string[];
  isCommentSubmitting: boolean;
  isUploadingCommentImages: boolean;
  composerPlaceholder: string;
  onChangeText: (value: string) => void;
  onToggleMention: (userId: string) => void;
  onRemoveImage: (imageId: string) => void;
  onPickImages: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onFocusItem: (itemKey: string) => void;
}

const BoardDetailComposerContext = createContext<BoardDetailComposerContextValue | null>(null);

function InlineComposerRow({ item }: { item: BoardDetailComposerItem }) {
  const composerContext = useContext(BoardDetailComposerContext);

  if (!composerContext) {
    return null;
  }

  const composerMentions =
    item.mode === 'edit' ? ([] as BoardMentionCandidate[]) : composerContext.mentionCandidates;

  return (
    <View className="mb-3">
      <BoardCommentComposer
        mode={item.mode}
        value={composerContext.draftBody}
        images={composerContext.draftImages}
        inputRef={composerContext.inputRef}
        autoFocus={item.mode !== 'create'}
        replyTargetName={item.mode === 'reply' ? composerContext.replyTargetName : undefined}
        canInteract={composerContext.canInteract}
        canSelectMentions={
          composerContext.canInteract && item.mode !== 'edit' && composerMentions.length > 0
        }
        mentionCandidates={composerMentions}
        selectedMentionIds={composerContext.selectedMentionIds}
        isSubmitting={composerContext.isCommentSubmitting}
        isUploadingImages={composerContext.isUploadingCommentImages}
        placeholder={composerContext.composerPlaceholder}
        onChangeText={composerContext.onChangeText}
        onToggleMention={composerContext.onToggleMention}
        onRemoveImage={composerContext.onRemoveImage}
        onPickImages={composerContext.onPickImages}
        onSubmit={composerContext.onSubmit}
        onCancel={item.mode === 'create' ? undefined : composerContext.onCancel}
        onFocus={() => composerContext.onFocusItem(item.key)}
      />
    </View>
  );
}

export default function BoardPostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user, isAdmin } = useAuth();
  const insets = useSafeAreaInsets();
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
  const listRef = useRef<FlashListRef<BoardDetailListItem> | null>(null);
  const composerInputRef = useRef<TextInput | null>(null);
  const setPinnedMutateRef = useRef(commentMutations.setPinned.mutate);
  const toggleReactionMutateRef = useRef(commentMutations.toggleReaction.mutate);
  const currentUserIdRef = useRef(user?.uid);
  const mentionCandidatesRef = useRef<BoardMentionCandidate[]>([]);

  const [draftBody, setDraftBody] = useState('');
  const [draftImages, setDraftImages] = useState<BoardImageAttachment[]>([]);
  const [replyTarget, setReplyTarget] = useState<BoardCommentNode | null>(null);
  const [editingComment, setEditingComment] = useState<BoardCommentNode | null>(null);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [isUploadingCommentImages, setIsUploadingCommentImages] = useState(false);
  const [imageViewerState, setImageViewerState] = useState<{
    images: BoardImageAttachment[];
    currentIndex: number;
  } | null>(null);
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

  useEffect(() => {
    setPinnedMutateRef.current = commentMutations.setPinned.mutate;
  }, [commentMutations.setPinned.mutate]);

  useEffect(() => {
    toggleReactionMutateRef.current = commentMutations.toggleReaction.mutate;
  }, [commentMutations.toggleReaction.mutate]);

  useEffect(() => {
    currentUserIdRef.current = user?.uid;
  }, [user?.uid]);

  const mentionCandidates = useMemo(
    () => (mentionCandidatesQuery.data ?? []).filter((candidate) => candidate.userId !== user?.uid),
    [mentionCandidatesQuery.data, user?.uid]
  );

  useEffect(() => {
    mentionCandidatesRef.current = mentionCandidates;
  }, [mentionCandidates]);

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
  const isCommentSubmitting =
    createComment.isPending || commentMutations.updateComment.isPending || isUploadingCommentImages;
  const isReportSubmitting = createReport.isPending;
  const isReportSubmitDisabled = !reportReason.trim() || isReportSubmitting;
  const isVoteSubmitting = voteMutation.isPending;
  const isPostActionPending = lockMutation.isPending || hidePostMutation.isPending;
  const canReportPost =
    !!post && post.boardType !== 'notice' && !!user?.uid && user.uid !== post.authorId;
  const rawComposerTargetCommentId = editingComment?.id ?? replyTarget?.id ?? null;
  const isComposerTargetPresent = rawComposerTargetCommentId
    ? hasCommentWithId(pinnedComments, rawComposerTargetCommentId) ||
      hasCommentWithId(regularComments, rawComposerTargetCommentId)
    : true;
  const activeEditingComment = editingComment && isComposerTargetPresent ? editingComment : null;
  const activeReplyTarget = replyTarget && isComposerTargetPresent ? replyTarget : null;
  const composerMode = activeEditingComment ? 'edit' : activeReplyTarget ? 'reply' : 'create';
  const composerTargetCommentId = activeEditingComment?.id ?? activeReplyTarget?.id ?? null;

  const resetComposer = useCallback(() => {
    setDraftBody('');
    setDraftImages([]);
    setReplyTarget(null);
    setEditingComment(null);
    setSelectedMentionIds([]);
  }, []);

  const toggleMentionSelection = useCallback(
    (candidateUserId: string) => {
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
    },
    [addToast]
  );

  useEffect(() => {
    if (rawComposerTargetCommentId && !isComposerTargetPresent) {
      resetComposer();
    }
  }, [isComposerTargetPresent, rawComposerTargetCommentId, resetComposer]);

  const handlePickCommentImages = useCallback(async () => {
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
      const uploadedImages = await uploadMultipleBoardImages(
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
  }, [addToast, canInteract, draftImages.length, isUploadingCommentImages, user?.uid]);

  const openImageViewer = useCallback((images: BoardImageAttachment[], index: number) => {
    if (!images[index]) {
      return;
    }

    setImageViewerState({
      images,
      currentIndex: index,
    });
  }, []);

  const handleSubmitComment = useCallback(async () => {
    if (!post) {
      return;
    }

    try {
      if (activeEditingComment) {
        await commentMutations.updateComment.mutateAsync({
          commentId: activeEditingComment.id,
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
        parentCommentId: activeReplyTarget?.id ?? null,
        mentionedUserIds: selectedMentionIds,
        imageAttachments: draftImages,
      });
      resetComposer();
    } catch {
      // Toast feedback is handled in the mutation hook.
    }
  }, [
    commentMutations.updateComment,
    createComment,
    draftBody,
    draftImages,
    activeEditingComment,
    activeReplyTarget?.id,
    post,
    resetComposer,
    selectedMentionIds,
  ]);

  const handleReportSubmit = useCallback(async () => {
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
  }, [createReport, post, reportDetails, reportReason, reportTarget]);

  const handleDeleteComment = useCallback(
    (comment: BoardCommentNode) => {
      confirmAction({
        title: '댓글 삭제',
        message: '이 댓글을 삭제할까요?',
        confirmText: '삭제',
        destructive: true,
        onConfirm: async () => {
          await commentMutations.setStatus.mutateAsync({
            commentId: comment.id,
            status: 'deleted',
          });
        },
      });
    },
    [commentMutations.setStatus]
  );

  const handleHideComment = useCallback(
    (comment: BoardCommentNode) => {
      confirmAction({
        title: '댓글 숨김',
        message: '관리자 숨김 처리할까요?',
        confirmText: '숨김',
        destructive: true,
        onConfirm: async () => {
          await commentMutations.setStatus.mutateAsync({
            commentId: comment.id,
            status: 'hidden',
          });
        },
      });
    },
    [commentMutations.setStatus]
  );

  const handleTogglePostLock = useCallback(() => {
    if (!post) {
      return;
    }

    confirmAction({
      title: post.isLocked ? '잠금 해제' : '게시글 잠금',
      message: post.isLocked
        ? '이 게시글의 잠금을 해제할까요?'
        : '이 게시글의 추가 활동을 막을까요?',
      confirmText: post.isLocked ? '해제' : '잠금',
      onConfirm: async () => {
        await lockMutation.mutateAsync(!post.isLocked);
      },
    });
  }, [lockMutation, post]);

  const handleHidePost = useCallback(() => {
    if (!post) {
      return;
    }

    confirmAction({
      title: '게시글 숨김',
      message: '관리자 숨김 처리할까요?',
      confirmText: '숨김',
      destructive: true,
      onConfirm: async () => {
        try {
          await hidePostMutation.mutateAsync();
          router.replace(`/(app)/(tabs)/board/${post.boardType}`);
        } catch {
          // Toast feedback is handled in the mutation hook.
        }
      },
    });
  }, [hidePostMutation, post]);

  const handleReply = useCallback((comment: BoardCommentNode) => {
    const currentUserId = currentUserIdRef.current;
    const nextMentionCandidates = mentionCandidatesRef.current;

    setReplyTarget(comment);
    setEditingComment(null);
    setDraftBody('');
    setDraftImages([]);
    setSelectedMentionIds(
      comment.authorId === currentUserId ||
        !nextMentionCandidates.some((candidate) => candidate.userId === comment.authorId)
        ? []
        : [comment.authorId]
    );
  }, []);

  const handleEdit = useCallback((comment: BoardCommentNode) => {
    setEditingComment(comment);
    setReplyTarget(null);
    setDraftBody(comment.body);
    setDraftImages(comment.imageAttachments);
    setSelectedMentionIds([]);
  }, []);

  const handleRemoveDraftImage = useCallback((imageId: string) => {
    setDraftImages((prev) => prev.filter((image) => image.id !== imageId));
  }, []);

  const handleComposerImagePickPress = useCallback(() => {
    void handlePickCommentImages();
  }, [handlePickCommentImages]);

  const handleComposerSubmitPress = useCallback(() => {
    void handleSubmitComment();
  }, [handleSubmitComment]);

  const handleTogglePin = useCallback((comment: BoardCommentNode) => {
    setPinnedMutateRef.current({
      commentId: comment.id,
    });
  }, []);

  const handleToggleReaction = useCallback(
    (comment: BoardCommentNode, reactionType: CommentReactionType) => {
      toggleReactionMutateRef.current({
        commentId: comment.id,
        type: reactionType,
      });
    },
    []
  );

  const detailItems = useMemo(
    () =>
      post?.boardType === 'notice'
        ? []
        : buildBoardDetailListItems({
            pinnedComments,
            regularComments,
            commentsCount: post?.commentCount ?? 0,
            isLocked: Boolean(post?.isLocked),
            composerMode,
            composerTargetCommentId,
          }),
    [
      composerMode,
      composerTargetCommentId,
      pinnedComments,
      post?.boardType,
      post?.commentCount,
      post?.isLocked,
      regularComments,
    ]
  );

  const activeComposerItem = useMemo(
    () => detailItems.find((item) => item.type === 'composer') ?? null,
    [detailItems]
  );

  const scrollToItemKey = useCallback(
    (key: string, animated = true) => {
      const index = detailItems.findIndex((item) => item.key === key);
      if (index < 0) {
        return;
      }

      listRef.current?.scrollToIndex({ index, animated, viewPosition: 0.45 });
    },
    [detailItems]
  );

  const handleComposerFocus = useCallback(
    (itemKey: string) => {
      scrollToItemKey(itemKey, false);
    },
    [scrollToItemKey]
  );

  useEffect(() => {
    if (!activeComposerItem || activeComposerItem.mode === 'create') {
      return;
    }

    const timer = setTimeout(() => {
      scrollToItemKey(activeComposerItem.key);
      composerInputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [activeComposerItem, scrollToItemKey]);

  const composerPlaceholder = useMemo(
    () => getComposerPlaceholder(canInteract, Boolean(post?.isLocked)),
    [canInteract, post?.isLocked]
  );

  const bottomPadding = useMemo(() => LAYOUT.TAB_BAR_HEIGHT + insets.bottom + 28, [insets.bottom]);

  const composerContextValue = useMemo(
    () => ({
      draftBody,
      draftImages,
      inputRef: composerInputRef,
      replyTargetName: activeReplyTarget?.authorName,
      canInteract,
      mentionCandidates,
      selectedMentionIds,
      isCommentSubmitting,
      isUploadingCommentImages,
      composerPlaceholder,
      onChangeText: setDraftBody,
      onToggleMention: toggleMentionSelection,
      onRemoveImage: handleRemoveDraftImage,
      onPickImages: handleComposerImagePickPress,
      onSubmit: handleComposerSubmitPress,
      onCancel: resetComposer,
      onFocusItem: handleComposerFocus,
    }),
    [
      canInteract,
      composerPlaceholder,
      draftBody,
      draftImages,
      handleComposerFocus,
      handleComposerImagePickPress,
      handleComposerSubmitPress,
      handleRemoveDraftImage,
      isCommentSubmitting,
      isUploadingCommentImages,
      mentionCandidates,
      activeReplyTarget?.authorName,
      resetComposer,
      selectedMentionIds,
      toggleMentionSelection,
    ]
  );

  const postHeader = useMemo(() => {
    if (!post || !data) {
      return null;
    }

    return (
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

        <BoardImageGrid
          images={post.imageAttachments}
          onPressImage={(index) => openImageViewer(post.imageAttachments, index)}
        />

        {post.boardType !== 'notice' ? (
          <View className="mt-4 flex-row flex-wrap gap-2">
            <Button
              variant={data.myVote === 'like' ? 'primary' : 'outline'}
              size="sm"
              icon={<HeartIcon size={16} color={data.myVote === 'like' ? '#FFFFFF' : '#16A34A'} />}
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
              testID={`board-post-edit-${post.id}`}
              accessibilityRole="button"
              accessibilityLabel="게시글 수정"
              onPress={() => router.push(`/(app)/(tabs)/board/edit/${post.id}`)}
              className="active:opacity-70"
            >
              <Text className="text-sm text-primary-600 dark:text-primary-400">수정</Text>
            </Pressable>
          ) : null}
          {canManagePost ? (
            <Pressable
              testID={`board-post-lock-${post.id}`}
              accessibilityRole="button"
              accessibilityLabel={post.isLocked ? '게시글 잠금 해제' : '게시글 잠금'}
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
              testID={`board-post-hide-${post.id}`}
              accessibilityRole="button"
              accessibilityLabel="게시글 숨김"
              onPress={handleHidePost}
              disabled={isPostActionPending}
              className={isPostActionPending ? 'opacity-50' : 'active:opacity-70'}
            >
              <Text className="text-sm text-error-600 dark:text-error-400">숨김</Text>
            </Pressable>
          ) : null}
          {canReportPost ? (
            <Pressable
              testID={`board-post-report-${post.id}`}
              accessibilityRole="button"
              accessibilityLabel="게시글 신고"
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
    );
  }, [
    canInteract,
    canManagePost,
    canReportPost,
    data,
    handleHidePost,
    handleTogglePostLock,
    isAdmin,
    isPostActionPending,
    isVoteSubmitting,
    openImageViewer,
    post,
    voteMutation,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: BoardDetailListItem }) => {
      if (item.type === 'section') {
        return <CommentSectionHeader item={item} />;
      }

      if (item.type === 'empty') {
        return (
          <Card className="mb-3">
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
    ]
  );

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
            ListHeaderComponent={postHeader}
          />
        </BoardDetailComposerContext.Provider>
      </KeyboardAvoidingView>

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
