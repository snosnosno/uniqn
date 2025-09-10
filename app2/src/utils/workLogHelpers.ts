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
    logger.debug('Role이 없어서 모든 WorkLog 반환', {
      component: 'workLogHelpers',
      data: { workLogsCount: workLogs.length }
    });
    return workLogs;
  }

  const normalizedTargetRole = normalizeRole(targetRole);
  
  const filteredLogs = workLogs.filter(log => {
    // role 필드가 없으면 포함 (기존 로직 유지)
    if (!log.role) {
      return true;
    }
    
    const normalizedLogRole = normalizeRole(log.role);
    return normalizedLogRole === normalizedTargetRole;
  });

  logger.debug('Role 기반 WorkLog 필터링 완료', {
    component: 'workLogHelpers',
    data: {
      targetRole,
      normalizedTargetRole,
      totalLogs: workLogs.length,
      filteredLogs: filteredLogs.length,
      logDetails: filteredLogs.map(log => ({
        id: log.id,
        staffId: log.staffId,
        role: log.role,
        normalizedRole: normalizeRole(log.role)
      }))
    }
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
    logger.debug('WorkLog 배열이 비어있음', {
      component: 'workLogHelpers',
      data: { criteria }
    });
    return null;
  }

  // 1. workLogId가 있으면 직접 찾기
  if (criteria.workLogId) {
    const found = workLogs.find(log => log.id === criteria.workLogId);
    if (found) {
      logger.debug('workLogId로 WorkLog 찾음', {
        component: 'workLogHelpers',
        data: { workLogId: criteria.workLogId, found: found.id }
      });
      return found;
    }
  }

  // 2. 복합 조건으로 찾기
  const found = workLogs.find(log => {
    const conditions: boolean[] = [];

    // staffId 조건
    if (criteria.staffId) {
      conditions.push(log.staffId === criteria.staffId);
    }

    // date 조건
    if (criteria.date) {
      conditions.push(log.date === criteria.date);
    }

    // role 조건 (대소문자 무시)
    if (criteria.role) {
      const logRole = normalizeRole(log.role);
      const targetRole = normalizeRole(criteria.role);
      conditions.push(logRole === targetRole);
    }

    // eventId 조건
    if (criteria.eventId) {
      conditions.push(log.eventId === criteria.eventId);
    }

    // type 조건
    if (criteria.type) {
      conditions.push(log.type === criteria.type);
    }

    // 모든 조건이 true여야 매칭
    return conditions.length > 0 && conditions.every(condition => condition);
  });

  if (found) {
    logger.debug('복합 조건으로 WorkLog 찾음', {
      component: 'workLogHelpers',
      data: {
        criteria,
        found: {
          id: found.id,
          staffId: found.staffId,
          date: found.date,
          role: found.role,
          eventId: found.eventId,
          type: found.type
        }
      }
    });
  } else {
    logger.warn('조건에 맞는 WorkLog를 찾지 못함', {
      component: 'workLogHelpers',
      data: {
        criteria,
        availableWorkLogs: workLogs.map(log => ({
          id: log.id,
          staffId: log.staffId,
          date: log.date,
          role: log.role,
          eventId: log.eventId,
          type: log.type
        }))
      }
    });
  }

  return found || null;
};

/**
 * Staff별로 WorkLog 그룹핑 (성능 최적화용)
 */
export const groupWorkLogsByStaff = (
  workLogs: UnifiedWorkLog[]
): Map<string, UnifiedWorkLog[]> => {
  const grouped = new Map<string, UnifiedWorkLog[]>();
  
  workLogs.forEach(log => {
    const key = `${log.staffId}_${normalizeRole(log.role)}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    
    grouped.get(key)!.push(log);
  });

  logger.debug('Staff별 WorkLog 그룹핑 완료', {
    component: 'workLogHelpers',
    data: {
      totalLogs: workLogs.length,
      groupCount: grouped.size,
      groups: Array.from(grouped.entries()).map(([key, logs]) => ({
        key,
        count: logs.length
      }))
    }
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
        data: { workLogId: workLog.id, missingField: field }
      });
      return false;
    }
  }

  return true;
};