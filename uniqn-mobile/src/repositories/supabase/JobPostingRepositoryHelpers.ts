/**
 * UNIQN Mobile - Supabase JobPosting Repository Helpers
 *
 * @description JobPostingRepository 에서 사용하는 공통 헬퍼 (행 파싱, 권한 검증, 키 생성)
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, PermissionError, ERROR_CODES, isAppError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { parseJobPostingDocument } from '@/schemas';
import type { JobPosting } from '@/types';
import { resolvePostingAuthority, canManagePosting } from './postingAuthority';

export const TABLE = 'job_postings';
export const DEFAULT_PAGE_SIZE = 20;
export const TABLE_COLUMNS =
  'id,closed_at,closed_reason,compensation,conditions,contact_phone,created_at,description,filled_positions,fixed_config,location,owner_id,owner_name,posting_type,questions,role_catalog,role_keys,schedule,schema_version,stats,status,tags,title,total_positions,tournament_config,updated_at,urgent_config,venue_id,view_count,work_date,work_dates,workspace_id' as const;

// TABLE_COLUMNS를 camelCase로 변환한 허용 컬럼 Set (Realtime full-row 필터링용)
export const ALLOWED_CAMEL_COLUMNS: Set<string> = new Set(
  TABLE_COLUMNS.split(',').map((col) => {
    let c = col.trim().replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
    if (c.endsWith('Url')) c = c.slice(0, -3) + 'URL';
    if (c.endsWith('Urls')) c = c.slice(0, -4) + 'URLs';
    return c;
  })
);

// ── Helpers ──────────────────────────────────────────────────────────────────

export function toJobPosting(row: Record<string, unknown>): JobPosting | null {
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

export function rowsToJobPostings(rows: Record<string, unknown>[]): JobPosting[] {
  const items: JobPosting[] = [];
  for (const row of rows) {
    const jp = toJobPosting(row);
    if (jp) items.push(jp);
  }
  return items;
}

/** Supabase `data` (nullable, untyped row[]) → 파싱된 JobPosting[]. */
export function dataToJobPostings(data: unknown): JobPosting[] {
  return rowsToJobPostings((data ?? []) as Record<string, unknown>[]);
}

/** 공통 catch 핸들러 — isAppError이면 rethrow, 아니면 로그 + handleSupabaseError */
export function rethrowOrHandle(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(`${operation} 실패`, toError(error), context);
  handleSupabaseError(error, { operation, table: TABLE });
}

export async function loadJobPostingForVerify(
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
 * 호출 비용: owner 본인이면 RPC 0회, 멤버면 1회, 협업자면 2회, admin/외부인이면 3회 (둘 다 throw).
 *
 * @see ApplicationRepositoryHelpers.loadAndVerifyJobPostingAccess (read-side 는 admin 통과 유지)
 */
export async function loadAndVerifyMutateAccess(
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

  const authority = await resolvePostingAuthority({
    jobPostingId,
    workspaceId: jobPosting.workspaceId,
    postingOwnerId: jobPosting.ownerId,
    actorId: callerId,
    operation,
  });
  if (canManagePosting(authority)) return jobPosting;

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
    userMessage: `워크스페이스 멤버 또는 공고 협업자만 수행할 수 있습니다: ${operation}`,
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
export async function loadAndVerifyDeleteAccess(
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

export function assertCanonical(
  doc: JobPosting,
  msg: string,
  ctx: Record<string, unknown>
): JobPosting {
  const parsed = parseJobPostingDocument(doc);
  if (parsed) return parsed;
  logger.error('Canonical job posting validation failed before write', ctx);
  throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, { userMessage: msg });
}

/** (date, timeSlot, roleKey) 매칭 키. work_logs raw 값 기준(TBA→'미정'). */
export function buildSlotRoleKey(date: string, timeSlot: string, roleKey: string): string {
  return `${date}__${timeSlot}__${roleKey}`;
}
