import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  Unsubscribe,
  QueryConstraint,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import {
  UnifiedWorkLog,
  WorkLogFilter,
  WorkLogCreateInput,
  WorkLogUpdateInput,
  WorkLogSortOption
} from '../types/unified/workLog';
import {
  normalizeWorkLogs,
  prepareWorkLogForCreate,
  prepareWorkLogForUpdate,
  validateWorkLog,
  filterWorkLogs
} from '../utils/workLogMapper';

interface UseUnifiedWorkLogsOptions {
  filter?: WorkLogFilter;
  sort?: WorkLogSortOption;
  limit?: number;
  realtime?: boolean;
  autoNormalize?: boolean;
  skipSubscription?: boolean; // 구독을 완전히 건너뛸지 여부
}

interface UseUnifiedWorkLogsReturn {
  workLogs: UnifiedWorkLog[];
  loading: boolean;
  error: Error | null;
  
  // CRUD operations
  createWorkLog: (input: WorkLogCreateInput) => Promise<string>;
  updateWorkLog: (id: string, updates: WorkLogUpdateInput) => Promise<void>;
  deleteWorkLog: (id: string) => Promise<void>;
  
  // Batch operations
  createMultipleWorkLogs: (inputs: WorkLogCreateInput[]) => Promise<string[]>;
  updateMultipleWorkLogs: (updates: { id: string; data: WorkLogUpdateInput }[]) => Promise<void>;
  
  // Query helpers
  refetch: () => void;
  applyFilter: (filter: WorkLogFilter) => void;
  clearFilter: () => void;
  
  // Utility
  getWorkLogById: (id: string) => UnifiedWorkLog | undefined;
  getWorkLogsByStaffId: (staffId: string) => UnifiedWorkLog[];
  getWorkLogsByEventId: (eventId: string) => UnifiedWorkLog[];
}

/**
 * 통합 WorkLog Hook
 * 모든 WorkLog 관련 데이터 접근을 통합 관리
 */
export function useUnifiedWorkLogs(
  options: UseUnifiedWorkLogsOptions = {}
): UseUnifiedWorkLogsReturn {
  const {
    filter: initialFilter = {},
    sort: initialSort = { field: '', direction: 'desc' }, // 기본 정렬 비활성화
    limit: queryLimit = 1000,
    realtime = true,
    autoNormalize = true,
    skipSubscription = false // 구독을 완전히 건너뛸지 여부
  } = options;
  
  const [workLogs, setWorkLogs] = useState<UnifiedWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<WorkLogFilter>(initialFilter);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  
  // 데이터 조회 및 구독
  useEffect(() => {
    // skipSubscription이 true면 구독하지 않음
    if (!realtime || skipSubscription) {
      setLoading(false);
      setWorkLogs([]);
      return undefined;
    }
    
    // 이전 구독 정리
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Firebase 쿼리 구성
      const constraints: QueryConstraint[] = [];
      
      // eventId 필터
      if (filter.eventId) {
        if (Array.isArray(filter.eventId)) {
          constraints.push(where('eventId', 'in', filter.eventId));
        } else {
          constraints.push(where('eventId', '==', filter.eventId));
        }
      }
      
      // 날짜 필터
      if (filter.date) {
        constraints.push(where('date', '==', filter.date));
      } else {
        if (filter.dateFrom) {
          constraints.push(where('date', '>=', filter.dateFrom));
        }
        if (filter.dateTo) {
          constraints.push(where('date', '<=', filter.dateTo));
        }
      }
      
      // 상태 필터
      if (filter.status) {
        if (Array.isArray(filter.status)) {
          constraints.push(where('status', 'in', filter.status));
        } else {
          constraints.push(where('status', '==', filter.status));
        }
      }
      
      // 정렬 - date 필드가 존재하는 경우에만 정렬 추가
      // Firebase는 존재하지 않는 필드로 정렬하면 오류 발생
      if (initialSort.field === 'date') {
        // date 필드가 필터링되었거나 알려진 경우에만 정렬
        if (filter.date || filter.dateFrom || filter.dateTo) {
          constraints.push(orderBy(initialSort.field, initialSort.direction));
        }
      } else if (initialSort.field && initialSort.field.length > 0) {
        // 빈 문자열이 아닌 경우에만 정렬 적용
        constraints.push(orderBy(initialSort.field as Exclude<typeof initialSort.field, ''>, initialSort.direction));
      }
      
      // 제한
      constraints.push(limit(queryLimit));
      
      const q = query(collection(db, 'workLogs'), ...constraints);
      
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          try {
            const rawData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            // 디버깅 코드 제거
            
            // 자동 정규화
            const normalized = autoNormalize 
              ? normalizeWorkLogs(rawData)
              : rawData as UnifiedWorkLog[];
            
            // 클라이언트 사이드 필터링 (staffId는 Firestore에서 직접 쿼리 불가)
            let filtered = normalized;
            if (filter.staffId) {
              const staffIds = Array.isArray(filter.staffId) ? filter.staffId : [filter.staffId];
              filtered = filterWorkLogs(normalized, staffIds);
            }
            
            setWorkLogs(filtered);
            setLoading(false);
          } catch (err) {
            logger.error('WorkLogs 처리 오류', err as Error, {
              component: 'useUnifiedWorkLogs'
            });
            setError(err as Error);
            setLoading(false);
          }
        },
        (err) => {
          logger.error('WorkLogs 구독 오류', err as Error, {
            component: 'useUnifiedWorkLogs'
          });
          setError(err);
          setLoading(false);
        }
      );
      
      unsubscribeRef.current = unsub;
      
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    } catch (error) {
      logger.error('쿼리 구성 오류', error as Error, {
        component: 'useUnifiedWorkLogs'
      });
      setError(error as Error);
      setLoading(false);
      return undefined; // 명시적 반환
    }
  }, [filter.eventId, filter.staffId, filter.date, filter.dateFrom, filter.dateTo, filter.status, realtime, autoNormalize, initialSort.field, initialSort.direction, queryLimit, skipSubscription]);
  
  // WorkLog 생성
  const createWorkLog = useCallback(async (input: WorkLogCreateInput): Promise<string> => {
    try {
      // 검증
      const validation = validateWorkLog(input);
      if (!validation.valid) {
        throw new Error(`검증 실패: ${validation.errors.join(', ')}`);
      }
      
      // 문서 ID 생성 (eventId_staffId_date)
      const docId = `${input.eventId}_${input.staffId}_${input.date}`;
      const docRef = doc(db, 'workLogs', docId);
      
      // 데이터 준비
      const data = prepareWorkLogForCreate(input);
      
      // Firestore에 저장
      await setDoc(docRef, data);
      return docId;
    } catch (error) {
      logger.error('WorkLog 생성 실패', error as Error, {
        component: 'useUnifiedWorkLogs'
      });
      throw error;
    }
  }, []);
  
  // WorkLog 업데이트
  const updateWorkLog = useCallback(async (id: string, updates: WorkLogUpdateInput): Promise<void> => {
    try {
      const docRef = doc(db, 'workLogs', id);
      const data = prepareWorkLogForUpdate(updates);
      
      await updateDoc(docRef, data);
    } catch (error) {
      logger.error('WorkLog 업데이트 실패', error as Error, {
        component: 'useUnifiedWorkLogs'
      });
      throw error;
    }
  }, []);
  
  // WorkLog 삭제
  const deleteWorkLog = useCallback(async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, 'workLogs', id);
      await deleteDoc(docRef);
    } catch (error) {
      logger.error('WorkLog 삭제 실패', error as Error, {
        component: 'useUnifiedWorkLogs'
      });
      throw error;
    }
  }, []);
  
  // 여러 WorkLog 생성
  const createMultipleWorkLogs = useCallback(async (inputs: WorkLogCreateInput[]): Promise<string[]> => {
    const ids: string[] = [];
    
    for (const input of inputs) {
      try {
        const id = await createWorkLog(input);
        ids.push(id);
      } catch (error) {
        logger.error('일괄 생성 중 오류', error as Error, {
          component: 'useUnifiedWorkLogs'
        });
      }
    }
    
    return ids;
  }, [createWorkLog]);
  
  // 여러 WorkLog 업데이트
  const updateMultipleWorkLogs = useCallback(async (
    updates: { id: string; data: WorkLogUpdateInput }[]
  ): Promise<void> => {
    for (const { id, data } of updates) {
      try {
        await updateWorkLog(id, data);
      } catch (error) {
        logger.error('일괄 업데이트 중 오류', error as Error, {
          component: 'useUnifiedWorkLogs'
        });
      }
    }
  }, [updateWorkLog]);
  
  // 재조회
  const refetch = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    // 필터 상태를 업데이트하여 useEffect 트리거
    setFilter(prev => ({ ...prev }));
  }, []);
  
  // 필터 적용
  const applyFilter = useCallback((newFilter: WorkLogFilter) => {
    setFilter(newFilter);
  }, []);
  
  // 필터 초기화
  const clearFilter = useCallback(() => {
    setFilter({});
  }, []);
  
  // ID로 WorkLog 찾기
  const getWorkLogById = useCallback((id: string): UnifiedWorkLog | undefined => {
    return workLogs.find(log => log.id === id);
  }, [workLogs]);
  
  // staffId로 WorkLog 찾기
  const getWorkLogsByStaffId = useCallback((staffId: string): UnifiedWorkLog[] => {
    return workLogs.filter(log => log.staffId === staffId);
  }, [workLogs]);
  
  // eventId로 WorkLog 찾기
  const getWorkLogsByEventId = useCallback((eventId: string): UnifiedWorkLog[] => {
    return workLogs.filter(log => log.eventId === eventId);
  }, [workLogs]);
  
  return {
    workLogs,
    loading,
    error,
    createWorkLog,
    updateWorkLog,
    deleteWorkLog,
    createMultipleWorkLogs,
    updateMultipleWorkLogs,
    refetch,
    applyFilter,
    clearFilter,
    getWorkLogById,
    getWorkLogsByStaffId,
    getWorkLogsByEventId
  };
}

/**
 * 특정 공고의 WorkLog 조회 전용 Hook
 */
export function useJobPostingWorkLogs(eventId?: string) {
  return useUnifiedWorkLogs({
    filter: eventId ? { eventId: eventId } : {},
    sort: { field: '', direction: 'desc' }, // 정렬 비활성화
    realtime: true,
    autoNormalize: true
  });
}

/**
 * 특정 스태프의 WorkLog 조회 전용 Hook
 */
export function useStaffWorkLogs(staffId?: string) {
  return useUnifiedWorkLogs({
    filter: staffId ? { staffId } : {},
    sort: { field: '', direction: 'desc' }, // 정렬 비활성화
    realtime: true,
    autoNormalize: true
  });
}

/**
 * 날짜 범위 WorkLog 조회 전용 Hook
 */
export function useDateRangeWorkLogs(dateFrom?: string, dateTo?: string) {
  const filter: WorkLogFilter = {};
  if (dateFrom) filter.dateFrom = dateFrom;
  if (dateTo) filter.dateTo = dateTo;
  
  return useUnifiedWorkLogs({
    filter,
    sort: { field: '', direction: 'desc' }, // 정렬 비활성화
    realtime: true,
    autoNormalize: true
  });
}