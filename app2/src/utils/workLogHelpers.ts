import { UnifiedWorkLog } from '../types/unified/workLog';
import { logger } from './logger';

/**
 * Role 정규화 함수 - 대소문자 통일
 */
export const normalizeRole = (role?: string): string => {
  return role?.toLowerCase() || '';
};

/**
 * Role 기반 WorkLog 필터링
 */
export const filterWorkLogsByRole = (
  workLogs: UnifiedWorkLog[],
  targetRole?: string
): UnifiedWorkLog[] => {
  if (!targetRole) {
    return workLogs;
  }

  const normalizedTargetRole = normalizeRole(targetRole);

  const filteredLogs = workLogs.filter((log) => {
    if (!log.role) {
      return true;
    }

    const normalizedLogRole = normalizeRole(log.role);
    return normalizedLogRole === normalizedTargetRole;
  });

  return filteredLogs;
};

/**
 * 특정 조건으로 WorkLog 찾기 (ScheduleDetailModal의 getTargetWorkLog 패턴)
 */
export interface FindWorkLogCriteria {
  staffId?: string;
  date?: string;
  role?: string;
  eventId?: string;
  workLogId?: string;
  type?: string;
}

export const findTargetWorkLog = (
  workLogs: UnifiedWorkLog[],
  criteria: FindWorkLogCriteria
): UnifiedWorkLog | null => {
  if (!workLogs || workLogs.length === 0) {
    return null;
  }

  // 1. workLogId가 있으면 직접 찾기
  if (criteria.workLogId) {
    const found = workLogs.find((log) => log.id === criteria.workLogId);
    if (found) {
      return found;
    }
  }

  // 2. 복합 조건으로 찾기
  const found = workLogs.find((log) => {
    const conditions: boolean[] = [];

    if (criteria.staffId) {
      conditions.push(log.staffId === criteria.staffId);
    }

    if (criteria.date) {
      conditions.push(log.date === criteria.date);
    }

    if (criteria.role) {
      const logRole = normalizeRole(log.role);
      const targetRole = normalizeRole(criteria.role);
      conditions.push(logRole === targetRole);
    }

    if (criteria.eventId) {
      conditions.push(log.eventId === criteria.eventId);
    }

    if (criteria.type) {
      conditions.push(log.type === criteria.type);
    }

    return conditions.length > 0 && conditions.every((condition) => condition);
  });

  if (!found) {
    logger.warn('조건에 맞는 WorkLog를 찾지 못함', {
      component: 'workLogHelpers',
      data: {
        criteria,
        availableWorkLogs: workLogs.map((log) => ({
          id: log.id,
          staffId: log.staffId,
          date: log.date,
          role: log.role,
          eventId: log.eventId,
          type: log.type,
        })),
      },
    });
  }

  return found || null;
};

/**
 * Staff별로 WorkLog 그룹핑 (성능 최적화용)
 */
export const groupWorkLogsByStaff = (workLogs: UnifiedWorkLog[]): Map<string, UnifiedWorkLog[]> => {
  const grouped = new Map<string, UnifiedWorkLog[]>();

  workLogs.forEach((log) => {
    const key = `${log.staffId}_${normalizeRole(log.role)}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(log);
  });

  return grouped;
};

/**
 * WorkLog 유효성 검증
 */
export const validateWorkLog = (workLog: Partial<UnifiedWorkLog>): boolean => {
  const requiredFields = ['id', 'staffId', 'date', 'eventId'];

  for (const field of requiredFields) {
    if (!workLog[field as keyof UnifiedWorkLog]) {
      logger.warn('WorkLog 필수 필드 누락', {
        component: 'workLogHelpers',
        data: { workLogId: workLog.id, missingField: field },
      });
      return false;
    }
  }

  return true;
};
