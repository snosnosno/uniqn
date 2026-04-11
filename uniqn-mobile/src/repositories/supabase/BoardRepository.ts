/**
 * UNIQN Mobile - Supabase Board Repository
 *
 * @description Supabase PostgREST 기반 Board Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 게시판 게시글/댓글/투표 CRUD
 * 2. 멤버십 관리 (스케줄 게시판)
 * 3. 신고 관리
 *
 * Note: Firebase 서브컬렉션(comments, votes, reactions) → 별도 PostgreSQL 테이블로 매핑
 */

import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleSupabaseError, runRpc, safeParseJson } from '@/utils/supabase';
import { buildScheduleBoardPostId } from '@/shared/board/boardIds';
import type {
  BoardAuthorRole,
  BoardComment,
  BoardCommentReaction,
  BoardMembership,
  BoardPost,
  BoardPostStatus,
  BoardReport,
  BoardVote,
  BoardVoteType,
  CommentReactionType,
  CreateBoardCommentInput,
  CreateBoardPostInput,
  CreateBoardReportInput,
  ScheduleBoardSyncInput,
  ScheduleMembershipSyncItem,
  UpdateBoardCommentInput,
  UpdateBoardPostInput,
} from '@/types/board';
import type {
  FetchBoardRepositoryPostsOptions,
  FetchBoardReportsOptions,
  FetchScheduleMembershipsOptions,
  IBoardRepository,
} from '../interfaces/IBoardRepository';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  BOARD_POSTS: 'board_posts',
  BOARD_COMMENTS: 'board_comments',
  BOARD_VOTES: 'board_votes',
  BOARD_COMMENT_REACTIONS: 'board_comment_reactions',
  BOARD_MEMBERSHIPS: 'board_memberships',
  BOARD_REPORTS: 'board_reports',
} as const;

const POST_COLUMNS =
  'id,announcement_category,author_id,author_name,author_role,board_type,body,comment_count,created_at,dislike_count,image_attachments,is_auto_created,is_locked,is_pinned,job_summary,last_activity_at,like_count,linked_job_posting_id,locked_at,locked_by,source,status,title,updated_at,view_count,visibility' as const;
const COMMENT_COLUMNS =
  'id,author_id,author_name,author_role,body,created_at,image_attachments,is_pinned,mentioned_user_ids,parent_comment_id,pinned_at,pinned_by,post_id,reaction_counts,status,updated_at' as const;
const MEMBERSHIP_COLUMNS =
  'id,author_id,board_type,can_comment,can_read,created_at,display_name,job_posting_id,last_activity_at,post_id,role,title,updated_at,user_id,work_date' as const;
const REPORT_COLUMNS =
  'id,created_at,details,post_id,reason,reporter_id,resolved_at,resolved_by,status,target_id,target_type,updated_at' as const;
const VOTE_COLUMNS = 'id,created_at,post_id,type,user_id' as const;

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
// Helpers
// ============================================================================

function toBoardPost(row: Record<string, unknown>): BoardPost {
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

function toBoardComment(row: Record<string, unknown>): BoardComment {
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

function toBoardMembership(row: Record<string, unknown>): BoardMembership {
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

function toBoardReport(row: Record<string, unknown>): BoardReport {
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

function getMembershipId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseBoardRepository implements IBoardRepository {
  // ==========================================================================
  // Post CRUD
  // ==========================================================================

  async getPostById(postId: string): Promise<BoardPost | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_POSTS)
        .select(POST_COLUMNS)
        .eq('id', postId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '게시글 조회', table: TABLES.BOARD_POSTS });
      }

      return data ? toBoardPost(data as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 조회 실패', toError(error), { postId });
      handleSupabaseError(error, { operation: '게시글 조회', table: TABLES.BOARD_POSTS });
    }
  }

  async getPosts(options: FetchBoardRepositoryPostsOptions = {}): Promise<BoardPost[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase.from(TABLES.BOARD_POSTS).select(POST_COLUMNS);

      if (options.boardTypes?.length === 1) {
        query = query.eq('board_type', options.boardTypes[0]);
      } else if ((options.boardTypes?.length ?? 0) > 1) {
        query = query.in('board_type', options.boardTypes!.slice(0, 10));
      }

      if (options.authorId) {
        query = query.eq('author_id', options.authorId);
      }

      if (options.linkedJobPostingId) {
        query = query.eq('linked_job_posting_id', options.linkedJobPostingId);
      }

      if (options.statuses?.length === 1) {
        query = query.eq('status', options.statuses[0]);
      } else if ((options.statuses?.length ?? 0) > 1) {
        query = query.in('status', options.statuses!.slice(0, 10));
      }

      if (options.onlyPinned) {
        query = query.eq('is_pinned', true);
      }

      const sortColumn = options.sortBy
        ? options.sortBy.replace(/([A-Z])/g, '_$1').toLowerCase()
        : 'last_activity_at';

      query = query.order(sortColumn, { ascending: options.sortDirection === 'asc' });

      if (options.limitCount) {
        query = query.limit(options.limitCount);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error, { operation: '게시글 목록 조회', table: TABLES.BOARD_POSTS });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(toBoardPost);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 목록 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '게시글 목록 조회', table: TABLES.BOARD_POSTS });
    }
  }

  async getPostsByIds(postIds: string[]): Promise<BoardPost[]> {
    if (postIds.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_POSTS)
        .select(POST_COLUMNS)
        .in('id', postIds);

      if (error) {
        handleSupabaseError(error, { operation: '게시글 배치 조회', table: TABLES.BOARD_POSTS });
      }

      const posts = ((data ?? []) as Record<string, unknown>[]).map(toBoardPost);
      const ordering = new Map(postIds.map((id, index) => [id, index]));
      return posts.sort(
        (left, right) => (ordering.get(left.id) ?? 0) - (ordering.get(right.id) ?? 0)
      );
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 배치 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '게시글 배치 조회', table: TABLES.BOARD_POSTS });
    }
  }

  async createPost(input: CreateBoardPostInput): Promise<string> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(TABLES.BOARD_POSTS)
        .insert({
          board_type: input.boardType,
          source: 'board',
          title: input.title,
          body: input.body,
          author_id: input.authorId,
          author_name: input.authorName,
          author_role: input.authorRole,
          visibility: 'public',
          status: 'active',
          linked_job_posting_id: null,
          is_auto_created: false,
          is_locked: false,
          like_count: 0,
          dislike_count: 0,
          comment_count: 0,
          view_count: 0,
          image_attachments: input.imageAttachments ?? [],
          last_activity_at: now,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error) {
        handleSupabaseError(error, { operation: '게시글 생성', table: TABLES.BOARD_POSTS });
      }

      const postId = (data as Record<string, unknown>).id as string;
      logger.info('Board post created', { component: 'BoardRepository', postId });
      return postId;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 생성 실패', toError(error));
      handleSupabaseError(error, { operation: '게시글 생성', table: TABLES.BOARD_POSTS });
    }
  }

  async updatePost(postId: string, input: UpdateBoardPostInput): Promise<void> {
    try {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        updated_at: now,
        last_activity_at: now,
      };

      if (input.title !== undefined) updates.title = input.title;
      if (input.body !== undefined) updates.body = input.body;
      if (input.imageAttachments !== undefined) updates.image_attachments = input.imageAttachments;

      const { error } = await supabase.from(TABLES.BOARD_POSTS).update(updates).eq('id', postId);

      if (error) {
        handleSupabaseError(error, { operation: '게시글 수정', table: TABLES.BOARD_POSTS });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 수정 실패', toError(error), { postId });
      handleSupabaseError(error, { operation: '게시글 수정', table: TABLES.BOARD_POSTS });
    }
  }

  async setPostStatus(postId: string, status: BoardPostStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.BOARD_POSTS)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', postId);

      if (error) {
        handleSupabaseError(error, { operation: '게시글 상태 변경', table: TABLES.BOARD_POSTS });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 상태 변경 실패', toError(error), { postId, status });
      handleSupabaseError(error, { operation: '게시글 상태 변경', table: TABLES.BOARD_POSTS });
    }
  }

  async setPostLock(postId: string, isLocked: boolean, actorId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLES.BOARD_POSTS)
        .update({
          is_locked: isLocked,
          status: isLocked ? 'locked' : 'active',
          locked_by: isLocked ? actorId : null,
          locked_at: isLocked ? now : null,
          updated_at: now,
        })
        .eq('id', postId);

      if (error) {
        handleSupabaseError(error, { operation: '게시글 잠금 설정', table: TABLES.BOARD_POSTS });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 잠금 설정 실패', toError(error), { postId, isLocked });
      handleSupabaseError(error, { operation: '게시글 잠금 설정', table: TABLES.BOARD_POSTS });
    }
  }

  async incrementViewCount(postId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_board_post_view_count', {
        p_post_id: postId,
      });

      if (error) {
        // RPC 미존재 시 폴백: select → update
        const { data } = await supabase
          .from(TABLES.BOARD_POSTS)
          .select('view_count')
          .eq('id', postId)
          .single();

        if (data) {
          await supabase
            .from(TABLES.BOARD_POSTS)
            .update({
              view_count: (((data as Record<string, unknown>).view_count as number) ?? 0) + 1,
            })
            .eq('id', postId);
        }
      }
    } catch (error) {
      // 조회수 증가 실패는 치명적이지 않음
      logger.error('조회수 증가 실패', toError(error), { postId });
    }
  }

  // ==========================================================================
  // Comment CRUD
  // ==========================================================================

  async getComments(postId: string): Promise<BoardComment[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_COMMENTS)
        .select(COMMENT_COLUMNS)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        handleSupabaseError(error, { operation: '댓글 조회', table: TABLES.BOARD_COMMENTS });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(toBoardComment);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('댓글 조회 실패', toError(error), { postId });
      handleSupabaseError(error, { operation: '댓글 조회', table: TABLES.BOARD_COMMENTS });
    }
  }

  async getCommentById(postId: string, commentId: string): Promise<BoardComment | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_COMMENTS)
        .select(COMMENT_COLUMNS)
        .eq('id', commentId)
        .eq('post_id', postId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '댓글 단건 조회', table: TABLES.BOARD_COMMENTS });
      }

      return data ? toBoardComment(data as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('댓글 단건 조회 실패', toError(error), { postId, commentId });
      handleSupabaseError(error, { operation: '댓글 단건 조회', table: TABLES.BOARD_COMMENTS });
    }
  }

  async createComment(input: CreateBoardCommentInput): Promise<string> {
    try {
      const now = new Date().toISOString();

      // 댓글 생성
      const { data, error } = await supabase
        .from(TABLES.BOARD_COMMENTS)
        .insert({
          post_id: input.postId,
          parent_comment_id: input.parentCommentId ?? null,
          body: input.body,
          author_id: input.authorId,
          author_name: input.authorName,
          author_role: input.authorRole,
          mentioned_user_ids: input.mentionedUserIds ?? [],
          reaction_counts: {},
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          status: 'active',
          image_attachments: input.imageAttachments ?? [],
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error) {
        handleSupabaseError(error, { operation: '댓글 생성', table: TABLES.BOARD_COMMENTS });
      }

      // 게시글 댓글 수 + 활동 시각 업데이트
      const { data: postData } = await supabase
        .from(TABLES.BOARD_POSTS)
        .select('comment_count')
        .eq('id', input.postId)
        .single();

      if (postData) {
        await supabase
          .from(TABLES.BOARD_POSTS)
          .update({
            comment_count:
              (((postData as Record<string, unknown>).comment_count as number) ?? 0) + 1,
            last_activity_at: now,
            updated_at: now,
          })
          .eq('id', input.postId);
      }

      return (data as Record<string, unknown>).id as string;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('댓글 생성 실패', toError(error), { postId: input.postId });
      handleSupabaseError(error, { operation: '댓글 생성', table: TABLES.BOARD_COMMENTS });
    }
  }

  async updateComment(
    postId: string,
    commentId: string,
    input: UpdateBoardCommentInput
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.body !== undefined) updates.body = input.body;
      if (input.imageAttachments !== undefined) updates.image_attachments = input.imageAttachments;

      const { error } = await supabase
        .from(TABLES.BOARD_COMMENTS)
        .update(updates)
        .eq('id', commentId)
        .eq('post_id', postId);

      if (error) {
        handleSupabaseError(error, { operation: '댓글 수정', table: TABLES.BOARD_COMMENTS });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('댓글 수정 실패', toError(error), { postId, commentId });
      handleSupabaseError(error, { operation: '댓글 수정', table: TABLES.BOARD_COMMENTS });
    }
  }

  async setCommentStatus(
    postId: string,
    commentId: string,
    status: BoardComment['status']
  ): Promise<void> {
    try {
      const placeholder =
        status === 'hidden' ? '관리자에 의해 숨김된 댓글입니다.' : '삭제된 댓글입니다.';
      const now = new Date().toISOString();

      // 댓글 현재 상태 확인
      const { data: commentData, error: fetchError } = await supabase
        .from(TABLES.BOARD_COMMENTS)
        .select('status')
        .eq('id', commentId)
        .eq('post_id', postId)
        .maybeSingle();

      if (fetchError) {
        handleSupabaseError(fetchError, {
          operation: '댓글 상태 조회',
          table: TABLES.BOARD_COMMENTS,
        });
      }

      if (!commentData) return;

      const previousStatus =
        ((commentData as Record<string, unknown>).status as string) ?? 'active';
      if (previousStatus !== 'active' || status === 'active') return;

      // 댓글 상태 변경
      const { error: updateError } = await supabase
        .from(TABLES.BOARD_COMMENTS)
        .update({
          status,
          body: placeholder,
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          image_attachments: [],
          mentioned_user_ids: [],
          updated_at: now,
        })
        .eq('id', commentId)
        .eq('post_id', postId);

      if (updateError) {
        handleSupabaseError(updateError, {
          operation: '댓글 상태 변경',
          table: TABLES.BOARD_COMMENTS,
        });
      }

      // 게시글 댓글 수 감소
      const { data: postData } = await supabase
        .from(TABLES.BOARD_POSTS)
        .select('comment_count')
        .eq('id', postId)
        .single();

      if (postData) {
        const currentCount = ((postData as Record<string, unknown>).comment_count as number) ?? 0;
        await supabase
          .from(TABLES.BOARD_POSTS)
          .update({
            comment_count: Math.max(0, currentCount - 1),
            last_activity_at: now,
            updated_at: now,
          })
          .eq('id', postId);
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('댓글 상태 변경 실패', toError(error), { postId, commentId, status });
      handleSupabaseError(error, { operation: '댓글 상태 변경', table: TABLES.BOARD_COMMENTS });
    }
  }

  async setCommentPinned(
    postId: string,
    commentId: string,
    isPinned: boolean,
    actorId: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLES.BOARD_COMMENTS)
        .update({
          is_pinned: isPinned,
          pinned_at: isPinned ? now : null,
          pinned_by: isPinned ? actorId : null,
          updated_at: now,
        })
        .eq('id', commentId)
        .eq('post_id', postId);

      if (error) {
        handleSupabaseError(error, { operation: '댓글 고정 설정', table: TABLES.BOARD_COMMENTS });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('댓글 고정 설정 실패', toError(error), { postId, commentId, isPinned });
      handleSupabaseError(error, { operation: '댓글 고정 설정', table: TABLES.BOARD_COMMENTS });
    }
  }

  // ==========================================================================
  // Vote (Post)
  // ==========================================================================

  async togglePostVote(
    postId: string,
    userId: string,
    type: BoardVoteType
  ): Promise<BoardVoteType | null> {
    try {
      // RPC로 원자적 토글 시도
      const result = await runRpc<{ result_type: string | null }>('toggle_board_post_vote', {
        p_post_id: postId,
        p_user_id: userId,
        p_vote_type: type,
      });

      return result.result_type as BoardVoteType | null;
    } catch (rpcError) {
      // RPC 미존재 시 폴백: 수동 처리
      logger.warn('toggle_board_post_vote RPC 실패, 폴백 처리', { postId, userId });

      return this.togglePostVoteFallback(postId, userId, type);
    }
  }

  private async togglePostVoteFallback(
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

  async getPostVote(postId: string, userId: string): Promise<BoardVote | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_VOTES)
        .select(VOTE_COLUMNS)
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '투표 조회', table: TABLES.BOARD_VOTES });
      }

      if (!data) return null;

      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        postId,
        userId,
        type: row.type as BoardVoteType,
        createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('투표 조회 실패', toError(error), { postId, userId });
      handleSupabaseError(error, { operation: '투표 조회', table: TABLES.BOARD_VOTES });
    }
  }

  // ==========================================================================
  // Comment Reaction
  // ==========================================================================

  async toggleCommentReaction(
    postId: string,
    commentId: string,
    userId: string,
    type: CommentReactionType
  ): Promise<CommentReactionType | null> {
    try {
      const result = await runRpc<{ result_type: string | null }>('toggle_comment_reaction', {
        p_post_id: postId,
        p_comment_id: commentId,
        p_user_id: userId,
        p_reaction_type: type,
      });

      return result.result_type as CommentReactionType | null;
    } catch (rpcError) {
      logger.warn('toggle_comment_reaction RPC 실패, 폴백 처리', { postId, commentId, userId });
      return this.toggleCommentReactionFallback(postId, commentId, userId, type);
    }
  }

  private async toggleCommentReactionFallback(
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

  async getCommentReaction(
    postId: string,
    commentId: string,
    userId: string
  ): Promise<BoardCommentReaction | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_COMMENT_REACTIONS)
        .select(POST_COLUMNS)
        .eq('post_id', postId)
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, {
          operation: '댓글 리액션 조회',
          table: TABLES.BOARD_COMMENT_REACTIONS,
        });
      }

      if (!data) return null;

      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        commentId,
        userId,
        type: row.type as CommentReactionType,
        createdAt: row.created_at ? new Date(row.created_at as string) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : undefined,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('댓글 리액션 조회 실패', toError(error), { postId, commentId, userId });
      handleSupabaseError(error, {
        operation: '댓글 리액션 조회',
        table: TABLES.BOARD_COMMENT_REACTIONS,
      });
    }
  }

  async getCommentReactionsByUser(
    postId: string,
    userId: string
  ): Promise<Record<string, CommentReactionType>> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_COMMENT_REACTIONS)
        .select('comment_id, type')
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        handleSupabaseError(error, {
          operation: '사용자 댓글 리액션 조회',
          table: TABLES.BOARD_COMMENT_REACTIONS,
        });
      }

      return ((data ?? []) as Record<string, unknown>[]).reduce<
        Record<string, CommentReactionType>
      >((acc, row) => {
        const commentId = row.comment_id as string;
        const reactionType = row.type as CommentReactionType;
        if (commentId && reactionType) {
          acc[commentId] = reactionType;
        }
        return acc;
      }, {});
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 댓글 리액션 조회 실패', toError(error), { postId, userId });
      handleSupabaseError(error, {
        operation: '사용자 댓글 리액션 조회',
        table: TABLES.BOARD_COMMENT_REACTIONS,
      });
    }
  }

  // ==========================================================================
  // Membership
  // ==========================================================================

  async getMembershipsByUser(
    userId: string,
    options: FetchScheduleMembershipsOptions = {}
  ): Promise<BoardMembership[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from(TABLES.BOARD_MEMBERSHIPS)
        .select(MEMBERSHIP_COLUMNS)
        .eq('user_id', userId)
        .eq('board_type', 'schedule');

      if (options.canReadOnly) {
        query = query.eq('can_read', true);
      }

      const sortColumn = options.sortBy === 'lastActivityAt' ? 'last_activity_at' : 'work_date';
      query = query.order(sortColumn, { ascending: options.sortDirection !== 'desc' });

      if (options.limitCount) {
        query = query.limit(options.limitCount);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error, {
          operation: '사용자 멤버십 조회',
          table: TABLES.BOARD_MEMBERSHIPS,
        });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(toBoardMembership);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 멤버십 조회 실패', toError(error), { userId });
      handleSupabaseError(error, {
        operation: '사용자 멤버십 조회',
        table: TABLES.BOARD_MEMBERSHIPS,
      });
    }
  }

  async getMembershipsByPost(postId: string): Promise<BoardMembership[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_MEMBERSHIPS)
        .select(MEMBERSHIP_COLUMNS)
        .eq('post_id', postId)
        .eq('board_type', 'schedule');

      if (error) {
        handleSupabaseError(error, {
          operation: '게시글 멤버십 조회',
          table: TABLES.BOARD_MEMBERSHIPS,
        });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(toBoardMembership);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 멤버십 조회 실패', toError(error), { postId });
      handleSupabaseError(error, {
        operation: '게시글 멤버십 조회',
        table: TABLES.BOARD_MEMBERSHIPS,
      });
    }
  }

  async getMembership(postId: string, userId: string): Promise<BoardMembership | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_MEMBERSHIPS)
        .select(MEMBERSHIP_COLUMNS)
        .eq('id', getMembershipId(postId, userId))
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '멤버십 조회', table: TABLES.BOARD_MEMBERSHIPS });
      }

      return data ? toBoardMembership(data as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('멤버십 조회 실패', toError(error), { postId, userId });
      handleSupabaseError(error, { operation: '멤버십 조회', table: TABLES.BOARD_MEMBERSHIPS });
    }
  }

  async replaceScheduleMemberships(
    postId: string,
    jobPostingId: string,
    members: ScheduleMembershipSyncItem[]
  ): Promise<void> {
    try {
      const now = new Date().toISOString();

      // 기존 멤버십 조회
      const { data: existingData, error: fetchError } = await supabase
        .from(TABLES.BOARD_MEMBERSHIPS)
        .select('id')
        .eq('post_id', postId)
        .eq('board_type', 'schedule');

      if (fetchError) {
        handleSupabaseError(fetchError, {
          operation: '멤버십 교체 조회',
          table: TABLES.BOARD_MEMBERSHIPS,
        });
      }

      const existingIds = new Set(
        ((existingData ?? []) as Record<string, unknown>[]).map((row) => row.id as string)
      );
      const incomingIds = new Set(members.map((m) => getMembershipId(postId, m.userId)));

      // 삭제 대상 (기존에 있지만 새 목록에 없는 것)
      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from(TABLES.BOARD_MEMBERSHIPS)
          .delete()
          .in('id', toDelete);

        if (deleteError) {
          handleSupabaseError(deleteError, {
            operation: '멤버십 삭제',
            table: TABLES.BOARD_MEMBERSHIPS,
          });
        }
      }

      // Upsert 새 멤버십
      if (members.length > 0) {
        const rows = members.map((member) => ({
          id: getMembershipId(postId, member.userId),
          board_type: 'schedule',
          user_id: member.userId,
          post_id: postId,
          job_posting_id: jobPostingId,
          role: member.role,
          display_name: member.displayName ?? null,
          can_read: member.canRead,
          can_comment: member.canComment,
          title: member.title,
          work_date: member.workDate,
          author_id: member.authorId,
          last_activity_at: member.lastActivityAt ?? now,
          updated_at: now,
        }));

        const { error: upsertError } = await supabase
          .from(TABLES.BOARD_MEMBERSHIPS)
          .upsert(rows, { onConflict: 'id' });

        if (upsertError) {
          handleSupabaseError(upsertError, {
            operation: '멤버십 upsert',
            table: TABLES.BOARD_MEMBERSHIPS,
          });
        }
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('멤버십 교체 실패', toError(error), { postId });
      handleSupabaseError(error, { operation: '멤버십 교체', table: TABLES.BOARD_MEMBERSHIPS });
    }
  }

  async upsertSchedulePost(input: ScheduleBoardSyncInput): Promise<string> {
    try {
      const postId = buildScheduleBoardPostId(input.jobPostingId);
      const now = new Date().toISOString();

      const payload = {
        id: postId,
        board_type: 'schedule',
        source: 'board',
        title: input.title,
        body: input.body,
        author_id: input.ownerId,
        author_name: input.ownerName,
        author_role: input.ownerRole,
        visibility: 'participants_only',
        linked_job_posting_id: input.jobPostingId,
        is_auto_created: true,
        image_attachments: [],
        last_activity_at: now,
        updated_at: now,
        job_summary: {
          jobPostingId: input.jobPostingId,
          title: input.title,
          workDate: input.workDate,
          workDates: input.workDates ?? [],
          locationName: input.locationName ?? '',
          totalPositions: input.totalPositions ?? 0,
          filledPositions: input.filledPositions ?? 0,
          compensationLabel: input.compensationLabel ?? '',
          jobPostingStatus: input.jobPostingStatus ?? '',
        },
      };

      // 기존 게시글 존재 여부 확인
      const { data: existing } = await supabase
        .from(TABLES.BOARD_POSTS)
        .select('id')
        .eq('id', postId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from(TABLES.BOARD_POSTS).update(payload).eq('id', postId);

        if (error) {
          handleSupabaseError(error, {
            operation: '스케줄 게시글 업데이트',
            table: TABLES.BOARD_POSTS,
          });
        }
      } else {
        const { error } = await supabase.from(TABLES.BOARD_POSTS).insert({
          ...payload,
          status: 'active',
          is_locked: false,
          locked_by: null,
          locked_at: null,
          like_count: 0,
          dislike_count: 0,
          comment_count: 0,
          view_count: 0,
          created_at: now,
        });

        if (error) {
          handleSupabaseError(error, {
            operation: '스케줄 게시글 생성',
            table: TABLES.BOARD_POSTS,
          });
        }
      }

      return postId;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('스케줄 게시글 upsert 실패', toError(error), {
        jobPostingId: input.jobPostingId,
      });
      handleSupabaseError(error, { operation: '스케줄 게시글 upsert', table: TABLES.BOARD_POSTS });
    }
  }

  // ==========================================================================
  // Report
  // ==========================================================================

  async createReport(input: CreateBoardReportInput): Promise<string> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from(TABLES.BOARD_REPORTS)
        .insert({
          target_type: input.targetType,
          target_id: input.targetId,
          post_id: input.postId,
          reporter_id: input.reporterId,
          reason: input.reason,
          details: input.details,
          status: 'pending',
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error) {
        handleSupabaseError(error, { operation: '신고 생성', table: TABLES.BOARD_REPORTS });
      }

      return (data as Record<string, unknown>).id as string;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('신고 생성 실패', toError(error));
      handleSupabaseError(error, { operation: '신고 생성', table: TABLES.BOARD_REPORTS });
    }
  }

  async getReportById(reportId: string): Promise<BoardReport | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_REPORTS)
        .select(REPORT_COLUMNS)
        .eq('id', reportId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '신고 조회', table: TABLES.BOARD_REPORTS });
      }

      return data ? toBoardReport(data as Record<string, unknown>) : null;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('신고 조회 실패', toError(error), { reportId });
      handleSupabaseError(error, { operation: '신고 조회', table: TABLES.BOARD_REPORTS });
    }
  }

  async getReports(options: FetchBoardReportsOptions = {}): Promise<BoardReport[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from(TABLES.BOARD_REPORTS)
        .select(REPORT_COLUMNS)
        .order('created_at', { ascending: false });

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      if (options.limitCount) {
        query = query.limit(options.limitCount);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error, { operation: '신고 목록 조회', table: TABLES.BOARD_REPORTS });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(toBoardReport);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('신고 목록 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '신고 목록 조회', table: TABLES.BOARD_REPORTS });
    }
  }

  async getReportsByPostId(postId: string): Promise<BoardReport[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BOARD_REPORTS)
        .select(REPORT_COLUMNS)
        .eq('post_id', postId);

      if (error) {
        handleSupabaseError(error, {
          operation: '게시글 신고 조회',
          table: TABLES.BOARD_REPORTS,
        });
      }

      return ((data ?? []) as Record<string, unknown>[]).map(toBoardReport);
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('게시글 신고 조회 실패', toError(error), { postId });
      handleSupabaseError(error, { operation: '게시글 신고 조회', table: TABLES.BOARD_REPORTS });
    }
  }

  async reviewReport(
    reportId: string,
    status: Extract<BoardReport['status'], 'resolved' | 'dismissed'>,
    resolvedBy: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLES.BOARD_REPORTS)
        .update({
          status,
          resolved_by: resolvedBy,
          resolved_at: now,
          updated_at: now,
        })
        .eq('id', reportId);

      if (error) {
        handleSupabaseError(error, { operation: '신고 처리', table: TABLES.BOARD_REPORTS });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('신고 처리 실패', toError(error), { reportId, status });
      handleSupabaseError(error, { operation: '신고 처리', table: TABLES.BOARD_REPORTS });
    }
  }
}
