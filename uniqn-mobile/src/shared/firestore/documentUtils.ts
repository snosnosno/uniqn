/**
 * UNIQN Mobile - Firestore 문서 유틸리티
 *
 * @description 반복되는 문서 조회/파싱 패턴 통합
 * @version 1.0.0
 *
 * 이 모듈은 서비스 레이어에서 ~93회 반복되는 다음 패턴을 통합합니다:
 * 1. getDoc(doc(db, collection, id))
 * 2. if (!snapshot.exists()) throw new BusinessError(...)
 * 3. const data = parseXxxDocument({ id: snapshot.id, ...snapshot.data() })
 * 4. if (!data) throw new BusinessError(...)
 */

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  DocumentSnapshot,
  DocumentReference,
  QueryConstraint,
  Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { BusinessError, PermissionError, ERROR_CODES } from '@/errors';

// ============================================================================
// Types
// ============================================================================

/**
 * 문서 파서 함수 타입
 * @description 각 컬렉션별 파서 함수 (parseApplicationDocument 등)와 호환
 */
export type DocumentParser<T> = (data: { id: string; [key: string]: unknown }) => T | null;

/**
 * 문서 조회 옵션
 */
export interface GetDocumentOptions<T> {
  /** 컬렉션명 */
  collectionName: string;
  /** 문서 ID */
  documentId: string;
  /** 파서 함수 */
  parser: DocumentParser<T>;
  /** 에러 메시지 (찾을 수 없을 때) */
  notFoundMessage?: string;
  /** 파싱 실패 메시지 */
  parseErrorMessage?: string;
}

/**
 * 문서 조회 결과
 */
export interface DocumentResult<T> {
  /** 파싱된 데이터 */
  data: T;
  /** 문서 참조 (업데이트용) */
  ref: DocumentReference;
  /** 원본 스냅샷 */
  snapshot: DocumentSnapshot;
}

/**
 * 소유권 확인 옵션
 */
export interface VerifyOwnershipOptions<T> extends GetDocumentOptions<T> {
  /** 소유자 필드명 */
  ownerField: keyof T & string;
  /** 확인할 사용자 ID */
  userId: string;
  /** 권한 에러 메시지 */
  permissionErrorMessage?: string;
}

/**
 * 쿼리 옵션
 */
export interface QueryDocumentsOptions<T> {
  /** 컬렉션명 */
  collectionName: string;
  /** 쿼리 조건 (where, orderBy, limit 등) */
  constraints: QueryConstraint[];
  /** 파서 함수 */
  parser: DocumentParser<T>;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 단일 문서 조회 + 파싱 (필수 존재)
 *
 * @description getDoc + exists() + parser 패턴 통합
 * @throws BusinessError - 문서가 없거나 파싱 실패 시
 *
 * @example
 * const { data: job, ref } = await getDocumentRequired({
 *   collectionName: 'jobPostings',
 *   documentId: jobPostingId,
 *   parser: parseJobPostingDocument,
 *   notFoundMessage: '존재하지 않는 공고입니다',
 * });
 *
 * // ref를 사용하여 업데이트 가능
 * await updateDoc(ref, { status: 'closed' });
 */
export async function getDocumentRequired<T>(
  options: GetDocumentOptions<T>
): Promise<DocumentResult<T>> {
  const {
    collectionName,
    documentId,
    parser,
    notFoundMessage = '데이터를 찾을 수 없습니다',
    parseErrorMessage = '데이터를 파싱할 수 없습니다',
  } = options;

  const ref = doc(getFirebaseDb(), collectionName, documentId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: notFoundMessage,
      metadata: { collectionName, documentId },
    });
  }

  const data = parser({ id: snapshot.id, ...snapshot.data() });
  if (!data) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: parseErrorMessage,
      metadata: { collectionName, documentId },
    });
  }

  return { data, ref, snapshot };
}

/**
 * 단일 문서 조회 + 파싱 (옵셔널)
 *
 * @description 존재하지 않으면 null 반환 (에러 throw 없음)
 *
 * @example
 * const job = await getDocumentOptional({
 *   collectionName: 'jobPostings',
 *   documentId: jobPostingId,
 *   parser: parseJobPostingDocument,
 * });
 *
 * if (!job) {
 *   // 공고가 없는 경우 처리
 *   return null;
 * }
 */
export async function getDocumentOptional<T>(
  options: Omit<GetDocumentOptions<T>, 'notFoundMessage' | 'parseErrorMessage'>
): Promise<T | null> {
  const { collectionName, documentId, parser } = options;

  const ref = doc(getFirebaseDb(), collectionName, documentId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return parser({ id: snapshot.id, ...snapshot.data() });
}

/**
 * 트랜잭션 내 문서 조회 + 파싱 (필수 존재)
 *
 * @description runTransaction 내에서 사용
 * @throws BusinessError - 문서가 없거나 파싱 실패 시
 *
 * @example
 * await runTransaction(getFirebaseDb(), async (transaction) => {
 *   const { data: app, ref: appRef } = await getDocumentInTransaction(
 *     transaction,
 *     {
 *       collectionName: 'applications',
 *       documentId: applicationId,
 *       parser: parseApplicationDocument,
 *       notFoundMessage: '지원 내역을 찾을 수 없습니다',
 *     }
 *   );
 *
 *   // 트랜잭션 내에서 업데이트
 *   transaction.update(appRef, { status: 'confirmed' });
 * });
 */
export async function getDocumentInTransaction<T>(
  transaction: Transaction,
  options: GetDocumentOptions<T>
): Promise<DocumentResult<T>> {
  const {
    collectionName,
    documentId,
    parser,
    notFoundMessage = '데이터를 찾을 수 없습니다',
    parseErrorMessage = '데이터를 파싱할 수 없습니다',
  } = options;

  const ref = doc(getFirebaseDb(), collectionName, documentId);
  const snapshot = await transaction.get(ref);

  if (!snapshot.exists()) {
    throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
      userMessage: notFoundMessage,
      metadata: { collectionName, documentId },
    });
  }

  const data = parser({ id: snapshot.id, ...snapshot.data() });
  if (!data) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: parseErrorMessage,
      metadata: { collectionName, documentId },
    });
  }

  return { data, ref, snapshot };
}

// ============================================================================
// Collection Query Helpers
// ============================================================================

/**
 * 컬렉션 쿼리 + 파싱
 *
 * @description 조건에 맞는 문서들을 조회하고 파싱
 * @returns 파싱 성공한 문서 배열 (파싱 실패한 문서는 건너뜀)
 *
 * @example
 * import { where, orderBy, limit } from 'firebase/firestore';
 *
 * const applications = await queryDocuments({
 *   collectionName: 'applications',
 *   constraints: [
 *     where('jobPostingId', '==', jobPostingId),
 *     where('status', '==', 'confirmed'),
 *     orderBy('createdAt', 'desc'),
 *     limit(50),
 *   ],
 *   parser: parseApplicationDocument,
 * });
 */
export async function queryDocuments<T>(options: QueryDocumentsOptions<T>): Promise<T[]> {
  const { collectionName, constraints, parser } = options;

  const collectionRef = collection(getFirebaseDb(), collectionName);
  const q = query(collectionRef, ...constraints);
  const snapshot = await getDocs(q);

  const results: T[] = [];
  for (const docSnapshot of snapshot.docs) {
    const data = parser({ id: docSnapshot.id, ...docSnapshot.data() });
    if (data) {
      results.push(data);
    }
    // 파싱 실패한 문서는 건너뜀 (경고 로깅은 호출자 책임)
  }

  return results;
}

// ============================================================================
// Ownership Verification
// ============================================================================

/**
 * 문서 소유권 확인
 *
 * @description 문서 조회 + 소유자 확인을 한 번에 수행
 * @throws BusinessError - 문서가 없거나 파싱 실패 시
 * @throws PermissionError - 소유권이 없는 경우
 *
 * @example
 * const { data: job, ref } = await verifyOwnership({
 *   collectionName: 'jobPostings',
 *   documentId: jobPostingId,
 *   parser: parseJobPostingDocument,
 *   ownerField: 'ownerId',
 *   userId: currentUserId,
 *   permissionErrorMessage: '본인의 공고만 수정할 수 있습니다',
 * });
 *
 * // 소유권 확인 완료, 안전하게 업데이트 가능
 * await updateDoc(ref, { title: '새 제목' });
 */
export async function verifyOwnership<T extends Record<string, unknown>>(
  options: VerifyOwnershipOptions<T>
): Promise<DocumentResult<T>> {
  const {
    collectionName,
    documentId,
    parser,
    ownerField,
    userId,
    notFoundMessage,
    parseErrorMessage,
    permissionErrorMessage = '권한이 없습니다',
  } = options;

  const result = await getDocumentRequired({
    collectionName,
    documentId,
    parser,
    notFoundMessage,
    parseErrorMessage,
  });

  if (result.data[ownerField] !== userId) {
    throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
      userMessage: permissionErrorMessage,
      metadata: {
        collectionName,
        documentId,
        ownerField,
        expectedOwner: userId,
        actualOwner: result.data[ownerField],
      },
    });
  }

  return result;
}

// ============================================================================
// Batch Helpers
// ============================================================================

/**
 * 여러 문서 배치 조회 (부분 실패 허용)
 *
 * @description Promise.allSettled 기반으로 일부 실패해도 나머지 결과 반환
 * @returns Map<documentId, parsedData>
 *
 * @example
 * const jobPostingIds = ['job1', 'job2', 'job3'];
 * const jobMap = await batchGetDocuments({
 *   collectionName: 'jobPostings',
 *   documentIds: jobPostingIds,
 *   parser: parseJobPostingDocument,
 * });
 *
 * // 성공한 문서만 Map에 포함
 * const job1 = jobMap.get('job1'); // JobPosting | undefined
 */
export async function batchGetDocuments<T>(options: {
  collectionName: string;
  documentIds: string[];
  parser: DocumentParser<T>;
}): Promise<Map<string, T>> {
  const { collectionName, documentIds, parser } = options;

  // 중복 제거
  const uniqueIds = [...new Set(documentIds)];

  const promises = uniqueIds.map(async (docId) => {
    const ref = doc(getFirebaseDb(), collectionName, docId);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return { docId, data: null };
    }

    return {
      docId,
      data: parser({ id: snapshot.id, ...snapshot.data() }),
    };
  });

  const results = await Promise.allSettled(promises);
  const resultMap = new Map<string, T>();

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.data) {
      resultMap.set(result.value.docId, result.value.data);
    }
    // 실패한 경우는 Map에 추가하지 않음 (호출자가 누락된 ID 확인 가능)
  }

  return resultMap;
}

/**
 * 문서 참조 생성 헬퍼
 *
 * @description doc(db, collection, id) 패턴 간소화
 *
 * @example
 * const ref = getDocRef('jobPostings', jobPostingId);
 * await updateDoc(ref, { status: 'closed' });
 */
export function getDocRef(collectionName: string, documentId: string): DocumentReference {
  return doc(getFirebaseDb(), collectionName, documentId);
}
