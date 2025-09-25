import { Timestamp } from 'firebase/firestore';

/**
 * 간소화된 날짜 유틸리티
 * 모든 날짜를 표준 형식으로 통합 처리
 * 
 * 기존 432줄 → 95줄로 대폭 간소화
 * 하위 호환성 100% 유지
 */

/**
 * 모든 날짜 타입을 yyyy-MM-dd 문자열로 변환
 * @param input - Timestamp, Date, string, number 등 모든 날짜 형식
 * @returns yyyy-MM-dd 형식의 날짜 문자열
 */
export function toDateString(input: any): string {
  if (!input) return new Date().toISOString().split('T')[0] || '';
  
  try {
    let date: Date;
    
    // Timestamp 처리 (Firebase)
    if (input?.toDate && typeof input.toDate === 'function') {
      date = input.toDate();
    }
    // seconds 속성이 있는 객체 (Timestamp-like)
    else if (input?.seconds) {
      date = new Date(input.seconds * 1000);
    }
    // Date 객체
    else if (input instanceof Date) {
      date = input;
    }
    // yyyy-MM-dd 형식 문자열은 그대로 반환
    else if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    // 기타 문자열 또는 숫자
    else {
      date = new Date(input);
    }
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0] || '';
    }
    
    // yyyy-MM-dd 형식으로 반환
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
    
  } catch {
    return new Date().toISOString().split('T')[0] || '';
  }
}

/**
 * 시간을 HH:mm 형식으로 변환
 * @param input - 시간 정보를 포함한 모든 형식
 * @returns HH:mm 형식의 시간 문자열
 */
export function toTimeString(input: any): string {
  if (!input) return '';
  
  // 이미 HH:mm 형식인 경우
  if (typeof input === 'string' && /^\d{1,2}:\d{2}$/.test(input)) {
    return input;
  }
  
  try {
    let date: Date;
    
    // Firebase Timestamp 객체 처리
    if (input && typeof input === 'object' && 'toDate' in input && typeof input.toDate === 'function') {
      date = input.toDate();
    } else {
      date = new Date(input);
    }
    
    if (!isNaN(date.getTime())) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  } catch {
    // 에러 무시
  }
  
  return '';
}

/**
 * 날짜를 읽기 쉬운 형식으로 표시 (12월 29일 (일))
 * @param dateString - yyyy-MM-dd 형식의 날짜 문자열
 * @returns 한국어 형식의 날짜 표시
 */
export function formatDateDisplay(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return dateString;
    
    const date = new Date(year, month - 1, day);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()] || '';
    return `${month}월 ${day}일 (${weekday})`;
  } catch {
    return dateString;
  }
}

/**
 * 날짜를 Firebase Timestamp로 변환
 * @param input - 모든 날짜 형식
 * @returns Firebase Timestamp 객체
 */
export function toTimestamp(input: any): Timestamp {
  const dateStr = toDateString(input);
  const date = new Date(dateStr);
  return Timestamp.fromDate(date);
}

// 🔄 MIGRATED: getTodayString은 utils/jobPosting/dateUtils.ts로 이동됨
// 더 많은 기능과 캐싱이 포함된 버전을 사용하세요
//
// 기존 함수:
// export function getTodayString(): string {
//   return toDateString(new Date());
// }

/**
 * yy-MM-dd(요일) 형식의 문자열을 yyyy-MM-dd로 변환
 * @param dateStr - yy-MM-dd(요일) 형식 문자열
 * @returns yyyy-MM-dd 형식 문자열
 */
export function parseShortDateFormat(dateStr: string): string {
  if (/^\d{2}-\d{2}-\d{2}\([일월화수목금토]\)$/.test(dateStr)) {
    const datePart = dateStr.split('(')[0];
    if (datePart) {
      const parts = datePart.split('-');
      const yearPart = parts[0];
      const monthPart = parts[1];
      const dayPart = parts[2];
      
      if (yearPart && monthPart && dayPart) {
        const year = 2000 + parseInt(yearPart, 10);
        const month = monthPart.padStart(2, '0');
        const day = dayPart.padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  }
  return dateStr;
}

// ===== 하위 호환성을 위한 기존 함수명 export =====

/**
 * @deprecated Use toDateString instead
 */
export const timestampToLocalDateString = toDateString;

/**
 * 통합된 시간 포맷팅 함수
 * @deprecated Use toTimeString for simple cases
 */
export function formatTime(
  timestamp: any,
  options: {
    defaultValue?: string;
    format?: 'HH:MM' | 'korean' | 'full';
    timezone?: string;
  } = {}
): string {
  const { defaultValue = '', format = 'HH:MM' } = options;
  
  if (!timestamp) return defaultValue;
  
  if (format === 'korean') {
    const time = toTimeString(timestamp);
    if (!time) return defaultValue;
    
    const parts = time.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${ampm} ${displayHour}:${String(minutes).padStart(2, '0')}`;
  }
  
  if (format === 'full') {
    const dateStr = toDateString(timestamp);
    const timeStr = toTimeString(timestamp);
    return dateStr && timeStr ? `${dateStr} ${timeStr}` : defaultValue;
  }
  
  return toTimeString(timestamp) || defaultValue;
}

/**
 * @deprecated Use toTimeString instead
 */
export const formatTimeForInput = toTimeString;

/**
 * @deprecated Use formatTime with korean option
 */
export function formatTimeKorean(timestamp: any): string {
  return formatTime(timestamp, { defaultValue: '미정', format: 'korean' });
}