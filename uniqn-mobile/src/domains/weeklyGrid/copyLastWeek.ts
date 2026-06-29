/**
 * copyLastWeek — 지난주 동요일 배치를 이번 주로 복사(P5-1)의 순수 로직.
 *
 * 설계: docs/planning/2026-06-28-weekly-batch-grid-design.md (Phase 5 편의)
 * - 날짜 매핑: 지난주(소스) → 이번 주(타깃)는 균일 +7일 시프트(요일 보존). @/utils/date SSOT 경유.
 * - 소스 필터: no_show/cancelled 제외(정산/배치 비대상). 레포(getByVenueSpanInRange)도 SQL 레벨에서
 *   제외하지만, 순수 함수에서 비즈니스 규칙을 한 번 더 못박아 단위테스트 가능하게 한다(방어적 중복).
 * - 그룹핑: add_direct_staff 는 (jobPostingId, staffId) 당 1콜이므로 같은 키로 묶어 assignments 배열화.
 *   소스 job_posting_id 를 보존한다(그리드 작업은 job_posting_id=컨테이너=venueId 라 "같은 (스태프,
 *   컨테이너)" 와 동일; 일반 공고가 스팬에 섞여도 본래 공고로 복사되어 의미 보존).
 * - 멱등: 그룹 내 동일 (date, role, customRole, timeSlot) 배정은 1개로 중복 제거. RPC 자체도 v_already 가드.
 *
 * 렌더 없이 결정적으로 단위테스트 가능한 순수 함수(불변성: 새 객체만 생성, 입력 비변경).
 */
import { addDays } from 'date-fns';
import { STATUS } from '@/constants';
import { parseDateString, toDateString } from '@/utils/date';
import type { WorkLog } from '@/types';
import type { DirectStaffAssignmentInput } from '@/types/confirmedStaff';

/** 지난주 → 이번 주 균일 시프트(일). 요일 정합(월~일) 보존(7의 배수). */
export const COPY_LAST_WEEK_SHIFT_DAYS = 7;

/** YYYY-MM-DD 문자열을 days 만큼 이동한 YYYY-MM-DD 반환. 파싱 불가면 빈 문자열(경계 방어). */
export function shiftDateByDays(dateStr: string, days: number): string {
  const base = parseDateString(dateStr);
  if (!base) return '';
  return toDateString(addDays(base, days));
}

/** 이번 주 날짜의 지난주 동요일(7일 전). 파싱 불가면 빈 문자열. */
export function toLastWeekDate(targetDate: string): string {
  return shiftDateByDays(targetDate, -COPY_LAST_WEEK_SHIFT_DAYS);
}

/** 지난주 work_log 날짜를 이번 주 동요일(+7일)로 매핑. 파싱 불가면 빈 문자열. */
export function toThisWeekDate(sourceDate: string): string {
  return shiftDateByDays(sourceDate, COPY_LAST_WEEK_SHIFT_DAYS);
}

/** 복사 비대상 work_log(취소/노쇼) 여부. */
function isExcludedSource(workLog: WorkLog): boolean {
  return (
    workLog.status === STATUS.WORK_LOG.CANCELLED ||
    workLog.status === STATUS.WORK_LOG.NO_SHOW ||
    Boolean(workLog.noShowAt)
  );
}

/** add_direct_staff 1콜 단위(같은 공고·스태프 묶음 = p_assignments 벌크). */
export interface CopyLastWeekGroup {
  jobPostingId: string;
  staffId: string;
  assignments: DirectStaffAssignmentInput[];
}

/** 그룹 내 동일 배정 판별 키(date|role|customRole|timeSlot). */
function assignmentDedupKey(a: DirectStaffAssignmentInput): string {
  return [a.date, a.role, a.customRole ?? '', a.timeSlot ?? ''].join('|');
}

/**
 * 지난주 work_logs → 이번 주 add_direct_staff 벌크 페이로드(그룹 배열).
 *
 * - 취소/노쇼 제외, 균일 +shiftDays(요일 보존), (jobPostingId, staffId) 그룹핑,
 *   그룹 내 동일 배정 중복 제거(멱등).
 * - 날짜 파싱 불가/식별자 누락 행은 스킵(경계 방어). 입력 비변경(불변성: 새 배열·객체만 생성).
 */
export function buildCopyLastWeekPayload(
  sourceWorkLogs: readonly WorkLog[],
  shiftDays: number = COPY_LAST_WEEK_SHIFT_DAYS
): CopyLastWeekGroup[] {
  const groups = new Map<string, CopyLastWeekGroup>();
  const seen = new Map<string, Set<string>>();

  for (const workLog of sourceWorkLogs) {
    if (isExcludedSource(workLog)) continue;
    if (!workLog.jobPostingId || !workLog.staffId) continue;

    const targetDate = shiftDateByDays(workLog.date, shiftDays);
    if (!targetDate) continue;

    const assignment: DirectStaffAssignmentInput = {
      date: targetDate,
      role: workLog.role,
      ...(workLog.customRole ? { customRole: workLog.customRole } : {}),
      ...(workLog.timeSlot ? { timeSlot: workLog.timeSlot } : {}),
      ...(workLog.notes ? { notes: workLog.notes } : {}),
    };

    const groupKey = `${workLog.jobPostingId}::${workLog.staffId}`;
    const dedupKey = assignmentDedupKey(assignment);
    const seenSet = seen.get(groupKey) ?? new Set<string>();
    if (seenSet.has(dedupKey)) continue;
    seenSet.add(dedupKey);
    seen.set(groupKey, seenSet);

    const existing = groups.get(groupKey);
    if (existing) {
      groups.set(groupKey, {
        ...existing,
        assignments: [...existing.assignments, assignment],
      });
    } else {
      groups.set(groupKey, {
        jobPostingId: workLog.jobPostingId,
        staffId: workLog.staffId,
        assignments: [assignment],
      });
    }
  }

  return [...groups.values()];
}
