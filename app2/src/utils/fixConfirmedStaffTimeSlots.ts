import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from './logger';

/**
 * confirmedStaff의 잘못된 timeSlot을 수정하는 유틸리티 함수
 * "미정"이나 단일 시간 형식을 "HH:mm-HH:mm" 형식으로 변환
 */
export const fixConfirmedStaffTimeSlots = async (jobPostingId: string) => {
  try {
    // 1. 현재 jobPosting 문서 가져오기
    const jobPostingRef = doc(db, 'jobPostings', jobPostingId);
    const jobPostingDoc = await getDoc(jobPostingRef);
    
    if (!jobPostingDoc.exists()) {
      logger.error('Job posting not found', new Error('Job posting not found'), { 
        component: 'fixConfirmedStaffTimeSlots', 
        data: { jobPostingId } 
      });
      return { success: false, error: 'Job posting not found' };
    }
    
    const data = jobPostingDoc.data();
    const confirmedStaff = data.confirmedStaff || [];
    
    logger.info('Processing confirmedStaff for timeSlot fixes', {
      component: 'fixConfirmedStaffTimeSlots',
      data: {
        jobPostingId,
        confirmedStaffCount: confirmedStaff.length,
        originalData: confirmedStaff
      }
    });
    
    // 2. 각 스태프의 timeSlot 수정
    const updatedConfirmedStaff = confirmedStaff.map((staff: any) => {
      let fixedTimeSlot = staff.timeSlot;
      
      // 미정이거나 비어있는 경우
      if (!fixedTimeSlot || fixedTimeSlot === '미정' || fixedTimeSlot === 'TBD' || fixedTimeSlot === '') {
        fixedTimeSlot = '10:00-18:00'; // 기본값
        logger.debug('Fixed empty/undefined timeSlot', {
          component: 'fixConfirmedStaffTimeSlots',
          data: {
            staffId: staff.userId,
            original: staff.timeSlot,
            fixed: fixedTimeSlot
          }
        });
      }
      // 단일 시간인 경우 (예: "11:00")
      else if (fixedTimeSlot.match(/^\d{1,2}:\d{2}$/) && !fixedTimeSlot.includes('-')) {
        const [hours, minutes] = fixedTimeSlot.split(':').map(Number);
        const endHour = hours + 8; // 8시간 근무 가정
        fixedTimeSlot = `${fixedTimeSlot}-${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        logger.debug('Fixed single time format', {
          component: 'fixConfirmedStaffTimeSlots',
          data: {
            staffId: staff.userId,
            original: staff.timeSlot,
            fixed: fixedTimeSlot
          }
        });
      }
      // 이미 올바른 형식인 경우
      else if (fixedTimeSlot.match(/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/)) {
        logger.debug('TimeSlot already in correct format', {
          component: 'fixConfirmedStaffTimeSlots',
          data: {
            staffId: staff.userId,
            timeSlot: fixedTimeSlot
          }
        });
      }
      // 그 외 알 수 없는 형식
      else {
        fixedTimeSlot = '10:00-18:00'; // 기본값
        logger.warn('Unknown timeSlot format, using default', {
          component: 'fixConfirmedStaffTimeSlots',
          data: {
            staffId: staff.userId,
            original: staff.timeSlot,
            fixed: fixedTimeSlot
          }
        });
      }
      
      return {
        ...staff,
        timeSlot: fixedTimeSlot
      };
    });
    
    // 3. Firebase에 업데이트
    await updateDoc(jobPostingRef, {
      confirmedStaff: updatedConfirmedStaff
    });
    
    logger.info('Successfully updated confirmedStaff timeSlots', {
      component: 'fixConfirmedStaffTimeSlots',
      data: {
        jobPostingId,
        updatedCount: updatedConfirmedStaff.length,
        updatedData: updatedConfirmedStaff
      }
    });
    
    return { 
      success: true, 
      updatedCount: updatedConfirmedStaff.length,
      data: updatedConfirmedStaff 
    };
    
  } catch (error) {
    logger.error('Failed to fix confirmedStaff timeSlots', error instanceof Error ? error : new Error(String(error)), {
      component: 'fixConfirmedStaffTimeSlots',
      data: { jobPostingId }
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};