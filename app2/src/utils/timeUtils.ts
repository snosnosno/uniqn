// 시간 관련 유틸리티 함수들
import { logger } from './logger';

export interface TimeInterval {
  label: string;
  value: number; // 분 단위
  icon?: string;
}

// 사전 정의된 시간 간격 옵션들
export const TIME_INTERVALS: TimeInterval[] = [
  { label: '10분', value: 10, icon: '⚡' },
  { label: '20분', value: 20, icon: '🚀' },
  { label: '30분', value: 30, icon: '⏰' },
  { label: '60분', value: 60, icon: '🕒' },
];

// 시간 슬롯 생성 함수 (개선된 버전)
export const generateTimeSlots = (
  startTime: string, 
  endTime: string, 
  interval: number
): string[] => {
  const slots: string[] = [];
  const start = new Date(`2024-01-01T${startTime}:00`);
  const end = new Date(`2024-01-01T${endTime}:00`);
  
  if (start >= end) {
    logger.warn('Start time must be before end time', { component: 'timeUtils' });
    return [];
  }
  
  const current = new Date(start);
  while (current <= end) {
    const hours = current.getHours().toString().padStart(2, '0');
    const minutes = current.getMinutes().toString().padStart(2, '0');
    slots.push(`${hours}:${minutes}`);
    current.setMinutes(current.getMinutes() + interval);
  }
  
  return slots;
};

// 시간 문자열 검증
export const isValidTimeString = (timeStr: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
};

// 시간 비교 (HH:MM 형식)
export const compareTime = (time1: string, time2: string): number => {
  const parts1 = time1.split(':').map(Number);
  const parts2 = time2.split(':').map(Number);
  
  const h1 = parts1[0] || 0;
  const m1 = parts1[1] || 0;
  const h2 = parts2[0] || 0;
  const m2 = parts2[1] || 0;
  
  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;
  
  return minutes1 - minutes2;
};

// 시간 차이 계산 (분 단위)
export const getTimeDifferenceInMinutes = (startTime: string, endTime: string): number => {
  const startParts = startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);
  
  const startHour = startParts[0] || 0;
  const startMin = startParts[1] || 0;
  const endHour = endParts[0] || 0;
  const endMin = endParts[1] || 0;
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return endMinutes - startMinutes;
};

// 시간 형식화 (한국어 표시)
export const formatTimeDisplay = (timeStr: string): string => {
  if (!isValidTimeString(timeStr)) return timeStr;
  
  const parts = timeStr.split(':');
  const hours = parts[0] || '0';
  const minutes = parts[1] || '00';
  const h = parseInt(hours);
  const ampm = h >= 12 ? '오후' : '오전';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  
  return `${ampm} ${displayHour}:${minutes}`;
};

// 시간 간격 변경 시 기존 할당 데이터 변환
export const convertAssignmentData = (
  oldAssignments: { [timeSlot: string]: string },
  oldInterval: number,
  newInterval: number,
  startTime: string,
  endTime: string
): { [timeSlot: string]: string } => {
  const newAssignments: { [timeSlot: string]: string } = {};
  const newTimeSlots = generateTimeSlots(startTime, endTime, newInterval);
  
  // 기존 할당을 새로운 시간 슬롯에 매핑
  Object.entries(oldAssignments).forEach(([oldTimeSlot, assignment]) => {
    // 가장 가까운 새로운 시간 슬롯 찾기
    const closestSlot = findClosestTimeSlot(oldTimeSlot, newTimeSlots);
    if (closestSlot && !newAssignments[closestSlot]) {
      newAssignments[closestSlot] = assignment;
    }
  });
  
  return newAssignments;
};

// 가장 가까운 시간 슬롯 찾기
export const findClosestTimeSlot = (targetTime: string, timeSlots: string[]): string | null => {
  if (timeSlots.length === 0) return null;
  
  const firstSlot = timeSlots[0];
  if (!firstSlot) return null;
  
  let closestSlot = firstSlot;
  let minDiff = Math.abs(getTimeDifferenceInMinutes(targetTime, closestSlot));
  
  for (const slot of timeSlots) {
    const diff = Math.abs(getTimeDifferenceInMinutes(targetTime, slot));
    if (diff < minDiff) {
      minDiff = diff;
      closestSlot = slot;
    }
  }
  
  return closestSlot;
};

// 시간 슬롯 개수 계산
export const calculateTotalSlots = (
  startTime: string, 
  endTime: string, 
  interval: number
): number => {
  const totalMinutes = getTimeDifferenceInMinutes(startTime, endTime);
  return Math.floor(totalMinutes / interval) + 1;
};

// 작업 시간 통계
export interface TimeStatistics {
  totalSlots: number;
  totalMinutes: number;
  formattedDuration: string;
}

export const getTimeStatistics = (
  startTime: string, 
  endTime: string, 
  interval: number
): TimeStatistics => {
  const totalMinutes = getTimeDifferenceInMinutes(startTime, endTime);
  const totalSlots = calculateTotalSlots(startTime, endTime, interval);
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formattedDuration = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  
  return {
    totalSlots,
    totalMinutes,
    formattedDuration,
  };
};

// Timestamp/Date 변환 헬퍼
export const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  return new Date();
};

// 근무 시간 계산 (분 단위) - 다음날 계산 지원
export const calculateMinutes = (startTime: any, endTime: any): number => {
  if (!startTime || !endTime) return 0;
  
  // "미정" 체크
  if (startTime === '미정' || endTime === '미정') return 0;
  
  try {
    let startDate: Date;
    let endDate: Date;
    
    // startTime 변환
    if (startTime && typeof startTime.toDate === 'function') {
      startDate = startTime.toDate();
    } else if (startTime instanceof Date) {
      startDate = startTime;
    } else if (typeof startTime === 'string' && startTime.includes(':')) {
      // "HH:MM" 형식의 문자열 처리
      const [hours, minutes] = startTime.split(':').map(Number);
      startDate = new Date();
      startDate.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      return 0;
    }
    
    // endTime 변환
    if (endTime && typeof endTime.toDate === 'function') {
      endDate = endTime.toDate();
    } else if (endTime instanceof Date) {
      endDate = endTime;
    } else if (typeof endTime === 'string' && endTime.includes(':')) {
      // "HH:MM" 형식의 문자열 처리
      const [hours, minutes] = endTime.split(':').map(Number);
      endDate = new Date();
      endDate.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      return 0;
    }
    
    // 종료 시간이 시작 시간보다 이전인 경우 (다음날로 계산)
    if (endDate.getTime() <= startDate.getTime()) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  } catch (error) {
    return 0;
  }
};

// 분을 시간:분 형식으로 변환
export const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
};

// 분을 한국어 형식으로 변환
export const formatMinutesToKorean = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}시간 ${remainingMinutes}분`;
};

const timeUtilities = {
  TIME_INTERVALS,
  generateTimeSlots,
  isValidTimeString,
  compareTime,
  getTimeDifferenceInMinutes,
  formatTimeDisplay,
  convertAssignmentData,
  findClosestTimeSlot,
  calculateTotalSlots,
  getTimeStatistics,
  toDate,
  calculateMinutes,
  formatMinutesToTime,
  formatMinutesToKorean,
};

export default timeUtilities;