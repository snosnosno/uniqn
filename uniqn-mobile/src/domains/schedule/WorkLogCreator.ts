/**
 * WorkLogCreator - 근무 기록 생성 통합 클래스
 *
 * @description Phase 5 - 확정 트랜잭션 WorkLog 생성 로직 분리
 * Application 확정 시 Assignment별 WorkLog 생성 로직 캡슐화
 *
 * 주요 기능:
 * 1. Assignment에서 WorkLog 데이터 생성
 * 2. 시간 파싱 및 Timestamp 변환
 * 3. 트랜잭션 내 배치 생성 지원
 */

import { Timestamp, serverTimestamp, FieldValue } from 'firebase/firestore';
import { STATUS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

/** 시간 슬롯 정보 */
export interface TimeSlotInfo {
  /** 시작 시간 (HH:mm) */
  startTime: string | null;
  /** 종료 시간 (HH:mm) */
  endTime: string | null;
  /** 원본 timeSlot 문자열 */
  original: string;
}

/** WorkLog 생성 입력 */
export interface WorkLogCreateInput {
  /** 스태프 ID */
  staffId: string;
  /** 스태프 이름 */
  staffName: string;
  /** 공고 ID (정규화된 필드명) */
  jobPostingId: string;
  /** 공고 이름 */
  jobPostingName: string;
  /** 역할 ID */
  roleId: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 시간 슬롯 (예: "09:00~18:00") */
  timeSlot: string;
  /** 그룹 ID (Assignment v2.0) */
  assignmentGroupId?: string | null;
  /** 출퇴근 체크 방식 */
  checkMethod?: 'individual' | 'group';
  /** 시간 미정 여부 */
  isTimeToBeAnnounced?: boolean;
  /** 시간 미정 시 설명 */
  tentativeDescription?: string | null;
}

/** 생성된 WorkLog 데이터 (Firestore 저장용) */
export interface WorkLogData {
  staffId: string;
  staffName: string;
  /** 공고 ID */
  jobPostingId: string;
  /** 공고 이름 */
  jobPostingName: string;
  role: string;
  date: string;
  timeSlot: string;
  isTimeToBeAnnounced: boolean;
  tentativeDescription: string | null;
  status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled';
  attendanceStatus: 'not_started' | 'checked_in' | 'checked_out' | 'absent';
  checkInTime: Timestamp | null;
  checkOutTime: null;
  workDuration: null;
  payrollAmount: null;
  isSettled: boolean;
  assignmentGroupId: string | null;
  checkMethod: 'individual' | 'group';
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

/** 배치 생성 결과 */
export interface BatchCreateResult {
  /** 생성된 WorkLog 데이터 배열 */
  workLogs: WorkLogData[];
  /** 생성된 날짜 목록 */
  dates: string[];
  /** 총 생성 개수 */
  count: number;
}

// ============================================================================
// WorkLogCreator Class
// ============================================================================

export class WorkLogCreator {
  // ==========================================================================
  // 시간 파싱 유틸리티
  // ==========================================================================

  /**
   * timeSlot 문자열에서 시작/종료 시간 추출
   *
   * @description 다양한 형식 지원:
   * - "09:00" → { startTime: "09:00", endTime: null }
   * - "09:00~18:00" → { startTime: "09:00", endTime: "18:00" }
   * - "09:00 - 18:00" → { startTime: "09:00", endTime: "18:00" }
   *
   * @param timeSlot - 시간 슬롯 문자열
   * @returns TimeSlotInfo 객체
   */
  static parseTimeSlot(timeSlot: string): TimeSlotInfo {
    if (!timeSlot) {
      return { startTime: null, endTime: null, original: '' };
    }

    const trimmed = timeSlot.trim();

    // "~" 또는 " - " 로 분리
    const separators = /[-~]/;
    const parts = trimmed
      .split(separators)
      .map((p) => p.trim())
      .filter(Boolean);

    return {
      startTime: parts[0] || null,
      endTime: parts[1] || null,
      original: trimmed,
    };
  }

  /**
   * 시작 시간만 추출
   *
   * @param timeSlot - 시간 슬롯 문자열
   * @returns 시작 시간 (HH:mm) 또는 빈 문자열
   */
  static extractStartTime(timeSlot: string): string {
    const { startTime } = this.parseTimeSlot(timeSlot);
    return startTime ?? '';
  }

  /**
   * 날짜와 시간 문자열을 Timestamp로 변환
   *
   * @param date - 날짜 (YYYY-MM-DD)
   * @param time - 시간 (HH:mm)
   * @returns Timestamp 또는 null (파싱 실패 시)
   */
  static createTimestampFromDateTime(date: string, time: string): Timestamp | null {
    if (!date || !time) return null;

    // 시간 형식 검증 (HH:mm 또는 H:mm)
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) return null;

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    try {
      // HH:mm 형식으로 패딩
      const paddedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const dateTime = new Date(`${date}T${paddedTime}:00`);

      if (isNaN(dateTime.getTime())) return null;
      return Timestamp.fromDate(dateTime);
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // WorkLog 생성
  // ==========================================================================

  /**
   * 단일 WorkLog 데이터 생성
   *
   * @param input - 생성 입력
   * @returns WorkLog 데이터 (Firestore 저장용)
   */
  static create(input: WorkLogCreateInput): WorkLogData {
    const startTime = this.extractStartTime(input.timeSlot);
    const checkInTime = this.createTimestampFromDateTime(input.date, startTime);

    return {
      staffId: input.staffId,
      staffName: input.staffName,
      jobPostingId: input.jobPostingId,
      jobPostingName: input.jobPostingName,
      role: input.roleId,
      date: input.date,
      timeSlot: input.timeSlot,
      isTimeToBeAnnounced: input.isTimeToBeAnnounced ?? false,
      tentativeDescription: input.tentativeDescription ?? null,
      status: STATUS.WORK_LOG.SCHEDULED,
      attendanceStatus: 'not_started',
      checkInTime,
      checkOutTime: null,
      workDuration: null,
      payrollAmount: null,
      isSettled: false,
      assignmentGroupId: input.assignmentGroupId ?? null,
      checkMethod: input.checkMethod ?? 'individual',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }

  /**
   * Assignment 배열에서 WorkLog 배치 생성
   *
   * @description 각 Assignment의 dates 배열을 펼쳐서 개별 WorkLog 생성
   *
   * @param assignments - Assignment 배열
   * @param staffInfo - 스태프 정보
   * @param eventInfo - 이벤트 정보
   * @param defaultRole - 기본 역할 (Assignment에 역할 없을 시)
   * @returns BatchCreateResult
   */
  static createFromAssignments(
    assignments: {
      dates: string[];
      timeSlot: string;
      roleIds?: string[];
      groupId?: string | null;
      checkMethod?: 'individual' | 'group';
      isTimeToBeAnnounced?: boolean;
      tentativeDescription?: string | null;
    }[],
    staffInfo: { staffId: string; staffName: string },
    jobPostingInfo: { jobPostingId: string; jobPostingName: string },
    defaultRole?: string
  ): BatchCreateResult {
    const workLogs: WorkLogData[] = [];
    const allDates: string[] = [];

    for (const assignment of assignments) {
      const roleId = assignment.roleIds?.[0] ?? defaultRole ?? '';

      for (const date of assignment.dates) {
        const workLog = this.create({
          staffId: staffInfo.staffId,
          staffName: staffInfo.staffName,
          jobPostingId: jobPostingInfo.jobPostingId,
          jobPostingName: jobPostingInfo.jobPostingName,
          roleId,
          date,
          timeSlot: assignment.timeSlot,
          assignmentGroupId: assignment.groupId,
          checkMethod: assignment.checkMethod,
          isTimeToBeAnnounced: assignment.isTimeToBeAnnounced,
          tentativeDescription: assignment.tentativeDescription,
        });

        workLogs.push(workLog);
        allDates.push(date);
      }
    }

    return {
      workLogs,
      dates: [...new Set(allDates)].sort(),
      count: workLogs.length,
    };
  }

  /**
   * Assignment 개수 계산 (정원 확인용)
   *
   * @param assignments - Assignment 배열
   * @returns 총 날짜 개수 (= 생성될 WorkLog 수)
   */
  static countAssignments(assignments: { dates: string[] }[]): number {
    return assignments.reduce((sum, a) => sum + a.dates.length, 0);
  }
}
