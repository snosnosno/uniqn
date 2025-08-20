import { Timestamp } from 'firebase/firestore';
import { 
  UnifiedWorkLog, 
  LegacyWorkLog, 
  WorkLogCreateInput
} from '../types/unified/workLog';
import { logger } from './logger';

/**
 * 레거시 WorkLog 데이터를 통합 형식으로 변환
 * @deprecated dealerId, userId → staffId (우선순위: staffId > dealerId > userId)
 * @deprecated jobPostingId → eventId
 */
export function normalizeWorkLog(data: any): UnifiedWorkLog {
  try {
    // 기본 필드 매핑
    const normalized: UnifiedWorkLog = {
      id: data.id || '',
      
      // staffId 통합
      staffId: data.staffId || '',
      
      // eventId 통합 (우선순위: eventId > jobPostingId)
      eventId: data.eventId || data.jobPostingId || '',
      
      // 스태프 정보 통합
      staffName: data.staffName || data.dealerName || data.name || '',
      role: data.role || data.jobRole || '',
      
      // 날짜 정보
      date: data.date || '',
      type: data.type || 'manual',
      
      // 시간 정보
      scheduledStartTime: data.scheduledStartTime || null,
      scheduledEndTime: data.scheduledEndTime || null,
      actualStartTime: data.actualStartTime || null,
      actualEndTime: data.actualEndTime || null,
      
      // 근무 정보
      totalWorkMinutes: data.totalWorkMinutes || 0,
      totalBreakMinutes: data.totalBreakMinutes || 0,
      hoursWorked: data.hoursWorked || data.workHours || 0,
      overtime: data.overtime || data.overtimeHours || 0,
      
      // 상태
      status: data.status || 'scheduled',
      
      // 테이블 정보
      tableAssignments: data.tableAssignments || [],
      
      // 메타데이터
      notes: data.notes || '',
      createdAt: data.createdAt || Timestamp.now(),
      updatedAt: data.updatedAt || Timestamp.now(),
      createdBy: data.createdBy || data.staffId || ''
    };
    
    return normalized;
  } catch (error) {
    logger.error('WorkLog 정규화 실패', error as Error, {
      component: 'workLogMapper'
    });
    throw error;
  }
}

/**
 * 여러 WorkLog를 한번에 정규화
 */
export function normalizeWorkLogs(dataArray: any[]): UnifiedWorkLog[] {
  return dataArray.map(data => normalizeWorkLog(data));
}

/**
 * 통합 WorkLog를 레거시 형식으로 변환
 * @deprecated 이 함수는 더 이상 사용되지 않습니다
 */
export function toLegacyFormat(workLog: UnifiedWorkLog): LegacyWorkLog {
  return {
    ...workLog,
    dealerName: workLog.staffName,
    jobPostingId: workLog.eventId
  };
}

/**
 * WorkLog 생성 데이터 준비
 */
export function prepareWorkLogForCreate(input: WorkLogCreateInput): any {
  const now = Timestamp.now();
  
  return {
    // 통합 필드
    staffId: input.staffId,
    eventId: input.eventId,
    staffName: input.staffName,
    date: input.date,
    type: input.type || 'manual',
    
    dealerName: input.staffName,
    
    // 시간 정보
    scheduledStartTime: input.scheduledStartTime || null,
    scheduledEndTime: input.scheduledEndTime || null,
    actualStartTime: null,
    actualEndTime: null,
    
    // 초기값
    totalWorkMinutes: 0,
    totalBreakMinutes: 0,
    hoursWorked: 0,
    overtime: 0,
    
    // 상태
    status: input.status || 'scheduled',
    
    // 메타데이터
    role: input.role || '',
    tableAssignments: [],
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

/**
 * WorkLog 업데이트 데이터 준비
 */
export function prepareWorkLogForUpdate(updates: Partial<UnifiedWorkLog>): any {
  const prepared: any = {
    ...updates,
    updatedAt: Timestamp.now()
  };
  
  
  // staffName 변경 시 레거시 필드도 업데이트
  if (updates.staffName) {
    prepared.dealerName = updates.staffName;
  }
  
  // eventId 변경 시 레거시 필드도 업데이트
  if (updates.eventId) {
    prepared.jobPostingId = updates.eventId;
  }
  
  
  return prepared;
}

/**
 * 필드명 마이그레이션 체크
 * 레거시 필드만 있는 경우 true 반환
 */
export function needsMigration(data: any): boolean {
  // 통합 필드가 없고 레거시 필드만 있는 경우
  const hasLegacyOnly = (
    (!data.eventId && data.jobPostingId) ||
    (!data.staffName && data.dealerName)
  );
  
  return hasLegacyOnly;
}

/**
 * WorkLog 데이터 검증
 */
export function validateWorkLog(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 필수 필드 체크
  if (!data.staffId) {
    errors.push('스태프 ID가 없습니다');
  }
  
  if (!data.eventId && !data.jobPostingId) {
    errors.push('이벤트/공고 ID가 없습니다');
  }
  
  if (!data.date) {
    errors.push('날짜가 없습니다');
  }
  
  // 날짜 형식 체크
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 시간 계산 유틸리티
 * 정산 목적으로 scheduledStartTime/scheduledEndTime (예정시간)을 우선시
 * actualStartTime/actualEndTime는 출퇴근 기록용
 */
export function calculateWorkHours(workLog: UnifiedWorkLog): number {
  // 정산탭에서는 스태프탭에서 설정한 예정시간을 우선 사용
  const start = workLog.scheduledStartTime || workLog.actualStartTime;
  const end = workLog.scheduledEndTime || workLog.actualEndTime;
  
  if (!start || !end) return 0;
  
  try {
    // Timestamp를 Date로 변환 - 더 안전한 체크
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    // start 처리
    if (start && typeof start === 'object' && 'toDate' in start && typeof start.toDate === 'function') {
      // Firebase Timestamp
      startDate = start.toDate();
    } else if (start && typeof start === 'object' && 'seconds' in start) {
      // Timestamp-like object
      startDate = new Date((start as any).seconds * 1000);
    } else if (typeof start === 'string') {
      // 시간 문자열 (HH:mm 형식)
      startDate = new Date(`2000-01-01T${start}`);
    } else if ((start as any) instanceof Date) {
      startDate = start as Date;
    }
    
    // end 처리
    if (end && typeof end === 'object' && 'toDate' in end && typeof end.toDate === 'function') {
      // Firebase Timestamp
      endDate = end.toDate();
    } else if (end && typeof end === 'object' && 'seconds' in end) {
      // Timestamp-like object
      endDate = new Date((end as any).seconds * 1000);
    } else if (typeof end === 'string') {
      // 시간 문자열 (HH:mm 형식)
      endDate = new Date(`2000-01-01T${end}`);
    } else if ((end as any) instanceof Date) {
      endDate = end as Date;
    }
    
    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      let diffMs = endDate.getTime() - startDate.getTime();
      
      // 종료 시간이 시작 시간보다 이른 경우 (다음날로 간주)
      if (diffMs < 0) {
        // 24시간을 더함
        diffMs += 24 * 60 * 60 * 1000;
      }
      
      const hours = diffMs / (1000 * 60 * 60);
      return Math.round(hours * 100) / 100; // 소수점 2자리
    }
  } catch (error) {
    logger.error('근무시간 계산 실패', error as Error, {
      component: 'workLogMapper',
      data: {
        workLogId: workLog.id,
        scheduledStartTime: workLog.scheduledStartTime ? 'exists' : 'null',
        scheduledEndTime: workLog.scheduledEndTime ? 'exists' : 'null'
      }
    });
  }
  
  return 0;
}

/**
 * WorkLog 필터링 헬퍼
 */
export function filterWorkLogs(
  workLogs: UnifiedWorkLog[], 
  staffIds?: string[], 
  eventId?: string,
  dateRange?: { start: string; end: string }
): UnifiedWorkLog[] {
  let filtered = [...workLogs];
  
  // staffId 필터
  if (staffIds && staffIds.length > 0) {
    filtered = filtered.filter(log => staffIds.includes(log.staffId));
  }
  
  // eventId 필터
  if (eventId) {
    filtered = filtered.filter(log => log.eventId === eventId);
  }
  
  // 날짜 범위 필터
  if (dateRange) {
    filtered = filtered.filter(log => {
      return log.date >= dateRange.start && log.date <= dateRange.end;
    });
  }
  
  return filtered;
}