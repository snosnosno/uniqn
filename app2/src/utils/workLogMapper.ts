import { Timestamp } from 'firebase/firestore';
import { UnifiedWorkLog, WorkLogCreateInput } from '../types/unified/workLog';
import { logger } from './logger';

/**
 * Firebase Timestamp를 HH:mm 형식 문자열로 변환
 * 모든 시간 데이터 변환에 사용되는 통합 함수
 */
export function parseTimeToString(timeValue: any): string | null {
  if (!timeValue) {
    return null;
  }

  try {
    let date: Date | null = null;

    // Firebase Timestamp 처리 (우선순위 높음)
    if (typeof timeValue === 'object' && timeValue !== null) {
      // Firestore Timestamp 객체
      if ('toDate' in timeValue && typeof timeValue.toDate === 'function') {
        date = timeValue.toDate();
      }
      // seconds/nanoseconds 형태의 Timestamp (Firebase SDK에서 생성한 Timestamp)
      else if (
        'seconds' in timeValue &&
        'nanoseconds' in timeValue &&
        typeof timeValue.seconds === 'number'
      ) {
        date = new Date(timeValue.seconds * 1000 + timeValue.nanoseconds / 1000000);
      }
      // seconds만 있는 경우
      else if ('seconds' in timeValue && typeof timeValue.seconds === 'number') {
        date = new Date(timeValue.seconds * 1000);
      }
      // _seconds (Firestore 내부 형식)
      else if ('_seconds' in timeValue && typeof timeValue._seconds === 'number') {
        date = new Date(timeValue._seconds * 1000);
      }
    }
    // Date 객체 처리
    else if (timeValue instanceof Date) {
      date = timeValue;
    }
    // 문자열 처리
    else if (typeof timeValue === 'string') {
      // 이미 HH:mm 형식인 경우
      if (/^\d{1,2}:\d{2}$/.test(timeValue)) {
        return timeValue;
      }
      // ISO 문자열 파싱
      date = new Date(timeValue);
      if (isNaN(date.getTime())) {
        logger.warn('문자열 파싱 실패', {
          component: 'workLogMapper',
          data: { timeValue },
        });
        return null;
      }
    }

    // date가 유효한지 확인
    if (!date || isNaN(date.getTime())) {
      logger.warn('유효하지 않은 날짜', {
        component: 'workLogMapper',
        data: { timeValue, date },
      });
      return null;
    }

    // HH:mm 형식으로 반환
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    return result;
  } catch (error) {
    logger.error('시간 파싱 오류', error as Error, {
      component: 'workLogMapper',
      data: { timeValue },
    });
    return null;
  }
}

/**
 * HH:mm 문자열을 Firebase Timestamp로 변환
 */
export function parseTimeToTimestamp(timeStr: string, baseDate: string): Timestamp | null {
  if (!timeStr || !baseDate) return null;

  try {
    const timeParts = timeStr.split(':').map(Number);
    if (timeParts.length !== 2) return null;
    const [hours, minutes] = timeParts;
    if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) return null;

    const [year, month, day] = baseDate.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (isNaN(date.getTime())) return null;

    return Timestamp.fromDate(date);
  } catch (error) {
    logger.error('Timestamp 변환 오류', error as Error, {
      component: 'workLogMapper',
      data: { timeStr, baseDate },
    });
    return null;
  }
}

/**
 * 레거시 WorkLog 데이터를 통합 형식으로 변환
 */
export function normalizeWorkLog(data: any): UnifiedWorkLog {
  try {
    // 🔍 디버깅: snapshotData 확인
    if (data.snapshotData) {
      logger.info('🔍 [DEBUG] normalizeWorkLog - snapshotData 발견', {
        component: 'workLogMapper',
        data: {
          workLogId: data.id,
          hasSnapshotData: true,
          snapshotLocation: data.snapshotData.location,
          snapshotDataKeys: Object.keys(data.snapshotData),
        },
      });
    }

    // 기본 필드 매핑
    const normalized: UnifiedWorkLog = {
      id: data.id || '',

      // 통합 필드
      staffId: data.staffId || '',
      eventId: data.eventId || '',

      // 스태프 정보
      staffName: data.staffName || data.name || '',
      role: data.role || '',

      // 날짜 정보
      date: data.date || '',
      type: data.type || 'manual',

      // 시간 정보 - timeSlot 파싱 추가 (심야 근무 자동 조정)
      // 먼저 scheduledStartTime/scheduledEndTime 확인, 없으면 timeSlot에서 파싱
      scheduledStartTime: (() => {
        // 이미 Timestamp 형태면 그대로 사용
        if (data.scheduledStartTime) {
          return data.scheduledStartTime;
        }
        // timeSlot에서 파싱 (심야 근무 자동 조정)
        if (data.timeSlot && data.date) {
          const { convertAssignedTimeToScheduled } = require('./workLogUtils');
          const { scheduledStartTime } = convertAssignedTimeToScheduled(data.timeSlot, data.date);
          return scheduledStartTime;
        }
        return null;
      })(),
      scheduledEndTime: (() => {
        // 이미 Timestamp 형태면 그대로 사용
        if (data.scheduledEndTime) {
          return data.scheduledEndTime;
        }
        // timeSlot에서 파싱 (심야 근무 자동 조정)
        if (data.timeSlot && data.date) {
          const { convertAssignedTimeToScheduled } = require('./workLogUtils');
          const { scheduledEndTime } = convertAssignedTimeToScheduled(data.timeSlot, data.date);
          return scheduledEndTime;
        }
        return null;
      })(),
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
      createdBy: data.createdBy || data.staffId || '',

      // 🔥 스냅샷 데이터 (공고 삭제 대비)
      ...(data.snapshotData && { snapshotData: data.snapshotData }),
    };

    return normalized;
  } catch (error) {
    logger.error('WorkLog 정규화 실패', error as Error, {
      component: 'workLogMapper',
    });
    throw error;
  }
}

/**
 * 여러 WorkLog를 한번에 정규화
 */
export function normalizeWorkLogs(dataArray: any[]): UnifiedWorkLog[] {
  return dataArray.map((data) => normalizeWorkLog(data));
}

/**
 * WorkLog 생성 데이터 준비 - 표준화된 필드만 사용
 * 필수 필드 검증 포함
 */
export function prepareWorkLogForCreate(input: WorkLogCreateInput): any {
  // 필수 필드 검증
  if (!input.staffId) {
    throw new Error('staffId는 필수입니다');
  }
  if (!input.eventId) {
    throw new Error('eventId는 필수입니다');
  }
  if (!input.date) {
    throw new Error('date는 필수입니다');
  }
  if (!input.role) {
    throw new Error('role은 필수입니다');
  }

  const now = Timestamp.now();

  // 시간 데이터 표준화 - Timestamp로 통일
  let scheduledStartTime = input.scheduledStartTime;
  let scheduledEndTime = input.scheduledEndTime;

  // 문자열로 들어온 경우 Timestamp로 변환
  if (typeof scheduledStartTime === 'string') {
    scheduledStartTime = parseTimeToTimestamp(scheduledStartTime, input.date);
  }
  if (typeof scheduledEndTime === 'string') {
    scheduledEndTime = parseTimeToTimestamp(scheduledEndTime, input.date);
  }

  return {
    // 필수 필드
    staffId: input.staffId,
    eventId: input.eventId,
    staffName: input.staffName,
    date: input.date,
    role: input.role,
    type: input.type || 'manual',

    // 시간 정보 (Timestamp로 통일)
    scheduledStartTime: scheduledStartTime || null,
    scheduledEndTime: scheduledEndTime || null,
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
    tableAssignments: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
    createdBy: input.staffId,
  };
}

/**
 * WorkLog 업데이트 데이터 준비
 */
export function prepareWorkLogForUpdate(updates: Partial<UnifiedWorkLog>): any {
  const prepared: any = {
    ...updates,
    updatedAt: Timestamp.now(),
  };

  // 시간 데이터 표준화
  if (typeof prepared.scheduledStartTime === 'string' && updates.date) {
    prepared.scheduledStartTime = parseTimeToTimestamp(prepared.scheduledStartTime, updates.date);
  }
  if (typeof prepared.scheduledEndTime === 'string' && updates.date) {
    prepared.scheduledEndTime = parseTimeToTimestamp(prepared.scheduledEndTime, updates.date);
  }

  return prepared;
}

/**
 * WorkLog 데이터 검증 - 엄격한 검증
 */
export function validateWorkLog(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 필수 필드 체크
  if (!data.staffId) {
    errors.push('staffId가 없습니다');
  }

  if (!data.eventId) {
    errors.push('eventId가 없습니다');
  }

  if (!data.date) {
    errors.push('date가 없습니다');
  }

  if (!data.role) {
    errors.push('role이 없습니다');
  }

  // 날짜 형식 체크
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 근무 시간 계산 - 통합 급여 계산 유틸리티와 호환
 * scheduledStartTime/scheduledEndTime 우선 사용
 * assignedTime을 scheduledStartTime의 fallback으로 사용
 * @deprecated 새로운 코드에서는 payrollCalculations.ts의 calculateWorkHours 사용 권장
 */
export function calculateWorkHours(workLog: UnifiedWorkLog): number {
  const startTime = workLog.scheduledStartTime;
  const endTime = workLog.scheduledEndTime;

  if (!startTime || !endTime) {
    return 0;
  }

  try {
    const startDate =
      startTime && typeof startTime === 'object' && 'toDate' in startTime
        ? startTime.toDate()
        : null;
    const endDate =
      endTime && typeof endTime === 'object' && 'toDate' in endTime ? endTime.toDate() : null;

    if (!startDate || !endDate) {
      return 0;
    }

    // 심야 근무 케이스 처리: Timestamp가 이미 다음날로 조정된 상태인지 확인
    let adjustedEndDate = new Date(endDate);

    // Timestamp가 이미 다음날로 설정되어 있는지 확인 (workLogUtils에서 조정된 경우)
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();

    // 날짜가 다르면 이미 조정된 것으로 판단하고, 같은 날이면서 종료시간이 이른 경우만 조정
    const sameDate = startDate.getDate() === endDate.getDate();

    if (
      sameDate &&
      (endHour < startHour ||
        (endHour === startHour && endDate.getMinutes() < startDate.getMinutes()))
    ) {
      // 다음날 종료: 종료시간에 24시간 추가 (같은 날인 경우만)
      adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

      logger.debug('심야 근무 감지 - 날짜 조정', {
        component: 'workLogMapper',
        data: {
          workLogId: workLog.id,
          startTime: startDate.toTimeString().slice(0, 8),
          endTime: endDate.toTimeString().slice(0, 8),
          adjustedEndTime: adjustedEndDate.toTimeString().slice(0, 8),
          nextDay: true,
          sameDate: sameDate,
        },
      });
    } else if (!sameDate) {
      logger.debug('이미 다음날로 조정된 Timestamp 감지', {
        component: 'workLogMapper',
        data: {
          workLogId: workLog.id,
          startDate: startDate.toDateString(),
          endDate: endDate.toDateString(),
          alreadyAdjusted: true,
        },
      });
    }

    const hoursWorked = (adjustedEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const result = Math.max(0, Math.round(hoursWorked * 100) / 100);

    return result;
  } catch (error) {
    logger.error('근무시간 계산 실패', error as Error, {
      component: 'workLogMapper',
      data: { workLogId: workLog.id },
    });
    return 0;
  }
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
    filtered = filtered.filter((log) => staffIds.includes(log.staffId));
  }

  // eventId 필터
  if (eventId) {
    filtered = filtered.filter((log) => log.eventId === eventId);
  }

  // 날짜 범위 필터
  if (dateRange) {
    filtered = filtered.filter((log) => {
      return log.date >= dateRange.start && log.date <= dateRange.end;
    });
  }

  return filtered;
}
