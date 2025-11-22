/**
 * Firestore 단일 문서 구독 Hook
 *
 * @description
 * Firestore 단일 문서를 실시간으로 구독하고 업데이트 기능을 제공하는 Hook입니다.
 * onSnapshot 패턴을 추상화하여 재사용 가능하게 만들었습니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - 단일 문서 실시간 구독
 * - 문서 업데이트 기능 내장
 * - 로딩/에러 상태 통합
 * - 타입 안전성 100%
 * - cleanup 자동 처리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  onSnapshot,
  updateDoc,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import type {
  FirestoreDocumentResult,
  FirestoreDocument,
  DocumentHookOptions,
} from './types';
import { convertDocument } from './types';

/**
 * Firestore 단일 문서 실시간 구독 Hook
 *
 * @description
 * Firestore 단일 문서를 실시간으로 구독하고 데이터 변경 사항을 자동으로 반영합니다.
 * update 함수를 통해 문서를 쉽게 업데이트할 수 있습니다.
 *
 * @template T - 문서 데이터 타입
 * @param documentPath - Firestore 문서 경로 (예: 'staff/abc123', 'users/user1/posts/post1')
 * @param options - Hook 옵션 (enabled, errorOnNotFound, onError, onSuccess)
 * @returns FirestoreDocumentResult<T> - data, loading, error, update, refetch
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const { data: staff, loading, error, update } = useFirestoreDocument<Staff>('staff/abc123');
 *
 * // 문서 업데이트
 * const { update } = useFirestoreDocument<Staff>('staff/abc123');
 * await update({ name: '새 이름', active: true });
 *
 * // 문서 없을 때 에러로 처리
 * const { data } = useFirestoreDocument<Staff>(
 *   'staff/abc123',
 *   { errorOnNotFound: true }
 * );
 * ```
 */
export function useFirestoreDocument<T>(
  documentPath: string,
  options: DocumentHookOptions = {}
): FirestoreDocumentResult<T> {
  const {
    enabled = true,
    errorOnNotFound = false,
    onError,
    onSuccess,
    deps = [],
  } = options;

  // 상태 관리
  const [data, setData] = useState<FirestoreDocument<T> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // refetch 카운터
  const [refetchCount, setRefetchCount] = useState<number>(0);

  // 구독 정리 함수 ref
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 문서 업데이트 함수
  const update = useCallback(
    async (updateData: Partial<T>): Promise<void> => {
      try {
        logger.info('useFirestoreDocument 문서 업데이트 시작');

        const docRef = doc(db, documentPath);
        await updateDoc(docRef, updateData as DocumentData);

        logger.info('useFirestoreDocument 문서 업데이트 성공');
      } catch (err) {
        const updateError = err as Error;
        logger.error('useFirestoreDocument 문서 업데이트 에러', updateError);
        throw updateError;
      }
    },
    [documentPath]
  );

  // refetch 함수
  const refetch = useCallback(() => {
    logger.info('useFirestoreDocument refetch');
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

    logger.info('useFirestoreDocument 구독 시작');

    try {
      // Firestore 문서 참조 생성
      const docRef = doc(db, documentPath);

      // onSnapshot 구독
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const document = convertDocument<T>(
              snapshot.id,
              snapshot.data() as DocumentData
            );

            setData(document);
            setLoading(false);

            logger.info('useFirestoreDocument 데이터 업데이트');

            // 성공 콜백
            onSuccess?.();
          } else {
            // 문서가 존재하지 않음
            setData(null);
            setLoading(false);

            if (errorOnNotFound) {
              const notFoundError = new Error(
                `Document not found: ${documentPath}`
              );
              setError(notFoundError);
              logger.error('useFirestoreDocument 문서 없음', notFoundError);
              onError?.(notFoundError);
            } else {
              logger.info('useFirestoreDocument 문서 없음 (정상)');
              onSuccess?.();
            }
          }
        },
        (err) => {
          const firestoreError = err as Error;
          setError(firestoreError);
          setLoading(false);

          logger.error('useFirestoreDocument 에러', firestoreError);

          // 에러 콜백
          onError?.(firestoreError);
        }
      );

      // ref에 구독 정리 함수 저장
      unsubscribeRef.current = unsubscribe;

      // cleanup 함수
      return () => {
        logger.info('useFirestoreDocument 구독 해제');
        unsubscribe();
        unsubscribeRef.current = null;
      };
    } catch (err) {
      const firestoreError = err as Error;
      setError(firestoreError);
      setLoading(false);

      logger.error('useFirestoreDocument 초기화 에러', firestoreError);

      onError?.(firestoreError);
      return undefined;
    }
  }, [
    documentPath,
    enabled,
    errorOnNotFound,
    refetchCount,
    ...deps,
    onError,
    onSuccess,
  ]);

  return {
    data,
    loading,
    error,
    update,
    refetch,
  };
}
