/**
 * UNIQN Mobile - Supabase JobPosting Repository
 *
 * @description Supabase PostgREST 기반 JobPosting Repository 구현
 * @version 1.0.0
 */

import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, PermissionError, ERROR_CODES, isAppError } from '@/errors';
import {
  handleSupabaseError,
  toSnakeCase,
  toCamelCase,
  paginatedQuery,
  createRealtimeSubscription,
} from '@/utils/supabase';
import { parseJobPostingDocument } from '@/schemas';
import {
  createInitialPostingStats,
  mergeJobPostingInput,
  serializeJobPostingV3,
} from '@/domains/job-posting';
import { removeUndefined } from '@/utils/removeUndefined';
import { STATUS } from '@/constants';
import type { UnsubscribeFn, PaginationCursor } from '@/types/common';
import type { TaxSettings } from '@/utils/settlement';
import type {
  JobPosting,
  JobPostingFilters,
  JobPostingStatus,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  TournamentApprovalStatus,
  PostingRoleCatalogEntry,
} from '@/types';
import type { StaffRole } from '@/types/role';
import type {
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
  JobPostingSubscriptionCallbacks,
} from '../interfaces';

const TABLE = 'job_postings';
const DEFAULT_PAGE_SIZE = 20;
const TABLE_COLUMNS =
  'id,closed_at,closed_reason,compensation,contact_phone,created_at,description,filled_positions,fixed_config,location,owner_id,owner_name,posting_type,questions,role_catalog,role_keys,schedule,schema_version,stats,status,tags,title,total_positions,tournament_config,updated_at,urgent_config,view_count,work_date,work_dates,workspace_id' as const;

// TABLE_COLUMNS를 camelCase로 변환한 허용 컬럼 Set (Realtime full-row 필터링용)
const ALLOWED_CAMEL_COLUMNS: Set<string> = new Set(
  TABLE_COLUMNS.split(',').map((col) => {
    let c = col.trim().replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
    if (c.endsWith('Url')) c = c.slice(0, -3) + 'URL';
    if (c.endsWith('Urls')) c = c.slice(0, -4) + 'URLs';
    return c;
  })
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function toJobPosting(row: Record<string, unknown>): JobPosting | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  // 1. Realtime은 전체 컬럼을 반환하므로 TABLE_COLUMNS 기준으로 필터링
  // 2. Supabase는 optional 필드를 null로 반환하지만 Zod .optional()은 undefined만 허용
  //    → null 값을 제거하여 undefined로 처리되게 함
  const clean: Record<string, unknown> = { id: row.id };
  for (const [key, val] of Object.entries(camel)) {
    if (key === 'id') continue;
    if (!ALLOWED_CAMEL_COLUMNS.has(key)) continue; // 스키마 미등록 컬럼 제외
    if (val === null) continue; // null → undefined (Zod .optional() 호환)
    clean[key] = val;
  }
  return parseJobPostingDocument(clean);
}

function rowsToJobPostings(rows: Record<string, unknown>[]): JobPosting[] {
  const items: JobPosting[] = [];
  for (const row of rows) {
    const jp = toJobPosting(row);
    if (jp) items.push(jp);
  }
  return items;
}

/** 공통 catch 핸들러 — isAppError이면 rethrow, 아니면 로그 + handleSupabaseError */
function rethrowOrHandle(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(`${operation} 실패`, toError(error), context);
  handleSupabaseError(error, { operation, table: TABLE });
}

async function loadJobPostingForVerify(
  jobPostingId: string,
  operation: string
): Promise<JobPosting> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(TABLE_COLUMNS)
    .eq('id', jobPostingId)
    .maybeSingle();

  if (error) handleSupabaseError(error, { operation, table: TABLE });
  if (!data) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
  }

  const jobPosting = toJobPosting(data as Record<string, unknown>);
  if (!jobPosting) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '공고 데이터가 올바르지 않습니다.',
    });
  }
  return jobPosting;
}

/**
 * 공고를 로드하고 호출자가 update-style mutation 권한을 가졌는지 확인.
 *
 * Phase 2A.후속 (2026-05-10) — RLS jp_update_workspace_member (USING + WITH CHECK
 * 모두 `is_workspace_member(workspace_id, auth.uid()) OR is_admin()`) 와 일치.
 * 4 mutation flow (수정/마감/재오픈/정산설정) 가 본 헬퍼를 사용. owner-only 였던
 * 이전 동작에서 editor 까지 풀어 Phase 1A editor role 활성화.
 *
 * PR3-A.2 (2026-05-11) — admin 분기에서 PermissionError throw. 본 helper 가 적용되는
 * mutation 흐름의 후속 RLS (app_update / wl_update 등) 가 admin 분기 제거됨에 따라
 * helper 가 admin pass-through 시 후속 UPDATE 가 RLS silent no-op (0 row affected,
 * exception 미발생) 으로 빠져 caller 가 false success 인식. helper 단계에서 명시적
 * throw 하여 admin write 는 SECURITY DEFINER RPC (spec §2-C) 경유 강제.
 *
 * 호출 비용: owner 본인이면 RPC 0회, 멤버면 1회, admin/외부인이면 2회 (둘 다 throw).
 *
 * @see ApplicationRepositoryHelpers.loadAndVerifyJobPostingAccess (read-side 는 admin 통과 유지)
 */
async function loadAndVerifyMutateAccess(
  jobPostingId: string,
  callerId: string,
  operation: string
): Promise<JobPosting> {
  const jobPosting = await loadJobPostingForVerify(jobPostingId, operation);
  if (jobPosting.ownerId === callerId) return jobPosting;

  // workspaceId 없는 레거시 row 방어
  if (!jobPosting.workspaceId) {
    throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: `공고에 워크스페이스가 지정되지 않았습니다: ${operation}`,
    });
  }

  const memberResult = await supabase.rpc('is_workspace_member', {
    _workspace_id: jobPosting.workspaceId,
    _user_id: callerId,
  });
  if (memberResult.error) {
    handleSupabaseError(memberResult.error, { operation, table: TABLE });
  }
  if (memberResult.data === true) return jobPosting;

  // PR3-A.2: admin 분기 silent no-op 차단. 향후 admin write UI 도입 시 SECURITY DEFINER
  // RPC (admin_update_<table>_<column>) 경유하도록 강제.
  const adminResult = await supabase.rpc('is_admin');
  if (adminResult.error) {
    handleSupabaseError(adminResult.error, { operation, table: TABLE });
  }
  if (adminResult.data === true) {
    throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: `admin 직접 수정은 허용되지 않습니다. admin 전용 RPC 를 사용하세요: ${operation}`,
    });
  }

  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `워크스페이스 멤버만 수행할 수 있습니다: ${operation}`,
  });
}

/**
 * 공고를 로드하고 호출자가 delete 권한(더 엄격)을 가졌는지 확인.
 *
 * Phase 2A.후속 (2026-05-10) — RLS jp_delete_workspace_owner 의 의도(`workspace 소유자
 * 또는 admin`) 를 본 클라이언트는 `job posting owner 또는 admin` 으로 근사. 워크스페이스
 * 소유자와 공고 소유자가 일치하는 일반 케이스 모두 통과. member 는 거절(soft-delete
 * 도 거부).
 *
 * DB-level 보강 (2026-05-10, migration 20260514050000): trg_enforce_jp_status_transition
 * BEFORE UPDATE trigger 가 active|closed → cancelled 전이를 workspace owner|admin 만
 * 통과시키도록 차단한다. 본 클라이언트 가드는 즉시 UX 차단 (double defense) 으로 유지.
 */
async function loadAndVerifyDeleteAccess(
  jobPostingId: string,
  callerId: string,
  operation: string
): Promise<JobPosting> {
  const jobPosting = await loadJobPostingForVerify(jobPostingId, operation);
  if (jobPosting.ownerId === callerId) return jobPosting;

  const adminResult = await supabase.rpc('is_admin');
  if (adminResult.error) {
    handleSupabaseError(adminResult.error, { operation, table: TABLE });
  }
  if (adminResult.data === true) return jobPosting;

  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `공고 소유자만 삭제할 수 있습니다: ${operation}`,
  });
}

// ── Settlement Helpers ───────────────────────────────────────────────────────

type SettlementRolePayload = {
  role?: PostingRoleCatalogEntry['role'];
  name?: string;
  customRole?: string;
  salary?: PostingRoleCatalogEntry['salary'];
};

function settlementRoleKey(r: { role?: string; name?: string; customRole?: string }): string {
  const id = r.role ?? r.name ?? '';
  return id === 'other' && r.customRole ? `other:${r.customRole}` : id;
}

function mergeSettlementRoles(
  base: PostingRoleCatalogEntry[],
  incoming: Record<string, unknown>[]
): PostingRoleCatalogEntry[] {
  const typed = incoming as SettlementRolePayload[];
  if (base.length === 0) {
    return typed.map((r) => ({
      role: (r.role ?? r.name ?? 'dealer') as StaffRole | 'other',
      ...(r.customRole ? { customRole: r.customRole } : {}),
      ...(r.salary ? { salary: r.salary } : {}),
    }));
  }
  const byKey = new Map(typed.map((r) => [settlementRoleKey(r), r] as const));
  return base.map((r) => {
    const inc = byKey.get(settlementRoleKey(r));
    if (!inc || !Object.prototype.hasOwnProperty.call(inc, 'salary')) return r;
    return { ...r, ...(inc.salary ? { salary: inc.salary } : { salary: undefined }) };
  });
}

function normalizeRoleKeys(catalog?: PostingRoleCatalogEntry[]): string[] {
  if (!catalog || catalog.length === 0) return [];
  return catalog
    .map((e) => (e.role === 'other' && e.customRole ? `other:${e.customRole}` : (e.role ?? '')))
    .filter((k) => k.length > 0)
    .sort();
}

function hasRoleCatalogIdentityMutation(
  current?: PostingRoleCatalogEntry[],
  next?: PostingRoleCatalogEntry[]
): boolean {
  if (next === undefined) return false;
  const nextKeys = normalizeRoleKeys(next);
  if (new Set(nextKeys).size !== nextKeys.length) return true;
  const currentKeys = normalizeRoleKeys(current);
  if (currentKeys.length !== nextKeys.length) return true;
  return currentKeys.some((k, i) => k !== nextKeys[i]);
}

function assertCanonical(doc: JobPosting, msg: string, ctx: Record<string, unknown>): JobPosting {
  const parsed = parseJobPostingDocument(doc);
  if (parsed) return parsed;
  logger.error('Canonical job posting validation failed before write', ctx);
  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, { userMessage: msg });
}

/** (date, timeSlot, roleKey) 매칭 키. work_logs raw 값 기준(TBA→'미정'). */
export function buildSlotRoleKey(date: string, timeSlot: string, roleKey: string): string {
  return `${date}__${timeSlot}__${roleKey}`;
}

// ── Repository ───────────────────────────────────────────────────────────────

export class SupabaseJobPostingRepository implements IJobPostingRepository {
  // ── Read ────────────────────────────────────────────────────────────────

  async getById(jobPostingId: string): Promise<JobPosting | null> {
    try {
      logger.info('공고 상세 조회', { jobPostingId });
      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('id', jobPostingId)
        .maybeSingle();
      if (error) handleSupabaseError(error, { operation: '공고 상세 조회', table: TABLE });
      if (!data) return null;
      const jp = toJobPosting(data as Record<string, unknown>);
      if (!jp) {
        logger.warn('공고 데이터 파싱 실패', { jobPostingId });
        return null;
      }
      return jp;
    } catch (error) {
      rethrowOrHandle(error, '공고 상세 조회', { jobPostingId });
    }
  }

  async getByIdBatch(jobPostingIds: string[]): Promise<JobPosting[]> {
    try {
      if (jobPostingIds.length === 0) return [];
      logger.info('공고 배치 조회', { count: jobPostingIds.length });
      const uniqueIds = [...new Set(jobPostingIds)];
      const { data, error } = await supabase.from(TABLE).select(TABLE_COLUMNS).in('id', uniqueIds);
      if (error) handleSupabaseError(error, { operation: '공고 배치 조회', table: TABLE });
      const items = rowsToJobPostings((data ?? []) as Record<string, unknown>[]);
      logger.info('공고 배치 조회 완료', { requested: jobPostingIds.length, found: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '공고 배치 조회', { count: jobPostingIds.length });
    }
  }

  async getList(
    filters?: JobPostingFilters,
    pageSize: number = DEFAULT_PAGE_SIZE,
    lastDocument?: PaginationCursor
  ): Promise<PaginatedJobPostings> {
    try {
      logger.info('공고 목록 조회', { filters, pageSize });
      const result = await paginatedQuery<Record<string, unknown>>(TABLE, {
        orderBy: 'work_date',
        ascending: false,
        pageSize,
        cursor: lastDocument,
        filters: (q) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let qr: any = q;
          qr = qr.eq('status', filters?.status ?? STATUS.JOB_POSTING.ACTIVE);
          if (filters?.roles?.length) qr = qr.overlaps('role_keys', filters.roles.slice(0, 10));
          if (filters?.district) qr = qr.eq('location->>district', filters.district);
          if (filters?.ownerId) qr = qr.eq('owner_id', filters.ownerId);
          if (filters?.dateRange) {
            qr = qr
              .gte('work_date', filters.dateRange.start)
              .lte('work_date', filters.dateRange.end);
          }
          if (filters?.isUrgent === true) qr = qr.eq('posting_type', 'urgent');
          if (filters?.postingType === 'tournament') {
            qr = qr
              .eq('posting_type', 'tournament')
              .eq('tournament_config->>approvalStatus', STATUS.TOURNAMENT.APPROVED);
          } else if (filters?.postingType) {
            qr = qr.eq('posting_type', filters.postingType);
          }
          if (filters?.workDate && !filters?.dateRange) {
            qr = qr.contains('work_dates', [filters.workDate]);
          }
          return qr;
        },
      });
      const items = rowsToJobPostings(result.items);
      logger.info('공고 목록 조회 완료', { count: items.length, hasMore: result.hasMore });
      return { items, lastDoc: result.lastDoc as PaginationCursor, hasMore: result.hasMore };
    } catch (error) {
      rethrowOrHandle(error, '공고 목록 조회', { filters });
    }
  }

  async getByOwnerId(ownerId: string, status?: JobPostingStatus): Promise<JobPosting[]> {
    try {
      logger.info('소유자별 공고 조회', { ownerId, status });
      let query = supabase.from(TABLE).select(TABLE_COLUMNS).eq('owner_id', ownerId);
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) handleSupabaseError(error, { operation: '소유자별 공고 조회', table: TABLE });
      const items = rowsToJobPostings((data ?? []) as Record<string, unknown>[]);
      logger.info('소유자별 공고 조회 완료', { ownerId, count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '소유자별 공고 조회', { ownerId });
    }
  }

  /**
   * Phase 2A — 호출자가 owner 또는 워크스페이스 멤버인 모든 공고 조회.
   *
   * RLS jp_select 가 `owner_id = auth.uid() OR is_workspace_member(workspace_id, auth.uid())`
   * 분기를 제공하지만, jp_select 의 첫 분기 `status IN ('approved','active','closed')`
   * 가 모든 인증 사용자에게 공개 공고 SELECT 권한을 주므로 employer my-postings 흐름은
   * 클라이언트에서 workspace_id 로 명시적으로 좁혀야 한다 (Phase 2A.후속 — 2026-05-09).
   */
  async getManagedJobPostings(
    status?: JobPostingStatus,
    workspaceId?: string
  ): Promise<JobPosting[]> {
    try {
      logger.info('관리 가능 공고 조회', { status, workspaceId });
      let query = supabase.from(TABLE).select(TABLE_COLUMNS);
      if (status) query = query.eq('status', status);
      if (workspaceId) query = query.eq('workspace_id', workspaceId);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) handleSupabaseError(error, { operation: '관리 가능 공고 조회', table: TABLE });
      const items = rowsToJobPostings((data ?? []) as Record<string, unknown>[]);
      logger.info('관리 가능 공고 조회 완료', { count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '관리 가능 공고 조회', { status, workspaceId });
    }
  }

  async getTypeCounts(filters?: Pick<JobPostingFilters, 'status'>): Promise<PostingTypeCounts> {
    try {
      logger.info('공고 타입별 개수 조회', { filters });
      const status = filters?.status ?? STATUS.JOB_POSTING.ACTIVE;
      const { data, error } = await supabase
        .from(TABLE)
        .select('posting_type, tournament_config')
        .eq('status', status);
      if (error) handleSupabaseError(error, { operation: '공고 타입별 개수 조회', table: TABLE });

      const counts: PostingTypeCounts = {
        regular: 0,
        urgent: 0,
        fixed: 0,
        tournament: 0,
        total: 0,
      };
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const pt = row.posting_type as string;
        if (pt === 'tournament') {
          const cfg = row.tournament_config as Record<string, unknown> | null;
          if (cfg?.approvalStatus === STATUS.TOURNAMENT.APPROVED) {
            counts.tournament++;
            counts.total++;
          }
          continue;
        }
        counts.total++;
        if (pt === 'regular') counts.regular++;
        else if (pt === 'urgent') counts.urgent++;
        else if (pt === 'fixed') counts.fixed++;
      }
      logger.info('공고 타입별 개수 조회 완료', { counts });
      return counts;
    } catch (error) {
      rethrowOrHandle(error, '공고 타입별 개수 조회');
    }
  }

  async getRegularDateCounts(startDate: string, endDate: string): Promise<Record<string, number>> {
    try {
      logger.info('일반 공고 일자별 개수 조회', { startDate, endDate });
      const { data, error } = await supabase.rpc('get_regular_posting_date_counts', {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) {
        handleSupabaseError(error, {
          operation: '일반 공고 일자별 개수 조회',
          table: TABLE,
        });
      }
      const rows = (data ?? []) as { work_date: string; posting_count: number | string }[];
      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.work_date] = Number(row.posting_count);
      }
      logger.info('일반 공고 일자별 개수 조회 완료', {
        dates: Object.keys(result).length,
      });
      return result;
    } catch (error) {
      rethrowOrHandle(error, '일반 공고 일자별 개수 조회', { startDate, endDate });
    }
  }

  async getPostingFilledCounts(jobPostingIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (jobPostingIds.length === 0) return map;
    try {
      const { data, error } = await supabase.rpc('get_posting_filled_counts', {
        p_job_posting_ids: jobPostingIds,
      });
      if (error) {
        logger.warn('get_posting_filled_counts 실패 — 역할별 카운트 미표시', { error });
        return map;
      }
      const rows = (data ?? []) as {
        job_posting_id: string;
        work_date: string;
        time_slot: string;
        role_key: string;
        confirmed_count: number | string;
      }[];
      for (const row of rows) {
        const key = `${row.job_posting_id}__${buildSlotRoleKey(row.work_date, row.time_slot, row.role_key)}`;
        map.set(key, Number(row.confirmed_count));
      }
    } catch (e) {
      logger.warn('get_posting_filled_counts 예외', { error: e });
    }
    return map;
  }

  // ── Simple Write ────────────────────────────────────────────────────────

  async incrementViewCount(jobPostingId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_view_count', { posting_id: jobPostingId });
      if (error) {
        logger.warn('공고 조회수 증가 실패', { jobPostingId, error: error.message });
        Sentry.addBreadcrumb({
          category: 'swallow',
          level: 'warning',
          message: '공고 조회수 증가 RPC 실패 — 무시됨',
          data: { jobPostingId, error: error.message },
        });
        return;
      }
      logger.debug('공고 조회수 증가', { jobPostingId });
    } catch (error) {
      logger.warn('공고 조회수 증가 실패', { jobPostingId, error: toError(error) });
      Sentry.addBreadcrumb({
        category: 'swallow',
        level: 'warning',
        message: '공고 조회수 증가 예외 — 무시됨',
        data: { jobPostingId, error: String(error) },
      });
    }
  }

  async updateStatus(jobPostingId: string, status: JobPostingStatus): Promise<void> {
    try {
      logger.info('공고 상태 변경', { jobPostingId, status });
      const { error } = await supabase
        .from(TABLE)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', jobPostingId);
      if (error) handleSupabaseError(error, { operation: '공고 상태 변경', table: TABLE });
      logger.info('공고 상태 변경 완료', { jobPostingId, status });
    } catch (error) {
      rethrowOrHandle(error, '공고 상태 변경', { jobPostingId, status });
    }
  }

  // ── Transaction Write ───────────────────────────────────────────────────

  async createWithTransaction(
    input: CreateJobPostingInput,
    context: CreateJobPostingContext
  ): Promise<CreateJobPostingResult> {
    try {
      logger.info('공고 생성', { ownerId: context.ownerId, title: input.title });
      const now = new Date();
      const current: Partial<JobPosting> = {
        viewCount: 0,
        filledPositions: 0,
        stats: createInitialPostingStats(input.schedule),
        ...(input.postingType === 'tournament'
          ? { tournamentConfig: { approvalStatus: STATUS.TOURNAMENT.PENDING, submittedAt: now } }
          : {}),
      };

      const serialized = serializeJobPostingV3(input, {
        ownerId: context.ownerId,
        ownerName: context.ownerName,
        workspaceId: context.workspaceId,
        status: STATUS.JOB_POSTING.ACTIVE,
        current,
        createdAt: now,
        updatedAt: now,
      });
      const jobPosting = assertCanonical(
        serialized,
        'Created job posting does not satisfy the canonical contract.',
        { ownerId: context.ownerId, title: input.title }
      );

      const { id: _id, ...rest } = removeUndefined(
        serialized as unknown as Record<string, unknown>
      );
      const snakeData = toSnakeCase(rest);

      const { data, error } = await supabase.from(TABLE).insert(snakeData).select('id').single();
      if (error) handleSupabaseError(error, { operation: '공고 생성', table: TABLE });
      const newId = (data as Record<string, unknown>).id as string;
      logger.info('공고 생성 완료', { id: newId });
      return { id: newId, jobPosting: { ...jobPosting, id: newId } };
    } catch (error) {
      rethrowOrHandle(error, '공고 생성', { ownerId: context.ownerId });
    }
  }

  async updateWithTransaction(
    jobPostingId: string,
    input: UpdateJobPostingInput,
    ownerId: string
  ): Promise<JobPosting> {
    try {
      logger.info('공고 수정', { jobPostingId, ownerId });
      const cur = await loadAndVerifyMutateAccess(jobPostingId, ownerId, '공고 수정');

      if (
        (cur.filledPositions ?? 0) > 0 &&
        (input.schedule !== undefined ||
          hasRoleCatalogIdentityMutation(cur.roleCatalog, input.roleCatalog))
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Cannot change schedule or roles after applicants are confirmed.',
        });
      }

      const merged = mergeJobPostingInput(cur, input);
      const updatedAt = new Date();
      const serialized = serializeJobPostingV3(merged, {
        ownerId: cur.ownerId,
        ownerName: cur.ownerName,
        status: input.status ?? cur.status,
        current: cur,
        createdAt: cur.createdAt,
        updatedAt,
      });
      const validated = assertCanonical(
        serialized,
        'Updated job posting does not satisfy the canonical contract.',
        { jobPostingId, ownerId }
      );

      const { id: _id, ...rest } = removeUndefined(
        serialized as unknown as Record<string, unknown>
      );
      const { error } = await supabase.from(TABLE).update(toSnakeCase(rest)).eq('id', jobPostingId);
      if (error) handleSupabaseError(error, { operation: '공고 수정', table: TABLE });
      logger.info('공고 수정 완료', { jobPostingId });
      return validated;
    } catch (error) {
      rethrowOrHandle(error, '공고 수정', { jobPostingId });
    }
  }

  async deleteWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
    try {
      logger.info('공고 삭제', { jobPostingId, ownerId });
      const cur = await loadAndVerifyDeleteAccess(jobPostingId, ownerId, '공고 삭제');
      if ((cur.filledPositions ?? 0) > 0) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Cannot delete a posting with confirmed applicants. Close it instead.',
        });
      }
      const { error } = await supabase
        .from(TABLE)
        .update({ status: STATUS.JOB_POSTING.CANCELLED, updated_at: new Date().toISOString() })
        .eq('id', jobPostingId);
      if (error) handleSupabaseError(error, { operation: '공고 삭제', table: TABLE });
      logger.info('공고 삭제 완료', { jobPostingId });
    } catch (error) {
      rethrowOrHandle(error, '공고 삭제', { jobPostingId });
    }
  }

  async closeWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
    try {
      logger.info('공고 마감', { jobPostingId, ownerId });
      const cur = await loadAndVerifyMutateAccess(jobPostingId, ownerId, '공고 마감');
      if (cur.status === STATUS.JOB_POSTING.CLOSED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Job posting is already closed.',
        });
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(TABLE)
        .update({
          status: STATUS.JOB_POSTING.CLOSED,
          closed_at: now,
          closed_reason: 'manual',
          updated_at: now,
        })
        .eq('id', jobPostingId);
      if (error) handleSupabaseError(error, { operation: '공고 마감', table: TABLE });
      logger.info('공고 마감 완료', { jobPostingId });
    } catch (error) {
      rethrowOrHandle(error, '공고 마감', { jobPostingId });
    }
  }

  async reopenWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
    try {
      logger.info('공고 재오픈', { jobPostingId, ownerId });
      const cur = await loadAndVerifyMutateAccess(jobPostingId, ownerId, '공고 재오픈');

      if (cur.status === STATUS.JOB_POSTING.ACTIVE) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Job posting is already active.',
        });
      }
      if (cur.status === STATUS.JOB_POSTING.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: 'Cancelled postings cannot be reopened. Create a new posting instead.',
        });
      }
      if (
        cur.schedule.kind === 'fixed' &&
        cur.totalPositions > 0 &&
        cur.filledPositions >= cur.totalPositions
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '모든 역할 정원이 마감된 고정공고는 재오픈할 수 없습니다.',
        });
      }

      const { error } = await supabase
        .from(TABLE)
        .update({ status: STATUS.JOB_POSTING.ACTIVE, updated_at: new Date().toISOString() })
        .eq('id', jobPostingId);
      if (error) handleSupabaseError(error, { operation: '공고 재오픈', table: TABLE });
      logger.info('공고 재오픈 완료', { jobPostingId });
    } catch (error) {
      rethrowOrHandle(error, '공고 재오픈', { jobPostingId });
    }
  }

  async getStatsByOwnerId(ownerId: string): Promise<JobPostingStats> {
    try {
      logger.info('소유자 공고 통계 조회', { ownerId });
      const { data, error } = await supabase.rpc('get_job_posting_stats', { p_owner_id: ownerId });
      if (error) handleSupabaseError(error, { operation: '소유자 공고 통계 조회', table: TABLE });

      const row = Array.isArray(data) ? data[0] : data;
      const stats: JobPostingStats = {
        total: Number(row?.total ?? 0),
        active: Number(row?.active ?? 0),
        closed: Number(row?.closed ?? 0),
        cancelled: Number(row?.cancelled ?? 0),
        totalApplications: Number(row?.total_applications ?? 0),
        totalViews: Number(row?.total_views ?? 0),
      };
      logger.info('소유자 공고 통계 조회 완료', { ownerId, stats });
      return stats;
    } catch (error) {
      rethrowOrHandle(error, '소유자 공고 통계 조회', { ownerId });
    }
  }

  async verifyOwnership(jobPostingId: string, ownerId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('owner_id')
        .eq('id', jobPostingId)
        .maybeSingle();
      if (error || !data) return false;
      return (data as Record<string, unknown>).owner_id === ownerId;
    } catch {
      return false;
    }
  }

  async bulkUpdateStatus(
    jobPostingIds: string[],
    status: JobPostingStatus,
    ownerId: string
  ): Promise<number> {
    try {
      if (jobPostingIds.length === 0) return 0;
      logger.info('공고 상태 일괄 변경', { count: jobPostingIds.length, status, ownerId });
      const { data, error } = await supabase
        .from(TABLE)
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', jobPostingIds)
        .eq('owner_id', ownerId)
        .select('id');
      if (error) handleSupabaseError(error, { operation: '공고 상태 일괄 변경', table: TABLE });
      const cnt = (data ?? []).length;
      logger.info('공고 상태 일괄 변경 완료', { successCount: cnt });
      return cnt;
    } catch (error) {
      rethrowOrHandle(error, '공고 상태 일괄 변경', { status, ownerId });
    }
  }

  // ── Settlement Settings ─────────────────────────────────────────────────

  async updateSettlementSettings(
    jobPostingId: string,
    data: {
      roles: Record<string, unknown>[];
      allowances: Record<string, unknown>;
      taxSettings: TaxSettings;
    },
    ownerId: string
  ): Promise<void> {
    try {
      logger.info('정산 설정 업데이트', { jobPostingId, ownerId });
      const cur = await loadAndVerifyMutateAccess(jobPostingId, ownerId, '정산 설정 업데이트');

      const merged: CreateJobPostingInput = mergeJobPostingInput(cur, {
        roleCatalog: mergeSettlementRoles(cur.roleCatalog, data.roles),
        compensation: {
          ...cur.compensation,
          allowances: data.allowances as CreateJobPostingInput['compensation']['allowances'],
          taxSettings: data.taxSettings as CreateJobPostingInput['compensation']['taxSettings'],
        },
      });

      const updatedAt = new Date();
      const serialized = serializeJobPostingV3(merged, {
        ownerId: cur.ownerId,
        ownerName: cur.ownerName,
        status: cur.status,
        current: cur,
        createdAt: cur.createdAt,
        updatedAt,
      });
      assertCanonical(
        serialized,
        'Settlement settings update produced a non-canonical job posting.',
        { jobPostingId, ownerId }
      );

      const { id: _id, ...rest } = removeUndefined(
        serialized as unknown as Record<string, unknown>
      );
      const { error } = await supabase.from(TABLE).update(toSnakeCase(rest)).eq('id', jobPostingId);
      if (error) handleSupabaseError(error, { operation: '정산 설정 업데이트', table: TABLE });
      logger.info('정산 설정 업데이트 완료', { jobPostingId });
    } catch (error) {
      rethrowOrHandle(error, '정산 설정 업데이트', { jobPostingId });
    }
  }

  // ── Tournament ──────────────────────────────────────────────────────────

  async getByPostingTypeAndApprovalStatus(
    postingType: string,
    approvalStatus: TournamentApprovalStatus
  ): Promise<JobPosting[]> {
    try {
      logger.info('공고 타입/승인상태별 조회', { postingType, approvalStatus });
      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('posting_type', postingType)
        .eq('tournament_config->>approvalStatus', approvalStatus)
        .order('created_at', { ascending: false });
      if (error)
        handleSupabaseError(error, { operation: '공고 타입/승인상태별 조회', table: TABLE });
      const postings = rowsToJobPostings((data ?? []) as Record<string, unknown>[]);
      logger.info('공고 타입/승인상태별 조회 완료', {
        postingType,
        approvalStatus,
        count: postings.length,
      });
      return postings;
    } catch (error) {
      rethrowOrHandle(error, '공고 타입/승인상태별 조회', { postingType, approvalStatus });
    }
  }

  async getByOwnerAndPostingType(
    ownerId: string,
    postingType: string,
    approvalStatuses: TournamentApprovalStatus[]
  ): Promise<JobPosting[]> {
    try {
      logger.info('소유자/공고타입별 조회', { ownerId, postingType, approvalStatuses });
      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .eq('posting_type', postingType)
        .eq('owner_id', ownerId)
        .in('tournament_config->>approvalStatus', approvalStatuses)
        .order('created_at', { ascending: false });
      if (error) handleSupabaseError(error, { operation: '소유자/공고타입별 조회', table: TABLE });
      const postings = rowsToJobPostings((data ?? []) as Record<string, unknown>[]);
      logger.info('소유자/공고타입별 조회 완료', { ownerId, postingType, count: postings.length });
      return postings;
    } catch (error) {
      rethrowOrHandle(error, '소유자/공고타입별 조회', { ownerId, postingType });
    }
  }

  // ── Realtime ────────────────────────────────────────────────────────────

  subscribeById(jobPostingId: string, callbacks: JobPostingSubscriptionCallbacks): UnsubscribeFn {
    logger.info('공고 상세 실시간 구독 시작', { jobPostingId });

    // 초기 데이터 1회 fetch — 변경 이벤트가 오지 않아도 구독자가 빈 상태에서 탈출
    void this.getById(jobPostingId)
      .then((jp) => callbacks.onUpdate(jp))
      .catch((error) => callbacks.onError?.(toError(error)));

    return createRealtimeSubscription(TABLE, `id=eq.${jobPostingId}`, (payload) => {
      try {
        if (payload.eventType === 'DELETE') {
          callbacks.onUpdate(null);
          return;
        }
        const row = payload.new as Record<string, unknown>;
        if (!row || Object.keys(row).length === 0) {
          callbacks.onUpdate(null);
          return;
        }
        const jp = toJobPosting(row);
        if (!jp) {
          logger.warn('공고 실시간 데이터 파싱 실패', { jobPostingId });
          callbacks.onUpdate(null);
          return;
        }
        callbacks.onUpdate(jp);
      } catch (error) {
        logger.error('공고 상세 실시간 구독 처리 실패', toError(error), { jobPostingId });
        callbacks.onError?.(toError(error));
      }
    });
  }
}
