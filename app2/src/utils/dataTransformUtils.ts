/**
 * 데이터 변환 관련 통합 유틸리티
 * 중복된 데이터 변환 로직을 제거하고 일관된 변환 함수 제공
 */

import { Timestamp } from 'firebase/firestore';
import { logger } from './logger';
import { COLLECTIONS, DEFAULT_VALUES, TIME_REGEX } from '../constants';

/**
 * WorkLog와 Staff 데이터를 병합하는 통합 함수
 */
export interface StaffWorkLogData {
  id: string;
  staffId: string;
  staffName: string;
  eventId: string;
  date: string;
  scheduledStartTime?: Timestamp | null;
  scheduledEndTime?: Timestamp | null;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  assignedTime?: string;
  role?: string;
  contact?: string;
  status?: string;
  isVirtual?: boolean;
}

/**
 * Staff 데이터와 WorkLog 데이터를 병합
 */
export function mergeStaffWithWorkLog(
  staff: any,
  workLog?: any,
  options: {
    useStaffAsFallback?: boolean;
    includeVirtualData?: boolean;
  } = {}
): StaffWorkLogData {
  const { useStaffAsFallback = true, includeVirtualData = true } = options;

  const baseData: StaffWorkLogData = {
    id: workLog?.id || `virtual_${staff.id}_${staff.date || DEFAULT_VALUES.TODAY}`,
    staffId: staff.staffId || staff.id,
    staffName: staff.name || staff.staffName || '이름 없음',
    eventId: workLog?.eventId || staff.eventId || '',
    date: workLog?.date || staff.date || DEFAULT_VALUES.TODAY,
    scheduledStartTime: workLog?.scheduledStartTime || null,
    scheduledEndTime: workLog?.scheduledEndTime || null,
    actualStartTime: workLog?.actualStartTime || null,
    actualEndTime: workLog?.actualEndTime || null,
    status: workLog?.status || 'not_started'
  };

  // Staff 데이터를 fallback으로 사용
  if (useStaffAsFallback) {
    baseData.assignedTime = staff.assignedTime || DEFAULT_VALUES.TIME_PENDING;
    baseData.role = staff.role || workLog?.role;
    baseData.contact = staff.contact || staff.phone;
  }

  // 가상 데이터 표시
  if (includeVirtualData && !workLog?.id) {
    baseData.isVirtual = true;
  }

  return baseData;
}

/**
 * 출석 상태 계산 통합 함수
 */
export function calculateAttendanceStatus(data: {
  actualStartTime?: Timestamp | string | null;
  actualEndTime?: Timestamp | string | null;
  status?: string;
}): string {
  const { actualStartTime, actualEndTime, status } = data;

  // 명시적 상태가 있으면 우선 사용
  if (status && status !== 'not_started') {
    return status;
  }

  // 실제 시간 기반으로 상태 계산
  if (actualStartTime && actualEndTime) {
    return 'checked_out';
  } else if (actualStartTime) {
    return 'checked_in';
  } else {
    return 'not_started';
  }
}

/**
 * 근무 시간 계산 통합 함수
 */
export function calculateWorkDuration(
  startTime: Timestamp | Date | string | null,
  endTime: Timestamp | Date | string | null,
  options: {
    format?: 'minutes' | 'hours' | 'korean';
    allowNextDay?: boolean;
  } = {}
): number | string {
  const { format = 'minutes', allowNextDay = true } = options;

  if (!startTime || !endTime) return format === 'minutes' ? 0 : '0시간 0분';

  try {
    let start: Date;
    let end: Date;

    // 시간 객체 변환
    if (startTime instanceof Timestamp) {
      start = startTime.toDate();
    } else if (startTime instanceof Date) {
      start = startTime;
    } else if (typeof startTime === 'string') {
      start = new Date(startTime);
    } else {
      return format === 'minutes' ? 0 : '0시간 0분';
    }

    if (endTime instanceof Timestamp) {
      end = endTime.toDate();
    } else if (endTime instanceof Date) {
      end = endTime;
    } else if (typeof endTime === 'string') {
      end = new Date(endTime);
    } else {
      return format === 'minutes' ? 0 : '0시간 0분';
    }

    // 다음날 계산 지원
    if (allowNextDay && end.getTime() <= start.getTime()) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    const diffMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

    switch (format) {
      case 'minutes':
        return Math.max(0, diffMinutes);
      
      case 'hours':
        return Math.max(0, Math.round(diffMinutes / 60 * 100) / 100);
      
      case 'korean':
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        if (hours > 0) {
          return `${hours}시간 ${minutes}분`;
        } else {
          return `${minutes}분`;
        }
      
      default:
        return diffMinutes;
    }
  } catch (error) {
    logger.error('근무시간 계산 오류:', error instanceof Error ? error : new Error(String(error)), {
      component: 'dataTransformUtils',
      data: { startTime, endTime }
    });
    return format === 'minutes' ? 0 : '0시간 0분';
  }
}

/**
 * 시간 문자열 검증 통합 함수
 */
export function validateTimeString(timeStr: string): {
  isValid: boolean;
  format?: string;
  error?: string;
} {
  if (!timeStr || typeof timeStr !== 'string') {
    return { isValid: false, error: '시간이 입력되지 않았습니다' };
  }

  const trimmed = timeStr.trim();

  // HH:MM 형식
  if (TIME_REGEX.HH_MM.test(trimmed)) {
    const timeParts = trimmed.split(':');
    const hours = Number(timeParts[0] || 0);
    const minutes = Number(timeParts[1] || 0);
    
    if (hours < 0 || hours > 23) {
      return { isValid: false, error: '시간은 0-23 사이여야 합니다' };
    }
    
    if (minutes < 0 || minutes > 59) {
      return { isValid: false, error: '분은 0-59 사이여야 합니다' };
    }
    
    return { isValid: true, format: 'HH:MM' };
  }

  // HH:MM:SS 형식
  if (TIME_REGEX.HH_MM_SS.test(trimmed)) {
    return { isValid: true, format: 'HH:MM:SS' };
  }

  return { isValid: false, error: '올바른 시간 형식이 아닙니다 (HH:MM)' };
}

/**
 * 날짜 문자열 검증 통합 함수
 */
export function validateDateString(dateStr: string): {
  isValid: boolean;
  format?: string;
  error?: string;
} {
  if (!dateStr || typeof dateStr !== 'string') {
    return { isValid: false, error: '날짜가 입력되지 않았습니다' };
  }

  const trimmed = dateStr.trim();

  // YYYY-MM-DD 형식
  if (TIME_REGEX.YYYY_MM_DD.test(trimmed)) {
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
      return { isValid: false, error: '유효하지 않은 날짜입니다' };
    }
    return { isValid: true, format: 'YYYY-MM-DD' };
  }

  return { isValid: false, error: '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)' };
}

/**
 * 배열을 안전하게 접근하는 헬퍼 함수
 */
export function safeArrayAccess<T>(
  array: T[] | undefined | null,
  index: number,
  defaultValue: T
): T {
  if (!array || !Array.isArray(array) || index < 0 || index >= array.length) {
    return defaultValue;
  }
  return array[index] ?? defaultValue;
}

/**
 * 객체 속성을 안전하게 접근하는 헬퍼 함수
 */
export function safeObjectAccess<T>(
  obj: Record<string, any> | undefined | null,
  key: string,
  defaultValue: T
): T {
  if (!obj || typeof obj !== 'object' || !(key in obj)) {
    return defaultValue;
  }
  return obj[key] ?? defaultValue;
}

/**
 * ID 생성 헬퍼 함수
 */
export function generateId(prefix: string, ...parts: string[]): string {
  const cleanParts = parts.filter(part => part && typeof part === 'string');
  return `${prefix}_${cleanParts.join('_')}`;
}

/**
 * staffId와 dealerId 매칭 확인 (하위 호환성)
 */
export function isStaffIdMatch(recordStaffId: string, targetStaffId: string): boolean {
  if (!recordStaffId || !targetStaffId) return false;
  
  // 정확한 매치
  if (recordStaffId === targetStaffId) return true;
  
  // staffId 패턴 매치 (staffId_숫자 패턴 제거)
  const cleanRecordId = recordStaffId.replace(/_\d+$/, '');
  const cleanTargetId = targetStaffId.replace(/_\d+$/, '');
  
  return cleanRecordId === cleanTargetId;
}

/**
 * 데이터 정규화 헬퍼 (undefined, null, 빈 문자열 처리)
 */
export function normalizeString(value: any, defaultValue = ''): string {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') return value.trim();
  return String(value);
}

/**
 * 숫자 정규화 헬퍼
 */
export function normalizeNumber(value: any, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * 불린 정규화 헬퍼
 */
export function normalizeBoolean(value: any, defaultValue = false): boolean {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return defaultValue;
}

/**
 * 중복 제거 헬퍼
 */
export function removeDuplicates<T>(
  array: T[],
  keyExtractor?: (item: T) => string | number
): T[] {
  if (!Array.isArray(array)) return [];
  
  if (!keyExtractor) {
    // Set을 Array.from으로 변환하여 ES2015 호환성 확보
    return Array.from(new Set(array));
  }
  
  const seen = new Set();
  return array.filter(item => {
    const key = keyExtractor(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 데이터 그룹화 헬퍼
 */
export function groupBy<T>(
  array: T[],
  keyExtractor: (item: T) => string
): Record<string, T[]> {
  if (!Array.isArray(array)) return {};
  
  return array.reduce((groups, item) => {
    const key = keyExtractor(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key]!.push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * 깊은 복사 헬퍼 (간단한 객체용)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloned = {} as Record<string, any>;
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone((obj as any)[key]);
    });
    return cloned as T;
  }
  return obj;
}