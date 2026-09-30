import { NO_PERMISSION_NOTICE, REASON_NOTICE } from '@/core/staffAttendanceNotices';
import type { OpsStaffWorkLogLink } from '@/core/types/ops';

export interface AttendanceState {
  /** 기록을 막는 이유(안내 문구). null 이면 막을 이유 없음. */
  notice: string | null;
  /** 기록 버튼을 열어도 되는가 — `ok && writeAllowed && workLogId` 일 때만(fail-closed). */
  canWrite: boolean;
}

/**
 * 근태 대화상자 판정(순수) — 모바일 StaffAttendanceSheet 와 같은 fail-closed 규칙.
 * link: undefined = 불러오는 중, null = 근무 기록 행 없음. 조회 실패는 따로 보여 주므로 여기선 닫기만 한다.
 */
export function attendanceState(
  link: OpsStaffWorkLogLink | null | undefined,
  loadError: unknown
): AttendanceState {
  if (loadError) return { notice: null, canWrite: false };
  if (link === undefined) return { notice: '근태 정보를 불러오는 중입니다.', canWrite: false };
  if (link === null) return { notice: REASON_NOTICE.not_linked, canWrite: false };
  if (link.reason !== 'ok') return { notice: REASON_NOTICE[link.reason], canWrite: false };
  if (!link.writeAllowed) return { notice: NO_PERMISSION_NOTICE, canWrite: false };
  return { notice: null, canWrite: !!link.workLogId };
}
