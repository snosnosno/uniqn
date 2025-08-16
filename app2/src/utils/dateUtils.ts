import { Timestamp } from 'firebase/firestore';

import { logger } from '../utils/logger';

// Firebase Timestamp 또는 변환 가능한 날짜 타입 정의
type TimestampInput = 
  | Timestamp 
  | Date 
  | string 
  | number
  | { toDate?: () => Date; seconds?: number; _seconds?: number; nanoseconds?: number; assignedDate?: TimestampInput }
  | null 
  | undefined;

/**
 * Firebase Timestamp를 로컬 날짜 문자열(yyyy-MM-dd)로 변환
 * 타임존 차이로 인한 날짜 변경 문제를 해결
 */
export function timestampToLocalDateString(timestamp: TimestampInput): string {
  if (!timestamp) {
    const isoString = new Date().toISOString();
    const datePart = isoString.split('T')[0];
    return datePart || '';
  }

  try {
    let date: Date;
    
    // Firebase Timestamp 객체인 경우
    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
      logger.debug('🔍 Firebase Timestamp 인스턴스 사용:', { component: 'dateUtils', data: { 
        date: date.toISOString(), 
        timestamp,
        seconds: timestamp.seconds,
        nanoseconds: timestamp.nanoseconds
      }});
    }
    // Timestamp-like 객체인 경우 (seconds, nanoseconds 속성을 가진 객체)
    else if (timestamp && typeof timestamp === 'object') {
      // constructor.name으로 Timestamp 객체 확인
      const constructorName = timestamp.constructor?.name;
      if (constructorName === 'Timestamp' || constructorName === 't') {
        // Firebase Timestamp 객체의 toDate 메서드 사용 시도
        if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
          date = timestamp.toDate();
          logger.debug('🔍 Firebase Timestamp constructor 감지:', { component: 'dateUtils', data: { 
            constructorName,
            date: date.toISOString(), 
            timestamp
          }});
        } else if ('seconds' in timestamp) {
          // toDate가 없으면 seconds로 직접 변환
          const seconds = timestamp.seconds;
          date = new Date(seconds * 1000);
          logger.debug('🔍 Firebase Timestamp seconds 직접 변환:', { component: 'dateUtils', data: { 
            constructorName,
            seconds,
            date: date.toISOString()
          }});
        } else {
          date = new Date();
        }
      }
      // toDate 메서드가 있으면 사용 (가장 일반적인 경우)
      else if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
        logger.debug('🔍 Firebase Timestamp toDate 메서드 사용:', { component: 'dateUtils', data: { 
          date: date.toISOString(), 
          timestamp,
          seconds: 'seconds' in timestamp ? timestamp.seconds : undefined,
          type: timestamp.constructor?.name
        }});
      }
      // seconds 속성이 있는 경우
      else if ('seconds' in timestamp || '_seconds' in timestamp) {
        const seconds = timestamp.seconds || timestamp._seconds;
        
        // 직접 계산 방식으로 날짜 생성
        try {
          // Number 타입 확인 및 변환
          const secondsNum = typeof seconds === 'number' ? seconds : Number(seconds);
          
          if (isNaN(secondsNum)) {
            logger.error('⚠️ 잘못된 seconds 값:', new Error(`Invalid seconds value: ${seconds}`), { component: 'dateUtils' });
            date = new Date();
          } else {
            // milliseconds 계산
            const milliseconds = secondsNum * 1000;
            date = new Date(milliseconds);
            
            // NaN 체크
            if (isNaN(date.getTime())) {
              logger.error('⚠️ Invalid Date 생성됨:', new Error(`Invalid Date created from seconds: ${secondsNum}`), { component: 'dateUtils', data: { seconds: secondsNum, milliseconds } });
              date = new Date();
            } else {
              logger.debug('🔍 Firebase Timestamp seconds 속성 사용:', { 
                component: 'dateUtils',
                data: { 
                  date: date.toISOString(), 
                  seconds: secondsNum, 
                  milliseconds
                }
              });
            }
          }
        } catch (e) {
          logger.error('⚠️ Timestamp 변환 실패:', e instanceof Error ? e : new Error(String(e)), { component: 'dateUtils' });
          date = new Date();
        }
      }
      // 기타 객체 형식 - 디버깅을 위한 자세한 로그
      else {
        logger.warn('⚠️ 알 수 없는 timestamp 객체 형식:', { component: 'dateUtils', data: {
          timestamp,
          keys: Object.keys(timestamp),
          type: typeof timestamp,
          constructor: timestamp.constructor?.name
        } });
        // assignedDate가 객체 내부에 있는 경우를 처리
        if ('assignedDate' in timestamp && timestamp.assignedDate) {
          return timestampToLocalDateString(timestamp.assignedDate);
        }
        date = new Date();
      }
    }
    // Date 객체인 경우
    else if ((timestamp as any) instanceof Date) {
      date = timestamp as any;
    }
    // 문자열인 경우
    else if (typeof timestamp === 'string') {
      // yyyy-MM-dd 형식인 경우 그대로 반환
      if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
        return timestamp;
      }
      // Firebase Timestamp 문자열 형식 처리 (예: 'Timestamp(seconds=1753920000, nanoseconds=0)')
      if (timestamp.startsWith('Timestamp(')) {
        const match = timestamp.match(/seconds=(\d+)/);
        if (match && match[1]) {
          const seconds = parseInt(match[1], 10);
          date = new Date(seconds * 1000);
        } else {
          logger.warn('⚠️ Firebase Timestamp 문자열 파싱 실패:', { component: 'dateUtils', data: timestamp });
          date = new Date();
        }
      } else {
        // 다른 형식의 문자열인 경우 Date로 파싱
        date = new Date(timestamp);
      }
    }
    // 숫자인 경우 (milliseconds)
    else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    else {
      logger.warn('⚠️ 예상치 못한 timestamp 타입:', { 
        component: 'dateUtils', 
        data: { 
          timestampString: String(timestamp), 
          type: typeof timestamp 
        } 
      });
      // 기본값: 오늘 날짜
      date = new Date();
    }

    // 날짜가 유효한지 확인
    if (!date || isNaN(date.getTime())) {
      logger.error('❌ 유효하지 않은 날짜', new Error('Invalid date'), { 
        component: 'dateUtils',
        data: {
          timestamp, 
          date,
          timestampType: typeof timestamp,
          timestampKeys: timestamp && typeof timestamp === 'object' ? Object.keys(timestamp) : null
        }
      });
      const isoString = new Date().toISOString();
    const datePart = isoString.split('T')[0];
    return datePart || '';
    }

    // 한국 시간대로 변환하여 정확한 날짜 얻기
    try {
      const koreanDateString = date.toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      // ko-KR 형식 (yyyy. MM. dd.) 을 yyyy-MM-dd 형식으로 변환
      const parts = koreanDateString.split('. ');
      if (parts.length === 3) {
        const year = parts[0];
        const monthPart = parts[1];
        const dayPart = parts[2];
        
        if (year && monthPart && dayPart) {
          const month = monthPart.padStart(2, '0');
          const day = dayPart.replace('.', '').padStart(2, '0');
          const result = `${year}-${month}-${day}`;
          
          logger.debug('✅ timestampToLocalDateString 결과:', { component: 'dateUtils', data: { 
            input: timestamp,
            dateTime: date.toISOString(),
            koreanDateString,
            result
          }});
          
          return result;
        }
      }
    } catch (localeError) {
      logger.warn('⚠️ 로케일 변환 실패, 기본 방식 사용:', { component: 'dateUtils', data: localeError });
    }
    
    // 로케일 변환 실패 시 기본 방식 사용
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    
    logger.debug('✅ timestampToLocalDateString 결과 (기본):', { component: 'dateUtils', data: { 
      input: timestamp,
      result
    }});
    
    return result;
  } catch (error) {
    logger.error('🔴 날짜 변환 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'dateUtils', data: { timestamp } });
    // 오류 발생 시 오늘 날짜 반환
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * 날짜 문자열을 읽기 쉬운 형식으로 포맷
 * @param dateString yyyy-MM-dd 형식의 날짜 문자열
 * @returns 포맷된 날짜 문자열 (예: "12월 29일 (일)")
 */
export function formatDateDisplay(dateString: string): string {
  try {
    const parts = dateString.split('-');
    if (parts.length !== 3) {
      return dateString;
    }
    
    const [yearStr, monthStr, dayStr] = parts;
    if (!yearStr || !monthStr || !dayStr) {
      return dateString;
    }
    
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return dateString;
    }
    
    const date = new Date(year, month - 1, day);
    
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekdayIndex = date.getDay();
    const weekday = weekdays[weekdayIndex] || '';
    
    return `${month}월 ${day}일 (${weekday})`;
  } catch (error) {
    logger.error('날짜 포맷 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'dateUtils' });
    return dateString;
  }
}

/**
 * yy-MM-dd(요일) 형식의 문자열을 yyyy-MM-dd로 변환
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
        const year = 2000 + parseInt(yearPart);
        const month = monthPart.padStart(2, '0');
        const day = dayPart.padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  }
  return dateStr;
}

/**
 * 통합된 시간 포맷팅 함수 - 모든 컴포넌트에서 사용
 * Firebase Timestamp, Date, string, number 등 모든 타입 지원
 */
export function formatTime(
  timestamp: TimestampInput | number, 
  options: {
    defaultValue?: string;
    format?: 'HH:MM' | 'korean' | 'full';
    timezone?: string;
  } = {}
): string {
  const { defaultValue = '', format = 'HH:MM', timezone = 'Asia/Seoul' } = options;
  
  if (!timestamp) return defaultValue;
  
  try {
    let date: Date;
    
    // Firebase Timestamp 객체인 경우
    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    }
    // Timestamp-like 객체인 경우 (toDate 메서드가 있는 객체)
    else if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    }
    // seconds 속성이 있는 객체인 경우
    else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      const seconds = timestamp.seconds;
      date = new Date(seconds * 1000);
    }
    // Date 객체인 경우
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    // 숫자인 경우 (milliseconds)
    else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    // 문자열인 경우
    else if (typeof timestamp === 'string') {
      // 이미 HH:MM 형식인 경우 그대로 반환 (format에 따라 변환)
      if (/^\d{1,2}:\d{2}$/.test(timestamp)) {
        if (format === 'korean') {
          const parts = timestamp.split(':');
          const hours = parts[0] || '0';
          const minutes = parts[1] || '00';
          const h = parseInt(hours);
          const ampm = h >= 12 ? '오후' : '오전';
          const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
          return `${ampm} ${displayHour}:${minutes}`;
        }
        return timestamp;
      }
      
      // Timestamp 문자열 형식 처리
      if (timestamp.startsWith('Timestamp(')) {
        const match = timestamp.match(/seconds=(\d+)/);
        if (match && match[1]) {
          const seconds = parseInt(match[1], 10);
          date = new Date(seconds * 1000);
        } else {
          return defaultValue;
        }
      } else {
        date = new Date(timestamp);
      }
    }
    else {
      return defaultValue;
    }

    // 날짜가 유효한지 확인
    if (!date || isNaN(date.getTime())) {
      logger.warn('유효하지 않은 날짜:', { component: 'dateUtils', data: timestamp });
      return defaultValue;
    }

    // 포맷에 따라 반환
    switch (format) {
      case 'korean':
        return date.toLocaleTimeString('ko-KR', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      
      case 'full':
        return date.toLocaleString('ko-KR', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      
      case 'HH:MM':
      default:
        return date.toLocaleTimeString('ko-KR', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
    }
  } catch (error) {
    logger.error('시간 포맷팅 오류:', error instanceof Error ? error : new Error(String(error)), { 
      component: 'dateUtils', 
      data: { timestamp, format } 
    });
    return defaultValue;
  }
}

/**
 * Timestamp를 입력 필드용 HH:MM 형식으로 변환
 */
export function formatTimeForInput(timestamp: TimestampInput): string {
  return formatTime(timestamp, { defaultValue: '', format: 'HH:MM' });
}

/**
 * Timestamp를 한국어 시간 형식으로 변환 (오전/오후 포함)
 */
export function formatTimeKorean(timestamp: TimestampInput): string {
  return formatTime(timestamp, { defaultValue: '미정', format: 'korean' });
}