/**
 * UNIQN Mobile - Board Repository Operations
 *
 * @description BoardRepository에서 사용하는 멤버십/스케줄/신고 관련 standalone 함수
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';
import type { BoardMembership, BoardReport, CreateBoardReportInput } from '@/types/board';
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
