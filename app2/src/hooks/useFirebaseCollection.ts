import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot, 
  QueryConstraint,
  DocumentData,
  CollectionReference,
  Query,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';

/**
 * Firebase 컬렉션 실시간 구독을 위한 범용 훅
 * 모든 Firebase 쿼리 로직을 통합하여 중복 제거
 */

interface UseFirebaseCollectionOptions<T = DocumentData> {
  /** 컬렉션 경로 */
  collectionPath: string;
  /** 쿼리 조건들 */
  queryConstraints?: QueryConstraint[];
  /** 데이터 변환 함수 */
  transform?: (doc: DocumentData) => T;
  /** 의존성 배열 - 이 값들이 변경되면 쿼리를 다시 실행 */
  dependencies?: any[];
  /** 자동 구독 활성화 (기본값: true) */
  enabled?: boolean;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;
  /** 성공 시 콜백 */
  onSuccess?: (data: T[]) => void;
}

interface UseFirebaseCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  isEmpty: boolean;
  count: number;
}

export function useFirebaseCollection<T = DocumentData>(
  options: UseFirebaseCollectionOptions<T>
): UseFirebaseCollectionResult<T> {
  const {
    collectionPath,
    queryConstraints = [],
    transform,
    dependencies = [],
    enabled = true,
    onError,
    onSuccess
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let unsubscribe: Unsubscribe | null = null;

    try {
      setLoading(true);
      setError(null);

      // 컬렉션 참조 생성
      const collectionRef: CollectionReference = collection(db, collectionPath);
      
      // 쿼리 생성
      let queryRef: Query = collectionRef;
      if (queryConstraints.length > 0) {
        queryRef = query(collectionRef, ...queryConstraints);
      }

      // 실시간 구독 시작
      unsubscribe = onSnapshot(
        queryRef,
        (snapshot) => {
          try {
            const docs = snapshot.docs.map(doc => {
              const docData = { id: doc.id, ...doc.data() };
              return transform ? transform(docData) : docData as T;
            });

            setData(docs);
            setLoading(false);
            setError(null);

            if (onSuccess) {
              onSuccess(docs);
            }

            logger.debug('Firebase 컬렉션 데이터 업데이트:', {
              component: 'useFirebaseCollection',
              data: {
                collection: collectionPath,
                count: docs.length,
                hasConstraints: queryConstraints.length > 0
              }
            });
          } catch (transformError) {
            const error = transformError instanceof Error 
              ? transformError 
              : new Error(String(transformError));
            
            setError(error);
            setLoading(false);
            
            if (onError) {
              onError(error);
            }

            logger.error('데이터 변환 오류:', error, {
              component: 'useFirebaseCollection',
              data: { collection: collectionPath }
            });
          }
        },
        (firestoreError) => {
          const error = firestoreError instanceof Error 
            ? firestoreError 
            : new Error(String(firestoreError));
          
          setError(error);
          setLoading(false);
          
          if (onError) {
            onError(error);
          }

          logger.error('Firebase 구독 오류:', error, {
            component: 'useFirebaseCollection',
            data: { collection: collectionPath }
          });
        }
      );
    } catch (setupError) {
      const error = setupError instanceof Error 
        ? setupError 
        : new Error(String(setupError));
      
      setError(error);
      setLoading(false);
      
      if (onError) {
        onError(error);
      }

      logger.error('Firebase 구독 설정 오류:', error, {
        component: 'useFirebaseCollection',
        data: { collection: collectionPath }
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [collectionPath, enabled, onError, onSuccess, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch,
    isEmpty: data.length === 0,
    count: data.length
  };
}

/**
 * Staff 컬렉션 전용 훅
 */
export function useStaffCollection(eventId?: string) {
  return useFirebaseCollection({
    collectionPath: 'staff',
    queryConstraints: eventId ? [where('eventId', '==', eventId)] : [],
    dependencies: [eventId]
  });
}

/**
 * WorkLogs 컬렉션 전용 훅
 */
export function useWorkLogsCollection(filters: {
  eventId?: string;
  staffId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  const { eventId, staffId, date, startDate, endDate } = filters;

  const queryConstraints: QueryConstraint[] = [];
  
  if (eventId) {
    queryConstraints.push(where('eventId', '==', eventId));
  }
  
  if (staffId) {
    queryConstraints.push(where('staffId', '==', staffId));
  }
  
  if (date) {
    queryConstraints.push(where('date', '==', date));
  }
  
  if (startDate && endDate) {
    queryConstraints.push(
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
  }

  // 날짜순 정렬
  queryConstraints.push(orderBy('date', 'desc'));

  return useFirebaseCollection({
    collectionPath: 'workLogs',
    queryConstraints,
    dependencies: [eventId, staffId, date, startDate, endDate]
  });
}

/**
 * AttendanceRecords 컬렉션 전용 훅
 */
export function useAttendanceRecordsCollection(filters: {
  eventId?: string;
  date?: string;
} = {}) {
  const { eventId, date } = filters;

  const queryConstraints: QueryConstraint[] = [];
  
  if (eventId) {
    queryConstraints.push(where('eventId', '==', eventId));
  }
  
  if (date) {
    queryConstraints.push(where('date', '==', date));
  }

  return useFirebaseCollection({
    collectionPath: 'attendanceRecords',
    queryConstraints,
    dependencies: [eventId, date]
  });
}

/**
 * 여러 컬렉션을 동시에 구독하는 훅
 */
export function useMultipleCollections<T extends Record<string, any>>(
  collections: Array<{
    key: keyof T;
    collectionPath: string;
    queryConstraints?: QueryConstraint[];
    transform?: (doc: DocumentData) => any;
  }>,
  enabled = true
): {
  data: T;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [combinedData, setCombinedData] = useState<T>({} as T);
  const [combinedLoading, setCombinedLoading] = useState(true);
  const [combinedError, setCombinedError] = useState<Error | null>(null);

  // 각 컬렉션에 대한 개별 구독
  // React Hook 규칙: 조건부나 반복문 내에서 Hook을 호출할 수 없으므로
  // 최대 컬렉션 수를 고정하고 조건부로 사용
  const { key: _key1, ...options1 } = collections[0] || { key: '', collectionName: '', collectionPath: '' };
  const { key: _key2, ...options2 } = collections[1] || { key: '', collectionName: '', collectionPath: '' };
  const { key: _key3, ...options3 } = collections[2] || { key: '', collectionName: '', collectionPath: '' };
  const { key: _key4, ...options4 } = collections[3] || { key: '', collectionName: '', collectionPath: '' };
  const { key: _key5, ...options5 } = collections[4] || { key: '', collectionName: '', collectionPath: '' };
  
  const result1 = useFirebaseCollection(collections[0] ? { ...options1, enabled } : { collectionName: '', collectionPath: '', enabled: false });
  const result2 = useFirebaseCollection(collections[1] ? { ...options2, enabled } : { collectionName: '', collectionPath: '', enabled: false });
  const result3 = useFirebaseCollection(collections[2] ? { ...options3, enabled } : { collectionName: '', collectionPath: '', enabled: false });
  const result4 = useFirebaseCollection(collections[3] ? { ...options4, enabled } : { collectionName: '', collectionPath: '', enabled: false });
  const result5 = useFirebaseCollection(collections[4] ? { ...options5, enabled } : { collectionName: '', collectionPath: '', enabled: false });
  
  const results = [result1, result2, result3, result4, result5].slice(0, collections.length);

  useEffect(() => {
    const data = {} as T;
    let hasError = false;
    let isLoading = false;

    results.forEach((result, index) => {
      const collection = collections[index];
      if (collection) {
        const { key } = collection;
        (data as any)[key] = result.data;
        
        if (result.error && !hasError) {
          setCombinedError(result.error);
          hasError = true;
        }
        
        if (result.loading) {
          isLoading = true;
        }
      }
    });

    setCombinedData(data);
    setCombinedLoading(isLoading);
    
    if (!hasError) {
      setCombinedError(null);
    }
  }, [results, collections]);

  const refetch = useCallback(() => {
    results.forEach(result => result.refetch());
  }, [results]);

  return {
    data: combinedData,
    loading: combinedLoading,
    error: combinedError,
    refetch
  };
}