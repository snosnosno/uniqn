// 교대 규칙 검증 유틸리티 함수들

export interface ValidationRule {
  id: string;
  name: string;
  type: 'error' | 'warning' | 'info';
  enabled: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  suggestions: string[];
}

export interface ValidationViolation {
  type: 'table_conflict' | 'continuous_work' | 'insufficient_rest' | 'schedule_gap';
  severity: 'error' | 'warning' | 'info';
  message: string;
  dealerId: string;
  timeSlot: string;
  suggestedFix?: string;
}

export interface DealerSchedule {
  id: string;
  dealerName: string;
  startTime: string;
  assignments: { [timeSlot: string]: string };
}

export interface ValidationSettings {
  maxContinuousHours: number;
  minRestMinutes: number;
  allowTableConflicts: boolean;
  maxTablesPerTimeSlot: number;
}

// 기본 검증 설정
export const DEFAULT_VALIDATION_SETTINGS: ValidationSettings = {
  maxContinuousHours: 4,
  minRestMinutes: 30,
  allowTableConflicts: false,
  maxTablesPerTimeSlot: 1,
};

/**
 * 시간 문자열을 분으로 변환
 * @param timeStr HH:MM 형식의 시간 문자열
 * @returns 분 단위 숫자
 */
export const timeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
};

/**
 * 분을 시간 문자열로 변환
 * @param minutes 분 단위 숫자
 * @returns HH:MM 형식의 시간 문자열
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * 두 시간 슬롯 간의 분 차이 계산
 * @param timeSlot1 첫 번째 시간 슬롯
 * @param timeSlot2 두 번째 시간 슬롯
 * @returns 분 단위 차이
 */
export const getTimeSlotDifference = (timeSlot1: string, timeSlot2: string): number => {
  return Math.abs(timeToMinutes(timeSlot1) - timeToMinutes(timeSlot2));
};

/**
 * 테이블 중복 배정 검증
 * @param dealers 딜러 스케줄 배열
 * @param timeSlots 시간 슬롯 배열
 * @returns 검증 위반 사항 배열
 */
export const validateTableConflicts = (
  dealers: DealerSchedule[],
  timeSlots: string[]
): ValidationViolation[] => {
  const violations: ValidationViolation[] = [];

  timeSlots.forEach(timeSlot => {
    const tableAssignments: { [tableId: string]: string[] } = {};

    // 같은 시간대에 배정된 테이블들 수집
    dealers.forEach(dealer => {
      const assignment = dealer.assignments[timeSlot];
      if (assignment && assignment.startsWith('T')) {
        if (!tableAssignments[assignment]) {
          tableAssignments[assignment] = [];
        }
        const dealerList = tableAssignments[assignment];
        if (dealerList) {
          dealerList.push(dealer.id);
        }
      }
    });

    // 중복 배정 검사
    Object.entries(tableAssignments).forEach(([tableId, dealerIds]) => {
      if (dealerIds.length > 1) {
        dealerIds.forEach(dealerId => {
          violations.push({
            type: 'table_conflict',
            severity: 'error',
            message: `${timeSlot}에 ${tableId} 테이블이 중복 배정되었습니다 (${dealerIds.length}명 배정됨)`,
            dealerId,
            timeSlot,
            suggestedFix: `다른 테이블로 변경하거나 대기/휴식 상태로 변경하세요`
          });
        });
      }
    });
  });

  return violations;
};

/**
 * 연속 근무 시간 검증
 * @param dealer 딜러 스케줄
 * @param timeSlots 시간 슬롯 배열
 * @param settings 검증 설정
 * @returns 검증 위반 사항 배열
 */
export const validateContinuousWork = (
  dealer: DealerSchedule,
  timeSlots: string[],
  settings: ValidationSettings
): ValidationViolation[] => {
  const violations: ValidationViolation[] = [];
  
  // 시간 순으로 정렬된 슬롯들
  const sortedSlots = [...timeSlots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  
  let continuousStart: string | null = null;
  let continuousMinutes = 0;

  sortedSlots.forEach((timeSlot, index) => {
    const assignment = dealer.assignments[timeSlot];
    const isWorking = assignment && assignment !== '대기' && assignment !== '휴식';

    if (isWorking) {
      if (continuousStart === null) {
        continuousStart = timeSlot;
        continuousMinutes = 0;
      }
      
      // 다음 시간 슬롯과의 간격 계산
      if (index < sortedSlots.length - 1) {
        const nextTimeSlot = sortedSlots[index + 1];
        if (nextTimeSlot) {
          const interval = getTimeSlotDifference(timeSlot, nextTimeSlot);
          continuousMinutes += interval;
        }
      }
    } else {
      // 근무가 끝났을 때 연속 근무 시간 확인
      if (continuousStart !== null && continuousMinutes > settings.maxContinuousHours * 60) {
        violations.push({
          type: 'continuous_work',
          severity: 'warning',
          message: `${continuousStart}부터 ${timeSlot}까지 ${Math.round(continuousMinutes / 60)}시간 연속 근무입니다 (제한: ${settings.maxContinuousHours}시간)`,
          dealerId: dealer.id,
          timeSlot: continuousStart,
          suggestedFix: `중간에 휴식 시간을 추가하세요`
        });
      }
      continuousStart = null;
      continuousMinutes = 0;
    }
  });

  return violations;
};

/**
 * 휴식 시간 검증
 * @param dealer 딜러 스케줄
 * @param timeSlots 시간 슬롯 배열
 * @param settings 검증 설정
 * @returns 검증 위반 사항 배열
 */
export const validateRestTime = (
  dealer: DealerSchedule,
  timeSlots: string[],
  settings: ValidationSettings
): ValidationViolation[] => {
  const violations: ValidationViolation[] = [];
  
  const sortedSlots = [...timeSlots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  
  let lastWorkTime: string | null = null;

  sortedSlots.forEach(timeSlot => {
    const assignment = dealer.assignments[timeSlot];
    const isWorking = assignment && assignment !== '대기' && assignment !== '휴식';

    if (isWorking) {
      if (lastWorkTime !== null) {
        const restMinutes = getTimeSlotDifference(lastWorkTime, timeSlot);
        
        if (restMinutes > 0 && restMinutes < settings.minRestMinutes) {
          violations.push({
            type: 'insufficient_rest',
            severity: 'warning',
            message: `${lastWorkTime}과 ${timeSlot} 사이 휴식 시간이 부족합니다 (${restMinutes}분, 최소: ${settings.minRestMinutes}분)`,
            dealerId: dealer.id,
            timeSlot,
            suggestedFix: `중간에 충분한 휴식 시간을 추가하세요`
          });
        }
      }
      lastWorkTime = timeSlot;
    }
  });

  return violations;
};

/**
 * 스케줄 공백 검증
 * @param dealer 딜러 스케줄
 * @param timeSlots 시간 슬롯 배열
 * @returns 검증 위반 사항 배열
 */
export const validateScheduleGaps = (
  dealer: DealerSchedule,
  timeSlots: string[]
): ValidationViolation[] => {
  const violations: ValidationViolation[] = [];
  
  const sortedSlots = [...timeSlots].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  
  let hasAssignment = false;
  let gapStart: string | null = null;

  sortedSlots.forEach(timeSlot => {
    const assignment = dealer.assignments[timeSlot];
    
    if (assignment) {
      hasAssignment = true;
      if (gapStart !== null) {
        const gapMinutes = getTimeSlotDifference(gapStart, timeSlot);
        if (gapMinutes > 120) { // 2시간 이상 공백
          violations.push({
            type: 'schedule_gap',
            severity: 'info',
            message: `${gapStart}과 ${timeSlot} 사이에 ${Math.round(gapMinutes / 60)}시간 공백이 있습니다`,
            dealerId: dealer.id,
            timeSlot: gapStart
          });
        }
        gapStart = null;
      }
    } else if (hasAssignment && gapStart === null) {
      gapStart = timeSlot;
    }
  });

  return violations;
};

/**
 * 전체 스케줄 검증
 * @param dealers 딜러 스케줄 배열
 * @param timeSlots 시간 슬롯 배열
 * @param settings 검증 설정
 * @returns 검증 결과
 */
export const validateSchedule = (
  dealers: DealerSchedule[],
  timeSlots: string[],
  settings: ValidationSettings = DEFAULT_VALIDATION_SETTINGS
): ValidationResult => {
  const violations: ValidationViolation[] = [];
  const suggestions: string[] = [];

  // 테이블 중복 배정 검증
  if (!settings.allowTableConflicts) {
    violations.push(...validateTableConflicts(dealers, timeSlots));
  }

  // 각 딜러별 검증
  dealers.forEach(dealer => {
    violations.push(...validateContinuousWork(dealer, timeSlots, settings));
    violations.push(...validateRestTime(dealer, timeSlots, settings));
    violations.push(...validateScheduleGaps(dealer, timeSlots));
  });

  // 제안사항 생성
  if (violations.length === 0) {
    suggestions.push('스케줄이 모든 규칙을 준수합니다');
  } else {
    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;
    
    if (errorCount > 0) {
      suggestions.push(`${errorCount}개의 오류를 수정해야 합니다`);
    }
    if (warningCount > 0) {
      suggestions.push(`${warningCount}개의 경고를 검토하세요`);
    }
    
    // 자동 수정 제안
    const tableConflicts = violations.filter(v => v.type === 'table_conflict');
    if (tableConflicts.length > 0) {
      suggestions.push('테이블 중복 배정을 해결하기 위해 일부 딜러를 다른 테이블이나 휴식으로 변경하세요');
    }
  }

  return {
    isValid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
    suggestions
  };
};

export default {
  validateSchedule,
  validateTableConflicts,
  validateContinuousWork,
  validateRestTime,
  validateScheduleGaps,
  timeToMinutes,
  minutesToTime,
  getTimeSlotDifference,
  DEFAULT_VALIDATION_SETTINGS
};