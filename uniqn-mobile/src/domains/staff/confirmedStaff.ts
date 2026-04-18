import { STATUS } from '@/constants';
import type {
  ConfirmedStaff,
  ConfirmedStaffGroup,
  ConfirmedStaffStats,
} from '@/types/confirmedStaff';
import type { PayrollStatus, WorkLog } from '@/types/schedule';
import type { ConfirmedStaffStatus } from '@/shared/status';
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
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
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
