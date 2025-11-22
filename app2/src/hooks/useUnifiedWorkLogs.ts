import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  limit,
  Query,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { useFirestoreQuery } from './firestore';
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

  const [filter, setFilter] = useState<WorkLogFilter>(initialFilter);

  // 동적 쿼리 생성 (메모이제이션)
  const workLogsQuery = useMemo((): Query<DocumentData> | null => {
    // skipSubscription이 true면 쿼리하지 않음
    if (!realtime || skipSubscription) {
      return null;
    }

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

    return query(collection(db, 'workLogs'), ...constraints);
  }, [filter.eventId, filter.date, filter.dateFrom, filter.dateTo, filter.status, initialSort.field, initialSort.direction, queryLimit, realtime, skipSubscription]);

  // useFirestoreQuery로 구독
  const {
    data: rawWorkLogs,
    loading,
    error: hookError,
  } = useFirestoreQuery<Omit<UnifiedWorkLog, 'id'>>(
    workLogsQuery || query(collection(db, 'workLogs'), where('__name__', '==', '__non_existent__')), // 빈 쿼리
    {
      enabled: workLogsQuery !== null,
      onSuccess: () => {
        logger.debug('WorkLogs 실시간 업데이트', {
          component: 'useUnifiedWorkLogs',
          data: { count: rawWorkLogs.length }
        });
      },
      onError: (err) => {
        logger.error('WorkLogs 구독 오류', err, {
          component: 'useUnifiedWorkLogs'
        });
      },
    }
  );

  // 클라이언트 사이드 필터링 및 정규화 (메모이제이션)
  const workLogs = useMemo(() => {
    if (!rawWorkLogs || rawWorkLogs.length === 0) {
      return [];
    }

    // 타입 변환
    const typedData = rawWorkLogs.map((doc) => doc as unknown as UnifiedWorkLog);

    // 자동 정규화
    const normalized = autoNormalize
      ? normalizeWorkLogs(typedData)
      : typedData;

    // 클라이언트 사이드 필터링 (staffId는 Firestore에서 직접 쿼리 불가)
    let filtered = normalized;
    if (filter.staffId) {
      const staffIds = Array.isArray(filter.staffId) ? filter.staffId : [filter.staffId];
      filtered = filterWorkLogs(normalized, staffIds);
    }

    return filtered;
  }, [rawWorkLogs, autoNormalize, filter.staffId]);
  
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
  
  // 재조회 (실시간 구독이므로 필터 업데이트로 트리거)
  const refetch = useCallback(() => {
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
    error: hookError,
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