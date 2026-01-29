/**
 * ScheduleConverter - 스케줄 변환 로직 통합
 *
 * @description Phase 5 - scheduleService 헬퍼 분리
 * @version 1.0.0
 *
 * WorkLog/Application → ScheduleEvent 변환 로직을 도메인 클래스로 통합
 *
 * ## 사용법
 * ```typescript
 * import { ScheduleConverter } from '@/domains/schedule';
 *
 * // WorkLog → ScheduleEvent
 * const event = ScheduleConverter.workLogToScheduleEvent(workLog, cardInfo);
 *
 * // Application → ScheduleEvent[]
 * const events = ScheduleConverter.applicationToScheduleEvents(application, cardInfo);
 * ```
 */

import { Timestamp } from 'firebase/firestore';
import { normalizeTimestamp } from '@/utils/firestore';
import { calculateSettlementBreakdown } from '@/utils/settlement';
import { StatusMapper } from '@/shared/status';
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER, TBA_TIME_MARKER } from '@/types/assignment';
import type {
  ScheduleEvent,
  ScheduleType,
  WorkLog,
  Application,
  ApplicationStatus,
  JobPostingCard,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * JobPostingCard와 메타데이터
 */
export interface JobPostingCardWithMeta {
  card: JobPostingCard;
  title: string;
  location: string;
  contactPhone?: string;
  ownerId?: string;
}

// ============================================================================
// ScheduleConverter
// ============================================================================

/**
 * 스케줄 변환 유틸리티 클래스
 *
 * @description scheduleService에서 분리된 변환 로직
 */
export class ScheduleConverter {
  /**
   * WorkLog를 ScheduleEvent로 변환
   *
   * @description Phase 1 - StatusMapper로 상태 매핑 통합
   */
  static workLogToScheduleEvent(
    workLog: WorkLog,
    cardInfo?: JobPostingCardWithMeta
  ): ScheduleEvent {
    // StatusMapper로 상태 매핑 (Phase 1 통합)
    const type = StatusMapper.workLogToSchedule(workLog.status);
    const attendanceStatus = StatusMapper.toAttendance(workLog.status);

    // 정산 세부 내역 미리 계산 (SettlementTab에서 중복 계산 방지)
    const settlementBreakdown = calculateSettlementBreakdown(
      {
        checkInTime: workLog.checkInTime,
        checkOutTime: workLog.checkOutTime,
        scheduledStartTime: workLog.scheduledStartTime,
        scheduledEndTime: workLog.scheduledEndTime,
        role: workLog.role,
        customRole: workLog.customRole,
        customSalaryInfo: workLog.customSalaryInfo,
        customAllowances: workLog.customAllowances,
        customTaxSettings: workLog.customTaxSettings,
      },
      cardInfo?.card
    );

    // 공고 ID
    const jobPostingId = workLog.jobPostingId || '';
    const jobPostingName = cardInfo?.title || '이벤트';

    return {
      id: workLog.id,
      type,
      date: workLog.date,
      startTime: normalizeTimestamp(workLog.scheduledStartTime),
      endTime: normalizeTimestamp(workLog.scheduledEndTime),
      checkInTime: normalizeTimestamp(workLog.checkInTime),
      checkOutTime: normalizeTimestamp(workLog.checkOutTime),
      jobPostingId,
      jobPostingName,
      location: cardInfo?.location || '',
      role: workLog.role,
      customRole: workLog.customRole,
      status: attendanceStatus,
      payrollStatus: workLog.payrollStatus,
      payrollAmount: workLog.payrollAmount,
      ownerPhone: cardInfo?.contactPhone,
      ownerId: workLog.ownerId || cardInfo?.ownerId, // workLog 우선, 없으면 공고에서 폴백
      notes: workLog.notes,
      sourceCollection: 'workLogs',
      sourceId: workLog.id,
      workLogId: workLog.id,
      // applicationId: 복합 키로 구성 (jobPostingId_staffId)
      applicationId: `${jobPostingId}_${workLog.staffId}`,
      // 개별 오버라이드 (구인자가 스태프별로 수정한 정산 정보)
      customSalaryInfo: workLog.customSalaryInfo,
      customAllowances: workLog.customAllowances,
      customTaxSettings: workLog.customTaxSettings,
      jobPostingCard: cardInfo?.card,
      // 시간대 문자열 (확정 상태 시간 표시 폴백용)
      timeSlot: workLog.timeSlot,
      // 정산 세부 내역 (미리 계산됨)
      settlementBreakdown: settlementBreakdown || undefined,
      createdAt: workLog.createdAt,
      updatedAt: workLog.updatedAt,
    };
  }

  /**
   * Application의 Assignment를 ScheduleEvent 배열로 변환
   *
   * @description 하나의 Application이 여러 날짜에 지원했을 수 있으므로 배열 반환
   */
  static applicationToScheduleEvents(
    application: Application,
    cardInfo?: JobPostingCardWithMeta
  ): ScheduleEvent[] {
    const events: ScheduleEvent[] = [];

    const scheduleType = this.mapApplicationStatusToScheduleType(application.status);

    // 표시하지 않을 상태인 경우 빈 배열 반환
    if (!scheduleType) {
      return events;
    }

    // assignments 배열에서 ScheduleEvent 생성
    if (application.assignments.length > 0) {
      for (let assignmentIdx = 0; assignmentIdx < application.assignments.length; assignmentIdx++) {
        const assignment = application.assignments[assignmentIdx];
        // 각 날짜별로 ScheduleEvent 생성
        for (let dateIdx = 0; dateIdx < assignment.dates.length; dateIdx++) {
          const date = assignment.dates[dateIdx];
          // 고정공고 마커는 스킵
          if (date === FIXED_DATE_MARKER) continue;

          // 공고 정보
          const jobPostingId = application.jobPostingId;
          const jobPostingName = cardInfo?.title || application.jobPostingTitle || '공고';

          // 고유 ID 생성: applicationId_assignmentIdx_dateIdx (중복 방지)
          const event: ScheduleEvent = {
            id: `${application.id}_${assignmentIdx}_${dateIdx}`,
            type: scheduleType,
            date,
            startTime: this.parseTimeSlotToTimestamp(assignment.timeSlot, date, 'start'),
            endTime: this.parseTimeSlotToTimestamp(assignment.timeSlot, date, 'end'),
            checkInTime: null,
            checkOutTime: null,
            jobPostingId,
            jobPostingName,
            location: cardInfo?.location || '',
            role: assignment.roleIds[0] || 'other',
            customRole: application.customRole,
            status: 'not_started', // applications에는 출퇴근 데이터 없음
            payrollStatus: undefined,
            payrollAmount: undefined,
            ownerPhone: cardInfo?.contactPhone,
            ownerId: cardInfo?.ownerId,
            notes: application.message,
            sourceCollection: 'applications',
            sourceId: application.id,
            applicationId: application.id,
            jobPostingCard: cardInfo?.card,
            timeSlot: assignment.timeSlot,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
          };
          events.push(event);
        }
      }
    }

    return events;
  }

  /**
   * Application status를 ScheduleType으로 매핑
   *
   * @description Phase 1 - StatusMapper로 위임
   */
  static mapApplicationStatusToScheduleType(status: ApplicationStatus): ScheduleType | null {
    return StatusMapper.applicationToSchedule(status);
  }

  /**
   * 시간대 문자열을 Timestamp로 변환
   *
   * @param timeSlot - "19:00" 또는 "19:00~22:00" 형식
   * @param date - YYYY-MM-DD
   * @param type - 'start' | 'end'
   */
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

    // "19:00~22:00" 형식 처리
    const parts = timeSlot.split('~').map((p) => p.trim());
    const timeStr = type === 'start' ? parts[0] : parts[1] || parts[0];

    if (!timeStr) return null;

    const timeParts = timeStr.split(':');
    if (timeParts.length < 2) return null;

    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return null;

    const dateParts = date.split('-');
    if (dateParts.length !== 3) return null;

    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const day = parseInt(dateParts[2], 10);

    const dateObj = new Date(year, month - 1, day, hours, minutes);
    return Timestamp.fromDate(dateObj);
  }
}
