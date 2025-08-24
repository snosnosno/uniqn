/**
 * 구인공고 데이터 마이그레이션 유틸리티
 * 
 * 기존 startDate/endDate 기반 데이터를 새로운 dateSpecificRequirements 기반으로 변환합니다.
 */

import { JobPosting, JobPostingFormData } from '../../types/jobPosting';
import { convertToDateString } from './dateUtils';
import { createNewDateSpecificRequirement } from './jobPostingHelpers';
import { UnifiedWorkLog } from '../../types/unified/workLog';
import { logger } from '../logger';

/**
 * 날짜 범위 생성
 */
const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(convertToDateString(date));
  }
  
  return dates;
};

/**
 * 다음 날짜 가져오기
 */
export const getNextDay = (dateString: string): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return convertToDateString(date);
};

/**
 * 기존 JobPosting 데이터 마이그레이션
 * startDate/endDate → dateSpecificRequirements
 */
export const migrateJobPosting = (post: any): JobPosting => {
  try {
    // 이미 마이그레이션된 데이터는 그대로 반환
    if (!post.startDate && !post.endDate && post.dateSpecificRequirements?.length > 0) {
      return post;
    }
    
    // startDate/endDate가 있고 dateSpecificRequirements가 없으면 자동 변환
    if (post.startDate && post.endDate && (!post.dateSpecificRequirements || post.dateSpecificRequirements.length === 0)) {
      const startDateStr = convertToDateString(post.startDate);
      const endDateStr = convertToDateString(post.endDate);
      const dates = generateDateRange(startDateStr, endDateStr);
      
      logger.info('JobPosting 마이그레이션', {
        component: 'migration',
        data: {
          postId: post.id,
          startDate: startDateStr,
          endDate: endDateStr,
          generatedDates: dates.length
        }
      });
      
      // 기존 timeSlots이 있으면 유지, 없으면 기본값 생성
      post.dateSpecificRequirements = dates.map(date => {
        const requirement = createNewDateSpecificRequirement(date);
        
        // 기존 timeSlots이 있으면 마이그레이션
        if (post.timeSlots && post.timeSlots.length > 0) {
          requirement.timeSlots = post.timeSlots.map((slot: any) => ({
            ...slot,
            endTime: slot.endTime || '18:00', // 기본 종료 시간 추가
            duration: { type: 'single' }
          }));
        } else {
          // 기본 시간대 생성
          requirement.timeSlots = [{
            time: '09:00',
            endTime: '18:00',
            roles: post.requiredRoles?.map((role: string) => ({
              name: role,
              count: 1
            })) || [{ name: 'dealer', count: 1 }],
            duration: { type: 'single' }
          }];
        }
        
        return requirement;
      });
    }
    
    // 기존 필드 제거
    const migrated = { ...post };
    delete migrated.startDate;
    delete migrated.endDate;
    delete migrated.timeSlots; // 이제 dateSpecificRequirements 내부로 이동
    
    return migrated;
  } catch (error) {
    logger.error('JobPosting 마이그레이션 실패', error as Error, { component: 'migration', data: { postId: post.id } });
    return post;
  }
};

/**
 * JobPostingFormData 마이그레이션
 */
export const migrateJobPostingFormData = (formData: any): JobPostingFormData => {
  try {
    // 이미 마이그레이션된 데이터는 그대로 반환
    if (!formData.startDate && !formData.endDate && formData.dateSpecificRequirements?.length > 0) {
      return formData;
    }
    
    // startDate/endDate가 있으면 변환
    if (formData.startDate && formData.endDate) {
      const dates = generateDateRange(formData.startDate, formData.endDate);
      
      // dateSpecificRequirements가 없으면 생성
      if (!formData.dateSpecificRequirements || formData.dateSpecificRequirements.length === 0) {
        formData.dateSpecificRequirements = dates.map(date => 
          createNewDateSpecificRequirement(date)
        );
      }
    }
    
    // 기존 필드 제거
    const migrated = { ...formData };
    delete migrated.startDate;
    delete migrated.endDate;
    
    return migrated;
  } catch (error) {
    logger.error('JobPostingFormData 마이그레이션 실패', error as Error);
    return formData;
  }
};

/**
 * WorkLog 마이그레이션
 * scheduledEndTime이 없으면 추가하고, 자정을 넘는 경우 처리
 */
export const migrateWorkLog = (log: any): UnifiedWorkLog => {
  try {
    // scheduledEndTime이 없으면 추가
    if (!log.scheduledEndTime && log.scheduledStartTime) {
      // 기본 8시간 근무 가정
      const startHour = parseInt(log.scheduledStartTime.split(':')[0]);
      const endHour = (startHour + 8) % 24;
      log.scheduledEndTime = `${endHour.toString().padStart(2, '0')}:00`;
      
      // 자정을 넘는 경우
      if (endHour < startHour) {
        log.endsNextDay = true;
      }
    }
    
    // actualEndTime 처리
    if (log.actualStartTime && !log.actualEndTime && log.actualStartTime) {
      // 실제 종료 시간이 없으면 예정 종료 시간 사용
      log.actualEndTime = log.scheduledEndTime;
      
      if (log.endsNextDay) {
        log.actualEndDate = getNextDay(log.date);
      }
    }
    
    return log;
  } catch (error) {
    logger.error('WorkLog 마이그레이션 실패', error as Error, { component: 'migration', data: { logId: log.id } });
    return log;
  }
};

/**
 * dateSpecificRequirements에서 날짜 범위 계산
 */
export const calculateDateRange = (dateRequirements: any[]): { start: string; end: string } => {
  if (!dateRequirements || dateRequirements.length === 0) {
    const today = convertToDateString(new Date());
    return { start: today, end: today };
  }
  
  // 모든 날짜 수집 (시간대의 endDate 포함)
  const allDates: string[] = [];
  
  dateRequirements.forEach(req => {
    const dateStr = convertToDateString(req.date);
    allDates.push(dateStr);
    
    // 시간대별 종료 날짜도 포함
    req.timeSlots?.forEach((slot: any) => {
      if (slot.endDate) {
        allDates.push(slot.endDate);
      }
      if (slot.duration?.type === 'multi' && slot.duration.endDate) {
        allDates.push(slot.duration.endDate);
      }
    });
  });
  
  // 정렬하여 최소/최대 날짜 찾기
  allDates.sort();
  
  return {
    start: allDates[0] || '',
    end: allDates[allDates.length - 1] || ''
  };
};

/**
 * 연속된 날짜 범위 통합
 */
export const consolidateDateRanges = (dates: { start: string; end: string }[]): { start: string; end: string }[] => {
  if (dates.length === 0) return [];
  
  // 시작 날짜로 정렬
  const sorted = [...dates].sort((a, b) => a.start.localeCompare(b.start));
  const consolidated: { start: string; end: string }[] = [];
  
  if (sorted.length === 0) return [];
  
  const firstItem = sorted[0];
  if (!firstItem) return [];
  
  let current: { start: string; end: string } = { 
    start: firstItem.start || '', 
    end: firstItem.end || '' 
  };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (!next) continue;
    const currentEndDate = new Date(current.end || '');
    const nextStartDate = new Date(next.start || '');
    
    // 날짜가 연속되거나 겹치면 통합
    currentEndDate.setDate(currentEndDate.getDate() + 1);
    if (currentEndDate >= nextStartDate) {
      // 범위 확장
      if ((next.end || '') > (current.end || '')) {
        current.end = next.end || '';
      }
    } else {
      // 새로운 범위 시작
      consolidated.push({ start: current.start, end: current.end });
      current = { ...next };
    }
  }
  
  consolidated.push(current);
  return consolidated;
};