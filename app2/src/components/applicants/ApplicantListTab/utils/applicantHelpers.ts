import { logger } from '../../../../utils/logger';
import { Applicant } from '../types';
import { ApplicationHistoryService } from '../../../../services/ApplicationHistoryService';
import { ApplicationGroup, ApplicationAssignment, DateBasedAssignment, DateBasedSelection } from '../../../../types/unifiedData';
import { JobPosting, DateSpecificRequirement, TimeSlot, RoleRequirement } from '../../../../types/jobPosting';

/**
 * 구인공고에서 특정 시간대의 역할 정보를 가져오는 함수
 * 역할 정보가 누락된 경우 대체 로직으로 사용
 */
const getRoleFromJobPosting = (
  jobPosting: JobPosting | undefined,
  timeSlot: string,
  date: string
): string | undefined => {
  if (!jobPosting?.dateSpecificRequirements) {
    return undefined;
  }

  try {
    // 날짜 매칭을 위한 날짜 정규화
    const normalizedDate = convertDateToString(date);
    
    // 해당 날짜의 요구사항 찾기
    const dateReq = jobPosting.dateSpecificRequirements.find((req: DateSpecificRequirement) => {
      const reqDate = convertDateToString(req.date);
      return reqDate === normalizedDate;
    });

    if (!dateReq?.timeSlots) {
      return undefined;
    }

    // 해당 시간대의 TimeSlot 찾기
    const timeSlotObj = dateReq.timeSlots.find((ts: TimeSlot) => 
      ts.time === timeSlot || (ts.isTimeToBeAnnounced && timeSlot === '미정')
    );

    if (!timeSlotObj?.roles || timeSlotObj.roles.length === 0) {
      return undefined;
    }

    // 첫 번째 역할 반환 (보통 하나의 시간대는 하나의 역할만 가짐)
    const role = timeSlotObj.roles[0]?.name;
    
    if (role) {
      logger.info('✅ 구인공고에서 역할 정보 복원:', {
        component: 'getRoleFromJobPosting',
        data: { 
          date: normalizedDate, 
          timeSlot, 
          foundRole: role 
        }
      });
      return role;
    }
  } catch (error) {
    logger.error('❌ 구인공고 역할 정보 조회 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'getRoleFromJobPosting',
      data: { timeSlot, date }
    });
  }

  return undefined;
};

/**
 * 지원자가 다중 선택을 했는지 확인하는 함수
 */
export const hasMultipleSelections = (applicant: Applicant): boolean => {
  // 🎯 새로운 assignments 배열 확인 (최우선)
  if (applicant.assignments && applicant.assignments.length > 1) {
    return true;
  }
  
  // 🔧 레거시 필드 확인 (하위 호환성)
  return !!(applicant.assignedRoles?.length || 
            applicant.assignedTimes?.length || 
            applicant.assignedDates?.length);
};

/**
 * 날짜 값을 안전하게 문자열로 변환하는 함수
 * UTC 시간대 문제를 방지하기 위해 로컬 날짜로 처리
 */
export const convertDateToString = (rawDate: any): string => {
  if (!rawDate) return '';
  
  if (typeof rawDate === 'string') {
    return rawDate;
  } else if (rawDate.toDate) {
    // Firestore Timestamp 객체인 경우
    try {
      const date = rawDate.toDate();
      // UTC 시간대 문제 방지: 로컬 날짜 기준으로 변환
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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
      const date = new Date(rawDate.seconds * 1000);
      // UTC 시간대 문제 방지: 로컬 날짜 기준으로 변환
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      logger.error('❌ seconds 변환 오류:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'applicantHelpers', 
        data: { rawDate } 
      });
      return '';
    }
  } else if (rawDate instanceof Date) {
    // Date 객체인 경우
    try {
      const year = rawDate.getFullYear();
      const month = String(rawDate.getMonth() + 1).padStart(2, '0');
      const day = String(rawDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      logger.error('❌ Date 변환 오류:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'applicantHelpers', 
        data: { rawDate } 
      });
      return '';
    }
  } else {
    // 다른 타입인 경우 문자열로 변환
    try {
      const dateStr = String(rawDate);
      // 날짜 형식인지 확인 (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      return '';
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
 * - jobPosting: 역할 정보 누락 시 구인공고에서 복원하기 위한 매개변수
 */
export const getApplicantSelections = (applicant: Applicant, jobPosting?: JobPosting) => {
  
  
  // 🚀 최우선: dateAssignments 사용 (날짜 기반 구조 - 최신 버전)
  if (applicant.dateAssignments && Array.isArray(applicant.dateAssignments) && applicant.dateAssignments.length > 0) {
    
    const selections = applicant.dateAssignments.flatMap((dateAssignment, index) => {
      
      return dateAssignment.selections.map((selection, selIndex) => {
        // 🔥 역할 정보 복원 로직 추가 (dateAssignments용)
        let effectiveRole = selection.role || '';
        
        // 역할이 없거나 빈 문자열인 경우 구인공고에서 복원 시도
        if (!effectiveRole && jobPosting && selection.timeSlot && dateAssignment.date) {
          const recoveredRole = getRoleFromJobPosting(jobPosting, selection.timeSlot, dateAssignment.date);
          if (recoveredRole) {
            effectiveRole = recoveredRole;
            logger.info('🔧 구인공고에서 역할 정보 복원 성공 (dateAssignments):', {
              component: 'getApplicantSelections',
              data: {
                applicantId: applicant.id,
                timeSlot: selection.timeSlot,
                date: dateAssignment.date,
                originalRole: selection.role,
                recoveredRole: effectiveRole
              }
            });
          }
        }
        
        const processedSelection = {
          role: effectiveRole,
          time: selection.timeSlot,
          date: dateAssignment.date, // 단일 날짜 필드 추가 (기존 로직 호환)
          dates: [dateAssignment.date], // 단일 날짜 배열로 변환
          isGrouped: dateAssignment.isConsecutive || false,
          groupId: dateAssignment.groupId,
          checkMethod: dateAssignment.checkMethod || 'individual', // checkMethod 추가
          confirmedCount: 0,
          requiredCount: 0,
        };
        
        return processedSelection;
      });
    });
    
    
    return selections;
  }
  
  // 🔥 우선순위 1: assignments 사용 (Firebase 원본 데이터 - 정확한 데이터!)
  if (applicant.assignments && Array.isArray(applicant.assignments) && applicant.assignments.length > 0) {
    
    // 🚀 assignments 배열을 직접 변환 - 순서 보장
    const selections: Selection[] = [];
    
    applicant.assignments.forEach((assignment, index) => {
      // 🔥 그룹 선택의 경우 roles 배열 사용, 개별 선택의 경우 role 필드 사용
      let effectiveRole = '';
      
      // 1. 그룹 선택: roles 배열에서 첫 번째 역할 사용
      if (assignment.checkMethod === 'group' && assignment.roles && Array.isArray(assignment.roles) && assignment.roles.length > 0) {
        effectiveRole = assignment.roles[0] || ''; // 첫 번째 역할 선택 (undefined 방지)
      }
      // 2. 개별 선택: role 필드 사용
      else if (assignment.role) {
        effectiveRole = assignment.role;
      }
      // 3. Fallback: 구인공고에서 역할 정보 복원 시도
      else if (jobPosting && assignment.timeSlot && assignment.dates && assignment.dates.length > 0 && assignment.dates[0]) {
        const recoveredRole = getRoleFromJobPosting(jobPosting, assignment.timeSlot, assignment.dates[0]);
        if (recoveredRole) {
          effectiveRole = recoveredRole;
          logger.info('🔧 구인공고에서 역할 정보 복원 성공:', {
            component: 'getApplicantSelections',
            data: {
              applicantId: applicant.id,
              timeSlot: assignment.timeSlot,
              originalRole: assignment.role,
              recoveredRole: effectiveRole
            }
          });
        }
      }
      
      // 🔄 그룹선택인 경우: 각 역할별로 하나의 그룹 selection 생성 (날짜는 분리하지 않음)
      // assignment.checkMethod 또는 isGrouped로 판단
      const isGroupSelection = assignment.checkMethod === 'group' || 
                              (assignment.isGrouped && assignment.dates && assignment.dates.length > 1);
      
      if (isGroupSelection && assignment.dates && assignment.dates.length >= 1) {
        // 🆕 roles 배열이 있는 경우 (새로운 구조)
        if (assignment.roles && Array.isArray(assignment.roles)) {
          assignment.roles.forEach((role: string) => {
            const finalRole = role || effectiveRole || '';
            const groupSelection: Selection = {
              role: finalRole,
              time: assignment.timeSlot,
              date: assignment.dates![0] || '', // 시작 날짜 (undefined 방지)
              dates: assignment.dates!, // 전체 날짜 배열 유지
              isGrouped: true,
              groupId: assignment.groupId || `group-${index}`,
              checkMethod: 'group' as const,
              ...(assignment.duration && {
                duration: {
                  type: assignment.duration.type,
                  endDate: assignment.duration.endDate
                }
              }),
            };
            
            selections.push(groupSelection);
          });
        }
        // 🔄 role 단일 필드만 있는 경우 (레거시 호환)
        else if (effectiveRole) {
          const groupSelection: Selection = {
            role: effectiveRole,
            time: assignment.timeSlot,
            date: assignment.dates[0] || '', // 시작 날짜 (undefined 방지)
            dates: assignment.dates, // 전체 날짜 배열 유지
            isGrouped: true,
            groupId: assignment.groupId || `group-${index}`,
            checkMethod: 'group' as const,
            ...(assignment.duration && {
              duration: {
                type: assignment.duration.type,
                endDate: assignment.duration.endDate
              }
            }),
          };
          
        
          selections.push(groupSelection);
        }
      } 
      // 🎯 개별선택인 경우: 단일 selection 생성
      else {
        // 🆕 roles 배열이 있는 경우 (새로운 구조) - 개별선택에서도 처리
        if (assignment.roles && Array.isArray(assignment.roles)) {
          assignment.roles.forEach((role: string) => {
            const finalRole = role || effectiveRole || '';
            const selection: Selection = {
              role: finalRole,
              time: assignment.timeSlot,
              date: assignment.dates?.[0] || '', // 첫 번째 날짜
              dates: assignment.dates,
              isGrouped: false,
              checkMethod: assignment.checkMethod || 'individual',
              ...(assignment.duration && {
                duration: {
                  type: assignment.duration.type,
                  endDate: assignment.duration.endDate
                }
              }),
            };
            
            
            selections.push(selection);
          });
        }
        // 🔄 role 단일 필드만 있는 경우 (기존 로직)
        else if (effectiveRole) {
          const selection: Selection = {
            role: effectiveRole,
            time: assignment.timeSlot,
            date: assignment.dates?.[0] || '', // 첫 번째 날짜
            dates: assignment.dates,
            isGrouped: false,
            checkMethod: assignment.checkMethod || 'individual', // checkMethod 추가
            ...(assignment.groupId && { groupId: assignment.groupId }),
            ...(assignment.duration && {
              duration: {
                type: assignment.duration.type,
                endDate: assignment.duration.endDate
              }
            }),
          };
          
          
          selections.push(selection);
        }
      }
    });
    
    
    return selections;
  }
  
  // 🔧 Fallback: assignedGroups 사용 (Legacy 그룹 기반 데이터)
  if (applicant.assignedGroups && Array.isArray(applicant.assignedGroups) && applicant.assignedGroups.length > 0) {
    const selections: Selection[] = [];
    
    // 각 그룹을 하나의 Selection으로 변환 (dates 배열 포함)
    applicant.assignedGroups.forEach(group => {
      // date가 있는 경우에만 포함
      const firstDate = group.dates && group.dates.length > 0 ? group.dates[0] : null;
      
      const selection: Selection = {
        role: group.role,
        time: group.timeSlot,
        date: firstDate || '', // 첫 번째 날짜
        dates: group.dates, // dates 배열 포함
        checkMethod: group.checkMethod || 'individual', // checkMethod 추가
        isGrouped: group.dates && group.dates.length > 1,
        ...(group.groupId && { groupId: group.groupId }), // undefined 일 때 제외
        ...(group.duration && { duration: group.duration })
      };
      
      selections.push(selection);
    });
    
    
    return selections;
  }
  
  // 🎯 확정된 상태: 실제 확정된 선택사항만 반환
  if (applicant.status === 'confirmed') {
    try {
      const confirmedSelections = ApplicationHistoryService.getConfirmedSelections(applicant as any);
      
      // logger.debug 제거 - 성능 최적화
      
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
    const originalData = ApplicationHistoryService.getOriginalApplicationData(applicant as any);
    
    // Assignment 배열에서 필드들을 추출
    const roles = originalData.map(assignment => assignment.role).filter(Boolean);
    const times = originalData.map(assignment => assignment.timeSlot).filter(Boolean);
    const dates = originalData.flatMap(assignment => assignment.dates || []).filter(Boolean);
    
    if (roles.length > 0 || times.length > 0 || dates.length > 0) {
      const selections = [];
      const maxLength = Math.max(roles.length, times.length, dates.length);
      
      // logger.debug 제거 - 성능 최적화
      
      // 원본 데이터로부터 완전 복원
      for (let i = 0; i < maxLength; i++) {
        const roleValue = roles[i] ?? '';
        const timeValue = times[i] ?? '';
        const dateValue = convertDateToString(dates[i]);
        const duration = (applicant as any).assignedDurations?.[i] || undefined;
        
        selections.push({
          role: roleValue,
          time: timeValue,
          date: dateValue,
          ...(duration && { duration })
        });
      }
      
      // logger.debug 제거 - 성능 최적화
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
    
    // ✅ 1:1:1 매칭 보장: 역할, 시간, 날짜가 정확히 매칭되도록 처리
    const maxLength = Math.min(
      Math.max(rolesArray.length, 1), // 최소 1개는 보장
      Math.max(timesArray.length, 1),
      Math.max(datesArray.length || 1, 1) // datesArray가 비어있어도 처리
    );
    
    // 실제 데이터가 있는 경우의 최대 길이 계산
    const actualLength = Math.max(
      rolesArray.length,
      timesArray.length,
      datesArray.length
    );
    
    const finalLength = actualLength > 0 ? actualLength : 1;
    
    // logger.debug 제거 - 성능 최적화
    
    // 🔥 핵심: 모든 인덱스 완전 복원 (빈 값 필터링 제거)
    for (let i = 0; i < finalLength; i++) {
      const roleValue = rolesArray[i] ?? rolesArray[0] ?? '';  // 첫 번째 역할로 폴백
      const timeValue = timesArray[i] ?? timesArray[0] ?? '';  // 첫 번째 시간으로 폴백
      
      // ✅ 날짜 처리 개선: assignedDates 배열을 정확히 사용
      let dateValue = '';
      if (datesArray.length > 0) {
        dateValue = convertDateToString(datesArray[i] ?? datesArray[0] ?? '');
      } else if (applicant.assignedDate) {
        // 하위 호환성: assignedDate 단일 필드 사용
        dateValue = convertDateToString(applicant.assignedDate);
      }
      
      // ✅ 모든 데이터 보존 (빈 값 포함) - 원본 지원 상태 완전 복원
      const duration = (applicant as any).assignedDurations?.[i] || undefined;
      
      // 그룹 선택 여부 판단 - 레거시 데이터는 항상 개별 선택으로 처리
      const isGrouped = false;
      
      selections.push({
        role: roleValue,
        time: timeValue,
        date: dateValue,
        dates: isGrouped ? datesArray.map(d => convertDateToString(d)) : [dateValue],
        checkMethod: isGrouped ? 'group' : 'individual',
        isGrouped: isGrouped,
        ...(duration && { duration })
      });
    }
    
    // logger.debug 제거 - 성능 최적화
    return selections;
  }
  
  // 🔄 우선순위 3: 단일 필드만 있는 경우 (최초 지원)
  if (applicant.assignedRole && applicant.assignedTime) {
    const singleDateValue = convertDateToString(applicant.assignedDate);
    
    const singleSelection = [{
      role: applicant.assignedRole,
      time: applicant.assignedTime,
      date: singleDateValue,
      dates: [singleDateValue],
      checkMethod: 'individual' as const,
      isGrouped: false
    }];
    
    // logger.debug 제거 - 성능 최적화
    return singleSelection;
  }
  
  // logger.debug 제거 - 성능 최적화
  return [];
};

/**
 * 날짜 포맷팅 함수 (MM-DD(요일))
 * UTC 시간대 문제 해결을 위해 로컬 날짜로 변환
 */
export const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr || dateStr === 'no-date') return '날짜 미정';
  
  try {
    // UTC 문자열을 로컬 날짜로 변환 (시간대 문제 해결)
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      return '날짜 미정';
    }
    
    // 월은 0부터 시작하므로 month - 1
    const date = new Date(year, month - 1, day);
    
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    
    return `${monthStr}-${dayStr}(${dayOfWeek})`;
  } catch (error) {
    logger.error('날짜 포맷팅 오류:', error instanceof Error ? error : new Error(String(error)), { 
      component: 'applicantHelpers',
      data: { dateStr }
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
  date?: string;  // 단일 날짜 (하위 호환성)
  dates?: string[];  // 새로운 다중 날짜 필드 (assignedGroups에서 사용)
  checkMethod?: 'group' | 'individual';  // 체크 방식
  groupId?: string;  // 그룹 식별자
  isGrouped?: boolean;  // 그룹화 여부 추가
  duration?: {
    type?: string;
    endDate?: any;
  } | undefined;  // undefined를 명시적으로 허용
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
export const getApplicantSelectionsByDate = (applicant: Applicant, jobPosting?: JobPosting): DateGroupedSelections[] => {
  // logger.debug 제거 - 성능 최적화

  const selections = getApplicantSelections(applicant, jobPosting);
  
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

  // logger.debug 제거 - 성능 최적화

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

/**
 * 날짜 범위 생성 함수
 */
export const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  
  return dates;
};

/**
 * 연속된 날짜들을 그룹화하는 새로운 인터페이스
 */
export interface ConsecutiveDateGroup {
  time: string;
  roles: string[]; // 단일 role에서 역할 배열로 변경
  dates: string[];
  isConsecutive: boolean;
  displayDateRange: string;
  confirmedCount: number;
  requiredCount: number;
}

/**
 * 지원자의 선택사항을 연속된 날짜별로 그룹화하는 함수
 * 🎯 checkMethod에 따라 그룹화/개별 표시 구분
 * - checkMethod가 'group'이고 groupId가 있는 경우만 그룹으로 표시
 * - 나머지는 개별 표시
 */
export const groupApplicationsByConsecutiveDates = (selections: Selection[]): ConsecutiveDateGroup[] => {
  logger.debug('groupApplicationsByConsecutiveDates 입력 데이터 확인', {
    selectionsCount: selections.length,
    firstSelection: selections[0],
    hasDatesArray: selections.length > 0 && selections[0]?.dates,
    hasCheckMethod: selections.length > 0 && selections[0]?.checkMethod,
  });
  
  // 🎯 checkMethod 기반 그룹화 - 이미 그룹화된 데이터는 유지
  if (selections.length > 0 && selections[0]?.dates) {
    // 1단계: 이미 그룹화된 selection과 개별 selection 구분
    const actualGroups = new Map<string, { dates: string[], time: string, roles: string[], checkMethod?: string }>();
    const individualSelections: Selection[] = [];
    
    selections.forEach(selection => {
      // checkMethod가 'group'이고 이미 그룹화된 경우: 재그룹화하지 않고 유지
      if (selection.checkMethod === 'group' && selection.dates && selection.dates.length > 1) {
        const key = `${selection.groupId || 'group'}|${selection.time || '시간 미정'}`;
        
        if (!actualGroups.has(key)) {
          actualGroups.set(key, {
            dates: selection.dates.sort(),
            time: selection.time || '시간 미정',
            roles: [],
            checkMethod: selection.checkMethod
          });
        }
        
        const group = actualGroups.get(key)!;
        if (selection.role && !group.roles.includes(selection.role)) {
          group.roles.push(selection.role);
        }
      } else {
        // 개별 체크인 경우 또는 단일 날짜인 경우 개별 처리
        individualSelections.push(selection);
      }
    });
    
    // 2단계: 실제 그룹들을 ConsecutiveDateGroup 형식으로 변환
    const finalGroups: ConsecutiveDateGroup[] = [];
    
    // 실제 그룹 처리
    actualGroups.forEach(({ dates, time, roles }) => {
      const isConsecutive = dates.length > 1 && isConsecutiveDates(dates);
      let displayRange: string;
      
      if (isConsecutive && dates.length > 1) {
        // 연속된 날짜: "09-10(수)~09-12(금)" 형식
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        if (firstDate && lastDate) {
          const firstFormatted = formatDateDisplay(firstDate);
          const lastFormatted = formatDateDisplay(lastDate);
          displayRange = `${firstFormatted}~${lastFormatted}`;
        } else {
          displayRange = dates.map(d => formatDateDisplay(d)).join(', ');
        }
      } else {
        // 단일 날짜: 개별 표시
        displayRange = dates.map(d => formatDateDisplay(d)).join(', ');
      }
      
      finalGroups.push({
        time,
        roles, // 여러 역할을 배열로 저장
        dates,
        isConsecutive,
        displayDateRange: displayRange,
        confirmedCount: 0,
        requiredCount: 0
      });
    });
    
    // 개별 선택들을 각각 별도 그룹으로 처리
    individualSelections.forEach(selection => {
      const dates = selection.dates || [selection.date || ''];
      finalGroups.push({
        time: selection.time || '시간 미정',
        roles: [selection.role || '역할 미정'],
        dates,
        isConsecutive: false,
        displayDateRange: dates.map(d => formatDateDisplay(d)).join(', '),
        confirmedCount: 0,
        requiredCount: 0
      });
    });
    
    return finalGroups;
  }
  
  // 🔄 기존 그룹화 로직 (하위 호환성) - 날짜-시간별로 역할 통합
  // 1단계: 날짜-시간별로 역할들을 그룹화
  const dateTimeGroups = new Map<string, { time: string, roles: string[], dates: string[] }>();
  
  selections.forEach(selection => {
    const time = selection.time || '시간 미정';
    const role = selection.role || '역할 미정';
    const date = selection.date && selection.date !== 'no-date' ? selection.date : 'no-date';
    
    const key = `${date}|${time}`;
    
    if (!dateTimeGroups.has(key)) {
      dateTimeGroups.set(key, {
        time,
        roles: [],
        dates: date === 'no-date' ? ['no-date'] : [date]
      });
    }
    
    const group = dateTimeGroups.get(key)!;
    if (!group.roles.includes(role)) {
      group.roles.push(role);
    }
  });
  
  // 2단계: 그룹을 ConsecutiveDateGroup 형식으로 변환
  const finalGroups: ConsecutiveDateGroup[] = [];
  
  dateTimeGroups.forEach(({ time, roles, dates }) => {
    let displayRange: string;
    
    if (dates[0] === 'no-date') {
      displayRange = '날짜 미정';
    } else {
      const sortedDates = dates.sort();
      const isConsecutive = sortedDates.length > 1 && isConsecutiveDates(sortedDates);
      
      if (isConsecutive && sortedDates.length > 1) {
        // 연속된 날짜: "09-10(수)~09-12(금)" 형식
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        if (firstDate && lastDate) {
          const firstFormatted = formatDateDisplay(firstDate);
          const lastFormatted = formatDateDisplay(lastDate);
          displayRange = `${firstFormatted}~${lastFormatted}`;
        } else {
          displayRange = sortedDates.map(d => formatDateDisplay(d)).join(', ');
        }
      } else {
        // 단일 날짜: 개별 표시
        displayRange = sortedDates.map(d => formatDateDisplay(d)).join(', ');
      }
    }
    
    finalGroups.push({
      time,
      roles, // 여러 역할을 배열로 저장
      dates: dates[0] === 'no-date' ? ['no-date'] : dates.sort(),
      isConsecutive: dates.length > 1 && dates[0] !== 'no-date' ? isConsecutiveDates(dates.sort()) : false,
      displayDateRange: displayRange,
      confirmedCount: 0,
      requiredCount: 0
    });
  });
  
  return finalGroups;
};

/**
 * 날짜 배열에서 연속된 날짜 구간들을 찾아내는 함수
 */
export const findConsecutiveDateGroups = (sortedDates: string[]): string[][] => {
  if (sortedDates.length === 0) return [];
  if (sortedDates.length === 1) return [sortedDates];
  
  const groups: string[][] = [];
  const firstDate = sortedDates[0];
  if (!firstDate) return [];
  
  let currentGroup: string[] = [firstDate];
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDateStr = sortedDates[i - 1];
    const currentDateStr = sortedDates[i];
    
    if (!prevDateStr || !currentDateStr) continue;
    
    const prevDate = new Date(prevDateStr);
    const currentDate = new Date(currentDateStr);
    
    // 날짜 차이 계산 (하루 차이인지 확인)
    const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24));
    
    if (diffDays === 1) {
      // 연속된 날짜
      currentGroup.push(currentDateStr);
    } else {
      // 비연속 날짜 - 현재 그룹을 완료하고 새 그룹 시작
      groups.push([...currentGroup]); // 복사해서 추가
      currentGroup = [currentDateStr];
    }
  }
  
  // 마지막 그룹 추가
  groups.push([...currentGroup]); // 복사해서 추가
  
  return groups;
};

/**
 * 지원자의 선택사항을 시간대-역할별로 그룹화하는 함수
 * 같은 시간대와 역할의 모든 날짜를 하나의 그룹으로 묶어서 표시
 * @deprecated 새로운 groupApplicationsByConsecutiveDates 함수 사용 권장
 */
export const groupApplicationsByTimeAndRole = (selections: Selection[]): LegacyApplicationGroup[] => {
  const groups = new Map<string, LegacyApplicationGroup>();
  
  selections.forEach(selection => {
    // 시간대와 역할을 조합해서 그룹 키 생성
    const key = `${selection.time}|${selection.role}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        time: selection.time || '시간 미정',
        role: selection.role || '',  // 빈 문자열로 처리 (하드코딩 제거)
        dates: [],
        confirmedCount: 0, // 실제 확정 인원수는 별도로 계산 필요
        requiredCount: 0   // 필요 인원수는 공고 정보에서 계산 필요
      });
    }
    
    const group = groups.get(key);
    if (group && selection.date && selection.date !== 'no-date') {
      // 중복 날짜 방지
      if (!group.dates.includes(selection.date)) {
        group.dates.push(selection.date);
      }
    }
  });
  
  // 날짜 정렬
  groups.forEach(group => {
    group.dates.sort();
  });
  
  return Array.from(groups.values());
};

/**
 * 특정 역할과 시간대의 확정/필요 인원 계산
 */
export const getStaffCounts = (
  jobPosting: any,
  applications: any[],
  role: string,
  timeSlot: string,
  date?: string
): { confirmed: number; required: number } => {
  // 디버깅 로그 추가
  logger.debug('🔢 getStaffCounts 호출', {
    component: 'applicantHelpers',
    data: {
      role,
      timeSlot,
      date,
      applicationsCount: applications.length,
      confirmedAppsCount: applications.filter(app => app.status === 'confirmed').length,
      jobPostingStructure: {
        hasDateSpecificRequirements: !!jobPosting?.dateSpecificRequirements,
        dateReqsCount: jobPosting?.dateSpecificRequirements?.length || 0
      }
    }
  });

  // 확정된 인원 계산
  const confirmed = applications.filter(app => 
    app.status === 'confirmed' && 
    app.assignments?.some((a: any) => {
      const roleMatch = a.role === role || a.roles?.includes(role);
      const timeMatch = a.timeSlot === timeSlot;
      const dateMatch = !date || a.dates?.includes(date);
      return roleMatch && timeMatch && dateMatch;
    })
  ).length;
  
  // 필요 인원 계산 - 올바른 데이터 구조 사용
  let required = 0;
  if (jobPosting?.dateSpecificRequirements && Array.isArray(jobPosting.dateSpecificRequirements)) {
    // date가 제공된 경우 해당 날짜의 요구사항만 찾기
    if (date) {
      const dateReq = jobPosting.dateSpecificRequirements.find((dateReq: any) => {
        // 날짜 비교를 위한 변환
        let dateReqDate = '';
        if (dateReq.date) {
          if (typeof dateReq.date === 'string') {
            dateReqDate = dateReq.date;
          } else if (dateReq.date.toDate) {
            // Firebase Timestamp
            dateReqDate = dateReq.date.toDate().toISOString().split('T')[0] || '';
          } else if (typeof dateReq.date.seconds === 'number') {
            // Timestamp with seconds
            dateReqDate = new Date(dateReq.date.seconds * 1000).toISOString().split('T')[0] || '';
          }
        }
        return dateReqDate === date;
      });
      
      if (dateReq?.timeSlots) {
        const timeSlotInfo = dateReq.timeSlots.find((ts: any) => ts.time === timeSlot);
        if (timeSlotInfo?.roles) {
          const roleInfo = timeSlotInfo.roles.find((r: any) => r.name === role);
          required = roleInfo?.count || 0;
        }
      }
    } else {
      // date가 없는 경우 모든 날짜에서 해당 시간대/역할의 최대 요구사항 찾기
      jobPosting.dateSpecificRequirements.forEach((dateReq: any) => {
        if (dateReq?.timeSlots) {
          const timeSlotInfo = dateReq.timeSlots.find((ts: any) => ts.time === timeSlot);
          if (timeSlotInfo?.roles) {
            const roleInfo = timeSlotInfo.roles.find((r: any) => r.name === role);
            if (roleInfo?.count) {
              required = Math.max(required, roleInfo.count);
            }
          }
        }
      });
    }
  }
  
  logger.debug('🔢 getStaffCounts 결과', {
    component: 'applicantHelpers',
    data: { role, timeSlot, date, confirmed, required }
  });

  return { confirmed, required };
};

/**
 * 날짜 배열을 사용자 친화적인 범위 문자열로 변환
 */
export const formatDateRange = (dates: string[]): string => {
  if (dates.length === 0) return '날짜 미정';
  
  // undefined 필터링
  const validDates = dates.filter((date): date is string => !!date);
  if (validDates.length === 0) return '날짜 미정';
  if (validDates.length === 1) {
    const firstDate = validDates[0];
    return firstDate ? formatDateDisplay(firstDate) : '날짜 미정';
  }
  
  const sortedDates = validDates.sort();
  
  // 연속된 날짜인지 확인
  if (isConsecutiveDates(sortedDates)) {
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    if (firstDate && lastDate) {
      const first = formatDateDisplay(firstDate);
      const last = formatDateDisplay(lastDate);
      return `${first} ~ ${last}`;
    }
  }
  
  // 개별 날짜 표시 (지원자가 일부만 선택한 경우)
  return validDates.map(d => formatDateDisplay(d)).join(', ');
};

/**
 * 날짜 배열이 연속된 날짜인지 확인
 */
export const isConsecutiveDates = (sortedDates: string[]): boolean => {
  if (sortedDates.length <= 1) return true;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDateStr = sortedDates[i - 1];
    const currentDateStr = sortedDates[i];
    
    // undefined 체크
    if (!prevDateStr || !currentDateStr) continue;
    
    const prevDate = new Date(prevDateStr);
    const currentDate = new Date(currentDateStr);
    
    // 유효한 날짜인지 확인
    if (isNaN(prevDate.getTime()) || isNaN(currentDate.getTime())) {
      continue;
    }
    
    // 하루 차이인지 확인 (밀리초 단위로 계산)
    const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays !== 1) {
      return false;
    }
  }
  
  return true;
};

/**
 * 지원자 선택사항 그룹 인터페이스 (레거시)
 */
export interface LegacyApplicationGroup {
  time: string;
  role: string;
  dates: string[];
  confirmedCount: number;
  requiredCount: number;
}

/**
 * 다중일 선택사항 그룹화 - 날짜 범위별로 그룹화하고, 같은 날짜 범위의 여러 역할을 하나의 그룹으로 묶음
 * @deprecated 새로운 groupApplicationsByTimeAndRole 함수 사용 권장
 */
export const groupMultiDaySelections = (selections: Selection[]) => {
  const dateRangeGroups = new Map<string, any>();
  
  selections.forEach(selection => {
    if (selection.duration?.type === 'multi' && selection.duration?.endDate && selection.date) {
      const endDate = convertDateToString(selection.duration.endDate);
      // 날짜 범위만으로 그룹 키 생성 (시간대와 역할 제외)
      const dateRangeKey = `${selection.date}_${endDate}`;
      
      if (!dateRangeGroups.has(dateRangeKey)) {
        const dates = generateDateRange(selection.date, endDate);
        dateRangeGroups.set(dateRangeKey, {
          startDate: selection.date,
          endDate: endDate,
          dates: dates,
          dayCount: dates.length,
          displayDateRange: dates.length === 1 
            ? formatDateDisplay(selection.date)
            : `${formatDateDisplay(selection.date)} ~ ${formatDateDisplay(endDate)}`,
          timeSlotRoles: [] // 시간대-역할 조합들
        });
      }
      
      const group = dateRangeGroups.get(dateRangeKey);
      // 같은 시간대-역할 조합이 이미 있는지 확인
      const existingRole = group.timeSlotRoles.find((tr: any) => 
        tr.timeSlot === selection.time && tr.role === selection.role
      );
      
      if (!existingRole) {
        group.timeSlotRoles.push({
          timeSlot: selection.time,
          role: selection.role,
          selection: selection
        });
      }
    }
  });
  
  return Array.from(dateRangeGroups.values());
};

/**
 * 단일 날짜 선택사항 그룹화 (기존 로직)
 */
export const groupSingleDaySelections = (selections: Selection[]) => {
  const groups = new Map<string, any>();
  
  selections.forEach(selection => {
    const dateKey = selection.date || 'no-date';
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dateKey,
        displayDate: dateKey === 'no-date' ? '날짜 미정' : formatDateDisplay(dateKey),
        selections: []
      });
    }
    
    groups.get(dateKey).selections.push(selection);
  });
  
  return Array.from(groups.values()).sort((a, b) => {
    if (a.date === 'no-date') return 1;
    if (b.date === 'no-date') return -1;
    return a.date.localeCompare(b.date);
  });
};

/**
 * 연속된 날짜 그룹 인터페이스 (미확정 지원자용)
 */
export interface ConsecutiveDateGroupForUnconfirmed {
  dates: string[];
  displayDateRange: string;
  dayCount: number;
  isConsecutive: boolean;
  timeRoleSelections: Array<{
    time: string;
    role: string;
    originalSelections: Selection[];
  }>;
}

/**
 * 미확정 지원자의 연속된 날짜들을 그룹화하는 함수 (날짜 우선 그룹화)
 * 연속된 날짜가 있으면 하나의 카드로 묶고, 그 안에서 모든 시간-역할 조합을 표시
 */
export const groupConsecutiveDatesForUnconfirmed = (selections: Selection[]): {
  consecutiveGroups: ConsecutiveDateGroupForUnconfirmed[];
  singleDateGroups: DateGroupedSelections[];
} => {
  if (!selections || selections.length === 0) {
    return { consecutiveGroups: [], singleDateGroups: [] };
  }

  // 1단계: 모든 고유 날짜 추출 및 정렬
  const allDates: string[] = Array.from(new Set(
    selections
      .map(s => s.date)
      .filter((date): date is string => date !== undefined && date !== null && date !== 'no-date')
  )).sort();

  if (allDates.length === 0) {
    const singleDateGroups = groupSingleDaySelections(selections);
    return { consecutiveGroups: [], singleDateGroups };
  }

  // 2단계: 연속된 날짜 구간 찾기
  const consecutiveRanges = findConsecutiveDateGroups(allDates);
  
  const consecutiveGroups: ConsecutiveDateGroupForUnconfirmed[] = [];
  const processedSelections = new Set<string>();

  // 3단계: 연속된 날짜 구간별로 처리 (2개 이상의 연속 날짜만)
  consecutiveRanges.forEach(range => {
    if (range.length > 1) { // 2개 이상의 연속된 날짜만 그룹화
      const firstDate = range[0];
      const lastDate = range[range.length - 1];
      
      if (!firstDate || !lastDate) return;

      // 해당 날짜 구간의 모든 selection 수집
      const rangeSelections = selections.filter(s => s.date && range.includes(s.date));
      
      // 시간-역할 조합별로 그룹화 (중복 제거)
      const timeRoleMap = new Map<string, {time: string, role: string, originalSelections: Selection[]}>();
      
      rangeSelections.forEach(selection => {
        const key = `${selection.time}_${selection.role}`;
        if (!timeRoleMap.has(key)) {
          timeRoleMap.set(key, {
            time: selection.time || '',
            role: selection.role || '', 
            originalSelections: []
          });
        }
        timeRoleMap.get(key)!.originalSelections.push(selection);
      });

      // ConsecutiveDateGroup 생성
      const group: ConsecutiveDateGroupForUnconfirmed = {
        dates: range,
        displayDateRange: range.length === 1 
          ? formatDateDisplay(firstDate)
          : `${formatDateDisplay(firstDate)} ~ ${formatDateDisplay(lastDate)}`,
        dayCount: range.length,
        isConsecutive: true,
        timeRoleSelections: Array.from(timeRoleMap.values())
      };

      consecutiveGroups.push(group);

      // 처리된 selection 표시
      rangeSelections.forEach(s => 
        processedSelections.add(`${s.date}_${s.time}_${s.role}`)
      );
    }
  });

  // 4단계: 처리되지 않은 selection들을 단일 날짜 그룹으로 분류
  const remainingSelections = selections.filter(s => 
    !processedSelections.has(`${s.date}_${s.time}_${s.role}`)
  );

  const singleDateGroups = groupSingleDaySelections(remainingSelections);

  return { consecutiveGroups, singleDateGroups };
};