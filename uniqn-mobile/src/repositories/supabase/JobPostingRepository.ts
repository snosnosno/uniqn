/**
 * UNIQN Mobile - Supabase JobPosting Repository
 *
 * @description Supabase PostgREST 기반 JobPosting Repository 구현
 * @version 1.0.0
 */

import * as Sentry from '@sentry/react-native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES } from '@/errors';
import {
  handleSupabaseError,
  toSnakeCase,
  paginatedQuery,
  createRealtimeSubscription,
} from '@/utils/supabase';
import {
  createInitialPostingStats,
  mergeJobPostingInput,
  serializeJobPostingV3,
} from '@/domains/job-posting';
import { removeUndefined } from '@/utils/removeUndefined';
import { generateUUID } from '@/utils/generateId';
import { STATUS } from '@/constants';
import type { VenueContainer } from '@/domains/weeklyGrid';
import type { UnsubscribeFn, PaginationCursor } from '@/types/common';
import type { TaxSettings } from '@/utils/settlement';
import type {
  JobPosting,
  JobPostingFilters,
  JobPostingStatus,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  TournamentApprovalStatus,
} from '@/types';
import type {
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
  JobPostingSubscriptionCallbacks,
  ScheduleBoardSyncAction,
} from '../interfaces';
import {
  TABLE,
  DEFAULT_PAGE_SIZE,
  TABLE_COLUMNS,
  toJobPosting,
  rowsToJobPostings,
  dataToJobPostings,
  rethrowOrHandle,
  loadAndVerifyMutateAccess,
  loadAndVerifyDeleteAccess,
  assertCanonical,
  buildSlotRoleKey,
} from './JobPostingRepositoryHelpers';
import {
  mergeSettlementRoles,
  hasRoleCatalogIdentityMutation,
} from './JobPostingRepositorySettlement';
import * as venue from './JobPostingRepositoryVenue';

export { buildSlotRoleKey } from './JobPostingRepositoryHelpers';

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
        // fail-closed(B4): 운영처 컨테이너(status='container')는 by-id 직접조회로도
        // 일반 JobPosting 카드로 노출하지 않는다(work_logs.job_posting_id 가 컨테이너인
        // 경우 포함). 컨테이너는 전용 venue read 경로(getVenueContainerById)로만 해소하며,
        // JobPosting Zod 증발에 의존하지 않는 명시적 차단으로 스키마 진화에 견고하다.
        .neq('status', STATUS.JOB_POSTING.CONTAINER)
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
      const { data, error } = await supabase
        .from(TABLE)
        .select(TABLE_COLUMNS)
        .in('id', uniqueIds)
        // fail-closed(B4): 컨테이너 행은 배치 결과에서 제외한다. work_log 카드 해소 경로
        // (scheduleService.fetchJobPostingContextBatch 등)가 컨테이너를 일반 카드로
        // hydrate 하지 않도록 보장. 누락 id 는 호출부에서 graceful(삭제 공고와 동일 처리).
        .neq('status', STATUS.JOB_POSTING.CONTAINER);
      if (error) handleSupabaseError(error, { operation: '공고 배치 조회', table: TABLE });
      const items = dataToJobPostings(data);
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
          // 명시적 status 가 없으면 구직자 브라우즈 기본값: active + capacity_full.
          // capacity_full(정원 마감)은 spec §4/§6 + 공개 RLS(M4)상 "정원 마감" 라벨로
          // 사용자에게 노출되어야 한다. active 만 필터하면 정원이 찬 공고가 목록에서
          // 사라진다(pitfall_enum_divergence_read_disappearance).
          if (filters?.status) {
            qr = qr.eq('status', filters.status);
          } else {
            qr = qr.in('status', [STATUS.JOB_POSTING.ACTIVE, STATUS.JOB_POSTING.CAPACITY_FULL]);
          }
          // fail-closed(R2): 운영처 컨테이너(status='container')는 브라우즈/공개/운영자 목록에서
          // 항상 제외한다(명시 status·기본값 무관). 컨테이너는 JobPosting 으로 표현되지 않으며
          // 전용 venue read 경로(getVenueContainers/getVenueContainerById)로만 조회한다.
          qr = qr.neq('status', STATUS.JOB_POSTING.CONTAINER);
          if (filters?.roles?.length) qr = qr.overlaps('role_keys', filters.roles.slice(0, 10));
          if (filters?.district) qr = qr.eq('location->>district', filters.district);
          if (filters?.region) qr = qr.eq('location->>region', filters.region);
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
      // fail-closed(R2): 운영처 컨테이너는 운영자 "내 공고" 목록에 노출하지 않는다.
      query = query.neq('status', STATUS.JOB_POSTING.CONTAINER);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) handleSupabaseError(error, { operation: '소유자별 공고 조회', table: TABLE });
      const items = dataToJobPostings(data);
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
      // fail-closed(R2): 컨테이너는 관리 가능 공고 목록에서 제외한다.
      query = query.neq('status', STATUS.JOB_POSTING.CONTAINER);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) handleSupabaseError(error, { operation: '관리 가능 공고 조회', table: TABLE });
      const items = dataToJobPostings(data);
      logger.info('관리 가능 공고 조회 완료', { count: items.length });
      return items;
    } catch (error) {
      rethrowOrHandle(error, '관리 가능 공고 조회', { status, workspaceId });
    }
  }

  async getTypeCounts(
    filters?: Pick<JobPostingFilters, 'status' | 'region'>
  ): Promise<PostingTypeCounts> {
    try {
      logger.info('공고 타입별 개수 조회', { filters });
      let query = supabase.from(TABLE).select('posting_type, tournament_config');
      // 브라우즈(getList) 기본값과 정합: 명시 status 가 없으면 active + capacity_full 을
      // 집계한다. active 만 세면 정원이 찬(capacity_full) 공고가 칩 카운트에서 누락되어
      // 실제로는 브라우즈 가능한 타입이 0건으로 표시된다
      // (EF-jobsearch-11, pitfall_enum_divergence_read_disappearance — getList 동일 클래스).
      if (filters?.status) {
        query = query.eq('status', filters.status);
      } else {
        query = query.in('status', [STATUS.JOB_POSTING.ACTIVE, STATUS.JOB_POSTING.CAPACITY_FULL]);
      }
      // fail-closed(R2): 컨테이너는 타입별 칩 카운트 집계에서 제외한다.
      query = query.neq('status', STATUS.JOB_POSTING.CONTAINER);
      // region 지정 시 getList 와 동일하게 location->>region 으로 좁혀 칩 카운트 정합 유지.
      if (filters?.region) {
        query = query.eq('location->>region', filters.region);
      }
      const { data, error } = await query;
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

  // 운영처(venue) 컨테이너 경로(주간 배치 그리드) — 구현은 JobPostingRepositoryVenue 로 분리(800줄 하드캡). 동작 무변경 위임.
  async getVenueContainers(workspaceId: string): Promise<VenueContainer[]> {
    return venue.getVenueContainers(workspaceId);
  }

  async getVenueContainerById(id: string): Promise<VenueContainer | null> {
    return venue.getVenueContainerById(id);
  }

  async getOrCreateVenueContainer(
    workspaceId: string,
    options: { name: string; kind: string; period?: string }
  ): Promise<VenueContainer> {
    return venue.getOrCreateVenueContainer(workspaceId, options);
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
    // 조회수 증가는 best-effort — 실패해도 사용자 흐름을 막지 않고 swallow.
    const swallow = (message: string, errorText: string, loggedError: unknown) => {
      logger.warn('공고 조회수 증가 실패', { jobPostingId, error: loggedError });
      Sentry.addBreadcrumb({
        category: 'swallow',
        level: 'warning',
        message,
        data: { jobPostingId, error: errorText },
      });
    };
    try {
      const { error } = await supabase.rpc('increment_view_count', { posting_id: jobPostingId });
      if (error) {
        swallow('공고 조회수 증가 RPC 실패 — 무시됨', error.message, error.message);
        return;
      }
      logger.debug('공고 조회수 증가', { jobPostingId });
    } catch (error) {
      swallow('공고 조회수 증가 예외 — 무시됨', String(error), toError(error));
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
      // 클라 생성 UUID — 직접 INSERT의 멱등키(ON CONFLICT id)로 사용해 재시도 시 중복 생성 방지
      const postingId = generateUUID();
      const current: Partial<JobPosting> = {
        id: postingId,
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

      const snakeData = toSnakeCase(
        removeUndefined(serialized as unknown as Record<string, unknown>)
      );

      const { data: insertData, error: insertError } = await supabase
        .from(TABLE)
        .insert(snakeData)
        .select('id')
        .single();
      if (insertError) handleSupabaseError(insertError, { operation: '공고 생성', table: TABLE });
      const newId = (insertData as { id: string }).id;
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
          userMessage: '확정된 지원자가 있어 일정이나 역할을 변경할 수 없습니다.',
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
          userMessage: '확정된 지원자가 있는 공고는 삭제할 수 없습니다. 대신 마감해 주세요.',
        });
      }
      const now = new Date().toISOString();
      const { error: cancelError } = await supabase
        .from(TABLE)
        .update({ status: STATUS.JOB_POSTING.CANCELLED, updated_at: now })
        .eq('id', jobPostingId);
      if (cancelError) handleSupabaseError(cancelError, { operation: '공고 취소', table: TABLE });

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
          userMessage: '이미 마감된 공고입니다.',
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
          userMessage: '이미 진행 중인 공고입니다.',
        });
      }
      if (cur.status === STATUS.JOB_POSTING.CANCELLED) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '취소된 공고는 재오픈할 수 없습니다. 새 공고를 작성해 주세요.',
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
      const postings = dataToJobPostings(data);
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
      const postings = dataToJobPostings(data);
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

  // ── Schedule Board Sync Outbox ────────────────────────────────────────────

  async enqueueScheduleBoardSync(
    jobPostingId: string,
    action: ScheduleBoardSyncAction,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    const { error } = await supabase.from('schedule_board_sync_outbox').insert({
      job_posting_id: jobPostingId,
      action,
      payload,
      status: 'pending',
      retry_count: 0,
    });

    if (error) {
      // outbox insert 실패는 main mutation을 롤백시키지 않음.
      // 사용자 경험 보호 차원에서 warn 로그만 남기고, outbox failed_retry_limit
      // 모니터링 + 수동 백필이 안전망. 이는 아키텍처 결정.
      logger.warn('Schedule board sync enqueue 실패', {
        component: 'JobPostingRepository',
        jobPostingId,
        action,
        error: error.message,
      });
    }
  }
}
