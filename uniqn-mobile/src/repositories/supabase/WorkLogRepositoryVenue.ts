/**
 * UNIQN Mobile - Supabase WorkLog Repository Venue (운영처 스팬 정산 / 슬롯 편집)
 *
 * @description 주간 배치 그리드의 work_logs 경로.
 * - getByVenueSpanInRange: 운영처 스팬 + 날짜범위 정산 근무 기록 조회(Phase 4).
 * - updateSlot: 슬롯 편집(B2) — 시간/역할/색상/메모 부분 수정.
 *
 * SupabaseWorkLogRepository 가 본 모듈로 위임한다(800줄 하드캡 분리, 동작 무변경).
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { handleSupabaseError } from '@/utils/supabase';
import { STATUS } from '@/constants';
import { assertSlotColor, assertSlotMemo, composeTimeSlot } from '@/domains/weeklyGrid';
import type { WorkLog } from '@/types';
import type { UpdateSlotInput } from '../interfaces';
import {
  TABLE,
  TABLE_COLUMNS,
  MAX_STATS_PAGE_SIZE,
  rowsToWorkLogs,
  rethrowOrHandle,
} from './WorkLogRepositoryHelpers';

/**
 * 운영처(venue) 스팬 + 날짜범위 근무 기록 조회 (주간 배치 그리드 Phase 4 정산).
 *
 * E1: venue 스팬은 venue_span_posting_ids(SSOT) RPC 로 취득 — `venue_id=:V OR id=:V` 손수
 * 재작성 금지(발산 방지). R5: 날짜범위는 SQL 경계(.gte/.lte)에서 적용(전기간 풀 pull 금지).
 * status NOT IN(cancelled,no_show) 도 SQL 레벨 제외(정산 비대상).
 */
export async function getByVenueSpanInRange(
  venueId: string,
  fromDate: string,
  toDate: string
): Promise<WorkLog[]> {
  try {
    logger.info('운영처 스팬 정산 근무 기록 조회', { venueId, fromDate, toDate });

    // E1: venue 스팬 SSOT — 컨테이너 자기행 + venue_id 매칭 공고의 posting id 집합.
    // INVOKER 권한(RLS)이라 호출자가 볼 수 있는 공고만 반환(외부인=빈 스팬, fail-closed).
    const { data: spanData, error: spanError } = await supabase.rpc('venue_span_posting_ids', {
      p_venue: venueId,
    });
    if (spanError) handleSupabaseError(spanError, { operation: '운영처 스팬 조회', table: TABLE });

    // SETOF uuid 응답 — 스칼라 배열/객체(venue_span_posting_ids 키) 양형 방어 파싱(경계 검증).
    const spanIds = ((spanData ?? []) as unknown[])
      .map((row) => {
        if (typeof row === 'string') return row;
        if (row && typeof row === 'object') {
          const value = (row as Record<string, unknown>).venue_span_posting_ids;
          return typeof value === 'string' ? value : null;
        }
        return null;
      })
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    // 스팬이 비면(외부인 fail-closed 또는 공고 0개) work_logs 조회를 생략한다.
    if (spanIds.length === 0) {
      logger.info('운영처 스팬 비어있음 — 빈 결과', { venueId });
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select(TABLE_COLUMNS)
      .in('job_posting_id', spanIds)
      .gte('date', fromDate)
      .lte('date', toDate)
      .not('status', 'in', `(${STATUS.WORK_LOG.CANCELLED},${STATUS.WORK_LOG.NO_SHOW})`)
      .order('date', { ascending: false })
      .limit(MAX_STATS_PAGE_SIZE);

    if (error)
      handleSupabaseError(error, { operation: '운영처 스팬 정산 근무 기록 조회', table: TABLE });

    const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
    if (items.length === MAX_STATS_PAGE_SIZE) {
      logger.warn(
        '운영처 스팬 정산 근무 기록 조회 상한 도달 — 날짜범위 축소/페이지네이션 필요 가능',
        {
          venueId,
          limit: MAX_STATS_PAGE_SIZE,
        }
      );
    }
    logger.info('운영처 스팬 정산 근무 기록 조회 완료', { venueId, count: items.length });
    return items;
  } catch (error) {
    rethrowOrHandle(error, '운영처 스팬 정산 근무 기록 조회', { venueId, fromDate, toDate });
  }
}

/**
 * 슬롯 편집(주간 배치 그리드 B2) — 시간/역할/색상/메모 부분 수정.
 *
 * 검증 경계(Repository): color 는 토큰 화이트리스트(자유 hex 거부), memo 는 XSS 검증
 * 통과분만 기록(S1/U3). startTime+endTime 둘 다 제공 시에만 time_slot 갱신(읽기-수정-쓰기 회피).
 */
export async function updateSlot(workLogId: string, input: UpdateSlotInput): Promise<void> {
  try {
    logger.info('배치 슬롯 편집', { workLogId, fields: Object.keys(input) });

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // 시간: 시작/종료 둘 다 제공 시에만 time_slot('HH:MM - HH:MM') 갱신.
    if (input.startTime && input.endTime) {
      updateData.time_slot = composeTimeSlot(input.startTime, input.endTime);
    }

    // 역할(StaffRole)
    if (input.staffRole !== undefined) {
      updateData.role = input.staffRole;
    }

    // 색상: 화이트리스트 검증(자유 hex 거부) — 위반 시 ValidationError 던짐
    if (input.color !== undefined) {
      updateData.color = assertSlotColor(input.color);
    }

    // 메모: XSS/길이 검증 — 위반 시 ValidationError 던짐
    if (input.memo !== undefined) {
      updateData.notes = assertSlotMemo(input.memo);
    }

    // 수정 행위자(운영자)
    if (input.editedBy !== undefined) {
      updateData.edited_by = input.editedBy;
    }

    const { error } = await supabase.from(TABLE).update(updateData).eq('id', workLogId);

    if (error) handleSupabaseError(error, { operation: '배치 슬롯 편집', table: TABLE });

    logger.info('배치 슬롯 편집 완료', { workLogId });
  } catch (error) {
    rethrowOrHandle(error, '배치 슬롯 편집', { workLogId });
  }
}
