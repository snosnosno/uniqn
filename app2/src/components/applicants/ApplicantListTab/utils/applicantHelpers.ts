import { logger } from '../../../../utils/logger';
import { Applicant } from '../types';

/**
 * 지원자가 다중 선택을 했는지 확인하는 함수
 */
export const hasMultipleSelections = (applicant: Applicant): boolean => {
  return !!(applicant.assignedRoles?.length || 
            applicant.assignedTimes?.length || 
            applicant.assignedDates?.length);
};

/**
 * 날짜 값을 안전하게 문자열로 변환하는 함수
 */
export const convertDateToString = (rawDate: any): string => {
  if (!rawDate) return '';
  
  if (typeof rawDate === 'string') {
    return rawDate;
  } else if (rawDate.toDate) {
    // Firestore Timestamp 객체인 경우
    try {
      return rawDate.toDate().toISOString().split('T')[0] || '';
    } catch (error) {
      logger.error('❌ Timestamp 변환 오류:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'applicantHelpers', 
        data: { rawDate } 
      });
      return '';
    }
  } else if (rawDate.seconds) {
    // seconds 속성이 있는 경우
    try {
      return new Date(rawDate.seconds * 1000).toISOString().split('T')[0] || '';
    } catch (error) {
      logger.error('❌ seconds 변환 오류:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'applicantHelpers', 
        data: { rawDate } 
      });
      return '';
    }
  } else {
    // 다른 타입인 경우 문자열로 변환
    try {
      return String(rawDate);
    } catch (error) {
      logger.error('❌ 날짜 변환 오류:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'applicantHelpers', 
        data: { rawDate } 
      });
      return '';
    }
  }
};

/**
 * 지원자의 선택 사항을 가져오는 함수
 */
export const getApplicantSelections = (applicant: Applicant) => {
  logger.debug('🔍 getApplicantSelections 호출:', { 
    component: 'applicantHelpers',
    data: {
      applicantId: applicant.id,
      applicantName: applicant.applicantName,
      hasMultiple: hasMultipleSelections(applicant),
      assignedRoles: applicant.assignedRoles,
      assignedTimes: applicant.assignedTimes,
      assignedDates: applicant.assignedDates,
      assignedRole: applicant.assignedRole,
      assignedTime: applicant.assignedTime,
      assignedDate: applicant.assignedDate
    }
  });
  
  // 다중 선택이 있는 경우
  if (hasMultipleSelections(applicant)) {
    const selections = [];
    const maxLength = Math.max(
      applicant.assignedRoles?.length || 0,
      applicant.assignedTimes?.length || 0,
      applicant.assignedDates?.length || 0
    );
    
    for (let i = 0; i < maxLength; i++) {
      const dateValue = convertDateToString(applicant.assignedDates?.[i]);
      
      selections.push({
        role: applicant.assignedRoles?.[i] || '',
        time: applicant.assignedTimes?.[i] || '',
        date: dateValue
      });
    }
    
    logger.debug('🔍 다중 선택 결과:', { component: 'applicantHelpers', data: selections });
    return selections;
  }
  
  // 기존 단일 선택 방식
  if (applicant.assignedRole && applicant.assignedTime) {
    const singleDateValue = convertDateToString(applicant.assignedDate);
    
    const singleSelection = [{
      role: applicant.assignedRole,
      time: applicant.assignedTime,
      date: singleDateValue
    }];
    
    logger.debug('🔍 단일 선택 결과:', { component: 'applicantHelpers', data: singleSelection });
    return singleSelection;
  }
  
  logger.debug('🔍 선택 사항 없음', { component: 'applicantHelpers' });
  return [];
};

/**
 * 날짜 포맷팅 함수 (MM-DD(요일))
 */
export const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}-${day}(${dayOfWeek})`;
  } catch (error) {
    logger.error('날짜 포맷팅 오류:', error instanceof Error ? error : new Error(String(error)), { 
      component: 'applicantHelpers' 
    });
    return dateStr;
  }
};

/**
 * 역할 이름을 한글로 변환하는 맵
 */
export const jobRoleMap: { [key: string]: string } = {
  'dealer': 'Dealer',
  'floor': 'Floor',
  'serving': 'Server',
  'tournament_director': 'Tournament Director',
  'chip_master': 'Chip Master', 
  'registration': 'Registration',
  'security': 'Security',
  'other': 'Other'
};