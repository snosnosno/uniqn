import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createBoardComment,
  createBoardPost,
  createBoardReport,
  fetchBoardPosts,
  getBoardHomeData,
  getBoardMentionCandidates,
  getBoardPostDetail,
  hideBoardPost,
  incrementBoardPostViewCount,
  setBoardCommentPinned,
  setBoardCommentStatus,
  setBoardPostLock,
  toggleBoardCommentReaction,
  toggleBoardPostVote,
  updateBoardComment,
  updateBoardPost,
} from '@/services';
import { invalidateQueries, queryClient, queryKeys } from '@/lib/queryClient';
import { userRepository } from '@/repositories';
import {
  selectBootstrapSource,
  selectNeedsServerReconcile,
  useAuthStore,
} from '@/stores/authStore';
import { useAuth } from '@/hooks/useAuth';
import { isBoardQueryAuthReady } from '@/hooks/internal/boardQueryAuthGate';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type {
  BoardType,
  BoardVoteType,
  CommentReactionType,
  CreateBoardCommentInput,
  CreateBoardPostInput,
  CreateBoardReportInput,
  UpdateBoardCommentInput,
  UpdateBoardPostInput,
} from '@/types';
import type { BoardHomeData, BoardPost } from '@/types/board';

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

interface BoardMutationUser {
  uid: string;
  displayName?: string | null;
}

interface BoardMutationProfile {
  nickname?: string | null;
  name?: string | null;
  role?: CreateBoardPostInput['authorRole'] | null;
}

type BoardPostDetailQueryData = Awaited<ReturnType<typeof getBoardPostDetail>>;
type BoardPostListQueryData = Awaited<ReturnType<typeof fetchBoardPosts>>;
type BoardHomeQueryData = Awaited<ReturnType<typeof getBoardHomeData>>;

interface BoardPostLockMutationContext {
  detailSnapshots: [readonly unknown[], BoardPostDetailQueryData | undefined][];
  listSnapshots: [readonly unknown[], BoardPostListQueryData | undefined][];
  homeSnapshots: [readonly unknown[], BoardHomeQueryData | undefined][];
}

function isBoardDetailQueryKey(queryKey: readonly unknown[], postId: string): boolean {
  return queryKey[0] === 'boards' && queryKey[1] === 'detail' && queryKey[2] === postId;
}

function isBoardListQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'boards' && queryKey[1] === 'list';
}

function isBoardHomeQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'boards' && queryKey[1] === 'home';
}

function applyBoardPostLockState(
  post: BoardPost,
  isLocked: boolean,
  actorId?: string | null
): BoardPost {
  return {
    ...post,
    isLocked,
    status: isLocked ? 'locked' : 'active',
    lockedBy: isLocked ? (actorId ?? post.lockedBy ?? null) : null,
    lockedAt: isLocked ? (post.lockedAt ?? new Date()) : null,
  };
}

function updateBoardPostCollectionLockState(
  posts: BoardPost[],
  postId: string,
  isLocked: boolean,
  actorId?: string | null
): BoardPost[] {
  return posts.map((post) =>
    post.id === postId ? applyBoardPostLockState(post, isLocked, actorId) : post
  );
}

function updateBoardLockCaches(postId: string, isLocked: boolean, actorId?: string | null) {
  queryClient.setQueriesData<BoardPostDetailQueryData>(
    {
      predicate: (query) => isBoardDetailQueryKey(query.queryKey, postId),
    },
    (current) => {
      if (!current || current.post.id !== postId) {
        return current;
      }

      return {
        ...current,
        post: applyBoardPostLockState(current.post, isLocked, actorId),
      };
    }
  );

  queryClient.setQueriesData<BoardPostListQueryData>(
    {
      predicate: (query) => isBoardListQueryKey(query.queryKey),
    },
    (current) => {
      if (!current?.some((post) => post.id === postId)) {
        return current;
      }

      return updateBoardPostCollectionLockState(current, postId, isLocked, actorId);
    }
  );

  queryClient.setQueriesData<BoardHomeQueryData>(
    {
      predicate: (query) => isBoardHomeQueryKey(query.queryKey),
    },
    (current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        pinnedNotices: updateBoardPostCollectionLockState(
          current.pinnedNotices,
          postId,
          isLocked,
          actorId
        ),
        recentSchedulePosts: updateBoardPostCollectionLockState(
          current.recentSchedulePosts,
          postId,
          isLocked,
          actorId
        ),
        popularCommunityPosts: updateBoardPostCollectionLockState(
          current.popularCommunityPosts,
          postId,
          isLocked,
          actorId
        ),
      } satisfies BoardHomeData;
    }
  );
}

function restoreBoardPostLockCaches(context?: BoardPostLockMutationContext) {
  context?.detailSnapshots.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });

  context?.listSnapshots.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });

  context?.homeSnapshots.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
}

function requireBoardMutationActor(
  user: BoardMutationUser | null | undefined,
  isAdmin = false
): { userId: string; isAdmin: boolean } {
  if (!user?.uid) {
    throw new Error('로그인이 필요합니다.');
  }

  return {
    userId: user.uid,
    isAdmin,
  };
}

async function requireBoardAuthorIdentity(
  user: BoardMutationUser | null | undefined,
  profile: BoardMutationProfile | null | undefined,
  role: CreateBoardPostInput['authorRole'] | null | undefined,
  isAdmin = false
): Promise<{
  userId: string;
  isAdmin: boolean;
  authorName: string;
  authorRole: CreateBoardPostInput['authorRole'];
}> {
  const actor = requireBoardMutationActor(user, isAdmin);
  const needsPersistedProfile = (!profile?.nickname && !profile?.name) || !role;
  const persistedProfile = needsPersistedProfile
    ? await userRepository.getById(actor.userId).catch(() => null)
    : null;
  const authorName =
    profile?.nickname?.trim() ||
    persistedProfile?.nickname?.trim() ||
    profile?.name?.trim() ||
    persistedProfile?.name?.trim();
  const authorRole = role || persistedProfile?.role || null;

  if (!authorName || !authorRole) {
    throw new Error('프로필 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
  }

  return {
    ...actor,
    authorName,
    authorRole,
  };
}

function useBoardQueryAuthEnabled(userId?: string | null): boolean {
  const needsServerReconcile = useAuthStore(selectNeedsServerReconcile);
  const bootstrapSource = useAuthStore(selectBootstrapSource);

  return isBoardQueryAuthReady({
    userId,
    bootstrapSource,
    needsServerReconcile,
  });
}

export function useBoardHome() {
  const { user, role, isAdmin } = useAuth();
  const isBoardQueryEnabled = useBoardQueryAuthEnabled(user?.uid);

  return useQuery({
    queryKey: queryKeys.boards.home(user?.uid, role ?? undefined, isAdmin),
    queryFn: () =>
      getBoardHomeData({
        userId: user?.uid,
        role,
        isAdmin,
      }),
    staleTime: 60 * 1000,
    enabled: isBoardQueryEnabled,
  });
}

export function useBoardPosts(boardType: BoardType, limitCount?: number) {
  const { user, role, isAdmin } = useAuth();
  const isBoardQueryEnabled = useBoardQueryAuthEnabled(user?.uid);

  return useQuery({
    queryKey: queryKeys.boards.list(boardType, user?.uid, role ?? undefined, isAdmin, limitCount),
    queryFn: () =>
      fetchBoardPosts({
        boardType,
        viewerId: user?.uid,
        viewerRole: role,
        isAdmin,
        limitCount,
      }),
    enabled: isBoardQueryEnabled,
    staleTime: 60 * 1000,
  });
}

export function useBoardPostDetail(postId: string, enabled = true) {
  const { user, role, isAdmin } = useAuth();
  const isBoardQueryEnabled = useBoardQueryAuthEnabled(user?.uid);

  return useQuery({
    queryKey: queryKeys.boards.detail(postId, user?.uid, role ?? undefined, isAdmin),
    queryFn: () =>
      getBoardPostDetail(postId, {
        userId: user?.uid,
        role,
        isAdmin,
      }),
    enabled: enabled && !!postId && isBoardQueryEnabled,
    staleTime: 30 * 1000,
  });
}

export function useBoardMentionCandidates(postId: string, enabled = true) {
  const { user, role, isAdmin } = useAuth();
  const isBoardQueryEnabled = useBoardQueryAuthEnabled(user?.uid);

  return useQuery({
    queryKey: queryKeys.boards.mentionCandidates(postId, user?.uid, role ?? undefined, isAdmin),
    queryFn: () =>
      getBoardMentionCandidates(postId, {
        userId: user?.uid,
        role,
        isAdmin,
      }),
    enabled: enabled && !!postId && isBoardQueryEnabled,
    staleTime: 60 * 1000,
  });
}

export function useIncrementBoardViewCount() {
  return useMutation({
    mutationFn: (postId: string) => incrementBoardPostViewCount(postId),
    onError: (error) => {
      logger.warn('Board view count increment failed', {
        component: 'useBoard',
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
}

export function useCreateBoardPost() {
  const { user, profile, role } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async (
      input: Omit<CreateBoardPostInput, 'authorId' | 'authorName' | 'authorRole'>
    ) => {
      const actor = await requireBoardAuthorIdentity(user, profile, role);

      return createBoardPost(actor.userId, actor.authorName, actor.authorRole, {
        ...input,
        authorId: actor.userId,
        authorName: actor.authorName,
        authorRole: actor.authorRole,
      });
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '게시글을 등록했습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '게시글 등록에 실패했습니다.'),
      });
    },
  });
}

export function useUpdateBoardPost(postId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (input: UpdateBoardPostInput) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return updateBoardPost(postId, actor, input);
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '게시글을 수정했습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '게시글 수정에 실패했습니다.'),
      });
    },
  });
}

export function useSetBoardPostLock(postId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (isLocked: boolean) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return setBoardPostLock(postId, actor, isLocked);
    },
    onMutate: async (isLocked) => {
      await Promise.all([
        queryClient.cancelQueries({
          predicate: (query) => isBoardDetailQueryKey(query.queryKey, postId),
        }),
        queryClient.cancelQueries({
          predicate: (query) => isBoardListQueryKey(query.queryKey),
        }),
        queryClient.cancelQueries({
          predicate: (query) => isBoardHomeQueryKey(query.queryKey),
        }),
      ]);

      const context: BoardPostLockMutationContext = {
        detailSnapshots: queryClient.getQueriesData<BoardPostDetailQueryData>({
          predicate: (query) => isBoardDetailQueryKey(query.queryKey, postId),
        }),
        listSnapshots: queryClient.getQueriesData<BoardPostListQueryData>({
          predicate: (query) => isBoardListQueryKey(query.queryKey),
        }),
        homeSnapshots: queryClient.getQueriesData<BoardHomeQueryData>({
          predicate: (query) => isBoardHomeQueryKey(query.queryKey),
        }),
      };

      updateBoardLockCaches(postId, isLocked, user?.uid);

      return context;
    },
    onSuccess: async (_, isLocked) => {
      updateBoardLockCaches(postId, isLocked, user?.uid);
      await queryClient.invalidateQueries({ queryKey: queryKeys.boards.all });
      addToast({
        type: 'success',
        message: isLocked ? '게시글을 잠갔습니다.' : '게시글 잠금을 해제했습니다.',
      });
    },
    onError: (error, _variables, context) => {
      restoreBoardPostLockCaches(context);
      addToast({
        type: 'error',
        message: toErrorMessage(error, '게시글 잠금 변경에 실패했습니다.'),
      });
    },
  });
}

export function useHideBoardPost(postId: string) {
  const { user } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: () => {
      const actor = requireBoardMutationActor(user);
      return hideBoardPost(postId, actor.userId);
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '게시글을 숨겼습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '게시글 숨김에 실패했습니다.'),
      });
    },
  });
}

export function useCreateBoardComment(postId: string) {
  const { user, profile, role, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async (
      input: Omit<CreateBoardCommentInput, 'postId' | 'authorId' | 'authorName' | 'authorRole'>
    ) => {
      const actor = await requireBoardAuthorIdentity(user, profile, role, isAdmin);

      return createBoardComment(
        { userId: actor.userId, isAdmin: actor.isAdmin },
        actor.authorName,
        actor.authorRole,
        {
          ...input,
          postId,
          authorId: actor.userId,
          authorName: actor.authorName,
          authorRole: actor.authorRole,
        }
      );
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '댓글을 등록했습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 등록에 실패했습니다.'),
      });
    },
  });
}

export function useUpdateBoardComment(postId: string, commentId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (input: UpdateBoardCommentInput) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return updateBoardComment(postId, commentId, actor, input);
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '댓글을 수정했습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 수정에 실패했습니다.'),
      });
    },
  });
}

export function useBoardCommentMutations(postId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  const updateMutation = useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: UpdateBoardCommentInput }) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return updateBoardComment(postId, commentId, actor, input);
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '댓글을 수정했어요.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 수정에 실패했습니다.'),
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ commentId, status }: { commentId: string; status: 'hidden' | 'deleted' }) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return setBoardCommentStatus(postId, commentId, actor, status);
    },
    onSuccess: (_, variables) => {
      invalidateQueries.boards();
      addToast({
        type: 'success',
        message: variables.status === 'hidden' ? '댓글을 숨겼어요.' : '댓글을 삭제했어요.',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 상태 변경에 실패했습니다.'),
      });
    },
  });

  const pinnedMutation = useMutation({
    mutationFn: ({ commentId }: { commentId: string }) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return setBoardCommentPinned(postId, commentId, actor);
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '댓글 고정 상태를 변경했어요.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 고정 상태 변경에 실패했습니다.'),
      });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ commentId, type }: { commentId: string; type: CommentReactionType }) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return toggleBoardCommentReaction(postId, commentId, actor, type);
    },
    onSuccess: () => {
      invalidateQueries.boards();
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 반응 변경에 실패했습니다.'),
      });
    },
  });

  return {
    updateComment: updateMutation,
    setStatus: statusMutation,
    setPinned: pinnedMutation,
    toggleReaction: reactionMutation,
  };
}

export function useSetBoardCommentStatus(postId: string, commentId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (status: 'hidden' | 'deleted') => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return setBoardCommentStatus(postId, commentId, actor, status);
    },
    onSuccess: (_, status) => {
      invalidateQueries.boards();
      addToast({
        type: 'success',
        message: status === 'hidden' ? '댓글을 숨겼습니다.' : '댓글을 삭제했습니다.',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 상태 변경에 실패했습니다.'),
      });
    },
  });
}

export function useSetBoardCommentPinned(postId: string, commentId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: () => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return setBoardCommentPinned(postId, commentId, actor);
    },
    onSuccess: () => {
      invalidateQueries.boards();
      addToast({ type: 'success', message: '댓글 고정 상태를 변경했습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 고정 상태 변경에 실패했습니다.'),
      });
    },
  });
}

interface BoardVoteMutationContext {
  detailSnapshots: [readonly unknown[], BoardPostDetailQueryData | undefined][];
}

// like/dislike 토글 결과를 detail 캐시에 낙관적으로 반영. 같은 타입 재탭=취소,
// 반대 타입=전환(상대 카운트 -1). 카운트는 음수 방지.
function applyBoardVoteToggle(
  data: BoardPostDetailQueryData,
  type: BoardVoteType
): BoardPostDetailQueryData {
  const prev = data.myVote ?? null;
  let likeDelta = 0;
  let dislikeDelta = 0;
  let nextVote: BoardPostDetailQueryData['myVote'];

  if (prev === type) {
    nextVote = null;
    if (type === 'like') likeDelta = -1;
    else dislikeDelta = -1;
  } else {
    nextVote = type;
    if (type === 'like') {
      likeDelta = 1;
      if (prev === 'dislike') dislikeDelta = -1;
    } else {
      dislikeDelta = 1;
      if (prev === 'like') likeDelta = -1;
    }
  }

  return {
    ...data,
    myVote: nextVote,
    post: {
      ...data.post,
      likeCount: Math.max(0, data.post.likeCount + likeDelta),
      dislikeCount: Math.max(0, data.post.dislikeCount + dislikeDelta),
    },
  };
}

function updateBoardVoteCaches(postId: string, type: BoardVoteType) {
  queryClient.setQueriesData<BoardPostDetailQueryData>(
    { predicate: (query) => isBoardDetailQueryKey(query.queryKey, postId) },
    (current) => {
      if (!current || current.post.id !== postId) {
        return current;
      }
      return applyBoardVoteToggle(current, type);
    }
  );
}

export function useToggleBoardPostVote(postId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (type: BoardVoteType) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return toggleBoardPostVote(postId, actor, type);
    },
    // 낙관적 업데이트: 좋아요/싫어요 탭 즉시 버튼 색·카운트 반영(서버 refetch 대기 제거).
    onMutate: async (type) => {
      await queryClient.cancelQueries({
        predicate: (query) => isBoardDetailQueryKey(query.queryKey, postId),
      });
      const detailSnapshots = queryClient.getQueriesData<BoardPostDetailQueryData>({
        predicate: (query) => isBoardDetailQueryKey(query.queryKey, postId),
      });
      updateBoardVoteCaches(postId, type);
      return { detailSnapshots } satisfies BoardVoteMutationContext;
    },
    onSuccess: () => {
      invalidateQueries.boards();
    },
    onError: (error, _type, context) => {
      // 롤백 후 서버 기준 재동기화는 detail 무효화로 처리(invalidateQueries.boards 미호출 →
      // 실패 시 낙관값만 되돌리고 다음 상호작용/포커스에서 정합).
      context?.detailSnapshots.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      addToast({
        type: 'error',
        message: toErrorMessage(error, '게시글 반응 변경에 실패했습니다.'),
      });
    },
  });
}

export function useToggleBoardCommentReaction(postId: string, commentId: string) {
  const { user, isAdmin } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (type: CommentReactionType) => {
      const actor = requireBoardMutationActor(user, isAdmin);
      return toggleBoardCommentReaction(postId, commentId, actor, type);
    },
    onSuccess: () => {
      invalidateQueries.boards();
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '댓글 반응 변경에 실패했습니다.'),
      });
    },
  });
}

export function useCreateBoardReport() {
  const { user } = useAuth();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: (input: Omit<CreateBoardReportInput, 'reporterId'>) => {
      const actor = requireBoardMutationActor(user);

      return createBoardReport({
        ...input,
        reporterId: actor.userId,
      });
    },
    onSuccess: () => {
      addToast({ type: 'success', message: '신고가 접수되었습니다.' });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: toErrorMessage(error, '신고 접수에 실패했습니다.'),
      });
    },
  });
}
