import { Timestamp } from 'firebase/firestore';

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
 * 다양한 날짜 형식을 yy-MM-dd(요일) 형식으로 포맷팅
 * 캐싱 시스템을 통한 성능 최적화 적용
 */
export const formatDate = (dateInput: any): string => {
  // 캐시 키 생성
  const cacheKey = typeof dateInput === 'object' 
    ? JSON.stringify(dateInput) 
    : String(dateInput);
  
  // 캐시에서 결과 확인
  if (formatDateCache.has(cacheKey)) {
    return formatDateCache.get(cacheKey)!;
  }

  if (!dateInput) {
    return '';
  }
  
  // 결과를 저장할 변수
  let formattedResult: string;

  // 이미 포맷된 문자열인지 확인 (yy-MM-dd(요일) 형식)
  if (typeof dateInput === 'string') {
    const alreadyFormattedPattern = /^\d{2}-\d{2}-\d{2}\([일월화수목금토]\)$/;
    if (alreadyFormattedPattern.test(dateInput)) {
      formattedResult = dateInput;
      // 캐시에 저장하고 반환
      addToCache(cacheKey, formattedResult);
      return formattedResult;
    }
  }
  
  try {
    let date: Date;
    
    // Handle Firebase Timestamp object
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
      // Timestamp 객체를 Date로 변환
      if (typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
      } else {
        date = new Date(dateInput.seconds * 1000 + dateInput.nanoseconds / 1000000);
      }
    } else if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      date = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // 빈 문자열 체크
      if (dateInput.trim() === '') {
        return '';
      }
      
      // Timestamp 문자열 형태 체크 - 더 관대한 정규식
      // "Timestamp(seconds=1753488000, nanoseconds=0)" 또는 유사한 형태들
      
      // 여러 정규식 시도 - 더 정확한 패턴들
      const patterns = [
        /Timestamp\(seconds=(\d+), nanoseconds=(\d+)\)/i,                  // 정확한 형태
        /Timestamp\(seconds=(\d+),\s*nanoseconds=(\d+)\)/i,               // 공백 처리
        /Timestamp\s*\(\s*seconds\s*=\s*(\d+)\s*,\s*nanoseconds\s*=\s*(\d+)\s*\)/i, // 관대한 공백
        /^Timestamp\(seconds=(\d+),\s*nanoseconds=(\d+)\)$/i              // 전체 매칭
      ];
      
      let timestampMatch = null;
      for (let i = 0; i < patterns.length; i++) {
        timestampMatch = dateInput.match(patterns[i]);
        if (timestampMatch) break;
      }
      
      if (timestampMatch) {
        const seconds = parseInt(timestampMatch[1]);
        const nanoseconds = parseInt(timestampMatch[2]);
        
        // seconds 값 검증
        if (isNaN(seconds) || seconds < 0) {
          formattedResult = '잘못된 타임스탬프';
          addToCache(cacheKey, formattedResult);
          return formattedResult;
        }
        
        const milliseconds = seconds * 1000 + (nanoseconds || 0) / 1000000;
        date = new Date(milliseconds);
        
        // Date 유효성 재확인
        if (isNaN(date.getTime())) {
          date = new Date(seconds * 1000);
        }
      } else {
        
        // 마지막 수단: indexOf와 substring으로 직접 추출
        if (dateInput.includes('seconds=') && dateInput.includes('nanoseconds=')) {
          const secondsStart = dateInput.indexOf('seconds=') + 'seconds='.length;
          const secondsEnd = dateInput.indexOf(',', secondsStart);
          const nanosecondsStart = dateInput.indexOf('nanoseconds=') + 'nanoseconds='.length;
          const nanosecondsEnd = dateInput.indexOf(')', nanosecondsStart);
          
          if (secondsEnd > secondsStart && nanosecondsEnd > nanosecondsStart) {
            const secondsStr = dateInput.substring(secondsStart, secondsEnd).trim();
            const nanosecondsStr = dateInput.substring(nanosecondsStart, nanosecondsEnd).trim();
            
            const seconds = parseInt(secondsStr);
            const nanoseconds = parseInt(nanosecondsStr);
            
            if (!isNaN(seconds) && !isNaN(nanoseconds)) {
              date = new Date(seconds * 1000 + nanoseconds / 1000000);
            } else {
              date = new Date(dateInput);
            }
          } else {
            date = new Date(dateInput);
          }
        } else {
          date = new Date(dateInput);
        }
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      formattedResult = '알 수 없는 날짜 형식';
      addToCache(cacheKey, formattedResult);
      return formattedResult;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // 마지막 시도: seconds 값을 직접 추출해보기
      if (typeof dateInput === 'string' && dateInput.includes('seconds=')) {
        const secondsMatch = dateInput.match(/seconds=(\d+)/);
        if (secondsMatch) {
          const seconds = parseInt(secondsMatch[1]);
          const fallbackDate = new Date(seconds * 1000);
          if (!isNaN(fallbackDate.getTime())) {
            date = fallbackDate;
          } else {
            formattedResult = '날짜 처리 불가';
            addToCache(cacheKey, formattedResult);
            return formattedResult;
          }
        } else {
          formattedResult = '날짜 형식 오류';
          addToCache(cacheKey, formattedResult);
          return formattedResult;
        }
      } else {
        formattedResult = '날짜 형식 오류';
        addToCache(cacheKey, formattedResult);
        return formattedResult;
      }
    }
    
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const dayOfWeekIndex = date.getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = dayNames[dayOfWeekIndex] || '?';
    
    formattedResult = `${year}-${month}-${day}(${dayOfWeek})`;
    addToCache(cacheKey, formattedResult);
    return formattedResult;
  } catch (error) {
    formattedResult = '날짜 처리 오류';
    addToCache(cacheKey, formattedResult);
    return formattedResult;
  }
};

/**
 * 다양한 날짜 형식을 yyyy-MM-dd 문자열로 변환
 */
export const convertToDateString = (dateInput: any): string => {
  if (!dateInput) return '';
  
  try {
    let date: Date;
    
    // Handle Firebase Timestamp object
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
      // Timestamp 객체를 Date로 변환
      if (typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
      } else {
        date = new Date(dateInput.seconds * 1000 + dateInput.nanoseconds / 1000000);
      }
    } else if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      date = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // 빈 문자열 체크
      if (dateInput.trim() === '') {
        return '';
      }
      // 이미 yyyy-MM-dd 형식인지 확인
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
      }
      
      // Timestamp 문자열 형태 체크
      const timestampMatch = dateInput.match(/Timestamp\s*\(\s*seconds\s*=\s*(\d+)\s*,\s*nanoseconds\s*=\s*(\d+)\s*\)/i);
      if (timestampMatch) {
        const seconds = parseInt(timestampMatch[1]);
        const nanoseconds = parseInt(timestampMatch[2]);
        date = new Date(seconds * 1000 + nanoseconds / 1000000);
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      console.warn('Unknown date format:', dateInput);
      return '';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateInput);
      return '';
    }
    
    // Convert to yyyy-MM-dd format for HTML date input
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error converting date to string:', error, dateInput);
    return '';
  }
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
    console.error('Error converting date string to dropdown value:', error, dateString);
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
export const convertToTimestamp = (dateInput: any): any => {
  if (!dateInput) return null;
  
  try {
    let date: Date;
    
    // Handle Firebase Timestamp object (이미 Timestamp라면 그대로 반환)
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
      return dateInput; // 이미 Timestamp 객체
    } else if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      return dateInput; // 이미 Timestamp 객체 (legacy)
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      if (dateInput.trim() === '') {
        return null;
      }
      
      // Timestamp 문자열 형태 체크
      const timestampMatch = dateInput.match(/Timestamp\s*\(\s*seconds\s*=\s*(\d+)\s*,\s*nanoseconds\s*=\s*(\d+)\s*\)/i);
      if (timestampMatch) {
        const seconds = parseInt(timestampMatch[1]);
        const nanoseconds = parseInt(timestampMatch[2]);
        date = new Date(seconds * 1000 + nanoseconds / 1000000);
      } else {
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      console.warn('Unknown date format for Timestamp conversion:', dateInput);
      return null;
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date for Timestamp conversion:', dateInput);
      return null;
    }
    
    return Timestamp.fromDate(date);
  } catch (error) {
    console.error('Error converting to Timestamp:', error, dateInput);
    return null;
  }
};

/**
 * 오늘 날짜를 yyyy-MM-dd 형식으로 반환
 */
export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
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