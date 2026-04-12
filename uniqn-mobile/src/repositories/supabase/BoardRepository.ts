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

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleSupabaseError, runRpc } from '@/utils/supabase';
import type {
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
import {
  TABLES,
  POST_COLUMNS,
  COMMENT_COLUMNS,
  VOTE_COLUMNS,
  toBoardPost,
  toBoardComment,
  togglePostVoteFallback,
  toggleCommentReactionFallback,
} from './BoardRepositoryHelpers';
import {
  executeGetMembershipsByUser,
  executeGetMembershipsByPost,
  executeGetMembership,
  executeReplaceScheduleMemberships,
  executeUpsertSchedulePost,
  executeCreateReport,
  executeGetReportById,
  executeGetReports,
  executeGetReportsByPostId,
  executeReviewReport,
} from './BoardRepositoryOperations';

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
      let query = supabase.from(TABLES.BOARD_POSTS).select(POST_COLUMNS);

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
    } catch {
      // RPC 미존재 시 폴백: 수동 처리
      logger.warn('toggle_board_post_vote RPC 실패, 폴백 처리', { postId, userId });

      return togglePostVoteFallback(postId, userId, type);
    }
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
    } catch {
      logger.warn('toggle_comment_reaction RPC 실패, 폴백 처리', { postId, commentId, userId });
      return toggleCommentReactionFallback(postId, commentId, userId, type);
    }
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
    return executeGetMembershipsByUser(userId, options);
  }

  async getMembershipsByPost(postId: string): Promise<BoardMembership[]> {
    return executeGetMembershipsByPost(postId);
  }

  async getMembership(postId: string, userId: string): Promise<BoardMembership | null> {
    return executeGetMembership(postId, userId);
  }

  async replaceScheduleMemberships(
    postId: string,
    jobPostingId: string,
    members: ScheduleMembershipSyncItem[]
  ): Promise<void> {
    return executeReplaceScheduleMemberships(postId, jobPostingId, members);
  }

  async upsertSchedulePost(input: ScheduleBoardSyncInput): Promise<string> {
    return executeUpsertSchedulePost(input);
  }

  // ==========================================================================
  // Report
  // ==========================================================================

  async createReport(input: CreateBoardReportInput): Promise<string> {
    return executeCreateReport(input);
  }

  async getReportById(reportId: string): Promise<BoardReport | null> {
    return executeGetReportById(reportId);
  }

  async getReports(options: FetchBoardReportsOptions = {}): Promise<BoardReport[]> {
    return executeGetReports(options);
  }

  async getReportsByPostId(postId: string): Promise<BoardReport[]> {
    return executeGetReportsByPostId(postId);
  }

  async reviewReport(
    reportId: string,
    status: Extract<BoardReport['status'], 'resolved' | 'dismissed'>,
    resolvedBy: string
  ): Promise<void> {
    return executeReviewReport(reportId, status, resolvedBy);
  }
}
