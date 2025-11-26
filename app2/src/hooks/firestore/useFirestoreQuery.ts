/**
 * Firestore 쿼리 구독 Hook
 *
 * @description
 * 복잡한 Firestore 쿼리를 실시간으로 구독하는 Hook입니다.
 * Query 객체를 직접 받아서 처리하므로 더 유연한 쿼리가 가능합니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - 복잡한 쿼리 실시간 구독
 * - Query 객체 직접 전달
 * - 로딩/에러 상태 통합
 * - 타입 안전성 100%
 * - cleanup 자동 처리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { onSnapshot, Query, DocumentData } from 'firebase/firestore';
import { logger } from '../../utils/logger';
import type { FirestoreQueryResult, FirestoreDocument, QueryHookOptions } from './types';
import { convertDocument } from './types';

/**
 * Firestore 쿼리 실시간 구독 Hook
 *
 * @description
 * 미리 생성된 Firestore 쿼리를 실시간으로 구독합니다.
 * useFirestoreCollection보다 더 복잡한 쿼리에 사용합니다.
 *
 * @template T - 문서 데이터 타입
 * @param query - Firestore Query 객체 (null이면 구독하지 않음)
 * @param options - Hook 옵션 (enabled, onError, onSuccess)
 * @returns FirestoreQueryResult<T> - data, loading, error, refetch
 *
 * @example
 * ```typescript
 * // 복잡한 쿼리 생성
 * const staffQuery = useMemo(() => {
 *   if (!userId) return null;
 *   return query(
 *     collection(db, 'staff'),
 *     where('userId', '==', userId),
 *     where('active', '==', true),
 *     orderBy('createdAt', 'desc'),
 *     limit(10)
 *   );
 * }, [userId]);
 *
 * // Hook 사용
 * const { data: staff, loading, error } = useFirestoreQuery<Staff>(staffQuery);
 *
 * // collectionGroup 쿼리
 * const allPostsQuery = useMemo(() =>
 *   query(collectionGroup(db, 'posts'), where('published', '==', true))
 * , []);
 * const { data: posts } = useFirestoreQuery<Post>(allPostsQuery);
 * ```
 */
export function useFirestoreQuery<T>(
  firestoreQuery: Query<DocumentData> | null,
  options: Omit<QueryHookOptions, 'query'> = {}
): FirestoreQueryResult<T> {
  const { enabled = true, onError, onSuccess, deps = [] } = options;

  // 상태 관리
  const [data, setData] = useState<FirestoreDocument<T>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // refetch 카운터
  const [refetchCount, setRefetchCount] = useState<number>(0);

  // 구독 정리 함수 ref
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 콜백 함수들을 ref로 저장 (의존성 배열에서 제거)
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
  }, [onError, onSuccess]);

  // refetch 함수
  const refetch = useCallback(() => {
    logger.info('useFirestoreQuery refetch');
    setRefetchCount((prev) => prev + 1);
  }, []);

  // 실시간 구독 설정
  useEffect(() => {
    // enabled가 false이거나 query가 null이면 구독하지 않음
    if (!enabled || !firestoreQuery) {
      setLoading(false);
      setData([]);
      return undefined;
    }

    setLoading(true);
    setError(null);

    logger.info('useFirestoreQuery 구독 시작');

    try {
      // onSnapshot 구독
      const unsubscribe = onSnapshot(
        firestoreQuery,
        (snapshot) => {
          const documents = snapshot.docs.map((doc) =>
            convertDocument<T>(doc.id, doc.data() as DocumentData)
          );

          setData(documents);
          setLoading(false);

          logger.info('useFirestoreQuery 데이터 업데이트');

          // 성공 콜백
          onSuccessRef.current?.();
        },
        (err) => {
          const firestoreError = err as Error;
          setError(firestoreError);
          setLoading(false);

          logger.error('useFirestoreQuery 에러', firestoreError);

          // 에러 콜백
          onErrorRef.current?.(firestoreError);
        }
      );

      // ref에 구독 정리 함수 저장
      unsubscribeRef.current = unsubscribe;

      // cleanup 함수
      return () => {
        logger.info('useFirestoreQuery 구독 해제');
        unsubscribe();
        unsubscribeRef.current = null;
      };
    } catch (err) {
      const firestoreError = err as Error;
      setError(firestoreError);
      setLoading(false);

      logger.error('useFirestoreQuery 초기화 에러', firestoreError);

      onErrorRef.current?.(firestoreError);
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestoreQuery, enabled, refetchCount, ...deps]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
