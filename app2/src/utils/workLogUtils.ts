import { Timestamp } from 'firebase/firestore';
import { parseToDate, getTodayString } from './jobPosting/dateUtils';
import { createWorkLogId } from './workLogSimplified';
import { toISODateString } from './dateUtils';

// ===== Core 모듈에서 타입 import =====
import type { DateInput } from './core/dateTypes';
import { hasToDateMethod, hasSecondsProperty } from './core';

/**
 * WorkLog 생성 및 관리를 위한 유틸리티 함수들
 */

/**
 * 다양한 날짜 형식을 YYYY-MM-DD 형식으로 표준화
 * Firebase Timestamp, Date 객체, 문자열 등 모든 형식 처리
 */
export const normalizeStaffDate = (date: DateInput): string => {
  if (!date) return getTodayString();

  try {
    // 1. 문자열 타입 처리 (타입 좁히기 이슈 방지를 위해 먼저 처리)
    if (typeof date === 'string') {
      // YYYY-MM-DD 형식인 경우
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }

      // Timestamp 문자열 처리 (예: 'Timestamp(seconds=1753833600, nanoseconds=0)')
      if (date.startsWith('Timestamp(')) {
        const match = date.match(/seconds=(\d+)/);
        if (match && match[1]) {
          const seconds = parseInt(match[1], 10);
          const isoString = new Date(seconds * 1000).toISOString();
          const datePart = isoString.split('T')[0];
          return datePart || getTodayString();
        }
      }

      // 기타 문자열은 Date로 변환 시도
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        const isoString = dateObj.toISOString();
        const datePart = isoString.split('T')[0];
        return datePart || getTodayString();
      }
      return getTodayString();
    }

    // 2. Firebase Timestamp 객체 처리 (seconds 속성)
    if (hasSecondsProperty(date)) {
      const isoString = new Date(date.seconds * 1000).toISOString();
      const datePart = isoString.split('T')[0];
      return datePart || getTodayString();
    }

    // 3. toDate 메서드가 있는 객체 (Firebase Timestamp)
    if (hasToDateMethod(date)) {
      const dateObj = date.toDate();
      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        const isoString = dateObj.toISOString();
        const datePart = isoString.split('T')[0];
        return datePart || getTodayString();
      }
    }

    // 4. Date 객체 또는 숫자를 Date로 변환
    const dateObj = date instanceof Date ? date : new Date(date as number);
    if (!isNaN(dateObj.getTime())) {
      const isoString = dateObj.toISOString();
      const datePart = isoString.split('T')[0];
      return datePart || getTodayString();
    }
  } catch {
    // 변환 실패 시 오늘 날짜 반환
  }

  return getTodayString();
};

/**
 * virtual_ prefix가 포함된 WorkLog ID 생성
 * StaffCard와 StaffRow에서 사용하는 패턴과 완벽히 호환
 */
export const generateVirtualWorkLogId = (
  staffId: string,
  date: DateInput,
  eventId?: string
): string => {
  const normalizedDate = normalizeStaffDate(date);

  if (eventId) {
    // ✅ createWorkLogId 함수 사용으로 통일된 ID 생성
    return createWorkLogId(eventId, staffId, normalizedDate);
  }

  // eventId가 없으면 virtual_ prefix 추가 (staffId에서 _숫자 패턴 제거)
  const actualStaffId = staffId.replace(/_\d+$/, '');
  return `virtual_${actualStaffId}_${normalizedDate}`;
};

interface CreateWorkLogParams {
  eventId: string;
  staffId: string;
  staffName: string;
  role?: string; // 역할 추가
  date: string;
  assignedTime?: string | null;
  scheduledStartTime?: Timestamp | null;
  scheduledEndTime?: Timestamp | null;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  status?: string;
}

/**
 * WorkLog ID 생성 (표준화된 형식: eventId_staffId_date)
 * @deprecated createWorkLogId 함수를 사용하세요
 */
export const generateWorkLogId = (eventId: string, staffId: string, date: string): string => {
  // ✅ createWorkLogId 함수 사용으로 통일된 ID 생성
  return createWorkLogId(eventId, staffId, date);
};

/**
 * assignedTime 문자열을 파싱하여 시작/종료 시간으로 분리
 * @param assignedTime "HH:mm" 또는 "HH:mm-HH:mm" 형식의 문자열
 * @returns {startTime, endTime} 객체
 */
export const parseAssignedTime = (
  assignedTime: string
): { startTime: string | null; endTime: string | null } => {
  if (!assignedTime || assignedTime === '미정') {
    return { startTime: null, endTime: null };
  }

  try {
    // "HH:mm-HH:mm" 형식 처리 (시간 범위)
    if (assignedTime.includes('-')) {
      const timeParts = assignedTime.split('-').map((t) => t.trim());
      const startTime = timeParts[0];
      const endTime = timeParts[1];

      // 시간 형식 검증
      const timeRegex = /^\d{1,2}:\d{2}$/;
      if (startTime && endTime && timeRegex.test(startTime) && timeRegex.test(endTime)) {
        return { startTime, endTime };
      }
    } else {
      // "HH:mm" 형식 처리 (단일 시간)
      const trimmedTime = assignedTime.trim();
      const timeRegex = /^\d{1,2}:\d{2}$/;
      if (timeRegex.test(trimmedTime)) {
        return { startTime: trimmedTime, endTime: null };
      }
    }
  } catch (error) {
    // 파싱 오류 시 null 반환
  }

  return { startTime: null, endTime: null };
};

/**
 * 시간 문자열을 Timestamp로 변환
 */
export const convertTimeToTimestamp = (timeString: string, baseDate: string): Timestamp | null => {
  if (!timeString || timeString === '미정') return null;

  try {
    const timeParts = timeString.split(':');
    if (timeParts.length !== 2) return null;

    const [hoursStr, minutesStr] = timeParts;
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);

    if (
      !hoursStr ||
      !minutesStr ||
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    const date = parseToDate(baseDate) || new Date();
    date.setHours(hours, minutes, 0, 0);

    if (isNaN(date.getTime())) return null;

    return Timestamp.fromDate(date);
  } catch {
    return null;
  }
};

/**
 * assignedTime을 사용하여 scheduledStartTime과 scheduledEndTime을 생성
 * @param assignedTime "HH:mm" 또는 "HH:mm-HH:mm" 형식의 문자열
 * @param baseDate 기준 날짜
 * @returns {scheduledStartTime, scheduledEndTime} Timestamp 객체들
 */
export const convertAssignedTimeToScheduled = (
  assignedTime: string | null | undefined,
  baseDate: string | null | undefined
): { scheduledStartTime: Timestamp | null; scheduledEndTime: Timestamp | null } => {
  // 입력값 검증
  if (!assignedTime || assignedTime === '미정') {
    return { scheduledStartTime: null, scheduledEndTime: null };
  }

  // baseDate가 없으면 오늘 날짜 사용
  const validBaseDate = baseDate || toISODateString(new Date()) || '';

  const { startTime, endTime } = parseAssignedTime(assignedTime);

  const scheduledStartTime =
    startTime && validBaseDate ? convertTimeToTimestamp(startTime, validBaseDate) : null;
  let scheduledEndTime =
    endTime && validBaseDate ? convertTimeToTimestamp(endTime, validBaseDate) : null;

  // 종료 시간이 시작 시간보다 이른 경우 다음날로 조정
  if (
    scheduledStartTime &&
    scheduledEndTime &&
    startTime &&
    endTime &&
    typeof startTime === 'string' &&
    typeof endTime === 'string'
  ) {
    try {
      const startTimeParts = startTime.split(':');
      const endTimeParts = endTime.split(':');

      if (startTimeParts.length < 2 || endTimeParts.length < 2) {
        return { scheduledStartTime, scheduledEndTime };
      }

      const startHour = parseInt(startTimeParts[0] || '0');
      const startMinute = parseInt(startTimeParts[1] || '0');
      const endHour = parseInt(endTimeParts[0] || '0');
      const endMinute = parseInt(endTimeParts[1] || '0');

      // 종료 시간이 시작 시간보다 이른 경우만 다음날로 조정
      // 시간과 분을 모두 고려하여 비교
      if (
        !isNaN(startHour) &&
        !isNaN(startMinute) &&
        !isNaN(endHour) &&
        !isNaN(endMinute) &&
        (endHour < startHour || (endHour === startHour && endMinute <= startMinute))
      ) {
        const adjustedEndTime = adjustEndTimeForNextDay(
          endTime,
          startTime,
          parseToDate(validBaseDate) || new Date()
        );
        if (adjustedEndTime) {
          scheduledEndTime = adjustedEndTime;
        }
      }
    } catch (error) {
      // 시간 파싱 오류 시 무시
    }
  }

  return { scheduledStartTime, scheduledEndTime };
};

/**
 * 새로운 WorkLog 데이터 생성 (DB 저장용)
 */
export const createWorkLogData = (params: CreateWorkLogParams) => {
  const now = Timestamp.now();
  const {
    eventId,
    staffId,
    staffName,
    role,
    date,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    status = 'not_started',
  } = params;

  return {
    eventId,
    staffId,
    staffName: staffName,
    ...(role && { role }), // 역할이 있는 경우만 포함
    date,
    scheduledStartTime: scheduledStartTime || null,
    scheduledEndTime: scheduledEndTime || null,
    actualStartTime: actualStartTime || null,
    actualEndTime: actualEndTime || null,
    status,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * 출석 기록 찾기
 */
export const isStaffIdMatch = (recordStaffId: string, targetStaffId: string): boolean => {
  // 정확한 매치
  if (recordStaffId === targetStaffId) return true;

  // staffId 패턴 매치 (staffId_숫자 패턴 제거)
  const cleanRecordId = recordStaffId.replace(/_\d+$/, '');
  const cleanTargetId = targetStaffId.replace(/_\d+$/, '');

  return cleanRecordId === cleanTargetId;
};

/** 출석 기록 조회용 타입 */
interface AttendanceRecordLike {
  staffId: string;
  workLog?: {
    staffId?: string;
    date?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * AttendanceRecord에서 특정 스태프의 특정 날짜 WorkLog 찾기
 */
export const findStaffWorkLog = (
  attendanceRecords: AttendanceRecordLike[],
  staffId: string,
  date: string
): AttendanceRecordLike | undefined => {
  return attendanceRecords.find((record) => {
    const staffMatch =
      isStaffIdMatch(record.staffId, staffId) ||
      record.workLog?.staffId === staffId ||
      isStaffIdMatch(record.workLog?.staffId || '', staffId);

    const dateMatch = record.workLog?.date === date;

    return staffMatch && dateMatch;
  });
};

/**
 * 종료 시간이 시작 시간보다 이른 경우 다음날로 조정
 */
export const adjustEndTimeForNextDay = (
  endTime: string,
  startTime: string,
  baseDate: Date
): Timestamp | null => {
  if (!endTime || !startTime) return null;

  const endParts = endTime.split(':');
  const startParts = startTime.split(':');

  if (endParts.length !== 2 || startParts.length !== 2) return null;

  const endHour = Number(endParts[0]);
  const endMinute = Number(endParts[1]);
  const startHour = Number(startParts[0]);
  const startMinute = Number(startParts[1]);

  if (isNaN(endHour) || isNaN(endMinute) || isNaN(startHour) || isNaN(startMinute)) return null;

  const date = new Date(baseDate);
  date.setHours(endHour, endMinute, 0, 0);

  // 종료 시간이 시작 시간보다 이른 경우 다음날로 설정
  // 시간만 비교하는 것이 아니라 분까지 고려
  if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
    date.setDate(date.getDate() + 1);
  }

  return Timestamp.fromDate(date);
};
