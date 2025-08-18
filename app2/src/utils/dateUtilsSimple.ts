import { Timestamp } from 'firebase/firestore';

/**
 * 간소화된 날짜 유틸리티
 * 모든 날짜를 표준 형식으로 통합 처리
 */

/**
 * 모든 날짜 타입을 yyyy-MM-dd 문자열로 변환
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
 */
export function toTimeString(input: any): string {
  if (!input) return '';
  
  // 이미 HH:mm 형식인 경우
  if (typeof input === 'string' && /^\d{1,2}:\d{2}$/.test(input)) {
    return input;
  }
  
  try {
    const dateStr = toDateString(input);
    const date = new Date(input);
    
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
 */
export function formatDateDisplay(dateString: string): string {
  try {
    const parts = dateString.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    
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
 */
export function toTimestamp(input: any): Timestamp {
  const dateStr = toDateString(input);
  const date = new Date(dateStr);
  return Timestamp.fromDate(date);
}

/**
 * 오늘 날짜를 yyyy-MM-dd 형식으로 반환
 */
export function getTodayString(): string {
  return toDateString(new Date());
}

// 하위 호환성을 위한 export (기존 함수명 유지)
export const timestampToLocalDateString = toDateString;
export const formatTime = toTimeString;
export const formatTimeForInput = toTimeString;
export const formatTimeKorean = (input: any) => {
  const time = toTimeString(input);
  if (!time) return '미정';
  
  const parts = time.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const ampm = hours >= 12 ? '오후' : '오전';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${ampm} ${displayHour}:${String(minutes).padStart(2, '0')}`;
};