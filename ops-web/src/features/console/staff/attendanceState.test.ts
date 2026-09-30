import { describe, expect, it } from 'vitest';
import { NO_PERMISSION_NOTICE, REASON_NOTICE } from '@/core/staffAttendanceNotices';
import type { OpsStaffWorkLogLink, OpsStaffWorkLogReason } from '@/core/types/ops';
import { attendanceState } from './attendanceState';

const link = (over: Partial<OpsStaffWorkLogLink>): OpsStaffWorkLogLink => ({
  opsStaffId: 's1',
  staffId: 'u1',
  staffName: '딜러',
  workLogId: 'wl1',
  wlStatus: 'confirmed',
  payrollStatus: null,
  checkInTs: null,
  checkOutTs: null,
  writeAllowed: true,
  reason: 'ok',
  ...over,
});

const BLOCKED: Exclude<OpsStaffWorkLogReason, 'ok'>[] = [
  'no_posting',
  'no_event_date',
  'not_linked',
  'cancelled',
  'ambiguous',
  'settled',
];

describe('attendanceState — fail-closed(모바일 StaffAttendanceSheet)', () => {
  it('ok + writeAllowed + workLogId 일 때만 기록 버튼을 연다', () => {
    expect(attendanceState(link({}), null)).toEqual({ notice: null, canWrite: true });
  });

  it.each(BLOCKED.flatMap((reason) => [true, false].map((w) => [reason, w] as const)))(
    '사유 %s (writeAllowed=%s) 는 사유 문구를 보이고 닫는다',
    (reason, writeAllowed) => {
      const r = attendanceState(link({ reason, writeAllowed }), null);
      expect(r).toEqual({ notice: REASON_NOTICE[reason], canWrite: false });
    }
  );

  it('ok 인데 권한이 없으면 권한 안내로 닫는다', () => {
    expect(attendanceState(link({ writeAllowed: false }), null)).toEqual({
      notice: NO_PERMISSION_NOTICE,
      canWrite: false,
    });
  });

  it('ok 인데 workLogId 가 비면 닫는다(방어)', () => {
    expect(attendanceState(link({ workLogId: null }), null).canWrite).toBe(false);
  });

  it('행 없음(null)은 not_linked 문구, 로딩(undefined)은 로딩 문구', () => {
    expect(attendanceState(null, null).notice).toBe(REASON_NOTICE.not_linked);
    expect(attendanceState(undefined, null).canWrite).toBe(false);
  });

  it('조회 실패는 "근무 기록 없음"으로 위장하지 않고 닫기만 한다', () => {
    expect(attendanceState(null, new Error('network'))).toEqual({
      notice: null,
      canWrite: false,
    });
  });
});
