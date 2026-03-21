/**
 * ScheduleConverter - schedule event conversion helpers
 *
 * WorkLog/Application -> ScheduleEvent conversion lives here so service code can
 * stay focused on fetching canonical postings and repositories.
 */

import { Timestamp } from 'firebase/firestore';
import { getPostingSettlementContext, toJobPostingCard } from '@/domains/job-posting';
import type { PostingSettlementContext } from '@/domains/job-posting';
import { STATUS } from '@/constants';
import { StatusMapper } from '@/shared/status';
import type {
  Application,
  ApplicationStatus,
  JobPosting,
  ScheduleEvent,
  ScheduleType,
  WorkLog,
} from '@/types';
import {
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
  TBA_TIME_MARKER,
  normalizeAssignmentRole,
} from '@/types/assignment';
import { parseTimeSlotToDate } from '@/utils/date/ranges';
import { normalizeTimestamp } from '@/utils/firestore';
import { calculateSettlementBreakdown } from '@/utils/settlement';

export interface SchedulePostingContext {
  posting: JobPosting;
  title: string;
  location: string;
  contactPhone?: string;
  ownerId?: string;
  settlement: PostingSettlementContext;
}

export function createSchedulePostingContext(posting: JobPosting): SchedulePostingContext {
  return {
    posting,
    title: posting.title || '이벤트',
    location: posting.location?.name || '',
    contactPhone: posting.contactPhone,
    ownerId: posting.ownerId,
    settlement: getPostingSettlementContext(posting),
  };
}

export class ScheduleConverter {
  static workLogToScheduleEvent(
    workLog: WorkLog,
    postingContext?: SchedulePostingContext
  ): ScheduleEvent {
    const type = StatusMapper.workLogToSchedule(workLog.status);
    const attendanceStatus = StatusMapper.toAttendance(workLog.status);
    const settlementBreakdown = calculateSettlementBreakdown(
      {
        checkInTime: workLog.checkInTime,
        checkOutTime: workLog.checkOutTime,
        timeSlot: workLog.timeSlot,
        date: workLog.date,
        role: workLog.role,
        customRole: workLog.customRole,
        customSalaryInfo: workLog.customSalaryInfo,
        customAllowances: workLog.customAllowances,
        customTaxSettings: workLog.customTaxSettings,
      },
      postingContext?.settlement
    );
    const jobPostingCard = postingContext ? toJobPostingCard(postingContext.posting) : undefined;
    const jobPostingId = workLog.jobPostingId || '';
    const jobPostingName = postingContext?.title || '이벤트';
    const timeSlotParsed = parseTimeSlotToDate(workLog.timeSlot ?? null, workLog.date);
    const startTimeFromTimeSlot = timeSlotParsed.startTime
      ? Timestamp.fromDate(timeSlotParsed.startTime)
      : null;
    const endTimeFromTimeSlot = timeSlotParsed.endTime
      ? Timestamp.fromDate(timeSlotParsed.endTime)
      : null;

    return {
      id: workLog.id,
      type,
      date: workLog.date,
      startTime: startTimeFromTimeSlot,
      endTime: endTimeFromTimeSlot,
      checkInTime: normalizeTimestamp(workLog.checkInTime),
      checkOutTime: normalizeTimestamp(workLog.checkOutTime),
      jobPostingId,
      jobPostingName,
      location: postingContext?.location || '',
      role: workLog.role,
      customRole: workLog.customRole,
      status: attendanceStatus,
      payrollStatus: workLog.payrollStatus,
      payrollAmount: workLog.payrollAmount,
      ownerPhone: postingContext?.contactPhone,
      ownerId: workLog.ownerId || postingContext?.ownerId,
      notes: workLog.notes,
      sourceCollection: 'workLogs',
      sourceId: workLog.id,
      workLogId: workLog.id,
      applicationId: `${jobPostingId}_${workLog.staffId}`,
      customSalaryInfo: workLog.customSalaryInfo,
      customAllowances: workLog.customAllowances,
      customTaxSettings: workLog.customTaxSettings,
      jobPostingCard,
      timeSlot: workLog.timeSlot,
      settlementBreakdown: settlementBreakdown || undefined,
      createdAt: workLog.createdAt,
      updatedAt: workLog.updatedAt,
    };
  }

  static applicationToScheduleEvents(
    application: Application,
    postingContext?: SchedulePostingContext
  ): ScheduleEvent[] {
    const scheduleType = this.mapApplicationStatusToScheduleType(application.status);

    if (!scheduleType) {
      return [];
    }

    const jobPostingCard = postingContext ? toJobPostingCard(postingContext.posting) : undefined;

    return application.assignments.flatMap((assignment, assignmentIdx) =>
      assignment.dates.flatMap((date, dateIdx) => {
        if (date === FIXED_DATE_MARKER) {
          return [];
        }

        const normalizedRole = normalizeAssignmentRole(assignment.roleIds[0]);

        return [
          {
            id: `${application.id}_${assignmentIdx}_${dateIdx}`,
            type: scheduleType,
            date,
            startTime: this.parseTimeSlotToTimestamp(assignment.timeSlot, date, 'start'),
            endTime: this.parseTimeSlotToTimestamp(assignment.timeSlot, date, 'end'),
            checkInTime: null,
            checkOutTime: null,
            jobPostingId: application.jobPostingId,
            jobPostingName: postingContext?.title || application.jobPostingTitle || '공고',
            location: postingContext?.location || '',
            role: normalizedRole.role,
            customRole: normalizedRole.customRole ?? application.customRole,
            status: STATUS.ATTENDANCE.NOT_STARTED,
            payrollStatus: undefined,
            payrollAmount: undefined,
            ownerPhone: postingContext?.contactPhone,
            ownerId: postingContext?.ownerId,
            notes: application.message,
            sourceCollection: 'applications',
            sourceId: application.id,
            applicationId: application.id,
            jobPostingCard,
            timeSlot: assignment.timeSlot,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
          },
        ] satisfies ScheduleEvent[];
      })
    );
  }

  static mapApplicationStatusToScheduleType(status: ApplicationStatus): ScheduleType | null {
    return StatusMapper.applicationToSchedule(status);
  }

  static parseTimeSlotToTimestamp(
    timeSlot: string,
    date: string,
    type: 'start' | 'end'
  ): Timestamp | null {
    if (
      !timeSlot ||
      timeSlot === FIXED_TIME_MARKER ||
      timeSlot === TBA_TIME_MARKER ||
      timeSlot === '미정'
    ) {
      return null;
    }

    const { startTime, endTime } = parseTimeSlotToDate(timeSlot, date);
    const parsedTime = type === 'start' ? startTime : (endTime ?? startTime);
    return parsedTime ? Timestamp.fromDate(parsedTime) : null;
  }
}
