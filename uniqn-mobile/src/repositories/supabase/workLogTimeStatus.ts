/**
 * 근무 시간 수정 → work_log status 파생 (두 경로 공용 SSOT)
 *
 * @description work_logs 의 정산 게이트는 **status** 로 판정한다
 *   (SettlementRepository.settleWorkLogWithTransaction — `status !== checked_out && !== completed` 거부).
 *   따라서 출퇴근 시각을 쓰는 모든 경로는 status 도 함께 맞춰야 한다. 정산 화면 경로가 이걸
 *   빠뜨려 '시간을 고쳐도 영원히 정산 불가' 인 막다른 길이 생겼다(SET-1).
 *
 *   같은 규칙을 두 리포지토리가 각자 구현하면 다시 어긋나므로 여기 하나로 모은다.
 *   - `SettlementRepository.updateWorkTimeWithTransaction` (정산 탭)
 *   - `ConfirmedStaffRepository.updateWorkTimeWithTransaction` (스태프 관리 탭)
 *
 * @remarks 반대 방향(status → 타임스탬프) 파생은 `ConfirmedStaffRepository.buildStatusTimestampPatch`
 *   가 담당한다. 그쪽은 수동 상태 변경 경로용이다.
 */

import { STATUS } from '@/constants';
import type { DateInput } from '@/utils/date';

/**
 * 시간 수정이 status 를 건드려도 되는 상태들(근태 생애주기).
 *
 * no_show·cancelled 는 제외한다 — 시간 수정이 노쇼를 조용히 checked_out 으로 뒤집으면
 * 없던 유급 근무가 생긴다. 노쇼 정정은 전용 경로(cancelNoShow)만 담당한다.
 */
const LIFECYCLE_STATUSES: readonly string[] = [
  STATUS.WORK_LOG.SCHEDULED,
  STATUS.WORK_LOG.CHECKED_IN,
  STATUS.WORK_LOG.CHECKED_OUT,
  STATUS.WORK_LOG.COMPLETED,
];

export interface WorkTimeStatusInput {
  /** 수정 전 work_log.status */
  currentStatus: string | undefined;
  /** 이번 수정 요청값 — `undefined`=변경 안함, `null`=삭제(미정) */
  incomingCheckIn: Date | null | undefined;
  incomingCheckOut: Date | null | undefined;
  /** 수정 전 저장돼 있던 값 (WorkLog 의 타임스탬프는 `DateInput` 이라 문자열일 수 있다) */
  existingCheckIn: DateInput;
  existingCheckOut: DateInput;
}

/**
 * 3-값 병합 — `undefined`(미변경)만 기존 값으로 폴백하고 `null`(삭제)은 그대로 둔다.
 *
 * ⚠️ `incoming ?? existing` 으로 쓰면 **삭제가 무시된다**(`null ?? x === x`). 이 한 줄이
 * 두 리포지토리 호출부에서 각자 반복되던 자리라 헬퍼 안으로 넣어 고정한다.
 */
function mergeWorkTime(incoming: Date | null | undefined, existing: DateInput): DateInput {
  return incoming === undefined ? existing : incoming;
}

/**
 * 최종 출퇴근 시각으로부터 기록해야 할 status 를 구한다.
 *
 * @returns 기록할 status. `undefined` 면 status 를 UPDATE payload 에 넣지 않는다(미변경).
 *
 * @remarks 출근 시각이 없으면 `scheduled` 로 강등한다. CHECK 제약
 *   `work_logs_status_timestamp_consistency`(checked_in→check_in_ts NOT NULL,
 *   checked_out/completed→양쪽 NOT NULL) 때문에, 시각을 지우면서 status 를 그대로 두면
 *   UPDATE 전체가 23514 로 거부된다.
 */
export function resolveWorkTimeStatus({
  currentStatus,
  incomingCheckIn,
  incomingCheckOut,
  existingCheckIn,
  existingCheckOut,
}: WorkTimeStatusInput): string | undefined {
  if (!currentStatus || !LIFECYCLE_STATUSES.includes(currentStatus)) return undefined;

  const finalCheckIn = mergeWorkTime(incomingCheckIn, existingCheckIn);
  const finalCheckOut = mergeWorkTime(incomingCheckOut, existingCheckOut);

  if (finalCheckIn && finalCheckOut) {
    // 이미 completed 인 행을 checked_out 으로 되돌리지 않는다 — completed 도 '양쪽 NOT NULL' 을
    // 만족하므로 제약 위반이 아니고, 강등하면 tr_sync_application_completion 이 applications 를
    // 불필요하게 역전파한다.
    return currentStatus === STATUS.WORK_LOG.COMPLETED ? undefined : STATUS.WORK_LOG.CHECKED_OUT;
  }

  if (finalCheckIn) return STATUS.WORK_LOG.CHECKED_IN;

  return STATUS.WORK_LOG.SCHEDULED;
}
