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
 * 지원자의 선택 사항을 가져오는 함수 (확정 취소 후 복원 지원)
 */
export const getApplicantSelections = (applicant: Applicant) => {
  logger.debug('🔍 getApplicantSelections 호출:', { 
    component: 'applicantHelpers',
    data: {
      applicantId: applicant.id,
      applicantName: applicant.applicantName,
      status: applicant.status,
      hasMultiple: hasMultipleSelections(applicant),
      assignedRoles: applicant.assignedRoles,
      assignedTimes: applicant.assignedTimes,
      assignedDates: applicant.assignedDates,
      assignedRole: applicant.assignedRole,
      assignedTime: applicant.assignedTime,
      assignedDate: applicant.assignedDate
    }
  });
  
  // 1. 다중 선택 배열이 있는 경우 (확정 후 또는 확정 취소 후)
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
    
    logger.debug('🔍 다중 선택 결과:', { 
      component: 'applicantHelpers', 
      data: { 
        status: applicant.status,
        selectionsCount: selections.length,
        selections 
      } 
    });
    return selections;
  }
  
  // 2. 단일 선택 필드만 있는 경우 (기존 방식 또는 확정 취소 후 배열이 비어있는 경우)
  if (applicant.assignedRole && applicant.assignedTime) {
    const singleDateValue = convertDateToString(applicant.assignedDate);
    
    const singleSelection = [{
      role: applicant.assignedRole,
      time: applicant.assignedTime,
      date: singleDateValue
    }];
    
    logger.debug('🔍 단일 선택 결과:', { 
      component: 'applicantHelpers', 
      data: { 
        status: applicant.status,
        singleSelection 
      } 
    });
    return singleSelection;
  }
  
  // 3. 확정 취소된 상태에서 배열 데이터만 있고 단일 필드가 비어있는 경우
  // (확정 취소 시 assignedRole/assignedTime은 null로 설정되지만 배열은 유지됨)
  if (applicant.status === 'applied' && 
      (applicant.assignedRoles?.length || applicant.assignedTimes?.length || applicant.assignedDates?.length)) {
    const selections = [];
    const maxLength = Math.max(
      applicant.assignedRoles?.length || 0,
      applicant.assignedTimes?.length || 0,
      applicant.assignedDates?.length || 0
    );
    
    for (let i = 0; i < maxLength; i++) {
      const dateValue = convertDateToString(applicant.assignedDates?.[i]);
      
      // 빈 값들도 포함하여 원본 지원 상태 복원
      selections.push({
        role: applicant.assignedRoles?.[i] || '',
        time: applicant.assignedTimes?.[i] || '',
        date: dateValue
      });
    }
    
    logger.debug('🔍 확정 취소 후 배열 복원:', { 
      component: 'applicantHelpers', 
      data: { 
        status: applicant.status,
        restoredCount: selections.length,
        selections 
      } 
    });
    return selections;
  }
  
  logger.debug('🔍 선택 사항 없음', { 
    component: 'applicantHelpers',
    data: { status: applicant.status }
  });
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
 * 선택 항목 인터페이스 (내부 사용)
 */
interface Selection {
  role: string;
  time: string;
  date: string;
}

/**
 * 날짜별 그룹화된 선택 사항 인터페이스
 */
export interface DateGroupedSelections {
  date: string;
  displayDate: string; // "01-15(수)" 형식
  selections: Selection[];
  selectedCount: number;
  totalCount: number;
}

/**
 * 통계 정보가 포함된 선택 항목 인터페이스
 */
export interface SelectionWithStats extends Selection {
  confirmedCount: number;
  requiredCount: number;
  isFull: boolean;
  isSelected: boolean;
}

/**
 * 지원자의 선택 사항을 날짜별로 그룹화하는 함수
 */
export const getApplicantSelectionsByDate = (applicant: Applicant): DateGroupedSelections[] => {
  logger.debug('🔍 getApplicantSelectionsByDate 호출:', { 
    component: 'applicantHelpers',
    data: {
      applicantId: applicant.id,
      applicantName: applicant.applicantName
    }
  });

  const selections = getApplicantSelections(applicant);
  
  if (selections.length === 0) {
    return [];
  }

  // 날짜별로 그룹화
  const dateGroups = new Map<string, Selection[]>();
  
  selections.forEach(selection => {
    const dateKey = selection.date || 'no-date';
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey)?.push(selection);
  });

  // Map을 배열로 변환하고 날짜순 정렬
  const groupedSelections: DateGroupedSelections[] = Array.from(dateGroups.entries())
    .map(([date, selections]) => ({
      date,
      displayDate: formatDateDisplay(date),
      selections,
      selectedCount: 0, // 나중에 MultiSelectControls에서 계산
      totalCount: selections.length
    }))
    .sort((a, b) => {
      // 날짜 없는 경우는 마지막으로
      if (a.date === 'no-date') return 1;
      if (b.date === 'no-date') return -1;
      // 날짜순 정렬
      return a.date.localeCompare(b.date);
    });

  logger.debug('🔍 날짜별 그룹화 결과:', { 
    component: 'applicantHelpers', 
    data: {
      groupCount: groupedSelections.length,
      groups: groupedSelections.map(g => ({
        date: g.date,
        displayDate: g.displayDate,
        count: g.totalCount
      }))
    }
  });

  return groupedSelections;
};

/**
 * 같은 날짜 내에서 중복 선택인지 확인하는 함수
 */
export const isDuplicateInSameDate = (
  existingSelections: Selection[], 
  newSelection: Selection
): boolean => {
  return existingSelections.some(existing => 
    existing.date === newSelection.date &&
    existing.time === newSelection.time &&
    existing.role === newSelection.role
  );
};

/**
 * 특정 날짜의 선택 통계를 계산하는 함수
 */
export const getDateSelectionStats = (
  selections: Selection[], 
  selectedAssignments: Array<{timeSlot: string, role: string, date: string}>,
  targetDate: string
) => {
  const dateSelections = selections.filter(s => s.date === targetDate);
  const selectedInDate = selectedAssignments.filter(s => s.date === targetDate);
  
  return {
    totalCount: dateSelections.length,
    selectedCount: selectedInDate.length
  };
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