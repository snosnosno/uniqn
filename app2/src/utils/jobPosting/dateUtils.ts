import { Timestamp } from 'firebase/firestore';

/**
 * 다양한 날짜 형식을 yy-MM-dd(요일) 형식으로 포맷팅
 */
export const formatDate = (dateInput: any): string => {
  if (!dateInput) {
    console.log('🔍 formatDate(utils): 빈 값 입력', dateInput);
    return '';
  }
  
  console.log('🔍 formatDate(utils) 입력:', dateInput, 'typeof:', typeof dateInput);
  
  try {
    let date: Date;
    
    // Handle Firebase Timestamp object
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      console.log('📅 Firebase Timestamp 처리:', dateInput.seconds);
      date = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      console.log('📅 Date 객체 처리:', dateInput);
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      console.log('📅 문자열 날짜 처리:', dateInput);
      date = new Date(dateInput);
    } else {
      console.warn('❌ 알 수 없는 날짜 형식:', dateInput);
      return '알 수 없는 날짜 형식';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('❌ 유효하지 않은 날짜:', dateInput);
      return '날짜 형식 오류';
    }
    
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const dayOfWeekIndex = date.getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = dayNames[dayOfWeekIndex] || '?';
    
    const result = `${year}-${month}-${day}(${dayOfWeek})`;
    console.log('✅ formatDate(utils) 성공:', result);
    return result;
  } catch (error) {
    console.error('❌ formatDate(utils) 오류:', error, dateInput);
    return '날짜 처리 오류';
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
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      date = new Date(dateInput.seconds * 1000);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // 이미 yyyy-MM-dd 형식인지 확인
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
      }
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
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      return dateInput; // 이미 Timestamp 객체
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
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