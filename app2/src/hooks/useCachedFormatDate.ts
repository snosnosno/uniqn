import { useMemo } from 'react';
import { formatDate } from '../utils/jobPosting/dateUtils';

// 전역 캐시 맵 - 앱 전체에서 공유
const formatDateCache = new Map<string, string>();

/**
 * 캐시된 날짜 포맷팅 훅
 * 동일한 날짜 입력에 대해 이전 결과를 캐시하여 성능 최적화
 */
export const useCachedFormatDate = (dateInput: any): string => {
  return useMemo(() => {
    // null, undefined, 빈 문자열 처리
    if (!dateInput) {
      return '';
    }
    
    // 캐시 키 생성 (입력값을 문자열로 변환)
    const cacheKey = typeof dateInput === 'object' 
      ? JSON.stringify(dateInput) 
      : String(dateInput);
    
    // 캐시에서 결과 확인
    if (formatDateCache.has(cacheKey)) {
      return formatDateCache.get(cacheKey)!;
    }
    
    // 새로운 포맷팅 수행
    const formatted = formatDate(dateInput);
    
    // 캐시에 저장 (메모리 사용량 제한을 위해 최대 1000개까지만 저장)
    if (formatDateCache.size >= 1000) {
      // 가장 오래된 항목 제거 (FIFO)
      const firstKey = formatDateCache.keys().next().value;
      formatDateCache.delete(firstKey);
    }
    
    formatDateCache.set(cacheKey, formatted);
    return formatted;
  }, [dateInput]);
};

/**
 * 시간 표시 포맷팅 캐시
 */
const timeDisplayCache = new Map<string, string>();

export const useCachedTimeDisplay = (
  timeInput: string | undefined,
  formatTimeDisplay: (time: string | undefined) => string
): string => {
  return useMemo(() => {
    if (!timeInput) {
      return '';
    }
    
    const cacheKey = timeInput;
    
    if (timeDisplayCache.has(cacheKey)) {
      return timeDisplayCache.get(cacheKey)!;
    }
    
    const formatted = formatTimeDisplay(timeInput);
    
    // 메모리 관리
    if (timeDisplayCache.size >= 500) {
      const firstKey = timeDisplayCache.keys().next().value;
      timeDisplayCache.delete(firstKey);
    }
    
    timeDisplayCache.set(cacheKey, formatted);
    return formatted;
  }, [timeInput, formatTimeDisplay]);
};

/**
 * 시간대 색상 캐시
 */
const timeSlotColorCache = new Map<string, string>();

export const useCachedTimeSlotColor = (
  timeInput: string | undefined,
  getTimeSlotColor: (time: string | undefined) => string
): string => {
  return useMemo(() => {
    if (!timeInput) {
      return '';
    }
    
    const cacheKey = timeInput;
    
    if (timeSlotColorCache.has(cacheKey)) {
      return timeSlotColorCache.get(cacheKey)!;
    }
    
    const color = getTimeSlotColor(timeInput);
    
    // 메모리 관리
    if (timeSlotColorCache.size >= 200) {
      const firstKey = timeSlotColorCache.keys().next().value;
      timeSlotColorCache.delete(firstKey);
    }
    
    timeSlotColorCache.set(cacheKey, color);
    return color;
  }, [timeInput, getTimeSlotColor]);
};

/**
 * 캐시 초기화 함수 (필요시 사용)
 */
export const clearFormatCaches = () => {
  formatDateCache.clear();
  timeDisplayCache.clear();
  timeSlotColorCache.clear();
};

/**
 * 캐시 상태 조회 (디버깅용)
 */
export const getCacheStats = () => ({
  formatDateCacheSize: formatDateCache.size,
  timeDisplayCacheSize: timeDisplayCache.size,
  timeSlotColorCacheSize: timeSlotColorCache.size
});