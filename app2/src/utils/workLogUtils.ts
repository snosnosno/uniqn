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
  role?: string;  // 역할 추가
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
 * assignedTime 문자열을 파싱하여 시작/종료 시간으로 분리
 * @param assignedTime "HH:mm" 또는 "HH:mm-HH:mm" 형식의 문자열
 * @returns {startTime, endTime} 객체
 */
export const parseAssignedTime = (assignedTime: string): { startTime: string | null; endTime: string | null } => {
  if (!assignedTime || assignedTime === '미정') {
    return { startTime: null, endTime: null };
  }

  try {
    // "HH:mm-HH:mm" 형식 처리 (시간 범위)
    if (assignedTime.includes('-')) {
      const timeParts = assignedTime.split('-').map(t => t.trim());
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
 * assignedTime을 사용하여 scheduledStartTime과 scheduledEndTime을 생성
 * @param assignedTime "HH:mm" 또는 "HH:mm-HH:mm" 형식의 문자열
 * @param baseDate 기준 날짜
 * @returns {scheduledStartTime, scheduledEndTime} Timestamp 객체들
 */
export const convertAssignedTimeToScheduled = (
  assignedTime: string | null | undefined, 
  baseDate: string | null | undefined
): { scheduledStartTime: Timestamp | null; scheduledEndTime: Timestamp | null } => {
  // 디버깅 로그 추가
  console.log('[convertAssignedTimeToScheduled] Input:', {
    assignedTime,
    assignedTimeType: typeof assignedTime,
    baseDate,
    baseDateType: typeof baseDate
  });
  
  // 입력값 검증
  if (!assignedTime || assignedTime === '미정') {
    console.log('[convertAssignedTimeToScheduled] Returning null - no assignedTime or 미정');
    return { scheduledStartTime: null, scheduledEndTime: null };
  }
  
  // baseDate가 없으면 오늘 날짜 사용
  const validBaseDate = baseDate || new Date().toISOString().split('T')[0];
  
  const { startTime, endTime } = parseAssignedTime(assignedTime);
  console.log('[convertAssignedTimeToScheduled] Parsed times:', { startTime, endTime });
  
  const scheduledStartTime = startTime && validBaseDate ? convertTimeToTimestamp(startTime, validBaseDate) : null;
  let scheduledEndTime = endTime && validBaseDate ? convertTimeToTimestamp(endTime, validBaseDate) : null;
  
  console.log('[convertAssignedTimeToScheduled] Converted to Timestamp:', {
    scheduledStartTime: scheduledStartTime ? 'Timestamp object' : 'null',
    scheduledEndTime: scheduledEndTime ? 'Timestamp object' : 'null',
    startTimeSeconds: scheduledStartTime ? (scheduledStartTime as any).seconds : 'N/A',
    endTimeSeconds: scheduledEndTime ? (scheduledEndTime as any).seconds : 'N/A'
  });
  
  // 종료 시간이 시작 시간보다 이른 경우 다음날로 조정
  if (scheduledStartTime && scheduledEndTime && startTime && endTime) {
    const adjustedEndTime = adjustEndTimeForNextDay(endTime, startTime, parseToDate(validBaseDate) || new Date());
    if (adjustedEndTime) {
      scheduledEndTime = adjustedEndTime;
    }
  }
  
  return { scheduledStartTime, scheduledEndTime };
};

/**
 * 가상 WorkLog 생성 (DB에 저장되지 않은 임시 객체)
 */
export const createVirtualWorkLog = (params: CreateWorkLogParams) => {
  const {
    eventId,
    staffId,
    staffName,
    role,
    date,
    assignedTime,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    status = 'not_started'
  } = params;
  
  // 디버깅: 입력 파라미터 상세 로그
  console.log('[createVirtualWorkLog] Creating virtual WorkLog:', {
    staffId,
    staffName,
    date,
    assignedTime,
    assignedTimeType: typeof assignedTime,
    scheduledStartTime: scheduledStartTime ? 'provided' : 'null',
    scheduledEndTime: scheduledEndTime ? 'provided' : 'null'
  });

  const workLogId = generateWorkLogId(eventId, staffId, date);
  
  // assignedTime이 있고 scheduledStartTime이 없는 경우 변환
  let startTime = scheduledStartTime;
  let endTime = scheduledEndTime;
  
  if (!startTime && assignedTime && assignedTime !== '미정') {
    const { scheduledStartTime: convertedStart, scheduledEndTime: convertedEnd } = 
      convertAssignedTimeToScheduled(assignedTime, date);
    console.log('[createVirtualWorkLog] Converted from assignedTime:', {
      assignedTime,
      convertedStart: convertedStart ? 'Timestamp object' : 'null',
      convertedEnd: convertedEnd ? 'Timestamp object' : 'null'
    });
    startTime = convertedStart;
    if (!endTime) {
      endTime = convertedEnd;
    }
  }
  
  console.log('[createVirtualWorkLog] Final times:', {
    startTime: startTime ? 'set' : 'null',
    endTime: endTime ? 'set' : 'null'
  });

  return {
    id: `virtual_${workLogId}`,
    eventId,
    staffId,
    dealerId: staffId, // @deprecated - staffId 사용 권장. 하위 호환성을 위해 유지
    dealerName: staffName,
    role,  // 역할 추가
    date,
    scheduledStartTime: startTime || null,
    scheduledEndTime: endTime || null,
    actualStartTime: actualStartTime || null,
    actualEndTime: actualEndTime || null,
    status,
    // 가상 WorkLog 표시자 - Firebase에 저장되지 않은 임시 객체
    isVirtual: true,
    // 원본 assignedTime 보존 (디버깅 및 fallback용)
    assignedTime: assignedTime || null
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
    role,
    date,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    status = 'not_started'
  } = params;

  return {
    eventId,
    staffId,
    dealerId: staffId, // @deprecated - staffId 사용 권장. Firebase 컬렉션과의 하위 호환성을 위해 유지
    dealerName: staffName,
    ...(role && { role }),  // 역할이 있는 경우만 포함
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
 * @deprecated dealerId 필드는 단계적으로 제거 예정. staffId 우선 사용
 */
export const isStaffIdMatch = (recordStaffId: string, targetStaffId: string): boolean => {
  // 정확한 매치
  if (recordStaffId === targetStaffId) return true;
  
  // staffId 패턴 매치 (staffId_숫자 패턴 제거)
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
                      record.workLog?.staffId === staffId ||
                      isStaffIdMatch(record.workLog?.staffId || '', staffId) ||
                      record.workLog?.dealerId === staffId || // @deprecated - 하위 호환성을 위해 유지
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