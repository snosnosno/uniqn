/**
 * UNIQN Mobile - Board Repository Helpers
 *
 * @description BoardRepository에서 사용하는 상수, Zod 스키마, 매핑 함수, 헬퍼 유틸리티
 */

import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { safeParseJson } from '@/utils/supabase';
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
});

const boardImageAttachmentsSchema = z.array(boardImageAttachmentSchema);

const reactionCountsSchema = z.record(z.string(), z.number());

const boardJobSummarySchema = z.object({
  jobPostingId: z.string(),
  title: z.string(),
  workDate: z.string(),
  workDates: z.array(z.string()).optional(),
  locationName: z.string().optional(),
  totalPositions: z.number().optional(),
  filledPositions: z.number().optional(),
  compensationLabel: z.string().optional(),
  jobPostingStatus: z.string().optional(),
});

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

// ============================================================================
// Vote Fallback
// ============================================================================

export async function togglePostVoteFallback(
  postId: string,
  userId: string,
  type: BoardVoteType
): Promise<BoardVoteType | null> {
  const now = new Date().toISOString();

  // 기존 투표 조회
  const { data: existing } = await supabase
    .from(TABLES.BOARD_VOTES)
    .select('type')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  const previousType = existing
    ? ((existing as Record<string, unknown>).type as BoardVoteType)
    : null;

  if (previousType === type) {
    // 동일 투표 → 취소
    await supabase.from(TABLES.BOARD_VOTES).delete().eq('post_id', postId).eq('user_id', userId);

    const { data: postData } = await supabase
      .from(TABLES.BOARD_POSTS)
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();

    if (postData) {
      const row = postData as Record<string, unknown>;
      const countField = type === 'like' ? 'like_count' : 'dislike_count';
      await supabase
        .from(TABLES.BOARD_POSTS)
        .update({
          [countField]: Math.max(0, ((row[countField] as number) ?? 0) - 1),
          updated_at: now,
        })
        .eq('id', postId);
    }

    return null;
  }

  if (previousType) {
    // 다른 투표 → 변경
    await supabase
      .from(TABLES.BOARD_VOTES)
      .update({ type, updated_at: now })
      .eq('post_id', postId)
      .eq('user_id', userId);

    const { data: postData } = await supabase
      .from(TABLES.BOARD_POSTS)
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();

    if (postData) {
      const row = postData as Record<string, unknown>;
      const prevField = previousType === 'like' ? 'like_count' : 'dislike_count';
      const newField = type === 'like' ? 'like_count' : 'dislike_count';
      await supabase
        .from(TABLES.BOARD_POSTS)
        .update({
          [prevField]: Math.max(0, ((row[prevField] as number) ?? 0) - 1),
          [newField]: ((row[newField] as number) ?? 0) + 1,
          updated_at: now,
        })
        .eq('id', postId);
    }
  } else {
    // 새 투표
    await supabase.from(TABLES.BOARD_VOTES).insert({
      post_id: postId,
      user_id: userId,
      type,
      created_at: now,
      updated_at: now,
    });

    const { data: postData } = await supabase
      .from(TABLES.BOARD_POSTS)
      .select('like_count, dislike_count')
      .eq('id', postId)
      .single();

    if (postData) {
      const row = postData as Record<string, unknown>;
      const countField = type === 'like' ? 'like_count' : 'dislike_count';
      await supabase
        .from(TABLES.BOARD_POSTS)
        .update({
          [countField]: ((row[countField] as number) ?? 0) + 1,
          updated_at: now,
        })
        .eq('id', postId);
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

  const { data: existing } = await supabase
    .from(TABLES.BOARD_COMMENT_REACTIONS)
    .select('type')
    .eq('post_id', postId)
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  const previousType = existing
    ? ((existing as Record<string, unknown>).type as CommentReactionType)
    : null;

  // 댓글의 reaction_counts 조회
  const { data: commentData } = await supabase
    .from(TABLES.BOARD_COMMENTS)
    .select('reaction_counts')
    .eq('id', commentId)
    .single();

  const reactionCounts = commentData
    ? (((commentData as Record<string, unknown>).reaction_counts as Record<string, number>) ?? {})
    : {};

  if (previousType === type) {
    // 동일 리액션 → 취소
    await supabase
      .from(TABLES.BOARD_COMMENT_REACTIONS)
      .delete()
      .eq('post_id', postId)
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    await supabase
      .from(TABLES.BOARD_COMMENTS)
      .update({
        reaction_counts: {
          ...reactionCounts,
          [type]: Math.max(0, (reactionCounts[type] ?? 0) - 1),
        },
        updated_at: now,
      })
      .eq('id', commentId);

    return null;
  }

  if (previousType) {
    // 다른 리액션 → 변경
    await supabase
      .from(TABLES.BOARD_COMMENT_REACTIONS)
      .update({ type, updated_at: now })
      .eq('post_id', postId)
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    await supabase
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
  } else {
    // 새 리액션
    await supabase.from(TABLES.BOARD_COMMENT_REACTIONS).insert({
      post_id: postId,
      comment_id: commentId,
      user_id: userId,
      type,
      created_at: now,
      updated_at: now,
    });

    await supabase
      .from(TABLES.BOARD_COMMENTS)
      .update({
        reaction_counts: {
          ...reactionCounts,
          [type]: (reactionCounts[type] ?? 0) + 1,
        },
        updated_at: now,
      })
      .eq('id', commentId);
  }

  return type;
}
