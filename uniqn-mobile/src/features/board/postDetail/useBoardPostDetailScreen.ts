import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildBoardDetailListItems,
  type BoardDetailListItem,
} from '@/components/board/boardDetailListItems';
import { type ActionSheetOption } from '@/components/ui';
import { LAYOUT } from '@/constants';
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
  type BoardCommentNode,
  type BoardImageAttachment,
  type BoardMentionCandidate,
  type CommentReactionType,
} from '@/types/board';
import { formatDateTime, formatRelativeTime } from '@/utils/date';
import {
  getComposerPlaceholder,
  getPostFallbackHref,
  hasCommentWithId,
  type BoardDetailComposerContextValue,
} from './boardPostDetailUtils';

export function useBoardPostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user, isAdmin } = useAuth();
  const insets = useSafeAreaInsets();
  const addToast = useToastStore((state) => state.addToast);
  const { data, isLoading, error, refetch, isRefetching } = useBoardPostDetail(postId ?? '');
  const post = data?.post;
  const canInteract =
    !!post &&
    post.boardType !== 'notice' &&
    !post.isLocked &&
    !!user?.uid &&
    (post.boardType !== 'schedule' ||
      isAdmin ||
      post.authorId === user.uid ||
      !!data?.membership?.canComment);
  const mentionCandidatesEnabled = Boolean(postId) && canInteract;
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
  const [postMenuVisible, setPostMenuVisible] = useState(false);

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
  const isCommentSubmitting =
    createComment.isPending || commentMutations.updateComment.isPending || isUploadingCommentImages;
  const isReportSubmitting = createReport.isPending;
  const isReportSubmitDisabled = !reportReason.trim() || isReportSubmitting;
  const isVoteSubmitting = voteMutation.isPending;
  const isPostActionPending = lockMutation.isPending || hidePostMutation.isPending;
  const canReportPost =
    !!post && post.boardType !== 'notice' && !!user?.uid && user.uid !== post.authorId;
  const postFallbackHref = getPostFallbackHref(post?.boardType);
  const postCreatedAtLabel = post ? formatDateTime(post.createdAt) : '';
  const postLastActivityLabel = post
    ? formatRelativeTime(post.lastActivityAt ?? post.updatedAt ?? post.createdAt)
    : '';
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

  const resetReportForm = useCallback(() => {
    setReportTarget(null);
    setReportReason('');
    setReportDetails('');
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

      resetReportForm();
    } catch {
      // Toast feedback is handled in the mutation hook.
    }
  }, [createReport, post, reportDetails, reportReason, reportTarget, resetReportForm]);

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

  const handlePostMenuSelect = useCallback(
    (value: string) => {
      if (!post) {
        return;
      }

      if (value === 'edit') {
        router.push(`/(app)/(tabs)/board/edit/${post.id}`);
      } else if (value === 'lock') {
        handleTogglePostLock();
      } else if (value === 'hide') {
        handleHidePost();
      } else if (value === 'report') {
        setReportTarget({ targetType: 'post', targetId: post.id });
      }
    },
    [handleHidePost, handleTogglePostLock, post]
  );

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
            canInteract,
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
      canInteract,
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

  const composerContextValue = useMemo<BoardDetailComposerContextValue>(
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

  const postMenuOptions = useMemo<ActionSheetOption[]>(() => {
    if (!post) {
      return [];
    }

    const options: ActionSheetOption[] = [];

    if (canManagePost && post.boardType !== 'schedule' && !post.isLocked) {
      options.push({ label: '수정', value: 'edit' });
    }
    if (canManagePost) {
      options.push({
        label: post.isLocked ? '잠금 해제' : '잠금',
        value: 'lock',
        disabled: isPostActionPending,
      });
    }
    if (isAdmin && post.boardType !== 'notice') {
      options.push({
        label: '숨김',
        value: 'hide',
        destructive: true,
        disabled: isPostActionPending,
      });
    }
    if (canReportPost) {
      options.push({ label: '신고', value: 'report' });
    }

    return options;
  }, [canManagePost, canReportPost, isAdmin, isPostActionPending, post]);

  return {
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
  };
}
