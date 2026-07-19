/**
 * UNIQN Mobile - Application Repository Helpers
 *
 * @description ApplicationRepository에서 사용하는 상수, 매핑 함수, 헬퍼 유틸리티
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, PermissionError, ERROR_CODES, isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { parseApplicationDocument, parseJobPostingDocument } from '@/schemas';
import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
import { STATUS } from '@/constants';
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER } from '@/types/assignment';
import { TABLE_COLUMNS } from './JobPostingRepositoryHelpers';
import type {
  Application,
  ApplicationStatus,
  ApplicationStats,
  Assignment,
  JobPosting,
} from '@/types';
import type { ApplicationWithJob, ApplicantListWithStats } from '../interfaces';

// ============================================================================
// Constants
// ============================================================================

export const TABLES = {
  APPLICATIONS: 'applications',
  JOB_POSTINGS: 'job_postings',
  WORK_LOGS: 'work_logs',
} as const;

export const ACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  STATUS.APPLICATION.APPLIED,
  STATUS.APPLICATION.CONFIRMED,
  STATUS.APPLICATION.CANCELLATION_PENDING,
]);

export const EMPLOYER_REALTIME_LIMIT = 300;
export const APPLICATION_COLUMNS =
  'id,applicant_email,applicant_id,applicant_name,applicant_nickname,applicant_phone,applicant_photo_url,applicant_photo_url_blurhash,applicant_role,assignments,cancellation_request,cancelled_at,confirmation_history,confirmed_at,created_at,custom_role,is_read,job_posting_date,job_posting_id,job_posting_title,message,notes,original_application,pre_question_answers,processed_at,processed_by,recruitment_type,rejection_reason,status,updated_at' as const;
// 공고 SELECT 화이트리스트 단일소스 — 정본 TABLE_COLUMNS(JobPostingRepositoryHelpers)를 그대로 재노출한다.
// 사본을 두면 conditions·venue_id 누락처럼 드리프트가 생겨 읽기에서 필드가 조용히 증발한다(whitelist-silent-drop).
export const JOB_POSTING_COLUMNS = TABLE_COLUMNS;

// ============================================================================
// Mapping Functions
// ============================================================================

export function toApplication(row: Record<string, unknown>): Application | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  // Supabase는 없는 optional 필드를 null로 반환 → undefined로 변환해서 Zod optional 처리
  const cleaned = Object.fromEntries(
    Object.entries(camel).map(([k, v]) => [k, v === null ? undefined : v])
  );
  return parseApplicationDocument({ ...cleaned, id: row.id });
}

export function rowsToApplications(rows: Record<string, unknown>[]): Application[] {
  const items: Application[] = [];
  for (const row of rows) {
    const app = toApplication(row);
    if (app) items.push(app);
  }
  return items;
}

export function toJobPosting(row: Record<string, unknown>): JobPosting | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  // Supabase는 없는 JSONB/optional 필드를 null로 반환 → undefined로 변환해서 Zod optional 처리
  const cleaned = Object.fromEntries(
    Object.entries(camel).map(([k, v]) => [k, v === null ? undefined : v])
  );
  return parseJobPostingDocument({ ...cleaned, id: row.id });
}

export function createEmptyApplicationStats(): ApplicationStats {
  return {
    total: 0,
    applied: 0,
    confirmed: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    cancellationPending: 0,
  };
}

// ============================================================================
// Error Helpers
// ============================================================================

/** 공통 catch 핸들러 — isAppError이면 rethrow, 아니면 로그 + handleSupabaseError */
export function rethrowOrHandle(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(`${operation} 실패`, toError(error), context);
  handleSupabaseError(error, { operation, table: TABLES.APPLICATIONS });
}

// ============================================================================
// Data Loading Helpers
// ============================================================================

export async function loadApplication(applicationId: string): Promise<Application> {
  const { data, error } = await supabase
    .from(TABLES.APPLICATIONS)
    .select(APPLICATION_COLUMNS)
    .eq('id', applicationId)
    .maybeSingle();

  if (error) handleSupabaseError(error, { operation: '지원서 조회', table: TABLES.APPLICATIONS });
  if (!data) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '지원 내역을 찾을 수 없습니다.',
    });
  }

  const app = toApplication(data as Record<string, unknown>);
  if (!app) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '지원 데이터가 올바르지 않습니다.',
    });
  }
  return app;
}

export async function loadJobPosting(jobPostingId: string): Promise<JobPosting> {
  const { data, error } = await supabase
    .from(TABLES.JOB_POSTINGS)
    .select(JOB_POSTING_COLUMNS)
    .eq('id', jobPostingId)
    .maybeSingle();

  if (error) handleSupabaseError(error, { operation: '공고 조회', table: TABLES.JOB_POSTINGS });
  if (!data) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
  }

  const jp = toJobPosting(data as Record<string, unknown>);
  if (!jp) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공고 데이터가 올바르지 않습니다.',
    });
  }
  return jp;
}

/**
 * 공고를 로드하고 호출자가 관리 권한(access)을 가졌는지 확인.
 *
 * Phase 2A.후속 (2026-05-09) — owner 외에 워크스페이스 멤버 + admin 도 통과.
 * Phase 2A 에서 applications/job_postings RLS 가 workspace_member 분기로 풀렸으나
 * 클라이언트 헬퍼는 owner-only 였던 부분 마이그레이션을 일치시킨다.
 *
 * Rename (2026-05-10) — owner-only 시절의 `loadAndVerifyJobPostingOwner` 에서 access
 * 의미가 명확해진 `loadAndVerifyJobPostingAccess` 로 변경. 함수 의미와 시그니처는 동일,
 * 호출자도 단순 import 변경.
 *
 * 호출 비용: owner 본인이면 RPC 0회, 멤버면 1회, admin 이면 2회. 권한 에러 흐름은
 * cancellation/리뷰 같은 흔하지 않은 employer-side 액션이라 허용 가능.
 */
export async function loadAndVerifyJobPostingAccess(
  jobPostingId: string,
  callerId: string,
  operation: string
): Promise<JobPosting> {
  const jobData = await loadJobPosting(jobPostingId);

  // 1) owner 본인
  if (jobData.ownerId === callerId) return jobData;

  // workspaceId 없는 레거시 row 방어 (M3 이후 NOT NULL 이지만 schema migration 보장 안 됨)
  if (!jobData.workspaceId) {
    throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: `공고에 팀이 지정되지 않았습니다: ${operation}`,
    });
  }

  // 2) 워크스페이스 멤버 (Phase 2A backend 와 일관)
  const memberResult = await supabase.rpc('is_workspace_member', {
    _workspace_id: jobData.workspaceId,
    _user_id: callerId,
  });
  if (memberResult.error) {
    handleSupabaseError(memberResult.error, { operation, table: TABLES.JOB_POSTINGS });
  }
  if (memberResult.data === true) return jobData;

  // 3) admin
  const adminResult = await supabase.rpc('is_admin');
  if (adminResult.error) {
    handleSupabaseError(adminResult.error, { operation, table: TABLES.JOB_POSTINGS });
  }
  if (adminResult.data === true) return jobData;

  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `팀 멤버만 관리할 수 있습니다: ${operation}`,
  });
}

// ============================================================================
// Business Logic Helpers
// ============================================================================

export function countAssignmentDates(assignments: Assignment[]): number {
  return assignments.reduce((sum, a) => sum + a.dates.length, 0);
}

export function buildCanonicalFixedAssignment(jobData: JobPosting, roleId: string): Assignment {
  if (jobData.schedule.kind !== 'fixed') {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '고정공고 assignment를 생성할 수 없습니다.',
    });
  }
  return {
    roleIds: [roleId],
    timeSlot: jobData.schedule.startTime ?? FIXED_TIME_MARKER,
    dates: [FIXED_DATE_MARKER],
    isGrouped: false,
    checkMethod: 'individual',
  };
}

export function buildApplicantListWithStats(
  applications: Application[],
  jobPosting: JobPosting,
  statusFilter?: ApplicationStatus | ApplicationStatus[]
): ApplicantListWithStats {
  const allApps: ApplicationWithJob[] = [];
  const stats = createEmptyApplicationStats();

  for (const app of applications) {
    allApps.push({ ...app, jobPosting });
    stats.total++;
    const statsKey = STATUS_TO_STATS_KEY[app.status];
    if (statsKey && statsKey !== 'total') {
      stats[statsKey]++;
    }
  }

  if (!statusFilter) {
    return { applications: allApps, stats };
  }

  const statusSet = new Set(Array.isArray(statusFilter) ? statusFilter : [statusFilter]);
  return {
    applications: allApps.filter((a) => statusSet.has(a.status)),
    stats,
  };
}

export async function fetchRelatedWorkLogIds(
  applicantId: string,
  jobPostingId: string
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.WORK_LOGS)
      .select('id')
      .eq('staff_id', applicantId)
      .eq('job_posting_id', jobPostingId);

    if (error) return [];
    return ((data ?? []) as Record<string, unknown>[]).map((r) => r.id as string);
  } catch {
    return [];
  }
}
