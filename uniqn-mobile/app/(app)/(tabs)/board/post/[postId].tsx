import { SECONDARY_PALETTE } from '@/constants/colors';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
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
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  SkeletonButton,
  SkeletonText,
} from '@/components/ui';
import { LAYOUT, ROLE_LABELS } from '@/constants';
import {
  ChatbubbleEllipsesOutlineIcon,
  CloseCircleOutlineIcon,
  EyeIcon,
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
import { formatDateTime, formatRelativeTime } from '@/utils/date';

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

function getPostFallbackHref(boardType?: string | null) {
  return boardType ? `/(app)/(tabs)/board/${boardType}` : '/(app)/(tabs)/board';
}

function MetaPill({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <View className="flex-row items-center rounded-sm bg-surface-card px-3 py-1.5 dark:bg-surface-elevated">
      {icon ? <View>{icon}</View> : null}
      <Text
        className={`${icon ? 'ml-1.5' : ''} text-xs font-sans-medium text-content-muted dark:text-secondary-300`}
      >
        {label}
      </Text>
    </View>
  );
}

function ActionChip({
  label,
  variant = 'neutral',
  disabled = false,
  testID,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  variant?: 'neutral' | 'primary' | 'danger';
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const containerClass =
    variant === 'primary'
      ? 'bg-primary-50 dark:bg-primary-900/20'
      : variant === 'danger'
        ? 'bg-error-50 dark:bg-error-900/20'
        : 'bg-secondary-100 dark:bg-surface-elevated';
  const textClass =
    variant === 'primary'
      ? 'text-primary-700 dark:text-primary-300'
      : variant === 'danger'
        ? 'text-error-600 dark:text-error-400'
        : 'text-secondary-600 dark:text-secondary-300';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      className={`rounded-sm px-3 py-2 ${containerClass} ${
        disabled ? 'opacity-50' : 'active:opacity-70'
      }`}
    >
      <Text className={`text-xs font-sans-semibold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}

function BoardPostDetailSkeleton() {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: LAYOUT.TAB_BAR_HEIGHT + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="mb-4 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
        게시글을 불러오는 중이에요.
      </Text>

      <View className="mb-3 flex-row flex-wrap gap-2">
        <Skeleton width={72} height={28} borderRadius={14} />
        <Skeleton width={64} height={28} borderRadius={14} />
        <Skeleton width={56} height={28} borderRadius={14} />
      </View>

      <Card className="mb-4 border border-secondary-100 dark:border-surface-overlay">
        <Skeleton width="72%" height={28} className="mb-3" />
        <View className="mb-5 flex-row flex-wrap gap-2">
          <Skeleton width={84} height={16} />
          <Skeleton width={120} height={16} />
          <Skeleton width={72} height={16} />
        </View>
        <SkeletonText lines={4} lineHeight={16} lastLineWidth="58%" className="mb-5" />
        <Skeleton width="100%" height={208} borderRadius={20} className="mb-5" />
        <View className="flex-row flex-wrap gap-2">
          <Skeleton width={76} height={32} borderRadius={16} />
          <Skeleton width={84} height={32} borderRadius={16} />
          <Skeleton width={80} height={32} borderRadius={16} />
        </View>
      </Card>

      <View className="mb-3 flex-row items-center justify-between">
        <Skeleton width={92} height={22} />
        <Skeleton width={68} height={16} />
      </View>

      {[1, 2].map((item) => (
        <Card
          key={item}
          className="mb-3 border border-secondary-100 bg-white dark:border-surface-overlay dark:bg-surface"
        >
          <View className="mb-3 flex-row items-center gap-2">
            <Skeleton width={88} height={18} />
            <Skeleton width={54} height={24} borderRadius={12} />
          </View>
          <SkeletonText lines={3} lineHeight={14} lastLineWidth="46%" className="mb-4" />
          <View className="flex-row flex-wrap gap-2">
            <Skeleton width={64} height={30} borderRadius={15} />
            <Skeleton width={64} height={30} borderRadius={15} />
            <Skeleton width={64} height={30} borderRadius={15} />
          </View>
        </Card>
      ))}

      <Card className="border border-secondary-100 dark:border-surface-overlay">
        <Skeleton width={80} height={20} className="mb-3" />
        <Skeleton width="100%" height={138} borderRadius={16} className="mb-4" />
        <View className="flex-row gap-3">
          <SkeletonButton width="48%" />
          <SkeletonButton width="48%" />
        </View>
      </Card>
    </ScrollView>
  );
}

function CommentSectionHeader({ item }: { item: BoardDetailSectionItem }) {
  if (item.section === 'pinned') {
    return (
      <View className="mb-3 mt-3 flex-row items-center gap-2">
        <PinIcon size={16} color="#D4A017" />
        <Text className="text-sm font-sans-semibold uppercase tracking-[0.8px] text-content-secondary dark:text-secondary-200">
          {item.title}
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-3 mt-3 flex-row items-center justify-between">
      <Text className="text-lg font-display-semibold text-content-primary dark:text-secondary-100">
        {item.title} {item.count ?? 0}
      </Text>
      {item.isLocked ? (
        <View className="flex-row items-center gap-1 rounded-sm bg-error-50 px-2 py-1 dark:bg-error-900/20">
          <LockIcon size={14} color="#DC2626" />
          <Text className="text-xs text-error-600 dark:text-error-400 font-sans">잠금 상태</Text>
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
    <View className={`mb-3 ${item.mode === 'create' ? 'mt-4' : 'mt-2'}`}>
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

    const showActionBar =
      canManagePost || (isAdmin && post.boardType !== 'notice') || canReportPost;

    return (
      <View className="pb-2">
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

        <Card className="mb-4 border border-secondary-100 dark:border-surface-overlay">
          <Text className="text-2xl font-display leading-9 text-content-primary dark:text-secondary-100">
            {post.title}
          </Text>

          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <Text className="text-sm font-sans-medium text-content-secondary dark:text-secondary-200">
              {post.authorName}
            </Text>
            {postCreatedAtLabel ? (
              <>
                <View className="h-1 w-1 rounded-sm bg-secondary-300 dark:bg-secondary-600" />
                <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  {postCreatedAtLabel}
                </Text>
              </>
            ) : null}
            {postLastActivityLabel ? (
              <>
                <View className="h-1 w-1 rounded-sm bg-secondary-300 dark:bg-secondary-600" />
                <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  최근 활동 {postLastActivityLabel}
                </Text>
              </>
            ) : null}
          </View>

          <Text className="mt-5 text-base leading-8 text-content-secondary font-sans">
            {post.body}
          </Text>

          <BoardImageGrid
            images={post.imageAttachments}
            onPressImage={(index) => openImageViewer(post.imageAttachments, index)}
          />

          {post.jobSummary ? (
            <View className="mt-5 rounded-lg border border-primary-100 bg-primary-50/60 p-4 dark:border-surface-overlay dark:bg-surface-elevated">
              <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
                일정 요약
              </Text>
              <View className="mt-3 gap-2">
                <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
                  날짜: {post.jobSummary.workDates?.join(', ') || post.jobSummary.workDate}
                </Text>
                <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
                  장소: {post.jobSummary.locationName || '미정'}
                </Text>
                <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
                  인원: {post.jobSummary.filledPositions ?? 0}/{post.jobSummary.totalPositions ?? 0}
                </Text>
                {post.jobSummary.compensationLabel ? (
                  <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
                    급여: {post.jobSummary.compensationLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View className="mt-5 flex-row flex-wrap gap-2">
            <MetaPill
              icon={<ChatbubbleEllipsesOutlineIcon size={14} color={SECONDARY_PALETTE[500]} />}
              label={`댓글 ${post.commentCount}`}
            />
            <MetaPill
              icon={<EyeIcon size={14} color={SECONDARY_PALETTE[500]} />}
              label={`조회 ${post.viewCount}`}
            />
            {postLastActivityLabel ? (
              <MetaPill label={`최근 활동 ${postLastActivityLabel}`} />
            ) : null}
          </View>

          {post.boardType !== 'notice' ? (
            <View className="mt-5 rounded-lg bg-surface-page p-4 dark:bg-surface-elevated">
              <Text className="text-xs font-sans-semibold uppercase tracking-[0.8px] text-secondary-500 dark:text-secondary-400">
                반응
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
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
            </View>
          ) : null}

          {showActionBar ? (
            <View className="mt-5 rounded-lg bg-surface-page p-4 dark:bg-surface-elevated">
              <Text className="text-xs font-sans-semibold uppercase tracking-[0.8px] text-secondary-500 dark:text-secondary-400">
                게시글 작업
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {canManagePost && post.boardType !== 'schedule' && !post.isLocked ? (
                  <ActionChip
                    testID={`board-post-edit-${post.id}`}
                    accessibilityLabel="게시글 수정"
                    label="수정"
                    variant="primary"
                    onPress={() => router.push(`/(app)/(tabs)/board/edit/${post.id}`)}
                  />
                ) : null}
                {canManagePost ? (
                  <ActionChip
                    testID={`board-post-lock-${post.id}`}
                    accessibilityLabel={post.isLocked ? '게시글 잠금 해제' : '게시글 잠금'}
                    label={post.isLocked ? '잠금 해제' : '잠금'}
                    disabled={isPostActionPending}
                    onPress={handleTogglePostLock}
                  />
                ) : null}
                {isAdmin && post.boardType !== 'notice' ? (
                  <ActionChip
                    testID={`board-post-hide-${post.id}`}
                    accessibilityLabel="게시글 숨김"
                    label="숨김"
                    variant="danger"
                    disabled={isPostActionPending}
                    onPress={handleHidePost}
                  />
                ) : null}
                {canReportPost ? (
                  <ActionChip
                    testID={`board-post-report-${post.id}`}
                    accessibilityLabel="게시글 신고"
                    label="신고"
                    onPress={() =>
                      setReportTarget({
                        targetType: 'post',
                        targetId: post.id,
                      })
                    }
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </Card>
      </View>
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
    postCreatedAtLabel,
    postLastActivityLabel,
    voteMutation,
  ]);

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
    ]
  );

  if (!postId) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
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
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
        <StackHeader title="게시글" fallbackHref={postFallbackHref} />
        <BoardPostDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !post || !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
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
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark" edges={['top']}>
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
