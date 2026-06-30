/**
 * copyLastWeekService — 지난주 동요일 배치를 이번 주로 복사(P5-1) 오케스트레이션.
 *
 * 아키텍처: Hook → Service → Repository. 두 레포(WorkLog 읽기 + ConfirmedStaff 쓰기)를 조율한다.
 * 1) 소스: 지난주 동일 구간(이번 주 시작 −7 ~ −1)의 venue 스팬 work_logs 를
 *    workLogRepository.getByVenueSpanInRange 로 조회(E1 SSOT 경유, SQL 레벨 cancelled/no_show 제외).
 * 2) 순수 빌더: buildCopyLastWeekPayload 로 +7일 매핑 + (공고,스태프) 그룹핑 + 동일 배정 중복 제거.
 * 3) 쓰기: add_direct_staff 는 (공고,스태프) 당 1콜이므로 그룹별로 호출(p_assignments 벌크, 멱등 가드).
 *    컨테이너 status 면 RPC 가 filled 미러를 skip(Phase 3a) — 클라는 분기 불필요.
 */
import { logger } from '@/utils/logger';
import { ValidationError, BusinessError, ERROR_CODES } from '@/errors';
import { workLogRepository, confirmedStaffRepository } from '@/repositories';
import { requireCurrentUser } from '@/services/auth/authCoreService';
import {
  buildCopyLastWeekPayload,
  shiftDateByDays,
  COPY_LAST_WEEK_SHIFT_DAYS,
} from '@/domains/weeklyGrid';

export interface CopyLastWeekInput {
  venueId: string;
  /** 이번 주 시작일(YYYY-MM-DD). 지난주 동일 구간(−7 ~ −1)을 +7일로 복사한다. */
  targetWeekStart: string;
}

export interface CopyLastWeekResult {
  /** add_direct_staff 호출 그룹 수(= 복사된 (공고,스태프) 조합 수). */
  staffGroups: number;
  /** 복사 시도된 총 배정 수(그룹 내 assignments 합). */
  assignments: number;
  /** RPC 가 신규 생성한 work_log id 목록(기존 중복분은 멱등 가드로 제외). */
  workLogIds: string[];
}

export async function copyLastWeek(input: CopyLastWeekInput): Promise<CopyLastWeekResult> {
  await requireCurrentUser();

  const sourceFrom = shiftDateByDays(input.targetWeekStart, -COPY_LAST_WEEK_SHIFT_DAYS);
  const sourceTo = shiftDateByDays(input.targetWeekStart, -1);
  if (!sourceFrom || !sourceTo) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      field: 'targetWeekStart',
      userMessage: '복사 기준 주의 날짜 형식이 올바르지 않습니다.',
    });
  }

  logger.info('지난주 배치 복사 시작', {
    venueId: input.venueId,
    targetWeekStart: input.targetWeekStart,
    sourceFrom,
    sourceTo,
  });

  // 소스: 지난주 동일 구간 venue 스팬 work_logs(E1 SSOT, SQL 레벨 cancelled/no_show 제외).
  const sourceWorkLogs = await workLogRepository.getByVenueSpanInRange(
    input.venueId,
    sourceFrom,
    sourceTo
  );

  // 순수 빌더: +7일 매핑 + (공고,스태프) 그룹핑 + 동일 배정 중복 제거.
  const groups = buildCopyLastWeekPayload(sourceWorkLogs, COPY_LAST_WEEK_SHIFT_DAYS);
  if (groups.length === 0) {
    logger.info('지난주 배치 복사 — 복사 대상 없음', {
      venueId: input.venueId,
      sourceCount: sourceWorkLogs.length,
    });
    return { staffGroups: 0, assignments: 0, workLogIds: [] };
  }

  // add_direct_staff 는 (공고,스태프) 당 1콜이며 그룹별로 별도 트랜잭션이다(p_assignments 벌크).
  // RPC 는 동일 (staff,date,slot,role) 이면 DUPLICATE_ASSIGNMENT, 정원 초과면 MAX_CAPACITY_REACHED
  // 를 RAISE(스킵 아님)한다. Promise.all 이면 한 그룹의 RAISE 가 이미 커밋된 다른 그룹을
  // 되돌리지 못한 채 전체를 reject → 부분적용 + 일반 실패 토스트가 된다.
  //   재클릭/기존 수동배치(=DUPLICATE)와 정원초과(=CAPACITY)는 복사 시 정상적으로 발생할 수 있는
  //   양성 스킵으로 흡수해 멱등성을 보장하고(부분성공), 권한/네트워크 등 실제 오류만 표면화한다.
  const settled = await Promise.allSettled(
    groups.map((group) =>
      confirmedStaffRepository.addDirectStaff({
        jobPostingId: group.jobPostingId,
        staffId: group.staffId,
        assignments: group.assignments,
      })
    )
  );

  const workLogIds: string[] = [];
  let skipped = 0;
  let firstGenuineError: unknown;
  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      workLogIds.push(...res.value);
      return;
    }
    if (isBenignCopySkip(res.reason)) {
      skipped += 1;
      logger.info('지난주 배치 복사 — 그룹 스킵(이미 배정/정원 초과)', {
        venueId: input.venueId,
        jobPostingId: groups[i]?.jobPostingId,
        staffId: groups[i]?.staffId,
      });
      return;
    }
    if (firstGenuineError === undefined) firstGenuineError = res.reason;
  });

  // 양성 스킵은 부분성공으로 흡수하되, 실제 오류(권한/미존재/네트워크)는 그대로 표면화.
  if (firstGenuineError !== undefined) throw firstGenuineError;

  const assignments = groups.reduce((sum, group) => sum + group.assignments.length, 0);

  logger.info('지난주 배치 복사 완료', {
    venueId: input.venueId,
    staffGroups: groups.length,
    assignments,
    created: workLogIds.length,
    skipped,
  });

  return { staffGroups: groups.length, assignments, workLogIds };
}

/**
 * 복사 시 흡수할 양성 스킵 판별.
 * add_direct_staff 가 RAISE 하는 도메인 에러 중 복사 맥락에서 "정상적으로 발생 가능"한 두 가지:
 *   - DUPLICATE_ASSIGNMENT → BUSINESS_INVALID_STATE(E6042): 이미 배정됨(멱등 재복사·기존 수동배치)
 *   - MAX_CAPACITY_REACHED → BUSINESS_MAX_CAPACITY_REACHED(E6004): 스팬 내 정원 초과(복사 불가)
 * (이 맥락에서 BUSINESS_INVALID_STATE 의 유일 출처는 ConfirmedStaffRepository 의 DUPLICATE 매핑이다.)
 */
function isBenignCopySkip(reason: unknown): boolean {
  return (
    reason instanceof BusinessError &&
    (reason.code === ERROR_CODES.BUSINESS_INVALID_STATE ||
      reason.code === ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED)
  );
}
