/**
 * Firestore Mutation Hook
 *
 * @description
 * Firestore CRUD 작업(Create, Update, Delete)을 위한 Hook입니다.
 * React Query의 useMutation 패턴을 참고하여 설계되었습니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - Create, Update, Delete 작업 통합
 * - 로딩/에러 상태 관리
 * - 타입 안전성 100%
 * - 에러 핸들링 통합
 */

import { useState, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import type {
  FirestoreMutationResult,
  MutationHookOptions,
} from './types';

/**
 * Firestore Mutation Hook
 *
 * @description
 * Firestore 문서의 생성, 업데이트, 삭제 작업을 위한 Hook입니다.
 * 각 작업은 독립적으로 호출 가능하며, 로딩/에러 상태를 공유합니다.
 *
 * @template T - 문서 데이터 타입
 * @param options - Hook 옵션 (onSuccess, onError)
 * @returns FirestoreMutationResult<T> - create, update, delete, loading, error
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const { create, update, delete: deleteDoc, loading, error } = useFirestoreMutation<Staff>();
 *
 * // 문서 생성
 * const newStaffId = await create('staff', {
 *   name: '홍길동',
 *   email: 'hong@example.com',
 *   active: true
 * });
 *
 * // 문서 업데이트
 * await update('staff/abc123', { name: '김철수' });
 *
 * // 문서 삭제
 * await deleteDoc('staff/abc123');
 *
 * // 성공/에러 콜백
 * const mutation = useFirestoreMutation<Staff>({
 *   onSuccess: () => toast.success('저장 성공!'),
 *   onError: (error) => toast.error(error.message)
 * });
 * ```
 */
export function useFirestoreMutation<T>(
  options: MutationHookOptions = {}
): FirestoreMutationResult<T> {
  const { onSuccess, onError } = options;

  // 상태 관리
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 문서 생성
   *
   * @param collectionPath - 컬렉션 경로 (예: 'staff', 'users/abc/posts')
   * @param data - 생성할 문서 데이터
   * @returns 생성된 문서 ID
   */
  const create = useCallback(
    async (collectionPath: string, data: T): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        logger.info('useFirestoreMutation 문서 생성 시작');

        const collectionRef = collection(db, collectionPath);
        const docRef = await addDoc(collectionRef, data as DocumentData);

        setLoading(false);
        logger.info('useFirestoreMutation 문서 생성 성공');

        // 성공 콜백
        onSuccess?.();

        return docRef.id;
      } catch (err) {
        const mutationError = err as Error;
        setError(mutationError);
        setLoading(false);

        logger.error('useFirestoreMutation 문서 생성 에러', mutationError);

        // 에러 콜백
        onError?.(mutationError);

        throw mutationError;
      }
    },
    [onSuccess, onError]
  );

  /**
   * 문서 업데이트
   *
   * @param docPath - 문서 경로 (예: 'staff/abc123')
   * @param data - 업데이트할 데이터 (Partial)
   */
  const update = useCallback(
    async (docPath: string, data: Partial<T>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        logger.info('useFirestoreMutation 문서 업데이트 시작');

        const docRef = doc(db, docPath);
        await updateDoc(docRef, data as DocumentData);

        setLoading(false);
        logger.info('useFirestoreMutation 문서 업데이트 성공');

        // 성공 콜백
        onSuccess?.();
      } catch (err) {
        const mutationError = err as Error;
        setError(mutationError);
        setLoading(false);

        logger.error('useFirestoreMutation 문서 업데이트 에러', mutationError);

        // 에러 콜백
        onError?.(mutationError);

        throw mutationError;
      }
    },
    [onSuccess, onError]
  );

  /**
   * 문서 삭제
   *
   * @param docPath - 문서 경로 (예: 'staff/abc123')
   */
  const deleteDocument = useCallback(
    async (docPath: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        logger.info('useFirestoreMutation 문서 삭제 시작');

        const docRef = doc(db, docPath);
        await deleteDoc(docRef);

        setLoading(false);
        logger.info('useFirestoreMutation 문서 삭제 성공');

        // 성공 콜백
        onSuccess?.();
      } catch (err) {
        const mutationError = err as Error;
        setError(mutationError);
        setLoading(false);

        logger.error('useFirestoreMutation 문서 삭제 에러', mutationError);

        // 에러 콜백
        onError?.(mutationError);

        throw mutationError;
      }
    },
    [onSuccess, onError]
  );

  return {
    create,
    update,
    delete: deleteDocument,
    loading,
    error,
  };
}
