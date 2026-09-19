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
import { toError } from '@/errors';
import { handleSupabaseError, runRpc } from '@/utils/supabase';
import type {
  BoardComment,
  BoardMembership,
  BoardPost,
  BoardPostStatus,
  BoardReport,
  CommentReactionType,
  CreateBoardCommentInput,
  CreateBoardReportInput,
  UpdateBoardCommentInput,
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
  toBoardPost,
  rethrowRepositoryError,
} from './BoardRepositoryHelpers';
import {
  executeGetComments,
  executeGetCommentById,
  executeCreateComment,
  executeUpdateComment,
  executeSetCommentStatus,
  executeSetCommentPinned,
} from './BoardRepositoryComments';
import {
  executeGetMembershipsByUser,
  executeGetMembershipsByPost,
  executeGetMembership,
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
      rethrowRepositoryError(error, '게시글 조회 실패', '게시글 조회', TABLES.BOARD_POSTS, {
        postId,
      });
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
      rethrowRepositoryError(
        error,
        '게시글 목록 조회 실패',
        '게시글 목록 조회',
        TABLES.BOARD_POSTS
      );
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
      rethrowRepositoryError(
        error,
        '게시글 배치 조회 실패',
        '게시글 배치 조회',
        TABLES.BOARD_POSTS
      );
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
      rethrowRepositoryError(
        error,
        '게시글 상태 변경 실패',
        '게시글 상태 변경',
        TABLES.BOARD_POSTS,
        {
          postId,
          status,
        }
      );
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
      rethrowRepositoryError(
        error,
        '게시글 잠금 설정 실패',
        '게시글 잠금 설정',
        TABLES.BOARD_POSTS,
        {
          postId,
          isLocked,
        }
      );
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
    return executeGetComments(postId);
  }

  async getCommentById(postId: string, commentId: string): Promise<BoardComment | null> {
    return executeGetCommentById(postId, commentId);
  }

  async createComment(input: CreateBoardCommentInput): Promise<string> {
    return executeCreateComment(input);
  }

  async updateComment(
    postId: string,
    commentId: string,
    input: UpdateBoardCommentInput
  ): Promise<void> {
    return executeUpdateComment(postId, commentId, input);
  }

  async setCommentStatus(
    postId: string,
    commentId: string,
    status: BoardComment['status']
  ): Promise<void> {
    return executeSetCommentStatus(postId, commentId, status);
  }

  async setCommentPinned(
    postId: string,
    commentId: string,
    isPinned: boolean,
    actorId: string
  ): Promise<void> {
    return executeSetCommentPinned(postId, commentId, isPinned, actorId);
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
    const result = await runRpc<{ result_type: string | null }>('toggle_comment_reaction', {
      p_post_id: postId,
      p_comment_id: commentId,
      p_user_id: userId,
      p_reaction_type: type,
    });

    return result.result_type as CommentReactionType | null;
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
      rethrowRepositoryError(
        error,
        '사용자 댓글 리액션 조회 실패',
        '사용자 댓글 리액션 조회',
        TABLES.BOARD_COMMENT_REACTIONS,
        { postId, userId }
      );
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
