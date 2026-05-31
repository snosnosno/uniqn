/**
 * UNIQN Mobile - Board Repository Helpers
 *
 * @description BoardRepository에서 사용하는 상수, Zod 스키마, 매핑 함수, 헬퍼 유틸리티
 */

import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleSupabaseError, safeParseJson } from '@/utils/supabase';
import { BoardJobSummarySchema } from '@/schemas/boardMetadata.schema';
import type {
  BoardAuthorRole,
  BoardComment,
  BoardMembership,
  BoardPost,
  BoardPostStatus,
  BoardReport,
  BoardVoteType,
  CommentReactionType,
} from '@/types/board';

// ============================================================================
// Constants
// ============================================================================

export const TABLES = {
  BOARD_POSTS: 'board_posts',
  BOARD_COMMENTS: 'board_comments',
  BOARD_VOTES: 'board_votes',
  BOARD_COMMENT_REACTIONS: 'board_comment_reactions',
  BOARD_MEMBERSHIPS: 'board_memberships',
  BOARD_REPORTS: 'board_reports',
} as const;

export const POST_COLUMNS =
  'id,announcement_category,author_id,author_name,author_role,board_type,body,comment_count,created_at,dislike_count,image_attachments,is_auto_created,is_locked,is_pinned,job_summary,last_activity_at,like_count,linked_job_posting_id,locked_at,locked_by,source,status,title,updated_at,view_count,visibility' as const;
export const COMMENT_COLUMNS =
  'id,author_id,author_name,author_role,body,created_at,image_attachments,is_pinned,mentioned_user_ids,parent_comment_id,pinned_at,pinned_by,post_id,reaction_counts,status,updated_at' as const;
export const MEMBERSHIP_COLUMNS =
  'id,author_id,board_type,can_comment,can_read,created_at,display_name,job_posting_id,last_activity_at,post_id,role,title,updated_at,user_id,work_date' as const;
export const REPORT_COLUMNS =
  'id,created_at,details,post_id,reason,reporter_id,resolved_at,resolved_by,status,target_id,target_type,updated_at' as const;
export const VOTE_COLUMNS = 'id,created_at,post_id,type,user_id' as const;

// ============================================================================
// Json Field Zod Schemas
// ============================================================================

const boardImageAttachmentSchema = z.object({
  id: z.string(),
  url: z.string(),
  storagePath: z.string(),
  order: z.number(),
  // impeccable v2 §18 — blurhash placeholder. 레거시 데이터 호환을 위해 optional.
  blurhash: z.string().nullable().optional(),
});

const boardImageAttachmentsSchema = z.array(boardImageAttachmentSchema);

const reactionCountsSchema = z.record(z.string(), z.number());

// board_posts.job_summary JSONB 필드 Zod 스키마
// (외부에서 재사용 가능하도록 @/schemas/boardMetadata.schema로 추출)
const boardJobSummarySchema = BoardJobSummarySchema;

// ============================================================================
// Mapping Functions
// ============================================================================

export function toBoardPost(row: Record<string, unknown>): BoardPost {
  return {
    id: row.id as string,
    boardType: row.board_type as BoardPost['boardType'],
    source: (row.source as BoardPost['source']) ?? 'board',
    title: row.title as string,
    body: row.body as string,
    authorId: row.author_id as string,
    authorName: row.author_name as string,
    authorRole: row.author_role as BoardAuthorRole,
    visibility: row.visibility as BoardPost['visibility'],
    status: row.status as BoardPostStatus,
    linkedJobPostingId: (row.linked_job_posting_id as string) ?? null,
    isAutoCreated: (row.is_auto_created as boolean) ?? false,
    isLocked: (row.is_locked as boolean) ?? false,
    lockedBy: (row.locked_by as string) ?? null,
    lockedAt: row.locked_at ? new Date(row.locked_at as string) : null,
    likeCount: (row.like_count as number) ?? 0,
    dislikeCount: (row.dislike_count as number) ?? 0,
    commentCount: (row.comment_count as number) ?? 0,
    viewCount: (row.view_count as number) ?? 0,
    imageAttachments: safeParseJson(
      boardImageAttachmentsSchema,
      row.image_attachments,
      [],
      'board_post.image_attachments'
    ),
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at as string) : null,
    announcementCategory: row.announcement_category as BoardPost['announcementCategory'],
    isPinned: (row.is_pinned as boolean) ?? false,
    jobSummary: row.job_summary
      ? (safeParseJson(
          boardJobSummarySchema,
          row.job_summary,
          undefined,
          'board_post.job_summary'
        ) as BoardPost['jobSummary'])
      : undefined,
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

export function toBoardComment(row: Record<string, unknown>): BoardComment {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    parentCommentId: (row.parent_comment_id as string) ?? null,
    body: (row.body as string) ?? '',
    authorId: row.author_id as string,
    authorName: row.author_name as string,
    authorRole: row.author_role as BoardAuthorRole,
    mentionedUserIds: (row.mentioned_user_ids as string[]) ?? [],
    reactionCounts: safeParseJson(
      reactionCountsSchema,
      row.reaction_counts,
      {},
      'board_comment.reaction_counts'
    ),
    isPinned: (row.is_pinned as boolean) ?? false,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at as string) : null,
    pinnedBy: (row.pinned_by as string) ?? null,
    status: (row.status as BoardComment['status']) ?? 'active',
    imageAttachments: safeParseJson(
      boardImageAttachmentsSchema,
      row.image_attachments,
      [],
      'board_comment.image_attachments'
    ),
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

export function toBoardMembership(row: Record<string, unknown>): BoardMembership {
  return {
    id: row.id as string,
    boardType: row.board_type as BoardMembership['boardType'],
    userId: row.user_id as string,
    postId: row.post_id as string,
    jobPostingId: row.job_posting_id as string,
    role: row.role as BoardMembership['role'],
    displayName: (row.display_name as string) ?? undefined,
    canRead: (row.can_read as boolean) ?? false,
    canComment: (row.can_comment as boolean) ?? false,
    title: (row.title as string) ?? '',
    workDate: (row.work_date as string) ?? '',
    authorId: (row.author_id as string) ?? '',
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at as string) : null,
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

export function toBoardReport(row: Record<string, unknown>): BoardReport {
  return {
    id: row.id as string,
    targetType: row.target_type as BoardReport['targetType'],
    targetId: row.target_id as string,
    postId: row.post_id as string,
    reporterId: row.reporter_id as string,
    reason: row.reason as BoardReport['reason'],
    details: row.details as string,
    status: row.status as BoardReport['status'],
    resolvedBy: (row.resolved_by as string) ?? null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
    createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
  };
}

// ============================================================================
// Utility Helpers
// ============================================================================

export function getMembershipId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

/**
 * 캐치 블록 공통 처리: AppError는 그대로 전파하고, 그 외 오류는 로깅 후
 * handleSupabaseError로 위임한다. handleSupabaseError가 항상 throw하므로
 * 반환 타입은 never.
 */
export function rethrowRepositoryError(
  error: unknown,
  logMessage: string,
  operation: string,
  table: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(logMessage, toError(error), context);
  handleSupabaseError(error, { operation, table });
  // handleSupabaseError는 항상 throw하지만 타입 시스템상 도달 불가 보장을 위해 재throw
  throw error;
}

// ============================================================================
// Vote Fallback
// ============================================================================

export async function togglePostVoteFallback(
  postId: string,
  userId: string,
  type: BoardVoteType
): Promise<BoardVoteType | null> {
  const now = new Date().toISOString();
  const voteCtx = { operation: '게시글 투표', table: TABLES.BOARD_VOTES };
  const postCtx = { operation: '게시글 카운트', table: TABLES.BOARD_POSTS };

  const { data: existing, error: selectError } = await supabase
    .from(TABLES.BOARD_VOTES)
    .select('type')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) handleSupabaseError(selectError, voteCtx);

  const previousType = existing
    ? ((existing as Record<string, unknown>).type as BoardVoteType)
    : null;

  if (previousType === type) {
    const { error: deleteError } = await supabase
      .from(TABLES.BOARD_VOTES)
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (deleteError) handleSupabaseError(deleteError, voteCtx);

    const { data: postData, error: postSelectError } = await supabase
      .from(TABLES.BOARD_POSTS)
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();
    if (postSelectError) handleSupabaseError(postSelectError, postCtx);

    if (postData) {
      const row = postData as Record<string, unknown>;
      const countField = type === 'like' ? 'like_count' : 'dislike_count';
      const { error: postUpdateError } = await supabase
        .from(TABLES.BOARD_POSTS)
        .update({
          [countField]: Math.max(0, ((row[countField] as number) ?? 0) - 1),
          updated_at: now,
        })
        .eq('id', postId);
      if (postUpdateError) handleSupabaseError(postUpdateError, postCtx);
    }

    return null;
  }

  if (previousType) {
    const { error: updateError } = await supabase
      .from(TABLES.BOARD_VOTES)
      .update({ type })
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (updateError) handleSupabaseError(updateError, voteCtx);

    const { data: postData, error: postSelectError } = await supabase
      .from(TABLES.BOARD_POSTS)
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();
    if (postSelectError) handleSupabaseError(postSelectError, postCtx);

    if (postData) {
      const row = postData as Record<string, unknown>;
      const prevField = previousType === 'like' ? 'like_count' : 'dislike_count';
      const newField = type === 'like' ? 'like_count' : 'dislike_count';
      const { error: postUpdateError } = await supabase
        .from(TABLES.BOARD_POSTS)
        .update({
          [prevField]: Math.max(0, ((row[prevField] as number) ?? 0) - 1),
          [newField]: ((row[newField] as number) ?? 0) + 1,
          updated_at: now,
        })
        .eq('id', postId);
      if (postUpdateError) handleSupabaseError(postUpdateError, postCtx);
    }
  } else {
    const { error: insertError } = await supabase.from(TABLES.BOARD_VOTES).insert({
      post_id: postId,
      user_id: userId,
      type,
      created_at: now,
    });
    if (insertError) handleSupabaseError(insertError, voteCtx);

    const { data: postData, error: postSelectError } = await supabase
      .from(TABLES.BOARD_POSTS)
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();
    if (postSelectError) handleSupabaseError(postSelectError, postCtx);

    if (postData) {
      const row = postData as Record<string, unknown>;
      const countField = type === 'like' ? 'like_count' : 'dislike_count';
      const { error: postUpdateError } = await supabase
        .from(TABLES.BOARD_POSTS)
        .update({
          [countField]: ((row[countField] as number) ?? 0) + 1,
          updated_at: now,
        })
        .eq('id', postId);
      if (postUpdateError) handleSupabaseError(postUpdateError, postCtx);
    }
  }

  return type;
}

// ============================================================================
// Comment Reaction Fallback
// ============================================================================

export async function toggleCommentReactionFallback(
  postId: string,
  commentId: string,
  userId: string,
  type: CommentReactionType
): Promise<CommentReactionType | null> {
  const now = new Date().toISOString();
  const reactionCtx = { operation: '댓글 감정표현', table: TABLES.BOARD_COMMENT_REACTIONS };
  const commentCtx = { operation: '댓글 카운트', table: TABLES.BOARD_COMMENTS };

  const { data: existing, error: selectError } = await supabase
    .from(TABLES.BOARD_COMMENT_REACTIONS)
    .select('type')
    .eq('post_id', postId)
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (selectError) handleSupabaseError(selectError, reactionCtx);

  const previousType = existing
    ? ((existing as Record<string, unknown>).type as CommentReactionType)
    : null;

  const { data: commentData, error: commentSelectError } = await supabase
    .from(TABLES.BOARD_COMMENTS)
    .select('reaction_counts')
    .eq('id', commentId)
    .single();
  if (commentSelectError) handleSupabaseError(commentSelectError, commentCtx);

  const reactionCounts = commentData
    ? (((commentData as Record<string, unknown>).reaction_counts as Record<string, number>) ?? {})
    : {};

  if (previousType === type) {
    const { error: deleteError } = await supabase
      .from(TABLES.BOARD_COMMENT_REACTIONS)
      .delete()
      .eq('post_id', postId)
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (deleteError) handleSupabaseError(deleteError, reactionCtx);

    const { error: commentUpdateError } = await supabase
      .from(TABLES.BOARD_COMMENTS)
      .update({
        reaction_counts: {
          ...reactionCounts,
          [type]: Math.max(0, (reactionCounts[type] ?? 0) - 1),
        },
        updated_at: now,
      })
      .eq('id', commentId);
    if (commentUpdateError) handleSupabaseError(commentUpdateError, commentCtx);

    return null;
  }

  if (previousType) {
    const { error: updateError } = await supabase
      .from(TABLES.BOARD_COMMENT_REACTIONS)
      .update({ type })
      .eq('post_id', postId)
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (updateError) handleSupabaseError(updateError, reactionCtx);

    const { error: commentUpdateError } = await supabase
      .from(TABLES.BOARD_COMMENTS)
      .update({
        reaction_counts: {
          ...reactionCounts,
          [previousType]: Math.max(0, (reactionCounts[previousType] ?? 0) - 1),
          [type]: (reactionCounts[type] ?? 0) + 1,
        },
        updated_at: now,
      })
      .eq('id', commentId);
    if (commentUpdateError) handleSupabaseError(commentUpdateError, commentCtx);
  } else {
    const { error: insertError } = await supabase.from(TABLES.BOARD_COMMENT_REACTIONS).insert({
      post_id: postId,
      comment_id: commentId,
      user_id: userId,
      type,
      created_at: now,
    });
    if (insertError) handleSupabaseError(insertError, reactionCtx);

    const { error: commentUpdateError } = await supabase
      .from(TABLES.BOARD_COMMENTS)
      .update({
        reaction_counts: {
          ...reactionCounts,
          [type]: (reactionCounts[type] ?? 0) + 1,
        },
        updated_at: now,
      })
      .eq('id', commentId);
    if (commentUpdateError) handleSupabaseError(commentUpdateError, commentCtx);
  }

  return type;
}
