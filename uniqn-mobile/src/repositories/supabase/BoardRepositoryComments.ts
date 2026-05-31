/**
 * UNIQN Mobile - Board Repository Comments
 *
 * @description BoardRepository에서 사용하는 댓글 CRUD standalone 함수
 * getComments, getCommentById, createComment, updateComment, setCommentStatus, setCommentPinned
 */

import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/utils/supabase';
import type { BoardComment, CreateBoardCommentInput, UpdateBoardCommentInput } from '@/types/board';
import {
  TABLES,
  COMMENT_COLUMNS,
  toBoardComment,
  rethrowRepositoryError,
} from './BoardRepositoryHelpers';

// ============================================================================
// Comment Query Operations
// ============================================================================

export async function executeGetComments(postId: string): Promise<BoardComment[]> {
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
    rethrowRepositoryError(error, '댓글 조회 실패', '댓글 조회', TABLES.BOARD_COMMENTS, {
      postId,
    });
  }
}

export async function executeGetCommentById(
  postId: string,
  commentId: string
): Promise<BoardComment | null> {
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
    rethrowRepositoryError(error, '댓글 단건 조회 실패', '댓글 단건 조회', TABLES.BOARD_COMMENTS, {
      postId,
      commentId,
    });
  }
}

// ============================================================================
// Comment Mutation Operations
// ============================================================================

export async function executeCreateComment(input: CreateBoardCommentInput): Promise<string> {
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
          comment_count: (((postData as Record<string, unknown>).comment_count as number) ?? 0) + 1,
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', input.postId);
    }

    return (data as Record<string, unknown>).id as string;
  } catch (error) {
    rethrowRepositoryError(error, '댓글 생성 실패', '댓글 생성', TABLES.BOARD_COMMENTS, {
      postId: input.postId,
    });
  }
}

export async function executeUpdateComment(
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
    rethrowRepositoryError(error, '댓글 수정 실패', '댓글 수정', TABLES.BOARD_COMMENTS, {
      postId,
      commentId,
    });
  }
}

export async function executeSetCommentStatus(
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

    const previousStatus = ((commentData as Record<string, unknown>).status as string) ?? 'active';
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
    rethrowRepositoryError(error, '댓글 상태 변경 실패', '댓글 상태 변경', TABLES.BOARD_COMMENTS, {
      postId,
      commentId,
      status,
    });
  }
}

export async function executeSetCommentPinned(
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
    rethrowRepositoryError(error, '댓글 고정 설정 실패', '댓글 고정 설정', TABLES.BOARD_COMMENTS, {
      postId,
      commentId,
      isPinned,
    });
  }
}
