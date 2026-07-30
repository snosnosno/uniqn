/**
 * UNIQN Mobile - Supabase JobPosting Repository Venue (운영처 컨테이너 read/get-or-create)
 *
 * @description 근무표의 운영처(venue) 컨테이너 전용 경로.
 * 컨테이너는 rigid JobPosting 으로 표현하지 않는다(strict 스키마 null 증발 회피).
 * status='container' 로 좁혀 경량 VenueContainer 로 파싱한다. RLS(owner/멤버/admin)가 가시성 제한.
 *
 * SupabaseJobPostingRepository 의 getVenueContainers / getVenueContainerById /
 * getOrCreateVenueContainer 가 본 모듈로 위임한다(800줄 하드캡 분리, 동작 무변경).
 */

import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { BusinessError, ValidationError, ERROR_CODES } from '@/errors';
import { xssValidation } from '@/utils/security';
import { handleSupabaseError } from '@/utils/supabase';
import { STATUS } from '@/constants';
import {
  parseVenueContainer,
  parseVenueContainers,
  parseVenueContainerLocation,
  VENUE_CONTAINER_COLUMNS,
  type VenueContainer,
} from '@/domains/workSchedule';
import type { ScheduleContainerContextInput } from '@/domains/schedule/ScheduleConverter';
import type { PostingRoleCatalogEntry, SalaryType } from '@/types';
import type { UpdateVenueContainerInput } from '../interfaces/IJobPostingRepository';
import { TABLE, rethrowOrHandle } from './JobPostingRepositoryHelpers';

const SALARY_TYPES: readonly SalaryType[] = ['hourly', 'daily', 'monthly', 'other'];

interface MyVenueRoleSalaryRow {
  job_posting_id: string;
  role: string;
  custom_role: string | null;
  salary_type: string | null;
  salary_amount: number | string | null;
}

/**
 * 운영처명(컨테이너 title) XSS 검증 스키마 (S1).
 * get_or_create_venue_container RPC 로는 이 검증을 통과한 운영처명만 전달한다.
 */
const venueContainerNameSchema = z
  .string()
  .refine(xssValidation, { message: '지점명에 허용되지 않는 문자가 포함되어 있습니다' });

export async function getVenueContainers(workspaceId: string): Promise<VenueContainer[]> {
  try {
    logger.info('운영처 컨테이너 목록 조회', { workspaceId });
    const { data, error } = await supabase
      .from(TABLE)
      .select(VENUE_CONTAINER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('status', STATUS.JOB_POSTING.CONTAINER)
      .order('title', { ascending: true });
    if (error) handleSupabaseError(error, { operation: '운영처 컨테이너 목록 조회', table: TABLE });
    const items = parseVenueContainers((data ?? []) as unknown[]);
    logger.info('운영처 컨테이너 목록 조회 완료', { workspaceId, count: items.length });
    return items;
  } catch (error) {
    rethrowOrHandle(error, '운영처 컨테이너 목록 조회', { workspaceId });
  }
}

export async function getVenueContainerById(id: string): Promise<VenueContainer | null> {
  try {
    logger.info('운영처 컨테이너 단건 조회', { id });
    const { data, error } = await supabase
      .from(TABLE)
      .select(VENUE_CONTAINER_COLUMNS)
      .eq('id', id)
      .eq('status', STATUS.JOB_POSTING.CONTAINER)
      .maybeSingle();
    if (error) handleSupabaseError(error, { operation: '운영처 컨테이너 단건 조회', table: TABLE });
    return data ? parseVenueContainer(data) : null;
  } catch (error) {
    rethrowOrHandle(error, '운영처 컨테이너 단건 조회', { id });
  }
}

/**
 * staff 본인이 배치된 지점 컨테이너들의 역할별 단가표를 배치 조회한다(#6).
 *
 * 일반 job_postings SELECT RLS 는 status='container' 를 제외하므로, staff 스케줄 경로는
 * getVenueContainerById 로 컨테이너를 못 읽는다. SECDEF RPC(get_my_venue_role_salaries)가
 * "본인이 work_log 를 가진 컨테이너"의 role/customRole/salary 만 반환한다.
 * 반환: containerId → PostingRoleCatalogEntry[]. 조회 실패는 상위(scheduleService)가 폴백 처리.
 */
export async function getMyVenueRoleSalaries(
  ids: string[]
): Promise<Map<string, PostingRoleCatalogEntry[]>> {
  const result = new Map<string, PostingRoleCatalogEntry[]>();
  if (ids.length === 0) return result;
  try {
    const { data, error } = await supabase.rpc('get_my_venue_role_salaries', { p_ids: ids });
    if (error) {
      handleSupabaseError(error, { operation: '지점 역할 단가 배치 조회', table: TABLE });
    }
    for (const row of (data ?? []) as MyVenueRoleSalaryRow[]) {
      if (!row?.job_posting_id || !row.role) continue;
      const list = result.get(row.job_posting_id) ?? [];
      const salaryType = row.salary_type;
      const salary =
        salaryType && (SALARY_TYPES as readonly string[]).includes(salaryType)
          ? { type: salaryType as SalaryType, amount: Number(row.salary_amount ?? 0) }
          : undefined;
      list.push({
        role: row.role,
        customRole: row.custom_role ?? undefined,
        salary,
      } as PostingRoleCatalogEntry);
      result.set(row.job_posting_id, list);
    }
    return result;
  } catch (error) {
    rethrowOrHandle(error, '지점 역할 단가 배치 조회', { count: ids.length });
  }
}

/** get_my_venue_contexts RPC 한 행(snake_case). location 은 jsonb 원문. */
interface MyVenueContextRow {
  job_posting_id: string;
  title: string | null;
  location: unknown;
  contact_phone: string | null;
  description: string | null;
  owner_name: string | null;
}

/**
 * staff 본인이 배치된 지점 컨테이너들의 표시 정보를 배치 조회한다(S1).
 *
 * getMyVenueRoleSalaries 와 나란히 쓰지만 다른 RPC 다 — 그쪽은 CROSS JOIN LATERAL 이라
 * 단가표가 비면 행이 0개라서, 단가를 아직 안 정한 신규 지점은 이름·장소도 못 받는다.
 * 이 RPC 는 지점당 1행을 보장한다. 조회 실패는 상위(scheduleService)가 폴백 처리.
 */
export async function getMyVenueContexts(
  ids: string[]
): Promise<Map<string, ScheduleContainerContextInput>> {
  const result = new Map<string, ScheduleContainerContextInput>();
  if (ids.length === 0) return result;
  try {
    const { data, error } = await supabase.rpc('get_my_venue_contexts', { p_ids: ids });
    if (error) {
      handleSupabaseError(error, { operation: '지점 표시 정보 배치 조회', table: TABLE });
    }
    for (const row of (data ?? []) as MyVenueContextRow[]) {
      if (!row?.job_posting_id) continue;
      result.set(row.job_posting_id, {
        title: row.title,
        location: parseVenueContainerLocation(row.location),
        contactPhone: row.contact_phone,
        description: row.description,
        ownerName: row.owner_name,
      });
    }
    return result;
  } catch (error) {
    rethrowOrHandle(error, '지점 표시 정보 배치 조회', { count: ids.length });
  }
}

/**
 * 지점 컨테이너 프로필 수정. 컨테이너는 RESTRICTIVE 정책으로 직접 UPDATE 가 막혀 있어
 * SECDEF RPC 가 유일 경로다. 부분 갱신 — undefined 필드는 NULL 로 보내 "미변경"을 뜻하고,
 * 빈 문자열은 그대로 보내 "제거"를 뜻한다(서버 규약과 동일).
 */
export async function updateVenueContainer(
  containerId: string,
  input: UpdateVenueContainerInput
): Promise<void> {
  try {
    logger.info('지점 프로필 수정', {
      containerId,
      fields: Object.keys(input).filter(
        (k) => input[k as keyof UpdateVenueContainerInput] !== undefined
      ),
    });
    const { error } = await supabase.rpc('update_venue_container', {
      p_container_id: containerId,
      p_name: input.name ?? null,
      p_location: input.location ?? null,
      p_contact_phone: input.contactPhone ?? null,
      p_description: input.description ?? null,
    });
    if (error) handleSupabaseError(error, { operation: '지점 프로필 수정', table: TABLE });
  } catch (error) {
    rethrowOrHandle(error, '지점 프로필 수정', { containerId });
  }
}

export async function getOrCreateVenueContainer(
  workspaceId: string,
  options: { name: string; kind: string; period?: string }
): Promise<VenueContainer> {
  const { name, kind, period } = options;
  // S1: 운영처명 XSS 검증 통과분만 RPC 로 전달(검증 실패 시 ValidationError, RPC 미호출).
  const parsedName = venueContainerNameSchema.safeParse(name);
  if (!parsedName.success) {
    throw new ValidationError(ERROR_CODES.SECURITY_XSS_DETECTED, {
      category: 'security',
      severity: 'medium',
      userMessage: '지점명에 허용되지 않는 문자가 포함되어 있습니다',
    });
  }
  try {
    logger.info('운영처 컨테이너 확보(get-or-create)', { workspaceId, kind });
    // RPC 는 SECDEF + 워크스페이스 게이트 + anon REVOKE 멱등 확보(get_or_create_venue_container).
    // period 는 RPC 기본 NULL 이므로 제공된 경우에만 전달한다.
    const params: {
      p_workspace_id: string;
      p_name: string;
      p_kind: string;
      p_period?: string;
    } = { p_workspace_id: workspaceId, p_name: parsedName.data, p_kind: kind };
    if (period !== undefined) params.p_period = period;

    const { data, error } = await supabase.rpc('get_or_create_venue_container', params);
    if (error) handleSupabaseError(error, { operation: '운영처 컨테이너 확보', table: TABLE });

    // RPC 는 camelCase({containerId,name,...})로 반환 → raw 행 모양으로 정규화 후
    // 경량 파서(parseVenueContainer)로 매핑한다(VenueContainer 단일 경로 재사용).
    const r = (data ?? {}) as {
      containerId?: string;
      workspaceId?: string;
      name?: string;
      kind?: string;
    };
    const container = parseVenueContainer({
      id: r.containerId,
      title: r.name,
      workspace_id: r.workspaceId,
      venue_id: r.containerId,
      status: STATUS.JOB_POSTING.CONTAINER,
      schedule: { kind: r.kind ?? kind, softTargets: {} },
    });
    if (!container) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '지점 정보 확보 결과가 올바르지 않습니다',
      });
    }
    logger.info('운영처 컨테이너 확보 완료', { workspaceId, containerId: container.id });
    return container;
  } catch (error) {
    rethrowOrHandle(error, '운영처 컨테이너 확보', { workspaceId });
  }
}
