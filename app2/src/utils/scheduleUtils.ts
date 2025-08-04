import { Timestamp } from 'firebase/firestore';

import { logger } from '../utils/logger';
/**
 * 스케줄 관련 유틸리티 함수들
 */

/**
 * 다양한 타입의 날짜를 안전하게 YYYY-MM-DD 문자열로 변환
 */
export const safeDateToString = (dateValue: any): string => {
  if (!dateValue) return '';

  try {
    let date: Date;

    // Firestore Timestamp 객체
    if (dateValue && typeof dateValue === 'object') {
      if (typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else if (dateValue.seconds !== undefined) {
        // Timestamp 객체 (seconds/nanoseconds)
        date = new Date(dateValue.seconds * 1000);
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        logger.warn('알 수 없는 날짜 객체 타입:', { component: 'scheduleUtils', data: dateValue });
        return '';
      }
    } else if (typeof dateValue === 'string') {
      // 문자열 처리
      if (dateValue.includes('Timestamp(')) {
        // "Timestamp(seconds=1753747200, nanoseconds=0)" 형태 파싱
        const match = dateValue.match(/seconds=(\d+)/);
        if (match && match[1]) {
          const seconds = parseInt(match[1]);
          date = new Date(seconds * 1000);
        } else {
          logger.warn('Timestamp 문자열 파싱 실패:', { component: 'scheduleUtils', data: dateValue });
          return '';
        }
      } else {
        date = new Date(dateValue);
      }
    } else {
      logger.warn('지원되지 않는 날짜 타입:', { component: 'scheduleUtils', data: { type: typeof dateValue, value: dateValue } });
      return '';
    }

    // 날짜 유효성 검사
    if (isNaN(date.getTime())) {
      logger.warn('잘못된 날짜:', { component: 'scheduleUtils', data: { value: dateValue } });
      return '';
    }

    // YYYY-MM-DD 형식으로 변환
    const isoString = date.toISOString();
    return isoString.substring(0, 10);
  } catch (error) {
    logger.error('날짜 변환 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'scheduleUtils', data: { dateValue } });
    return '';
  }
};

/**
 * 시간 문자열 (HH:MM-HH:MM)을 파싱하여 Timestamp 객체들 반환
 */
export const parseTimeString = (
  timeString: string, 
  dateString: string
): { startTime: Timestamp | null; endTime: Timestamp | null } => {
  if (!timeString || timeString === '미정' || !dateString) {
    return { startTime: null, endTime: null };
  }

  try {
    if (!timeString.includes('-')) {
      return { startTime: null, endTime: null };
    }

    const timeParts = timeString.split('-').map(s => s.trim());
    const startStr = timeParts[0];
    const endStr = timeParts[1];
    
    if (!startStr || !endStr) {
      logger.warn('시간 문자열 파싱 실패:', { component: 'scheduleUtils', data: timeString });
      return { startTime: null, endTime: null };
    }
    
    const dateObj = new Date(dateString);

    if (isNaN(dateObj.getTime())) {
      logger.warn('잘못된 날짜 문자열:', { component: 'scheduleUtils', data: dateString });
      return { startTime: null, endTime: null };
    }

    // 시작 시간
    const startTimeParts = startStr.split(':');
    const startHour = startTimeParts[0] ? Number(startTimeParts[0]) : NaN;
    const startMin = startTimeParts[1] ? Number(startTimeParts[1]) : NaN;
    
    if (isNaN(startHour) || isNaN(startMin)) {
      logger.warn('잘못된 시작 시간:', { component: 'scheduleUtils', data: startStr });
      return { startTime: null, endTime: null };
    }

    const startDate = new Date(dateObj);
    startDate.setHours(startHour, startMin, 0, 0);

    // 종료 시간
    const endTimeParts = endStr.split(':');
    const endHour = endTimeParts[0] ? Number(endTimeParts[0]) : NaN;
    const endMin = endTimeParts[1] ? Number(endTimeParts[1]) : NaN;
    
    if (isNaN(endHour) || isNaN(endMin)) {
      logger.warn('잘못된 종료 시간:', { component: 'scheduleUtils', data: endStr });
      return { startTime: null, endTime: null };
    }

    let endDate = new Date(dateObj);
    endDate.setHours(endHour, endMin, 0, 0);

    // 종료 시간이 시작 시간보다 작으면 다음날로 처리 (자정 넘는 근무)
    if (endHour < startHour) {
      endDate.setDate(endDate.getDate() + 1);
    }

    return {
      startTime: Timestamp.fromDate(startDate),
      endTime: Timestamp.fromDate(endDate)
    };
  } catch (error) {
    logger.error('시간 파싱 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'scheduleUtils', data: { timeString, dateString } });
    return { startTime: null, endTime: null };
  }
};

/**
 * 여러 날짜 배열에서 각 날짜를 안전하게 변환
 */
export const parseDateArray = (dateArray: any[]): string[] => {
  if (!Array.isArray(dateArray)) return [];

  return dateArray
    .map(safeDateToString)
    .filter(date => date !== ''); // 빈 문자열 제거
};

/**
 * 날짜 필드들을 순서대로 시도하여 첫 번째 유효한 날짜 반환
 */
export const extractDateFromFields = (data: any, fields: string[]): string => {
  for (const field of fields) {
    if (data[field]) {
      const dateStr = safeDateToString(data[field]);
      if (dateStr) {
        return dateStr;
      }
    }
  }
  return '';
};