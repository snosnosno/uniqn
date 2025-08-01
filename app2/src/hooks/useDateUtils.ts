import { useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { 
  formatDate, 
  convertToDateString, 
  dateStringToDropdownValue, 
  dropdownValueToDateString,
  convertToTimestamp,
  getTodayString
} from '../utils/jobPosting/dateUtils';

// 날짜 입력 타입 정의
type DateInput = 
  | Timestamp 
  | Date 
  | string 
  | number
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | null 
  | undefined;

export const useDateUtils = () => {
  // 날짜 포맷팅 (yy-MM-dd(요일))
  const formatDateDisplay = useCallback((dateInput: DateInput) => {
    return formatDate(dateInput);
  }, []);

  // 날짜를 문자열로 변환 (yyyy-MM-dd)
  const toDateString = useCallback((dateInput: DateInput) => {
    return convertToDateString(dateInput);
  }, []);

  // 드롭다운 값으로 변환
  const toDropdownValue = useCallback((dateString: string) => {
    return dateStringToDropdownValue(dateString);
  }, []);

  // 드롭다운 값을 날짜 문자열로 변환
  const fromDropdownValue = useCallback((value: { year?: string; month?: string; day?: string }) => {
    return dropdownValueToDateString(value);
  }, []);

  // Timestamp로 변환
  const toTimestamp = useCallback((dateInput: DateInput) => {
    return convertToTimestamp(dateInput);
  }, []);

  // 오늘 날짜 문자열
  const getTodayDateString = useCallback(() => {
    return getTodayString();
  }, []);

  // 날짜 범위 유효성 검증
  const validateDateRange = useCallback((startDate: string, endDate: string) => {
    if (!startDate || !endDate) {
      return { isValid: false, error: '시작 날짜와 종료 날짜를 모두 선택해주세요.' };
    }
    
    if (startDate > endDate) {
      return { isValid: false, error: '시작 날짜는 종료 날짜보다 이전이어야 합니다.' };
    }
    
    return { isValid: true, error: null };
  }, []);

  // 날짜 차이 계산 (일 단위)
  const calculateDateDifference = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both dates
  }, []);

  // 날짜 범위 생성
  const generateDateRange = useCallback((startDate: string, endDate: string) => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(convertToDateString(date));
    }
    
    return dates;
  }, []);

  // 현재 날짜와 비교
  const isDateInPast = useCallback((dateString: string) => {
    const today = getTodayString();
    return dateString < today;
  }, []);

  const isDateInFuture = useCallback((dateString: string) => {
    const today = getTodayString();
    return dateString > today;
  }, []);

  const isDateToday = useCallback((dateString: string) => {
    const today = getTodayString();
    return dateString === today;
  }, []);

  return {
    formatDateDisplay,
    toDateString,
    toDropdownValue,
    fromDropdownValue,
    toTimestamp,
    getTodayDateString,
    validateDateRange,
    calculateDateDifference,
    generateDateRange,
    isDateInPast,
    isDateInFuture,
    isDateToday,
  };
};