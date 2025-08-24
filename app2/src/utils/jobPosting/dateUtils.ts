import { Timestamp } from 'firebase/firestore';

import { logger } from '../../utils/logger';

// 날짜 입력 타입 정의
type DateInput = 
  | Timestamp 
  | Date 
  | string 
  | number
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | null 
  | undefined;

// 전역 캐시 맵 - formatDate 함수 성능 최적화
const formatDateCache = new Map<string, string>();
const maxCacheSize = 1000; // 최대 캐시 크기

// 캐시 관리 함수
const addToCache = (key: string, value: string) => {
  // 캐시 크기 제한
  if (formatDateCache.size >= maxCacheSize) {
    // 가장 오래된 항목 제거 (FIFO)
    const firstKey = formatDateCache.keys().next().value;
    formatDateCache.delete(firstKey);
  }
  formatDateCache.set(key, value);
};

/**
 * 통합된 Timestamp/Date 변환 함수
 * 모든 유형의 날짜 입력을 Date 객체로 변환
 */
export const parseToDate = (dateInput: DateInput): Date | null => {
  if (!dateInput) {
    return null;
  }

  try {
    // 1. Date 객체인 경우
    if (dateInput instanceof Date) {
      return isNaN(dateInput.getTime()) ? null : dateInput;
    }

    // 2. Firebase Timestamp 객체인 경우
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
      const seconds = dateInput.seconds;
      const nanoseconds = dateInput.nanoseconds || 0;
      
      // 유효성 검증 (1970~2038년 범위)
      if (typeof seconds !== 'number' || seconds < 0 || seconds > 2147483647) {
        logger.warn('Invalid Timestamp seconds:', { component: 'dateUtils', data: seconds });
        return null;
      }
      
      if (typeof nanoseconds !== 'number' || nanoseconds < 0 || nanoseconds >= 1000000000) {
        logger.warn('Invalid Timestamp nanoseconds:', { component: 'dateUtils', data: nanoseconds });
        return null;
      }
      
      // Timestamp 변환
      if (typeof dateInput.toDate === 'function') {
        const date = dateInput.toDate();
        return isNaN(date.getTime()) ? null : date;
      } else {
        // 타임존 보정을 적용한 변환
        const utcDate = new Date(seconds * 1000 + nanoseconds / 1000000);
        // 로컬 타임존을 고려하여 날짜가 변경되지 않도록 함
        return isNaN(utcDate.getTime()) ? null : utcDate;
      }
    }

    // 3. Legacy Timestamp 객체인 경우 (nanoseconds 없음)
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      const seconds = dateInput.seconds;
      
      if (typeof seconds !== 'number' || seconds < 0 || seconds > 2147483647) {
        logger.warn('Invalid legacy Timestamp seconds:', { component: 'dateUtils', data: seconds });
        return null;
      }
      
      // 타임존 보정을 적용한 변환
      const utcDate = new Date(seconds * 1000);
      // 로컬 타임존을 고려하여 날짜가 변경되지 않도록 함
      return isNaN(utcDate.getTime()) ? null : utcDate;
    }

    // 4. 문자열인 경우
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) {
        return null;
      }

      // 4-1. 이미 포맷된 문자열인지 확인 (yy-MM-dd(요일) 형식)
      const alreadyFormattedPattern = /^\d{2}-\d{2}-\d{2}\([일월화수목금토]\)$/;
      if (alreadyFormattedPattern.test(trimmed)) {
        // 포맷된 문자열에서 날짜 추출
        const datePart = trimmed.split('(')[0];
        if (datePart) {
          const parts = datePart.split('-');
          if (parts.length === 3) {
            const yearPart = parts[0];
            const monthPart = parts[1];
            const dayPart = parts[2];
            
            if (yearPart && monthPart && dayPart) {
              const year = 2000 + parseInt(yearPart); // yy -> yyyy
              const month = parseInt(monthPart) - 1; // 0-based month
              const day = parseInt(dayPart);
              const date = new Date(year, month, day);
              return isNaN(date.getTime()) ? null : date;
            }
          }
        }
      }

      // 4-2. Timestamp 문자열 형태 체크
      const timestampPatterns = [
        /Timestamp\(seconds=(\d+),?\s*nanoseconds=(\d+)\)/i,
        /seconds=(\d+),?\s*nanoseconds=(\d+)/i
      ];
      
      for (const pattern of timestampPatterns) {
        const match = trimmed.match(pattern);
        if (match && match[1] && match[2]) {
          const seconds = parseInt(match[1]);
          const nanoseconds = parseInt(match[2]);
          
          if (!isNaN(seconds) && seconds >= 0 && seconds <= 2147483647) {
            const date = new Date(seconds * 1000 + nanoseconds / 1000000);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
      }

      // 4-3. 일반 문자열을 Date로 변환
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? null : date;
    }

    // 5. 숫자인 경우 (밀리초 timestamp)
    if (typeof dateInput === 'number') {
      const date = new Date(dateInput);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  } catch (error) {
    logger.error('Error parsing date:', error instanceof Error ? error : new Error(String(error)), { component: 'dateUtils', data: { dateInput } });
    return null;
  }
};

/**
 * 다양한 날짜 형식을 yy-MM-dd(요일) 형식으로 포맷팅
 * 캐싱 시스템을 통한 성능 최적화 적용
 */
export const formatDate = (dateInput: DateInput): string => {
  // 캐시 키 생성
  const cacheKey = typeof dateInput === 'object' 
    ? JSON.stringify(dateInput) 
    : String(dateInput);
  
  // 캐시에서 결과 확인
  if (formatDateCache.has(cacheKey)) {
    return formatDateCache.get(cacheKey)!;
  }

  if (!dateInput) {
    addToCache(cacheKey, '');
    return '';
  }

  try {
    // 통합된 변환 함수 사용
    const date = parseToDate(dateInput);
    
    if (!date) {
      const errorResult = '날짜 처리 오류';
      addToCache(cacheKey, errorResult);
      return errorResult;
    }

    // yy-MM-dd(요일) 형식으로 포맷팅
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const dayOfWeekIndex = date.getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = dayNames[dayOfWeekIndex] || '?';
    
    const formattedResult = `${year}-${month}-${day}(${dayOfWeek})`;
    addToCache(cacheKey, formattedResult);
    return formattedResult;
  } catch (error) {
    logger.error('Error formatting date:', error instanceof Error ? error : new Error(String(error)), { component: 'dateUtils', data: { dateInput } });
    const errorResult = '날짜 처리 오류';
    addToCache(cacheKey, errorResult);
    return errorResult;
  }
};

/**
 * 다양한 날짜 형식을 yyyy-MM-dd 문자열로 변환
 * 타임존으로 인한 날짜 변경 문제를 방지
 */
export const convertToDateString = (dateInput: DateInput): string => {
  if (!dateInput) {
    return '';
  }
  
  try {
    // 이미 yyyy-MM-dd 형식인지 확인
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      return dateInput.trim();
    }
    
    // 통합된 변환 함수 사용
    const date = parseToDate(dateInput);
    
    if (!date) {
      logger.warn('Invalid date for convertToDateString:', { component: 'dateUtils', data: dateInput });
      return '';
    }
    
    // 로컬 날짜로 변환하여 타임존 차이로 인한 날짜 변경 방지
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    logger.error('Error converting date to string:', error instanceof Error ? error : new Error(String(error)), { component: 'dateUtils', data: { dateInput } });
    return '';
  }
};

/**
 * 날짜 범위 생성 함수
 * 시작일부터 종료일까지의 모든 날짜 배열 반환
 */
export const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(convertToDateString(date));
  }
  
  return dates;
};

/**
 * 날짜 배열을 범위 문자열로 변환
 * 예: ["2025-08-24", "2025-08-25", "2025-08-26"] → "25-08-24(일) ~ 25-08-26(화)"
 */
export const formatDateRangeDisplay = (dates: string[]): string => {
  if (!dates || dates.length === 0) return '';
  
  const sortedDates = [...dates].sort();
  
  // 단일 날짜
  if (sortedDates.length === 1) {
    return formatDate(sortedDates[0]);
  }
  
  // 연속된 날짜 체크
  const isConsecutive = sortedDates.every((date, idx) => {
    if (idx === 0) return true;
    const prev = sortedDates[idx - 1];
    if (!prev) return false;
    const prevDate = new Date(prev);
    const currDate = new Date(date);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
    return diffDays === 1;
  });
  
  // 연속된 경우 범위로 표시
  if (isConsecutive) {
    const first = formatDate(sortedDates[0]);
    const last = formatDate(sortedDates[sortedDates.length - 1]);
    return `${first} ~ ${last}`;
  }
  
  // 비연속 날짜 처리
  if (sortedDates.length <= 3) {
    // 3개 이하는 개별 표시
    return sortedDates.map(d => formatDate(d)).join(', ');
  } else {
    // 3개 초과시 축약 표시
    const first = formatDate(sortedDates[0]);
    const last = formatDate(sortedDates[sortedDates.length - 1]);
    return `${first} ~ ${last} (${sortedDates.length}일)`;
  }
};

/**
 * 날짜 배열을 연속된 그룹으로 나누기
 * 예: ["2025-08-24", "2025-08-25", "2025-08-27"] → [["2025-08-24", "2025-08-25"], ["2025-08-27"]]
 */
export const groupConsecutiveDates = (dates: string[]): string[][] => {
  if (!dates || dates.length === 0) return [];
  
  const sortedDates = [...dates].sort();
  const groups: string[][] = [];
  const firstDate = sortedDates[0];
  if (!firstDate) return [];
  
  let currentGroup: string[] = [firstDate];
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDateStr = sortedDates[i - 1];
    const currDateStr = sortedDates[i];
    
    if (!prevDateStr || !currDateStr) continue;
    
    const prevDate = new Date(prevDateStr);
    const currDate = new Date(currDateStr);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
    
    if (diffDays === 1) {
      // 연속된 날짜면 현재 그룹에 추가
      currentGroup.push(currDateStr);
    } else {
      // 연속되지 않으면 새 그룹 시작
      groups.push(currentGroup);
      currentGroup = [currDateStr];
    }
  }
  
  // 마지막 그룹 추가
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
};

/**
 * 날짜 그룹을 포맷된 문자열로 변환
 * 단일 날짜는 그대로, 연속된 날짜는 범위로 표시
 */
export const formatDateGroup = (dates: string[]): string => {
  if (!dates || dates.length === 0) return '';
  
  const firstDate = dates[0];
  if (!firstDate) return '';
  
  if (dates.length === 1) {
    return formatDate(firstDate);
  }
  
  const lastDate = dates[dates.length - 1];
  if (!lastDate) return formatDate(firstDate);
  
  const first = formatDate(firstDate);
  const last = formatDate(lastDate);
  return `${first} ~ ${last}`;
};

/**
 * DateDropdownSelector용 날짜 문자열을 드롭다운 값으로 변환
 */
export const dateStringToDropdownValue = (dateString: string): { year?: string; month?: string; day?: string } => {
  if (!dateString) return {};
  
  try {
    const [year, month, day] = dateString.split('-');
    return {
      year: year || '',
      month: month || '',
      day: day || ''
    };
  } catch (error) {
    logger.error('Error converting date string to dropdown value:', error instanceof Error ? error : new Error(String(error)), { component: 'dateUtils', data: { dateString } });
    return {};
  }
};

/**
 * 드롭다운 값을 날짜 문자열로 변환
 */
export const dropdownValueToDateString = (value: { year?: string; month?: string; day?: string }): string => {
  const { year, month, day } = value;
  
  if (!year || !month || !day) {
    return '';
  }
  
  // Ensure proper formatting with leading zeros
  const formattedMonth = month.padStart(2, '0');
  const formattedDay = day.padStart(2, '0');
  
  return `${year}-${formattedMonth}-${formattedDay}`;
};

/**
 * 다양한 날짜 형식을 Firebase Timestamp로 변환
 */
export const convertToTimestamp = (dateInput: DateInput): Timestamp | null => {
  if (!dateInput) {
    return null;
  }
  
  try {
    // 이미 Timestamp 객체인 경우 그대로 반환
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
      return dateInput as Timestamp; // 이미 Timestamp 객체
    }
    
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      return dateInput as Timestamp; // 이미 Timestamp 객체 (legacy)
    }
    
    // 통합된 변환 함수 사용
    const date = parseToDate(dateInput);
    
    if (!date) {
      logger.warn('Invalid date for Timestamp conversion:', { component: 'dateUtils', data: dateInput });
      return null;
    }
    
    return Timestamp.fromDate(date);
  } catch (error) {
    logger.error('Error converting to Timestamp:', error instanceof Error ? error : new Error(String(error)), { component: 'dateUtils', data: { dateInput } });
    return null;
  }
};

/**
 * 오늘 날짜를 yyyy-MM-dd 형식으로 반환
 * 로컬 타임존 기준으로 오늘 날짜 반환
 */
export const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * formatDate 캐시 관리 함수들
 */
export const clearFormatDateCache = (): void => {
  formatDateCache.clear();
};

export const getFormatDateCacheSize = (): number => {
  return formatDateCache.size;
};

export const getFormatDateCacheStats = () => ({
  size: formatDateCache.size,
  maxSize: maxCacheSize,
  usage: `${((formatDateCache.size / maxCacheSize) * 100).toFixed(1)}%`
});

