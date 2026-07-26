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
  PostingRoleCatalogEntry,
} from '@/types';
import {
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
  TBA_TIME_MARKER,
  normalizeAssignmentRole,
} from '@/types/assignment';
import { parseTimeSlotToDate } from '@/utils/date/ranges';
import { toDate } from '@/utils/date';
import { calculateSettlementBreakdown, DEFAULT_SALARY_INFO } from '@/utils/settlement';

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

/**
 * 지점 컨테이너(근무표 직접배치) → 스케줄 정산 컨텍스트.
 *
 * 컨테이너 직속 work_log(job_posting_id = venueId, status='container')는 일반 공고 조회에서
 * 의도적으로 제외(fail-closed)되므로, staff "내 스케줄" 경로가 이 컨텍스트를 못 얻어 급여가
 * 항상 기본 단가(15,000원)로 폴백되던 버그(#6)를 복구한다. employer settlementVenueQuery 가
 * 쓰는 "컨테이너 2차 해소(roleSalaries 주입)"와 동일 규약 — role 매칭 시 지점 단가표가 적용된다.
 */
export function createScheduleContainerContext(
  roleSalaries: PostingRoleCatalogEntry[],
  title?: string
): SchedulePostingContext {
  return {
    title: title || '이벤트',
    location: '',
    settlement: {
      roles: roleSalaries.map((entry) => ({
        role: entry.role,
        customRole: entry.customRole,
        count: 0,
        filled: 0,
        salary: entry.salary,
      })),
      defaultSalary: DEFAULT_SALARY_INFO,
    },
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
      // 지급 처리 시각. DB(payroll_date)→WorkLog 까지는 오는데 여기서 끊겨 있어
      // 스태프는 '정산 완료' 배지만 보고 언제 처리됐는지 알 수 없었다.
      payrollDate: workLog.payrollDate,
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
      // workLog.createdAt/updatedAt 도 런타임 ISO string(timestampSchema) — ScheduleEvent(Date)
      // 계약에 맞춰 경계에서 Date 로 변환. application 브랜치와 동일 패턴으로 통일해
      // ScheduleEvent.createdAt 의 소스별 런타임 타입 분기를 제거한다.
      createdAt: toDate(workLog.createdAt) ?? undefined,
      updatedAt: toDate(workLog.updatedAt) ?? undefined,
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
            // workLog 브랜치와 동일하게 경계에서 Date 로 변환(두 소스 런타임 타입 통일).
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
