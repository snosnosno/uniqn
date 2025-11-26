/**
 * Firestore 컬렉션 구독 Hook
 *
 * @description
 * Firestore 컬렉션을 실시간으로 구독하고 데이터를 제공하는 Hook입니다.
 * onSnapshot 패턴을 추상화하여 재사용 가능하게 만들었습니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - 실시간 구독 자동 관리
 * - 로딩/에러 상태 통합
 * - 타입 안전성 100%
 * - cleanup 자동 처리
 * - refetch 기능 지원
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, query, onSnapshot, QueryConstraint, DocumentData } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import type { FirestoreCollectionResult, FirestoreDocument, CollectionHookOptions } from './types';
import { convertDocument } from './types';

/**
 * Firestore 컬렉션 실시간 구독 Hook
 *
 * @description
 * Firestore 컬렉션을 실시간으로 구독하고 데이터 변경 사항을 자동으로 반영합니다.
 * 컴포넌트 언마운트 시 자동으로 구독이 해제됩니다.
 *
 * @template T - 문서 데이터 타입
 * @param collectionPath - Firestore 컬렉션 경로 (예: 'staff', 'users/abc/posts')
 * @param options - Hook 옵션 (queryConstraints, enabled, onError, onSuccess)
 * @returns FirestoreCollectionResult<T> - data, loading, error, refetch
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const { data: staff, loading, error } = useFirestoreCollection<Staff>('staff');
 *
 * // 쿼리 조건 사용
 * const { data: activeStaff } = useFirestoreCollection<Staff>(
 *   'staff',
 *   { queryConstraints: [where('active', '==', true)] }
 * );
 *
 * // 수동 refetch
 * const { data, refetch } = useFirestoreCollection<Staff>('staff');
 * // 나중에 refetch() 호출
 * ```
 */
export function useFirestoreCollection<T>(
  collectionPath: string,
  options: CollectionHookOptions = {}
): FirestoreCollectionResult<T> {
  const { queryConstraints = [], enabled = true, onError, onSuccess, deps = [] } = options;

  // queryConstraints를 문자열로 변환하여 메모이제이션
  const queryConstraintsKey = useMemo(
    () => JSON.stringify(queryConstraints.map((c) => c.toString())),
    [queryConstraints]
  );

  // 상태 관리
  const [data, setData] = useState<FirestoreDocument<T>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // refetch 카운터 (refetch 호출 시 증가)
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
    logger.info('useFirestoreCollection refetch');
    setRefetchCount((prev) => prev + 1);
  }, []);

  // 실시간 구독 설정
  useEffect(() => {
    // enabled가 false면 구독하지 않음
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    logger.info('useFirestoreCollection 구독 시작');

    try {
      // Firestore 쿼리 생성
      const collectionRef = collection(db, collectionPath);
      const q =
        queryConstraints.length > 0 ? query(collectionRef, ...queryConstraints) : collectionRef;

      // onSnapshot 구독
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const documents = snapshot.docs.map((doc) =>
            convertDocument<T>(doc.id, doc.data() as DocumentData)
          );

          setData(documents);
          setLoading(false);

          logger.info('useFirestoreCollection 데이터 업데이트');

          // 성공 콜백
          onSuccessRef.current?.();
        },
        (err) => {
          const firestoreError = err as Error;
          setError(firestoreError);
          setLoading(false);

          logger.error('useFirestoreCollection 에러', firestoreError);

          // 에러 콜백
          onErrorRef.current?.(firestoreError);
        }
      );

      // ref에 구독 정리 함수 저장
      unsubscribeRef.current = unsubscribe;

      // cleanup 함수
      return () => {
        logger.info('useFirestoreCollection 구독 해제');
        unsubscribe();
        unsubscribeRef.current = null;
      };
    } catch (err) {
      const firestoreError = err as Error;
      setError(firestoreError);
      setLoading(false);

      logger.error('useFirestoreCollection 초기화 에러', firestoreError);

      onErrorRef.current?.(firestoreError);
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, enabled, refetchCount, queryConstraintsKey, ...deps]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
