import { STATUS } from '@/constants';
import { WEEKDAYS_KO } from '@/constants/weekdays';
import type {
  ConfirmedStaff,
  ConfirmedStaffGroup,
  ConfirmedStaffStats,
} from '@/types/confirmedStaff';
import type { PayrollStatus, WorkLog } from '@/types/schedule';
import type { ConfirmedStaffStatus, WorkLogStatus } from '@/shared/status';
import type { TimeInput } from '@/shared/time/types';
import { formatDateWithDay, getTodayString } from '@/utils/date';

const UNDATED_GROUP_KEY = '__undated__';
const UNDATED_LABEL = '날짜 미정';

type WorkLogWithConfirmedStaffFields = WorkLog & {
  timeSlot?: string;
  checkInTime?: TimeInput;
  checkOutTime?: TimeInput;
  customRole?: string;
  noShowAt?: TimeInput;
  noShowReason?: string;
};

function normalizeGroupDate(date: string): string {
  return typeof date === 'string' && date.trim().length > 0 ? date : UNDATED_GROUP_KEY;
}

function denormalizeGroupDate(groupKey: string): string {
  return groupKey === UNDATED_GROUP_KEY ? '' : groupKey;
}

function compareGroupDates(a: string, b: string): number {
  if (a === UNDATED_GROUP_KEY) return 1;
  if (b === UNDATED_GROUP_KEY) return -1;
  return a.localeCompare(b);
}

function formatDateKorean(date: Date | string): string {
  if (typeof date === 'string') {
    if (!date) {
      return UNDATED_LABEL;
    }

    return formatDateWithDay(date) || date;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = WEEKDAYS_KO;
  const dayOfWeek = dayNames[date.getDay()];

  return `${month}월 ${day}일(${dayOfWeek})`;
}

export function workLogToConfirmedStaff(
  workLog: WorkLogWithConfirmedStaffFields,
  staffName?: string
): ConfirmedStaff {
  const isNoShow = Boolean(workLog.noShowAt);

  return {
    id: workLog.id,
    staffId: workLog.staffId,
    staffName: staffName || workLog.staffName || workLog.staffId.slice(-4),
    staffNickname: workLog.staffNickname,
    staffPhotoURL: workLog.staffPhotoURL,
    staffPhotoURLBlurhash: workLog.staffPhotoURLBlurhash,
    role: workLog.role,
    customRole: workLog.customRole,
    date: workLog.date,
    status: isNoShow ? 'no_show' : (workLog.status as ConfirmedStaffStatus),
    isNoShow,
    noShowReason: workLog.noShowReason,
    noShowAt: workLog.noShowAt,
    timeSlot: workLog.timeSlot,
    color: workLog.color,
    checkInTime: workLog.checkInTime,
    checkOutTime: workLog.checkOutTime,
    payrollStatus: workLog.payrollStatus as PayrollStatus | undefined,
    payrollAmount: workLog.payrollAmount,
    notes: workLog.notes,
    workLog,
  };
}

export function groupStaffByDate(staffList: ConfirmedStaff[]): ConfirmedStaffGroup[] {
  const today = getTodayString();
  const groupMap = new Map<string, ConfirmedStaff[]>();

  staffList.forEach((staff) => {
    const groupKey = normalizeGroupDate(staff.date);
    const existing = groupMap.get(groupKey) || [];
    groupMap.set(groupKey, [...existing, staff]);
  });

  return Array.from(groupMap.entries())
    .map(([groupKey, staffInDate]) => {
      const date = denormalizeGroupDate(groupKey);

      return {
        date,
        formattedDate: formatDateKorean(date),
        staff: staffInDate,
        isToday: date === today,
        isPast: Boolean(date) && date < today,
        stats: {
          total: staffInDate.length,
          checkedIn: staffInDate.filter((staff) => staff.status === STATUS.WORK_LOG.CHECKED_IN)
            .length,
          completed: staffInDate.filter(
            (staff) =>
              staff.status === STATUS.WORK_LOG.CHECKED_OUT ||
              staff.status === STATUS.WORK_LOG.COMPLETED
          ).length,
          noShow: staffInDate.filter((staff) => staff.status === STATUS.WORK_LOG.NO_SHOW).length,
        },
      };
    })
    .sort((a, b) => compareGroupDates(normalizeGroupDate(a.date), normalizeGroupDate(b.date)));
}

export function calculateStaffStats(staffList: ConfirmedStaff[]): ConfirmedStaffStats {
  return {
    total: staffList.length,
    scheduled: staffList.filter((staff) => staff.status === STATUS.WORK_LOG.SCHEDULED).length,
    checkedIn: staffList.filter((staff) => staff.status === STATUS.WORK_LOG.CHECKED_IN).length,
    checkedOut: staffList.filter((staff) => staff.status === STATUS.WORK_LOG.CHECKED_OUT).length,
    completed: staffList.filter((staff) => staff.status === STATUS.WORK_LOG.COMPLETED).length,
    cancelled: staffList.filter((staff) => staff.status === STATUS.WORK_LOG.CANCELLED).length,
    noShow: staffList.filter((staff) => staff.status === STATUS.WORK_LOG.NO_SHOW).length,
    settled: staffList.filter((staff) => staff.payrollStatus === STATUS.PAYROLL.COMPLETED).length,
  };
}

/**
 * 노쇼 취소 시 되돌아갈 근무 상태를 결정한다(순수 함수).
 *
 * DB CHECK 제약 `work_logs_status_timestamp_consistency`가 status와 타임스탬프
 * 정합을 강제한다(checked_in은 check_in_ts 필수, checked_out/completed는 양쪽
 * 필수). 따라서 노쇼 취소는 고정된 상태(예: scheduled)로 되돌리는 게 아니라,
 * 남아있는 출퇴근 타임스탬프로부터 상태를 재구성해야 제약을 위반하지 않는다.
 */
export function resolveNoShowRevertStatus(
  checkInTime?: TimeInput | null,
  checkOutTime?: TimeInput | null
): WorkLogStatus {
  if (checkInTime && checkOutTime) {
    return STATUS.WORK_LOG.CHECKED_OUT;
  }

  if (checkInTime) {
    return STATUS.WORK_LOG.CHECKED_IN;
  }

  return STATUS.WORK_LOG.SCHEDULED;
}

export function sortStaffByStatus(staffList: ConfirmedStaff[]): ConfirmedStaff[] {
  const statusPriority: Record<ConfirmedStaffStatus, number> = {
    checked_in: 0,
    scheduled: 1,
    checked_out: 2,
    completed: 3,
    no_show: 4,
    cancelled: 5,
  };

  return [...staffList].sort((a, b) => {
    const priorityA = statusPriority[a.status] ?? 99;
    const priorityB = statusPriority[b.status] ?? 99;
    return priorityA - priorityB;
  });
}
