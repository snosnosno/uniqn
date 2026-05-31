/**
 * UNIQN Mobile - Employer Application Repository
 *
 * @description 구인자 등록 신청 CRUD + RPC 호출
 * @version 1.0.0
 *
 * 책임:
 * 1. employer_applications 테이블 조회 (본인 / admin)
 * 2. RPC register_as_employer 호출 (신청 생성)
 * 3. RPC approve/reject_employer_application 호출 (admin)
 * 4. RPC 에러 메시지 → AppError 변환
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { isAppError, toError, BusinessError, AuthError, ERROR_CODES } from '@/errors';
import {
  EmployerAppPendingExistsError,
  EmployerAppAlreadyProcessedError,
  EmployerAppSelfApproveError,
  EmployerAppNotFoundError,
} from '@/errors/BusinessErrors';
import { handleSupabaseError, toCamelCase, paginatedQuery } from '@/utils/supabase';
import type { IEmployerApplicationRepository } from '../interfaces';

// ============================================================================
// Types
// ============================================================================

export type EmployerApplicationStatus = 'pending' | 'approved' | 'rejected';

export type EmployerApplicationRejectionCategory =
  | 'duplicate'
  | 'dummy'
  | 'identity_mismatch'
  | 'other';

export interface EmployerApplicationApplicant {
  name: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  /** PortOne KG이니시스 본인인증 완료 여부 (phoneVerified 와 별개) */
  identityVerified: boolean;
  photoURL: string | null;
}

export interface EmployerApplicationReviewer {
  name: string | null;
  nickname: string | null;
}

export interface EmployerApplication {
  id: string;
  userId: string;
  status: EmployerApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  rejectionCategory: EmployerApplicationRejectionCategory | null;
  agreementsSnapshot: Record<string, unknown>;
  intro: string | null;
  supersedesId: string | null;
  createdAt: string;
  applicant: EmployerApplicationApplicant | null;
  reviewer: EmployerApplicationReviewer | null;
}

export interface RegisterAsEmployerResult {
  success: boolean;
  applicationId: string;
  status: 'pending';
  submittedAt: string;
}

export interface ApproveRejectResult {
  success: boolean;
  applicationId: string;
  userId: string;
  reviewedAt: string;
}

export interface FetchApplicationsOptions {
  status?: EmployerApplicationStatus;
  pageSize?: number;
  cursor?: string;
}

export interface FetchApplicationsResult {
  items: EmployerApplication[];
  hasMore: boolean;
  lastCursor: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const TABLE = 'employer_applications';
const COMPONENT = 'SupabaseEmployerApplicationRepository';

const TABLE_COLUMNS =
  'id,user_id,status,submitted_at,reviewed_at,reviewed_by,rejection_reason,rejection_category,agreements_snapshot,intro,supersedes_id,created_at' as const;

const APPLICANT_JOIN =
  'applicant:users!employer_applications_user_id_fkey(name,nickname,email,phone,phone_verified,identity_verified,photo_url)' as const;

const REVIEWER_JOIN =
  'reviewer:users!employer_applications_reviewed_by_fkey(name,nickname)' as const;

const ADMIN_SELECT = `${TABLE_COLUMNS},${APPLICANT_JOIN},${REVIEWER_JOIN}` as const;

// ============================================================================
// RPC 에러 메시지 → AppError 변환
// ============================================================================

/**
 * RPC RAISE EXCEPTION 메시지 prefix로 AppError 분류
 * Supabase는 RAISE EXCEPTION 메시지를 그대로 error.message에 담아 반환
 */
function mapRpcError(error: unknown): never {
  const msg = toError(error).message ?? '';

  if (msg.includes('EMPLOYER_APP_PENDING_EXISTS')) {
    throw new EmployerAppPendingExistsError({ message: msg });
  }
  if (msg.includes('EMPLOYER_APP_ALREADY_PROCESSED')) {
    throw new EmployerAppAlreadyProcessedError({ message: msg });
  }
  if (msg.includes('EMPLOYER_APP_SELF_APPROVE')) {
    throw new EmployerAppSelfApproveError({ message: msg });
  }
  if (msg.includes('EMPLOYER_APP_NOT_FOUND')) {
    throw new EmployerAppNotFoundError({ message: msg });
  }
  if (msg.includes('UNAUTHORIZED')) {
    throw new AuthError(ERROR_CODES.AUTH_REQUIRED, {
      message: msg,
      userMessage: '관리자 권한이 필요합니다',
    });
  }
  if (msg.includes('INVALID_ROLE_TRANSITION')) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      message: msg,
      userMessage: 'staff 계정만 구인자 신청을 할 수 있습니다',
    });
  }

  // 기타 RPC 에러 → handleSupabaseError 위임
  handleSupabaseError(error, { operation: 'employer_application RPC' });
}

// ============================================================================
// Row → Domain 변환
// ============================================================================

function rowToApplicant(
  raw: Record<string, unknown> | null | undefined
): EmployerApplicationApplicant | null {
  if (!raw) return null;
  return {
    name: (raw.name as string | null) ?? null,
    nickname: (raw.nickname as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    phoneVerified: Boolean(raw.phone_verified),
    identityVerified: Boolean(raw.identity_verified),
    photoURL: (raw.photo_url as string | null) ?? null,
  };
}

function rowToReviewer(
  raw: Record<string, unknown> | null | undefined
): EmployerApplicationReviewer | null {
  if (!raw) return null;
  return {
    name: (raw.name as string | null) ?? null,
    nickname: (raw.nickname as string | null) ?? null,
  };
}

function rowToApplication(row: Record<string, unknown>): EmployerApplication {
  const { applicant: applicantRaw, reviewer: reviewerRaw, ...rest } = row;
  const base = toCamelCase<Omit<EmployerApplication, 'applicant' | 'reviewer'>>(rest);
  return {
    ...base,
    applicant: rowToApplicant(applicantRaw as Record<string, unknown> | null | undefined),
    reviewer: rowToReviewer(reviewerRaw as Record<string, unknown> | null | undefined),
  };
}

// ============================================================================
// Repository
// ============================================================================

export class SupabaseEmployerApplicationRepository implements IEmployerApplicationRepository {
  // ==========================================================================
  // 신청 생성 (유저)
  // ==========================================================================

  async register(
    agreementsSnapshot: Record<string, unknown>,
    intro: string
  ): Promise<RegisterAsEmployerResult> {
    try {
      logger.info('구인자 신청 제출', { component: COMPONENT });

      const { data, error } = await supabase.rpc('register_as_employer', {
        p_employer_agreements: agreementsSnapshot,
        p_intro: intro,
      });

      if (error) mapRpcError(error);

      const result = data as RegisterAsEmployerResult;
      logger.info('구인자 신청 제출 완료', {
        component: COMPONENT,
        applicationId: result.applicationId,
      });
      return result;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapRpcError(error);
    }
  }

  // ==========================================================================
  // 최신 신청 조회 (유저 본인 또는 admin)
  // ==========================================================================

  async getLatest(userId?: string): Promise<EmployerApplication | null> {
    try {
      const { data, error } = await supabase.rpc('get_latest_employer_application', {
        p_user_id: userId ?? null,
      });

      if (error) mapRpcError(error);
      if (!data) return null;

      return data as EmployerApplication;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapRpcError(error);
    }
  }

  // ==========================================================================
  // 목록 조회 (admin)
  // ==========================================================================

  async listForAdmin(options: FetchApplicationsOptions = {}): Promise<FetchApplicationsResult> {
    const { status, pageSize = 20, cursor } = options;

    try {
      const result = await paginatedQuery<Record<string, unknown>>(TABLE, {
        select: ADMIN_SELECT,
        orderBy: 'submitted_at',
        ascending: false,
        pageSize,
        cursor,
        filters: status ? (q) => q.eq('status', status) : undefined,
      });

      return {
        items: result.items.map(rowToApplication),
        hasMore: result.hasMore,
        lastCursor:
          result.lastDoc !== null && result.lastDoc !== undefined ? String(result.lastDoc) : null,
      };
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '구인자 신청 목록 조회', table: TABLE });
    }
  }

  // ==========================================================================
  // 상세 조회 (admin)
  // ==========================================================================

  async getById(applicationId: string): Promise<EmployerApplication | null> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(ADMIN_SELECT)
        .eq('id', applicationId)
        .maybeSingle();

      if (error) handleSupabaseError(error, { operation: '구인자 신청 상세 조회', table: TABLE });
      if (!data) return null;

      return rowToApplication(data as Record<string, unknown>);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '구인자 신청 상세 조회', table: TABLE });
    }
  }

  // ==========================================================================
  // 승인 (admin)
  // ==========================================================================

  async approve(applicationId: string): Promise<ApproveRejectResult> {
    try {
      logger.info('구인자 신청 승인', { component: COMPONENT, applicationId });

      const { data, error } = await supabase.rpc('approve_employer_application', {
        p_app_id: applicationId,
      });

      if (error) mapRpcError(error);

      const result = data as ApproveRejectResult;
      logger.info('구인자 신청 승인 완료', {
        component: COMPONENT,
        applicationId,
        userId: result.userId,
      });
      return result;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapRpcError(error);
    }
  }

  // ==========================================================================
  // 거부 (admin)
  // ==========================================================================

  async reject(
    applicationId: string,
    reason?: string,
    category?: EmployerApplicationRejectionCategory
  ): Promise<ApproveRejectResult> {
    try {
      logger.info('구인자 신청 거부', { component: COMPONENT, applicationId, category });

      const { data, error } = await supabase.rpc('reject_employer_application', {
        p_app_id: applicationId,
        p_reason: reason ?? null,
        p_category: category ?? null,
      });

      if (error) mapRpcError(error);

      const result = data as ApproveRejectResult;
      logger.info('구인자 신청 거부 완료', {
        component: COMPONENT,
        applicationId,
        userId: result.userId,
      });
      return result;
    } catch (error) {
      if (isAppError(error)) throw error;
      mapRpcError(error);
    }
  }

  // ==========================================================================
  // SLA 모니터링: 24h 경과 pending 건수 (admin)
  // ==========================================================================

  async countOverduePending(hoursThreshold = 24): Promise<number> {
    try {
      const { count, error } = await supabase
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('submitted_at', new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString());

      if (error) handleSupabaseError(error, { operation: 'SLA 모니터링', table: TABLE });
      return count ?? 0;
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: 'SLA 모니터링', table: TABLE });
    }
  }
}

export const employerApplicationRepository = new SupabaseEmployerApplicationRepository();
