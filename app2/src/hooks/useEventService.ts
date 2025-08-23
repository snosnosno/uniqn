/**
 * useEventService Hook
 * EventService를 React 컴포넌트에서 사용하기 위한 Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { eventService } from '../services/EventService';
import { 
  EventInfo, 
  EventStaff, 
  EventWorkLog,
  SubcollectionQueryOptions 
} from '../types/subcollection';
import { logger } from '../utils/logger';

interface UseEventServiceOptions {
  eventId?: string;
  realtime?: boolean;
  autoLoad?: boolean;
}

interface UseEventServiceReturn {
  // 데이터
  eventInfo: EventInfo | null;
  staff: EventStaff[];
  workLogs: EventWorkLog[];
  
  // 상태
  loading: boolean;
  error: Error | null;
  
  // Staff 작업
  getStaff: () => Promise<void>;
  getStaffById: (userId: string) => Promise<EventStaff | null>;
  upsertStaff: (userId: string, data: Partial<EventStaff>) => Promise<void>;
  
  // WorkLog 작업
  getWorkLogs: (options?: Partial<SubcollectionQueryOptions>) => Promise<void>;
  createWorkLog: (data: Omit<EventWorkLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateWorkLog: (workLogId: string, updates: Partial<EventWorkLog>) => Promise<void>;
  
  // 정산
  calculatePayroll: (dateRange?: { from: string; to: string }) => Promise<any>;
  
  // 유틸리티
  refresh: () => Promise<void>;
  invalidateCache: () => void;
}

/**
 * EventService를 React에서 사용하기 위한 Hook
 */
export function useEventService(
  options: UseEventServiceOptions = {}
): UseEventServiceReturn {
  const { eventId, realtime = false, autoLoad = true } = options;
  
  // 상태
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [staff, setStaff] = useState<EventStaff[]>([]);
  const [workLogs, setWorkLogs] = useState<EventWorkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // 마운트 상태 추적
  const isMountedRef = useRef(true);
  
  // 안전한 상태 업데이트
  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: React.SetStateAction<T>) => {
      if (isMountedRef.current) {
        setter(value);
      }
    };
  }, []);
  
  // EventInfo 조회
  const getEventInfo = useCallback(async () => {
    if (!eventId) return;
    
    try {
      const info = await eventService.getEventInfo(eventId, realtime);
      safeSetState(setEventInfo)(info);
    } catch (err) {
      logger.error('EventInfo 조회 실패', err as Error, {
        component: 'useEventService',
        data: { eventId }
      });
      safeSetState(setError)(err as Error);
    }
  }, [eventId, realtime, safeSetState]);
  
  // Staff 조회
  const getStaff = useCallback(async () => {
    if (!eventId) return;
    
    try {
      const staffList = await eventService.getEventStaff(eventId);
      safeSetState(setStaff)(staffList);
    } catch (err) {
      logger.error('Staff 조회 실패', err as Error, {
        component: 'useEventService',
        data: { eventId }
      });
      safeSetState(setError)(err as Error);
    }
  }, [eventId, safeSetState]);
  
  // Staff 개별 조회
  const getStaffById = useCallback(async (userId: string): Promise<EventStaff | null> => {
    if (!eventId) return null;
    
    try {
      return await eventService.getStaffById(eventId, userId);
    } catch (err) {
      logger.error('Staff 개별 조회 실패', err as Error, {
        component: 'useEventService',
        data: { eventId, userId }
      });
      throw err;
    }
  }, [eventId]);
  
  // Staff 추가/업데이트
  const upsertStaff = useCallback(async (
    userId: string,
    data: Partial<EventStaff>
  ): Promise<void> => {
    if (!eventId) return;
    
    try {
      await eventService.upsertStaff(eventId, userId, data);
      // 목록 새로고침
      await getStaff();
    } catch (err) {
      logger.error('Staff 저장 실패', err as Error, {
        component: 'useEventService',
        data: { eventId, userId }
      });
      throw err;
    }
  }, [eventId, getStaff]);
  
  // WorkLogs 조회
  const getWorkLogs = useCallback(async (
    queryOptions?: Partial<SubcollectionQueryOptions>
  ): Promise<void> => {
    if (!eventId) return;
    
    try {
      const logs = await eventService.getEventWorkLogs(eventId, queryOptions);
      safeSetState(setWorkLogs)(logs);
    } catch (err) {
      logger.error('WorkLogs 조회 실패', err as Error, {
        component: 'useEventService',
        data: { eventId }
      });
      safeSetState(setError)(err as Error);
    }
  }, [eventId, safeSetState]);
  
  // WorkLog 생성
  const createWorkLog = useCallback(async (
    data: Omit<EventWorkLog, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!eventId) throw new Error('eventId가 필요합니다');
    
    try {
      const workLogId = await eventService.createWorkLog(eventId, data);
      // 목록 새로고침
      await getWorkLogs();
      return workLogId;
    } catch (err) {
      logger.error('WorkLog 생성 실패', err as Error, {
        component: 'useEventService',
        data: { eventId }
      });
      throw err;
    }
  }, [eventId, getWorkLogs]);
  
  // WorkLog 업데이트
  const updateWorkLog = useCallback(async (
    workLogId: string,
    updates: Partial<EventWorkLog>
  ): Promise<void> => {
    if (!eventId) return;
    
    try {
      await eventService.updateWorkLog(eventId, workLogId, updates);
      // 목록 새로고침
      await getWorkLogs();
    } catch (err) {
      logger.error('WorkLog 업데이트 실패', err as Error, {
        component: 'useEventService',
        data: { eventId, workLogId }
      });
      throw err;
    }
  }, [eventId, getWorkLogs]);
  
  // 정산 계산
  const calculatePayroll = useCallback(async (
    dateRange?: { from: string; to: string }
  ) => {
    if (!eventId) return null;
    
    try {
      return await eventService.calculatePayroll(eventId, dateRange);
    } catch (err) {
      logger.error('정산 계산 실패', err as Error, {
        component: 'useEventService',
        data: { eventId, dateRange }
      });
      throw err;
    }
  }, [eventId]);
  
  // 전체 새로고침
  const refresh = useCallback(async () => {
    if (!eventId) return;
    
    safeSetState(setLoading)(true);
    safeSetState(setError)(null);
    
    try {
      await Promise.all([
        getEventInfo(),
        getStaff(),
        getWorkLogs()
      ]);
    } catch (err) {
      safeSetState(setError)(err as Error);
    } finally {
      safeSetState(setLoading)(false);
    }
  }, [eventId, getEventInfo, getStaff, getWorkLogs, safeSetState]);
  
  // 캐시 무효화
  const invalidateCache = useCallback(() => {
    eventService.invalidateCache(eventId);
  }, [eventId]);
  
  // 초기 로드
  useEffect(() => {
    if (autoLoad && eventId) {
      refresh();
    }
  }, [eventId, autoLoad]); // refresh는 의존성에서 제외 (무한 루프 방지)
  
  // 클린업
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // 컴포넌트 언마운트 시 이벤트별 캐시 정리
      if (eventId) {
        eventService.invalidateCache(eventId);
      }
    };
  }, [eventId]);
  
  return {
    // 데이터
    eventInfo,
    staff,
    workLogs,
    
    // 상태
    loading,
    error,
    
    // Staff 작업
    getStaff,
    getStaffById,
    upsertStaff,
    
    // WorkLog 작업
    getWorkLogs,
    createWorkLog,
    updateWorkLog,
    
    // 정산
    calculatePayroll,
    
    // 유틸리티
    refresh,
    invalidateCache
  };
}