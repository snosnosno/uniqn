/**
 * UNIQN Mobile - Board Repository Operations
 *
 * @description BoardRepository에서 사용하는 멤버십/스케줄/신고 관련 standalone 함수
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import { buildScheduleBoardPostId } from '@/shared/board/boardIds';
import type {
  BoardMembership,
  BoardReport,
  CreateBoardReportInput,
  ScheduleBoardSyncInput,
  ScheduleMembershipSyncItem,
} from '@/types/board';
import type {
  FetchBoardReportsOptions,
  FetchScheduleMembershipsOptions,
} from '../interfaces/IBoardRepository';
import {
  TABLES,
  MEMBERSHIP_COLUMNS,
  REPORT_COLUMNS,
  toBoardMembership,
  toBoardReport,
} from './BoardRepositoryHelpers';

// ============================================================================
// Membership Query Operations
// ============================================================================

export async function executeGetMembershipsByUser(
  userId: string,
  options: FetchScheduleMembershipsOptions = {}
): Promise<BoardMembership[]> {
  try {
    let query = supabase
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

export async function executeGetMembershipsByPost(postId: string): Promise<BoardMembership[]> {
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

export async function executeGetMembership(
  postId: string,
  userId: string
): Promise<BoardMembership | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.BOARD_MEMBERSHIPS)
      .select(MEMBERSHIP_COLUMNS)
      .eq('post_id', postId)
      .eq('user_id', userId)
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

// ============================================================================
// Membership Mutation Operations
// ============================================================================

export async function executeReplaceScheduleMemberships(
  postId: string,
  jobPostingId: string,
  members: ScheduleMembershipSyncItem[]
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // 기존 멤버십 조회 (user_id 기준 비교)
    const { data: existingData, error: fetchError } = await supabase
      .from(TABLES.BOARD_MEMBERSHIPS)
      .select('user_id')
      .eq('post_id', postId)
      .eq('board_type', 'schedule');

    if (fetchError) {
      handleSupabaseError(fetchError, {
        operation: '멤버십 교체 조회',
        table: TABLES.BOARD_MEMBERSHIPS,
      });
    }

    const existingUserIds = new Set(
      ((existingData ?? []) as Record<string, unknown>[]).map((row) => row.user_id as string)
    );
    const incomingUserIds = new Set(members.map((m) => m.userId));

    // 삭제 대상 (기존에 있지만 새 목록에 없는 것)
    const toDeleteUserIds = [...existingUserIds].filter((uid) => !incomingUserIds.has(uid));
    if (toDeleteUserIds.length > 0) {
      const { error: deleteError } = await supabase
        .from(TABLES.BOARD_MEMBERSHIPS)
        .delete()
        .eq('post_id', postId)
        .in('user_id', toDeleteUserIds);

      if (deleteError) {
        handleSupabaseError(deleteError, {
          operation: '멤버십 삭제',
          table: TABLES.BOARD_MEMBERSHIPS,
        });
      }
    }

    // Upsert 새 멤버십 (user_id, post_id unique constraint 기반)
    if (members.length > 0) {
      const rows = members.map((member) => ({
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
        .upsert(rows, { onConflict: 'user_id,post_id' });

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

// ============================================================================
// Schedule Post Operations
// ============================================================================

export async function executeUpsertSchedulePost(input: ScheduleBoardSyncInput): Promise<string> {
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

// ============================================================================
// Report Operations
// ============================================================================

export async function executeCreateReport(input: CreateBoardReportInput): Promise<string> {
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

export async function executeGetReportById(reportId: string): Promise<BoardReport | null> {
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

export async function executeGetReports(
  options: FetchBoardReportsOptions = {}
): Promise<BoardReport[]> {
  try {
    let query = supabase
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

export async function executeGetReportsByPostId(postId: string): Promise<BoardReport[]> {
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

export async function executeReviewReport(
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
