import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { STATUS } from '@/constants';
import { TimeNormalizer } from '@/shared/time';
import type { WorkLog } from '@/types';

interface WorkTimePatch {
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  notes?: string;
}

interface CanonicalWorkTimeUpdateOptions extends WorkTimePatch {
  preserveCompletedStatus?: boolean;
}

export function resolveFinalWorkTimes(
  workLog: WorkLog,
  patch: WorkTimePatch
): { checkInTime: Date | null; checkOutTime: Date | null } {
  const hasCheckInOverride = Object.prototype.hasOwnProperty.call(patch, 'checkInTime');
  const hasCheckOutOverride = Object.prototype.hasOwnProperty.call(patch, 'checkOutTime');

  return {
    checkInTime: hasCheckInOverride
      ? (patch.checkInTime ?? null)
      : TimeNormalizer.parseTime(workLog.checkInTime ?? null),
    checkOutTime: hasCheckOutOverride
      ? (patch.checkOutTime ?? null)
      : TimeNormalizer.parseTime(workLog.checkOutTime ?? null),
  };
}

export function calculateWorkDurationHours(
  checkInTime: Date | null,
  checkOutTime: Date | null
): number | null {
  if (!checkInTime || !checkOutTime) {
    return null;
  }

  const durationMinutes = Math.round(
    (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60)
  );
  return Math.round((durationMinutes / 60) * 100) / 100;
}

export function buildCanonicalWorkTimeUpdateData(
  workLog: WorkLog,
  options: CanonicalWorkTimeUpdateOptions
): Record<string, unknown> {
  const { checkInTime, checkOutTime } = resolveFinalWorkTimes(workLog, options);
  const nextWorkDuration = calculateWorkDurationHours(checkInTime, checkOutTime);
  const nextStatus = checkOutTime
    ? options.preserveCompletedStatus && workLog.status === STATUS.WORK_LOG.COMPLETED
      ? STATUS.WORK_LOG.COMPLETED
      : STATUS.WORK_LOG.CHECKED_OUT
    : checkInTime
      ? STATUS.WORK_LOG.CHECKED_IN
      : STATUS.WORK_LOG.SCHEDULED;

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    settlementBreakdown: null,
    workDuration: nextWorkDuration,
    status: nextStatus,
  };

  if (Object.prototype.hasOwnProperty.call(options, 'checkInTime')) {
    updateData.checkInTime = options.checkInTime ? Timestamp.fromDate(options.checkInTime) : null;
  }

  if (Object.prototype.hasOwnProperty.call(options, 'checkOutTime')) {
    updateData.checkOutTime = options.checkOutTime
      ? Timestamp.fromDate(options.checkOutTime)
      : null;
  }

  if (options.notes !== undefined) {
    updateData.notes = options.notes;
  }

  return updateData;
}
