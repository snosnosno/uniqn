import { BusinessError, ERROR_CODES, PermissionError, ValidationError, isAppError } from '@/errors';
import { handleSilentError } from '@/errors/serviceErrorHandler';
import { useAuthStore } from '@/stores/authStore';
import { announcementRepository, boardRepository } from '@/repositories';
import { deleteMultipleBoardImages } from '@/services/auth/storageService';
import {
  type BoardAuthorRole,
  type BoardComment,
  type BoardImageAttachment,
  type BoardMentionCandidate,
  type BoardMembership,
  type BoardPost,
  type BoardVoteType,
  type CommentReactionType,
  type CreateBoardPostInput,
  buildBoardCommentTree,
  mapAnnouncementToBoardPost,
} from '@/types/board';
import { extractAnnouncementIdFromBoardPostId, isBoardNoticePostId } from '@/shared/board/boardIds';
import type { UserRole } from '@/types';
import { sanitizeInput, xssValidation } from '@/utils/security';
import { logger } from '@/utils/logger';

export const COMPONENT = 'boardService';

export const ACTIVE_POST_STATUSES = ['active', 'locked'] as const;
export const ADMIN_VISIBLE_POST_STATUSES = ['active', 'locked', 'hidden', 'archived'] as const;
export const MAX_BOARD_MENTIONS = 10;

export interface BoardViewer {
  userId?: string;
  role?: UserRole | null;
  isAdmin?: boolean;
}

export interface BoardPostDetail {
  post: BoardPost;
  comments: BoardComment[];
  commentTree: ReturnType<typeof buildBoardCommentTree>;
  membership: BoardMembership | null;
  myVote: BoardVoteType | null;
  myReactions: Record<string, CommentReactionType>;
}

export interface MentionCandidateSource {
  userId: string;
  displayName?: string | null;
  role: BoardAuthorRole;
  isAuthor?: boolean;
}

export function buildDisplayName(
  name?: string | null,
  nickname?: string | null,
  fallback = ''
): string {
  const trimmedName = name?.trim();
  const trimmedNickname = nickname?.trim();

  if (trimmedName && trimmedNickname && trimmedName !== trimmedNickname) {
    return `${trimmedName}(${trimmedNickname})`;
  }

  return trimmedName || trimmedNickname || fallback;
}

export function resolveMentionCandidates(
  candidates: MentionCandidateSource[]
): BoardMentionCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  const candidateMap = new Map<string, BoardMentionCandidate>();

  candidates.forEach((candidate) => {
    const userId = candidate.userId?.trim();
    if (!userId) {
      return;
    }

    const displayName = candidate.displayName?.trim() || `사용자 ${userId.slice(-4)}`;
    const existing = candidateMap.get(userId);

    if (existing?.isAuthor) {
      return;
    }

    candidateMap.set(userId, {
      userId,
      displayName,
      role: candidate.role,
      isAuthor: candidate.isAuthor ?? false,
    });
  });

  return [...candidateMap.values()].sort((left, right) => {
    if (left.isAuthor !== right.isAuthor) {
      return left.isAuthor ? -1 : 1;
    }

    return left.displayName.localeCompare(right.displayName, 'ko-KR');
  });
}

export function getBoardImageIdentity(image: BoardImageAttachment): string {
  return image.storagePath || image.url || image.id;
}

export function findRemovedBoardImages(
  previousImages: BoardImageAttachment[],
  nextImages?: BoardImageAttachment[]
): BoardImageAttachment[] {
  if (!nextImages) {
    return [];
  }

  const nextImageIds = new Set(nextImages.map(getBoardImageIdentity));
  return previousImages.filter((image) => !nextImageIds.has(getBoardImageIdentity(image)));
}

export async function cleanupBoardImages(
  images: BoardImageAttachment[],
  context: Record<string, unknown>
): Promise<void> {
  if (images.length === 0) {
    return;
  }

  try {
    await deleteMultipleBoardImages(images);
  } catch (error) {
    logger.warn('Board image cleanup failed', {
      component: COMPONENT,
      imageCount: images.length,
      error: error instanceof Error ? error.message : String(error),
      ...context,
    });
  }
}

export function normalizeMentionIds(mentionedUserIds?: string[]): string[] {
  const uniqueMentionIds = new Set<string>();

  (mentionedUserIds ?? []).forEach((mentionedUserId) => {
    const normalizedId = mentionedUserId.trim();
    if (normalizedId) {
      uniqueMentionIds.add(normalizedId);
    }
  });

  if (uniqueMentionIds.size > MAX_BOARD_MENTIONS) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `멘션은 최대 ${MAX_BOARD_MENTIONS}명까지 가능합니다.`,
    });
  }

  return [...uniqueMentionIds];
}

export function mapMembershipRoleToAuthorRole(role: BoardMembership['role']): BoardAuthorRole {
  if (role === 'author') {
    return 'employer';
  }

  if (role === 'admin') {
    return 'admin';
  }

  return 'staff';
}

export function assertSafeText(
  field: 'title' | 'body' | 'reason' | 'details',
  value: string,
  maxLength: number
) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      field,
      userMessage: `${field} 값이 필요합니다.`,
    });
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(ERROR_CODES.VALIDATION_MAX_LENGTH, {
      field,
      userMessage: `${field} 길이가 너무 깁니다.`,
    });
  }

  if (!xssValidation(trimmed)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      field,
      userMessage: '허용되지 않는 문자가 포함되어 있습니다.',
    });
  }
}

export function sanitizeBoardText(value: string): string {
  return sanitizeInput(value).trim();
}

export function assertImageLimit(count: number, maxCount: number) {
  if (count > maxCount) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `이미지는 최대 ${maxCount}개까지 첨부할 수 있습니다.`,
    });
  }
}

export function isSkippableBoardHomeSectionError(error: unknown): boolean {
  if (isAppError(error)) {
    return (
      error.code === ERROR_CODES.INFRA_PERMISSION_DENIED ||
      error.code === ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS
    );
  }

  return false;
}

export function handleBoardHomeSectionPermissionError(
  section: 'pinnedNotices' | 'recentSchedulePosts' | 'popularCommunityPosts',
  viewer: BoardViewer,
  error: unknown
) {
  const liveUserId = useAuthStore.getState().user?.uid ?? null;

  handleSilentError(error, {
    operation: '게시판 홈 섹션 스킵',
    component: COMPONENT,
    context: {
      section,
      viewerId: viewer.userId ?? null,
      viewerRole: viewer.role ?? null,
      isAdmin: viewer.isAdmin ?? false,
      liveUserId,
      liveUserMatchesViewer: !!viewer.userId && liveUserId === viewer.userId,
    },
  });
}

export async function resolveBoardHomeSection<T>(
  section: 'pinnedNotices' | 'recentSchedulePosts' | 'popularCommunityPosts',
  viewer: BoardViewer,
  resolver: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await resolver();
  } catch (error) {
    if (isSkippableBoardHomeSectionError(error)) {
      handleBoardHomeSectionPermissionError(section, viewer, error);
      return fallback;
    }

    throw error;
  }
}

export async function getBoardPostInternal(postId: string): Promise<BoardPost | null> {
  if (isBoardNoticePostId(postId)) {
    const announcement = await announcementRepository.getById(
      extractAnnouncementIdFromBoardPostId(postId)
    );
    return announcement ? mapAnnouncementToBoardPost(announcement) : null;
  }

  return boardRepository.getPostById(postId);
}

export async function getBoardPostOrThrow(
  postId: string,
  notFoundMessage = '게시글을 찾을 수 없습니다.'
): Promise<BoardPost> {
  const post = await getBoardPostInternal(postId);
  if (!post) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, { userMessage: notFoundMessage });
  }
  return post;
}

export async function getScheduleMembership(
  postId: string,
  viewerId?: string
): Promise<BoardMembership | null> {
  if (!viewerId) {
    return null;
  }

  return boardRepository.getMembership(postId, viewerId);
}

export async function assertCanViewPost(
  post: BoardPost,
  viewer: BoardViewer
): Promise<BoardMembership | null> {
  if (post.boardType === 'notice' || post.boardType === 'free' || post.boardType === 'tda') {
    return null;
  }

  if (!viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '일정게시판 접근 권한이 없습니다.',
    });
  }

  if (viewer.isAdmin || post.authorId === viewer.userId) {
    return null;
  }

  const membership = await getScheduleMembership(post.id, viewer.userId);
  if (!membership?.canRead) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '일정게시판 접근 권한이 없습니다.',
    });
  }

  return membership;
}

export async function assertCanInteractPost(
  post: BoardPost,
  viewer: BoardViewer
): Promise<BoardMembership | null> {
  if (!viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '로그인이 필요합니다.',
    });
  }

  if (post.boardType === 'notice') {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공지사항은 상호작용할 수 없습니다.',
    });
  }

  if (post.isLocked) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '잠긴 게시글입니다.',
    });
  }

  if (post.boardType !== 'schedule') {
    return null;
  }

  if (viewer.isAdmin || post.authorId === viewer.userId) {
    return null;
  }

  const membership = await getScheduleMembership(post.id, viewer.userId);
  if (!membership?.canComment) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '댓글 권한이 없습니다.',
    });
  }

  return membership;
}

export function assertCanManagePost(post: BoardPost, viewer: BoardViewer) {
  if (!viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '로그인이 필요합니다.',
    });
  }

  if (post.boardType === 'notice') {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공지사항은 이 작업을 지원하지 않습니다.',
    });
  }

  if (!viewer.isAdmin && post.authorId !== viewer.userId) {
    throw new PermissionError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '게시글 관리 권한이 없습니다.',
    });
  }
}

export function assertCanCreatePost(input: CreateBoardPostInput) {
  if (input.boardType !== 'free' && input.boardType !== 'tda' && input.boardType !== 'substitute') {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: '직접 작성할 수 없는 게시판입니다.',
    });
  }
}
