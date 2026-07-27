/**
 * UNIQN Mobile - 운영처(venue) 정산 조회 서비스 (근무표 Phase 4)
 *
 * @description 운영처 컨테이너의 정산 대상 근무 기록을 venue 스팬 + 날짜범위 SQL 집계로 조회한다.
 * 기존 공고별 정산(settlementQuery.getWorkLogsByJobPosting)은 클라이언트단에서 dateRange 를
 * 잘라냈지만(전기간 풀 pull 후 필터), venue 경로는 날짜범위를 SQL 경계(repo)로 이전해
 * 전기간 풀 pull 을 피한다(R5). venue 스팬은 venue_span_posting_ids(SSOT) 경유(E1).
 *
 * @version 1.0.0
 */

import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { SettlementCalculator, resolveEffectiveSalaryWithSource } from '@/domains/settlement';
import { getPostingSettlementContext } from '@/domains/job-posting';
import { getEffectiveAllowances, getEffectiveTaxSettings } from '@/utils/settlement';
import { DEFAULT_SALARY_INFO } from '@/utils/settlement/constants';
import { jobPostingRepository, workLogRepository } from '@/repositories';
import type {
  WorkLog,
  PostingSettlementContext,
  JobRoleStats,
  PostingRoleCatalogEntry,
} from '@/types';
import { type WorkLogWithOverrides, type SettlementWorkLog, type SettlementFilters } from './types';

/**
 * toSettlementWorkLog 가 실제로 읽는 정산 컨텍스트 최소 형태. 공고 정산 컨텍스트
 * (PostingSettlementContext, roles=JobRoleStats[])와 컨테이너 단가표(roles=PostingRoleCatalogEntry[])를
 * 함께 수용한다 — resolveEffectiveSalaryWithSource 는 role/customRole/salary 만 읽으므로 count/filled 불요.
 */
type SettlementResolutionContext = {
  roles: JobRoleStats[] | PostingRoleCatalogEntry[];
  defaultSalary?: PostingSettlementContext['defaultSalary'];
  allowances?: PostingSettlementContext['allowances'];
  taxSettings?: PostingSettlementContext['taxSettings'];
};

/**
 * 단일 근무 기록 → SettlementWorkLog(근무시간/예상정산액 부가). SettlementCalculator 재사용.
 */
function toSettlementWorkLog(
  workLog: WorkLog,
  context: SettlementResolutionContext,
  jobPostingTitle?: string
): SettlementWorkLog {
  const wlWithOverrides = workLog as WorkLogWithOverrides;
  const { salaryInfo, source } = resolveEffectiveSalaryWithSource(
    wlWithOverrides,
    context.roles,
    context.defaultSalary
  );
  const allowances = getEffectiveAllowances(wlWithOverrides, context.allowances);
  const taxSettings = getEffectiveTaxSettings(wlWithOverrides, context.taxSettings);

  const result = SettlementCalculator.calculate({
    startTime: workLog.checkInTime,
    endTime: workLog.checkOutTime,
    salaryInfo,
    allowances,
    taxSettings,
  });

  return {
    ...workLog,
    jobPostingTitle,
    hoursWorked: result.hoursWorked,
    calculatedAmount: result.afterTaxPay,
    salaryInfo,
    salarySource: source,
  };
}

/**
 * 운영처 정산 근무 기록 조회 (구인자/운영자용)
 *
 * @description 운영처 컨테이너 V 의 스팬(컨테이너+open공고) 안에서 dateRange 에 속하는
 * 근무 기록을 조회해 예상 정산액을 계산한다.
 * - 권한: venue_span_posting_ids 가 INVOKER(RLS)라 호출자가 볼 수 없는 공고는 스팬에서 빠진다
 *   → 외부인은 빈 결과(fail-closed). work_logs SELECT RLS 가 한 번 더 게이트한다.
 * - 날짜범위는 repo(SQL .gte/.lte)에서 이미 적용됨 — 본 함수는 클라 날짜필터를 하지 않는다(R5).
 * - cancelled/no_show 제외도 repo SQL 에서 처리됨.
 *
 * @param venueId - 운영처 컨테이너 id
 * @param dateRange - 정산 기간(YYYY-MM-DD, start/end inclusive)
 * @param filters - 날짜 외 부가 필터(역할/정산상태) — 클라단 적용
 * @returns 예상 정산액이 부가된 근무 기록 목록
 */
export async function getVenueSettlementWorkLogs(
  venueId: string,
  dateRange: { start: string; end: string },
  filters?: Pick<SettlementFilters, 'payrollStatus' | 'role'>
): Promise<SettlementWorkLog[]> {
  try {
    logger.info('운영처 정산 근무 기록 조회', { venueId, dateRange, filters });

    // E1+R5: venue 스팬(SSOT) + 날짜범위(SQL) + cancelled/no_show 제외(SQL) 는 repo 가 처리.
    const workLogs = await workLogRepository.getByVenueSpanInRange(
      venueId,
      dateRange.start,
      dateRange.end
    );

    // 컨테이너 직속 배치(jobPostingId=venueId)의 2순위 해소 — 지점 역할별 단가표(설계 §A).
    const container = await jobPostingRepository.getVenueContainerById(venueId);
    const venueContext: SettlementResolutionContext = {
      roles: container?.roleSalaries ?? [],
      defaultSalary: DEFAULT_SALARY_INFO,
      allowances: undefined,
      taxSettings: undefined,
    };

    // 스팬 내 실재 공고(컨테이너 제외=B4)별 정산 컨텍스트 맵. 컨테이너 직속 배치는 venue 컨텍스트.
    const postingIds = Array.from(
      new Set(workLogs.map((wl) => wl.jobPostingId).filter((id): id is string => Boolean(id)))
    );
    const postings =
      postingIds.length > 0 ? await jobPostingRepository.getByIdBatch(postingIds) : [];
    const contextByPosting = new Map<
      string,
      { context: PostingSettlementContext; title: string }
    >();
    for (const posting of postings) {
      if (posting.id) {
        contextByPosting.set(posting.id, {
          context: getPostingSettlementContext(posting),
          title: posting.title,
        });
      }
    }

    let result = workLogs.map((wl) => {
      const found = wl.jobPostingId ? contextByPosting.get(wl.jobPostingId) : undefined;
      return toSettlementWorkLog(
        wl,
        found?.context ?? venueContext,
        found?.title ?? container?.name
      );
    });

    // 날짜 외 부가 필터(역할/정산상태)는 클라단 — 날짜만 SQL 경계로 이전한 설계.
    if (filters?.payrollStatus) {
      result = result.filter((wl) => wl.payrollStatus === filters.payrollStatus);
    }
    if (filters?.role) {
      result = result.filter((wl) => {
        if (wl.role === filters.role) return true;
        // 커스텀 역할: role='other' + customRole 매칭
        if (wl.role === 'other' && wl.customRole === filters.role) return true;
        return false;
      });
    }

    logger.info('운영처 정산 근무 기록 조회 완료', { venueId, count: result.length });
    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '운영처 정산 근무 기록 조회',
      component: 'settlementService',
      context: { venueId },
    });
  }
}
