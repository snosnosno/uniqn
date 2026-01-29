/**
 * UNIQN Mobile - Firestore 트랜잭션 헬퍼 유틸리티
 *
 * @description Firestore 트랜잭션 및 배치 작업을 위한 유틸리티 함수
 * @version 1.0.0
 */

import {
  runTransaction,
  writeBatch,
  doc,
  getDoc,
  Timestamp,
  type DocumentReference,
  type Transaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

/**
 * 트랜잭션 결과
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * 배치 트랜잭션 옵션
 */
export interface BatchTransactionOptions {
  /** 배치 크기 (기본: 400, Firestore 최대: 500) */
  batchSize?: number;
  /** 부분 실패 시 처리 방식 */
  onPartialFailure?: 'rollback' | 'continue';
  /** 진행 콜백 */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * 배치 트랜잭션 결과
 */
export interface BatchTransactionResult<T> {
  successCount: number;
  failedCount: number;
  totalCount: number;
  results: {
    index: number;
    success: boolean;
    data?: T;
    error?: string;
  }[];
}

/**
 * 낙관적 업데이트 옵션
 */
export interface OptimisticUpdateOptions {
  /** 최대 재시도 횟수 (기본: 3) */
  maxRetries?: number;
  /** 충돌 시 커스텀 병합 로직 */
  mergeStrategy?: 'overwrite' | 'merge';
}

// ============================================================================
// Transaction Helpers
// ============================================================================

/**
 * 단일 문서 트랜잭션 실행
 *
 * @description 단일 문서의 읽기-검증-쓰기 패턴을 안전하게 처리
 *
 * @example
 * ```typescript
 * const result = await runSingleDocTransaction<WorkLog>(
 *   'workLogs',
 *   workLogId,
 *   async (transaction, currentData, docRef) => {
 *     if (currentData.payrollStatus === 'completed') {
 *       throw new Error('이미 정산 완료된 기록입니다');
 *     }
 *     transaction.update(docRef, {
 *       payrollStatus: 'completed',
 *       updatedAt: serverTimestamp(),
 *     });
 *     return { ...currentData, payrollStatus: 'completed' };
 *   }
 * );
 * ```
 */
export async function runSingleDocTransaction<T>(
  collectionName: string,
  docId: string,
  processor: (
    transaction: Transaction,
    currentData: T,
    docRef: DocumentReference
  ) => Promise<T>
): Promise<TransactionResult<T>> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, collectionName, docId);

    const result = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);

      if (!docSnap.exists()) {
        throw new Error(`문서를 찾을 수 없습니다: ${collectionName}/${docId}`);
      }

      const currentData = { id: docSnap.id, ...docSnap.data() } as T;
      return processor(transaction, currentData, docRef);
    });

    logger.info('단일 문서 트랜잭션 완료', {
      collection: collectionName,
      docId,
    });

    return { success: true, data: result };
  } catch (error) {
    logger.error('단일 문서 트랜잭션 실패', error as Error, {
      collection: collectionName,
      docId,
    });
    return { success: false, error: error as Error };
  }
}

/**
 * 낙관적 업데이트 트랜잭션
 *
 * @description 동시성 충돌 시 자동 재시도하는 업데이트 패턴
 *
 * @example
 * ```typescript
 * await runOptimisticTransaction<User>(
 *   'users',
 *   userId,
 *   (currentData) => ({
 *     chipBalance: currentData.chipBalance + amount,
 *   }),
 *   { maxRetries: 5 }
 * );
 * ```
 */
export async function runOptimisticTransaction<T extends { id?: string }>(
  collectionName: string,
  docId: string,
  updater: (currentData: T) => Partial<T>,
  options: OptimisticUpdateOptions = {}
): Promise<TransactionResult<T>> {
  const { maxRetries = 3, mergeStrategy = 'merge' } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const db = getFirebaseDb();
      const docRef = doc(db, collectionName, docId);

      const result = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);

        if (!docSnap.exists()) {
          throw new Error(`문서를 찾을 수 없습니다: ${collectionName}/${docId}`);
        }

        const currentData = { id: docSnap.id, ...docSnap.data() } as T;
        const updates = updater(currentData);

        const updateData =
          mergeStrategy === 'overwrite'
            ? { ...updates, updatedAt: serverTimestamp() }
            : { ...currentData, ...updates, updatedAt: serverTimestamp() };

        transaction.set(docRef, updateData, { merge: mergeStrategy === 'merge' });

        return { ...currentData, ...updates } as T;
      });

      logger.info('낙관적 업데이트 트랜잭션 완료', {
        collection: collectionName,
        docId,
        attempt: attempt + 1,
      });

      return { success: true, data: result };
    } catch (error) {
      lastError = error as Error;
      logger.warn('낙관적 업데이트 트랜잭션 재시도', {
        collection: collectionName,
        docId,
        attempt: attempt + 1,
        maxRetries,
        error: (error as Error).message,
      });

      // 재시도 전 짧은 대기 (지수 백오프)
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  logger.error('낙관적 업데이트 트랜잭션 최대 재시도 초과', lastError!, {
    collection: collectionName,
    docId,
    maxRetries,
  });

  return { success: false, error: lastError! };
}

/**
 * 다중 문서 배치 트랜잭션
 *
 * @description 여러 문서를 일괄 처리하며, Firestore 500개 제한을 자동 청킹
 *
 * @example
 * ```typescript
 * const result = await runBatchedTransaction(
 *   workLogIds,
 *   async (transaction, id) => {
 *     const ref = doc(db, 'workLogs', id);
 *     const snap = await transaction.get(ref);
 *     if (!snap.exists()) return { success: false, error: 'Not found' };
 *
 *     transaction.update(ref, { status: 'completed' });
 *     return { success: true, data: snap.data() };
 *   },
 *   { batchSize: 400, onPartialFailure: 'continue' }
 * );
 * ```
 */
export async function runBatchedTransaction<T, R>(
  items: T[],
  processor: (
    transaction: Transaction,
    item: T,
    index: number
  ) => Promise<{ success: boolean; data?: R; error?: string }>,
  options: BatchTransactionOptions = {}
): Promise<BatchTransactionResult<R>> {
  const { batchSize = 400, onPartialFailure = 'continue', onProgress } = options;

  // Firestore 트랜잭션 최대 제한 (500개 문서)
  const effectiveBatchSize = Math.min(batchSize, 400);

  const results: BatchTransactionResult<R>['results'] = [];
  let successCount = 0;
  let failedCount = 0;

  // 배치 분할
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += effectiveBatchSize) {
    batches.push(items.slice(i, i + effectiveBatchSize));
  }

  logger.info('배치 트랜잭션 시작', {
    totalItems: items.length,
    batchCount: batches.length,
    batchSize: effectiveBatchSize,
  });

  let processedCount = 0;

  for (const batch of batches) {
    const batchStartIndex = processedCount;

    try {
      const db = getFirebaseDb();

      await runTransaction(db, async (transaction) => {
        for (let i = 0; i < batch.length; i++) {
          const item = batch[i];
          const globalIndex = batchStartIndex + i;

          try {
            const result = await processor(transaction, item, globalIndex);
            results.push({
              index: globalIndex,
              success: result.success,
              data: result.data,
              error: result.error,
            });

            if (result.success) {
              successCount++;
            } else {
              failedCount++;
              if (onPartialFailure === 'rollback') {
                throw new Error(`배치 내 실패: ${result.error}`);
              }
            }
          } catch (itemError) {
            failedCount++;
            results.push({
              index: globalIndex,
              success: false,
              error: (itemError as Error).message,
            });

            if (onPartialFailure === 'rollback') {
              throw itemError;
            }
          }
        }
      });
    } catch (batchError) {
      logger.error('배치 트랜잭션 실패', batchError as Error, {
        batchIndex: batches.indexOf(batch),
      });

      // 롤백 모드면 전체 중단
      if (onPartialFailure === 'rollback') {
        throw batchError;
      }
    }

    processedCount += batch.length;
    onProgress?.(processedCount, items.length);
  }

  logger.info('배치 트랜잭션 완료', {
    totalCount: items.length,
    successCount,
    failedCount,
  });

  return {
    successCount,
    failedCount,
    totalCount: items.length,
    results,
  };
}

// ============================================================================
// Batch Write Helpers (Non-transactional)
// ============================================================================

/**
 * 간단한 배치 쓰기 (트랜잭션 불필요 시)
 *
 * @description 읽기 없이 다수 문서를 한번에 쓰기
 *
 * @example
 * ```typescript
 * await runBatchWrite(
 *   notifications.map(n => ({
 *     collection: 'notifications',
 *     docId: n.id,
 *     data: { isRead: true },
 *     operation: 'update',
 *   }))
 * );
 * ```
 */
export async function runBatchWrite(
  operations: {
    collection: string;
    docId?: string;
    data: Record<string, unknown>;
    operation: 'set' | 'update' | 'delete';
  }[],
  options: { batchSize?: number } = {}
): Promise<{ success: boolean; processedCount: number }> {
  const { batchSize = 400 } = options;
  const db = getFirebaseDb();
  let processedCount = 0;

  try {
    // 배치 분할
    for (let i = 0; i < operations.length; i += batchSize) {
      const batchOps = operations.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const op of batchOps) {
        const docRef = op.docId
          ? doc(db, op.collection, op.docId)
          : doc(db, op.collection);

        switch (op.operation) {
          case 'set':
            batch.set(docRef, { ...op.data, updatedAt: serverTimestamp() });
            break;
          case 'update':
            batch.update(docRef, { ...op.data, updatedAt: serverTimestamp() });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      }

      await batch.commit();
      processedCount += batchOps.length;

      logger.debug('배치 쓰기 진행', {
        processed: processedCount,
        total: operations.length,
      });
    }

    logger.info('배치 쓰기 완료', { processedCount });
    return { success: true, processedCount };
  } catch (error) {
    logger.error('배치 쓰기 실패', error as Error, {
      processedCount,
      totalOperations: operations.length,
    });
    return { success: false, processedCount };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 문서 존재 여부 확인
 */
export async function documentExists(
  collectionName: string,
  docId: string
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    logger.error('문서 존재 확인 실패', error as Error, {
      collection: collectionName,
      docId,
    });
    return false;
  }
}

/**
 * 트랜잭션 재시도 래퍼
 *
 * @description Firebase 트랜잭션 충돌 시 자동 재시도
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; onRetry?: (attempt: number, error: Error) => void } = {}
): Promise<T> {
  const { maxRetries = 3, onRetry } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      onRetry?.(attempt, lastError);

      if (attempt < maxRetries) {
        // 지수 백오프
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Timestamp Conversion Helpers
// ============================================================================

/**
 * Timestamp 또는 문자열을 Timestamp | null로 정규화
 *
 * @description 문자열 마커(FIXED_TIME_MARKER 등)는 null 반환
 * @param value - Timestamp, 문자열, 또는 null/undefined
 * @returns 정규화된 Timestamp 또는 null
 */
export function normalizeTimestamp(value: Timestamp | string | null | undefined): Timestamp | null {
  if (!value) return null;
  if (typeof value === 'string') return null; // 문자열 마커는 null 처리
  return value;
}

/**
 * Timestamp 또는 Date를 Date로 변환
 *
 * @description 안전한 타입 변환
 * @param value - Timestamp, Date, 문자열, 또는 null/undefined
 * @returns 변환된 Date 또는 null
 */
export function timestampToDate(value: Timestamp | Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export default {
  runSingleDocTransaction,
  runOptimisticTransaction,
  runBatchedTransaction,
  runBatchWrite,
  documentExists,
  withRetry,
  normalizeTimestamp,
  timestampToDate,
};

// ============================================================================
// Query Builder Re-export
// ============================================================================

export {
  QueryBuilder,
  processPaginatedResults,
  processPaginatedResultsWithFilter,
  buildQuery,
  type PaginatedResult,
  type DateRange,
} from './firestore/queryBuilder';
