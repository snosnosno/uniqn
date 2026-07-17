/**
 * ScheduleConverter - schedule event conversion helpers
 *
 * WorkLog/Application -> ScheduleEvent conversion lives here so service code can
 * stay focused on fetching canonical postings and repositories.
 */

import { getPostingSettlementContext } from '@/domains/job-posting';
import type { PostingSettlementContext } from '@/domains/job-posting';
import { STATUS } from '@/constants';
import { StatusMapper } from '@/shared/status';
import type {
  Application,
  ApplicationStatus,
  JobPosting,
  ScheduleEvent,
  SchedulePostingProjection,
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
import { toDate } from '@/utils/date';
import { calculateSettlementBreakdown } from '@/utils/settlement';

export interface SchedulePostingContext {
  title: string;
  location: string;
  detailedAddress?: string;
  contactPhone?: string;
  ownerId?: string;
  ownerName?: string;
  description?: string;
  settlement: PostingSettlementContext;
}

export function createSchedulePostingContext(posting: JobPosting): SchedulePostingContext {
  return {
    title: posting.title || '이벤트',
    location: posting.location?.name || '',
    detailedAddress: posting.location?.detailedAddress,
    contactPhone: posting.contactPhone,
    ownerId: posting.ownerId,
    ownerName: posting.ownerName,
    description: posting.description,
    settlement: getPostingSettlementContext(posting),
  };
}

function toPostingProjection(
  postingContext?: SchedulePostingContext
): SchedulePostingProjection | undefined {
  if (!postingContext) {
    return undefined;
  }

  return {
    ownerName: postingContext.ownerName,
    description: postingContext.description,
    settlement: postingContext.settlement,
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
    const postingProjection = toPostingProjection(postingContext);
    const jobPostingId = workLog.jobPostingId || '';
    const jobPostingName = postingContext?.title || '이벤트';
    const effectiveDate = workLog.date || FIXED_DATE_MARKER;
    const timeSlotParsed = parseTimeSlotToDate(workLog.timeSlot ?? null, effectiveDate);
    const startTimeFromTimeSlot = timeSlotParsed.startTime ?? null;
    const endTimeFromTimeSlot = timeSlotParsed.endTime ?? null;

    return {
      id: workLog.id,
      type,
      assignmentGroupId: workLog.assignmentGroupId ?? null,
      date: workLog.date,
      startTime: startTimeFromTimeSlot,
      endTime: endTimeFromTimeSlot,
      checkInTime: toDate(workLog.checkInTime),
      checkOutTime: toDate(workLog.checkOutTime),
      jobPostingId,
      jobPostingName,
      location: postingContext?.location || '',
      detailedAddress: postingContext?.detailedAddress,
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
      // 실제 지원서 ID (applications.id). 취소/상세 조회가 이 값으로 UUID 조회하므로
      // 합성키(`${jobPostingId}_${staffId}`)를 쓰면 invalid uuid(22P02)로 터진다.
      // 레거시/수동 work_log로 applicationId가 없으면 undefined → 취소 버튼 숨김 + 그룹화 제외(안전).
      applicationId: workLog.applicationId ?? undefined,
      customSalaryInfo: workLog.customSalaryInfo,
      customAllowances: workLog.customAllowances,
      customTaxSettings: workLog.customTaxSettings,
      postingProjection,
      timeSlot: workLog.timeSlot,
      isFixedPosting: workLog.isFixedPosting,
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

    const postingProjection = toPostingProjection(postingContext);

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
            assignmentGroupId: assignment.groupId ?? null,
            date,
            startTime: this.parseTimeSlotToTimestamp(assignment.timeSlot, date, 'start'),
            endTime: this.parseTimeSlotToTimestamp(assignment.timeSlot, date, 'end'),
            checkInTime: null,
            checkOutTime: null,
            jobPostingId: application.jobPostingId,
            jobPostingName: postingContext?.title || application.jobPostingTitle || '공고',
            location: postingContext?.location || '',
            detailedAddress: postingContext?.detailedAddress,
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
            isCancellationPending: application.status === STATUS.APPLICATION.CANCELLATION_PENDING,
            postingProjection,
            timeSlot: assignment.timeSlot,
            // application.createdAt 은 ISO string(timestampSchema) — ScheduleEvent 는 Date 계약.
            // workLog 브랜치(위)와 동일하게 Date 로 통일해 경계에서 변환.
            createdAt: toDate(application.createdAt) ?? undefined,
            updatedAt: toDate(application.updatedAt) ?? undefined,
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
  ): Date | null {
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
    return parsedTime ?? null;
  }
}
