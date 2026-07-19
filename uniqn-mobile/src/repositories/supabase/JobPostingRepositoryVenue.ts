/**
 * UNIQN Mobile - Supabase JobPosting Repository Venue (운영처 컨테이너 read/get-or-create)
 *
 * @description 주간 배치 그리드의 운영처(venue) 컨테이너 전용 경로.
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
  VENUE_CONTAINER_COLUMNS,
  type VenueContainer,
} from '@/domains/weeklyGrid';
import { TABLE, rethrowOrHandle } from './JobPostingRepositoryHelpers';

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
