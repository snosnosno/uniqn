import { logger } from '../../../../utils/logger';
import { Applicant } from '../types';
import { ApplicationHistoryService } from '../../../../services/ApplicationHistoryService';

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
 * 지원자의 선택 사항을 가져오는 함수 (상태별 데이터 소스 분리)
 * - 확정 상태: 실제 확정된 선택사항만 반환
 * - 지원 상태: 원본 지원 데이터 반환 (ApplicationHistory 기반)
 */
export const getApplicantSelections = (applicant: Applicant) => {
  logger.debug('🔍 getApplicantSelections 호출 (상태별 처리):', { 
    component: 'applicantHelpers',
    data: {
      applicantId: applicant.id,
      applicantName: applicant.applicantName,
      status: applicant.status,
      hasOriginalApplication: !!(applicant as any).originalApplication,
      hasMultiple: hasMultipleSelections(applicant),
      assignedRoles: applicant.assignedRoles,
      assignedTimes: applicant.assignedTimes,
      assignedDates: applicant.assignedDates,
      assignedRole: applicant.assignedRole,
      assignedTime: applicant.assignedTime,
      assignedDate: applicant.assignedDate
    }
  });
  
  // 🎯 확정된 상태: 실제 확정된 선택사항만 반환
  if (applicant.status === 'confirmed') {
    try {
      const confirmedSelections = ApplicationHistoryService.getConfirmedSelections(applicant);
      
      logger.debug('✅ 확정된 선택사항 조회 성공:', { 
        component: 'applicantHelpers', 
        data: { 
          status: applicant.status,
          selectionsCount: confirmedSelections.length,
          selections: confirmedSelections,
          source: 'ConfirmedData'
        } 
      });
      
      return confirmedSelections;
    } catch (error) {
      logger.warn('⚠️ 확정된 선택사항 조회 실패, 폴백 진행:', {
        component: 'applicantHelpers',
        data: { error: error instanceof Error ? error.message : String(error) }
      });
      // 오류 시 빈 배열 반환 (확정된 상태에서는 확정 데이터만 표시)
      return [];
    }
  }
  
  // 🔄 지원 상태: ApplicationHistory 서비스를 통한 원본 데이터 복원
  // 이 방법이 가장 신뢰할 수 있는 데이터 소스입니다
  try {
    const originalData = ApplicationHistoryService.getOriginalApplicationData(applicant);
    
    if (originalData.roles.length > 0 || originalData.times.length > 0 || originalData.dates.length > 0) {
      const selections = [];
      const maxLength = Math.max(
        originalData.roles.length,
        originalData.times.length,
        originalData.dates.length
      );
      
      logger.debug('🏗️ ApplicationHistory 원본 데이터 발견:', {
        component: 'applicantHelpers',
        data: {
          rolesLength: originalData.roles.length,
          timesLength: originalData.times.length,
          datesLength: originalData.dates.length,
          maxLength,
          status: applicant.status
        }
      });
      
      // 원본 데이터로부터 완전 복원
      for (let i = 0; i < maxLength; i++) {
        const roleValue = originalData.roles[i] ?? '';
        const timeValue = originalData.times[i] ?? '';
        const dateValue = convertDateToString(originalData.dates[i]);
        
        selections.push({
          role: roleValue,
          time: timeValue,
          date: dateValue
        });
      }
      
      logger.debug('✅ ApplicationHistory 원본 데이터 복원 성공:', { 
        component: 'applicantHelpers', 
        data: { 
          status: applicant.status,
          selectionsCount: selections.length,
          selections,
          source: 'ApplicationHistory'
        } 
      });
      return selections;
    }
  } catch (error) {
    logger.warn('⚠️ ApplicationHistory 원본 데이터 접근 실패, 폴백 진행:', {
      component: 'applicantHelpers',
      data: { error: error instanceof Error ? error.message : String(error) }
    });
  }
  
  // 🔄 우선순위 2: 배열 데이터가 있는 경우 (기존 로직 유지)
  if (hasMultipleSelections(applicant)) {
    const selections = [];
    
    // 🔧 TypeScript strict mode: 배열 undefined 체크 강화
    const rolesArray = applicant.assignedRoles ?? [];
    const timesArray = applicant.assignedTimes ?? [];
    const datesArray = applicant.assignedDates ?? [];
    
    const maxLength = Math.max(
      rolesArray.length,
      timesArray.length,
      datesArray.length
    );
    
    logger.debug('🔧 배열 데이터 분석 (폴백):', {
      component: 'applicantHelpers',
      data: {
        rolesLength: rolesArray.length,
        timesLength: timesArray.length, 
        datesLength: datesArray.length,
        maxLength
      }
    });
    
    // 🔥 핵심: 모든 인덱스 완전 복원 (빈 값 필터링 제거)
    for (let i = 0; i < maxLength; i++) {
      const roleValue = rolesArray[i] ?? '';  // Optional chaining + nullish coalescing
      const timeValue = timesArray[i] ?? '';  
      const dateValue = convertDateToString(datesArray[i]);  // 안전한 날짜 변환
      
      // ✅ 모든 데이터 보존 (빈 값 포함) - 원본 지원 상태 완전 복원
      selections.push({
        role: roleValue,
        time: timeValue,
        date: dateValue
      });
    }
    
    logger.debug('✅ 배열 데이터 복원 성공 (폴백):', { 
      component: 'applicantHelpers', 
      data: { 
        status: applicant.status,
        selectionsCount: selections.length,
        selections,
        source: 'Arrays',
        isConfirmationCancelled: applicant.status === 'applied' && 
          (!applicant.assignedRole && !applicant.assignedTime),
        isFullyRestored: selections.length === maxLength
      } 
    });
    return selections;
  }
  
  // 🔄 우선순위 3: 단일 필드만 있는 경우 (최초 지원)
  if (applicant.assignedRole && applicant.assignedTime) {
    const singleDateValue = convertDateToString(applicant.assignedDate);
    
    const singleSelection = [{
      role: applicant.assignedRole,
      time: applicant.assignedTime,
      date: singleDateValue
    }];
    
    logger.debug('✅ 단일 필드 데이터 사용 (폴백):', { 
      component: 'applicantHelpers', 
      data: { 
        status: applicant.status,
        singleSelection,
        source: 'SingleFields'
      } 
    });
    return singleSelection;
  }
  
  logger.debug('⚠️ 선택 사항 없음 - 모든 데이터 소스 부재:', { 
    component: 'applicantHelpers',
    data: { 
      status: applicant.status,
      hasOriginalApplication: !!(applicant as any).originalApplication,
      hasArrayData: hasMultipleSelections(applicant),
      hasSingleData: !!(applicant.assignedRole && applicant.assignedTime),
      source: 'None'
    }
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