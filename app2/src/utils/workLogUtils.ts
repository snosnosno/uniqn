import { Timestamp } from 'firebase/firestore';
import { parseToDate, getTodayString } from './jobPosting/dateUtils';

/**
 * WorkLog 생성 및 관리를 위한 유틸리티 함수들
 */

// 날짜 입력 타입 정의
type DateInput = 
  | Timestamp 
  | Date 
  | string 
  | number
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | null 
  | undefined;

/**
 * 다양한 날짜 형식을 YYYY-MM-DD 형식으로 표준화
 * Firebase Timestamp, Date 객체, 문자열 등 모든 형식 처리
 */
export const normalizeStaffDate = (date: DateInput): string => {
  if (!date) return getTodayString();
  
  try {
    // Firebase Timestamp 객체 처리
    if (typeof date === 'object' && 'seconds' in date) {
      const seconds = date.seconds as number;
      const isoString = new Date(seconds * 1000).toISOString();
      const datePart = isoString.split('T')[0];
      return datePart || getTodayString();
    }
    
    // Timestamp 문자열 처리 (예: 'Timestamp(seconds=1753833600, nanoseconds=0)')
    if (typeof date === 'string' && date.startsWith('Timestamp(')) {
      const match = date.match(/seconds=(\d+)/);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        const isoString = new Date(seconds * 1000).toISOString();
        const datePart = isoString.split('T')[0];
        return datePart || getTodayString();
      }
    }
    
    // 이미 YYYY-MM-DD 형식인 경우
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // toDate 메서드가 있는 객체 (Firebase Timestamp)
    if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      const dateObj = date.toDate();
      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        const isoString = dateObj.toISOString();
        const datePart = isoString.split('T')[0];
        return datePart || getTodayString();
      }
    }
    
    // Date 객체 또는 문자열/숫자를 Date로 변환
    const dateObj = date instanceof Date ? date : new Date(date as string | number);
    if (!isNaN(dateObj.getTime())) {
      const isoString = dateObj.toISOString();
      const datePart = isoString.split('T')[0];
      return datePart || getTodayString();
    }
  } catch (error) {
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
  // staffId에서 _숫자 패턴 제거
  const actualStaffId = staffId.replace(/_\d+$/, '');
  const normalizedDate = normalizeStaffDate(date);
  
  if (eventId) {
    // eventId가 있으면 실제 workLogId 형식
    return `${eventId}_${actualStaffId}_${normalizedDate}`;
  }
  
  // eventId가 없으면 virtual_ prefix 추가
  return `virtual_${actualStaffId}_${normalizedDate}`;
};

interface CreateWorkLogParams {
  eventId: string;
  staffId: string;
  staffName: string;
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
 */
export const generateWorkLogId = (eventId: string, staffId: string, date: string): string => {
  return `${eventId}_${staffId}_${date}`;
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
    
    if (!hoursStr || !minutesStr || isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
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
 * 가상 WorkLog 생성 (DB에 저장되지 않은 임시 객체)
 */
export const createVirtualWorkLog = (params: CreateWorkLogParams) => {
  const {
    eventId,
    staffId,
    staffName,
    date,
    assignedTime,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    status = 'not_started'
  } = params;

  const workLogId = generateWorkLogId(eventId, staffId, date);
  
  // assignedTime이 있고 scheduledStartTime이 없는 경우 변환
  let startTime = scheduledStartTime;
  if (!startTime && assignedTime && assignedTime !== '미정') {
    startTime = convertTimeToTimestamp(assignedTime, date);
  }

  return {
    id: `virtual_${workLogId}`,
    eventId,
    staffId,
    dealerId: staffId, // 호환성을 위해 둘 다 포함
    dealerName: staffName,
    date,
    scheduledStartTime: startTime || null,
    scheduledEndTime: scheduledEndTime || null,
    actualStartTime: actualStartTime || null,
    actualEndTime: actualEndTime || null,
    status,
    isVirtual: true // 가상 workLog 표시
  };
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
    date,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    status = 'not_started'
  } = params;

  return {
    eventId,
    dealerId: staffId, // Firebase 컬렉션과의 호환성
    dealerName: staffName,
    date,
    scheduledStartTime: scheduledStartTime || null,
    scheduledEndTime: scheduledEndTime || null,
    actualStartTime: actualStartTime || null,
    actualEndTime: actualEndTime || null,
    status,
    createdAt: now,
    updatedAt: now
  };
};

/**
 * staffId와 dealerId 매칭 확인
 */
export const isStaffIdMatch = (recordStaffId: string, targetStaffId: string): boolean => {
  // 정확한 매치
  if (recordStaffId === targetStaffId) return true;
  
  // dealerId 형식 매치 (staffId_숫자 패턴 제거)
  const cleanRecordId = recordStaffId.replace(/_\d+$/, '');
  const cleanTargetId = targetStaffId.replace(/_\d+$/, '');
  
  return cleanRecordId === cleanTargetId;
};

/**
 * AttendanceRecord에서 특정 스태프의 특정 날짜 WorkLog 찾기
 */
export const findStaffWorkLog = (
  attendanceRecords: any[],
  staffId: string,
  date: string
): any | undefined => {
  return attendanceRecords.find(record => {
    const staffMatch = isStaffIdMatch(record.staffId, staffId) ||
                      record.workLog?.dealerId === staffId ||
                      isStaffIdMatch(record.workLog?.dealerId || '', staffId);
    
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
  
  if (isNaN(endHour) || isNaN(endMinute) || isNaN(startHour)) return null;
  
  const date = new Date(baseDate);
  date.setHours(endHour, endMinute, 0, 0);
  
  // 종료 시간이 시작 시간보다 이른 경우 다음날로 설정
  if (endHour < startHour) {
    date.setDate(date.getDate() + 1);
  }
  
  return Timestamp.fromDate(date);
};