/**
 * Firestore Hook 라이브러리 타입 정의
 *
 * @description
 * 공통 Firestore Hook을 위한 타입 정의입니다.
 * React Query 패턴을 참고하여 설계되었습니다.
 *
 * @version 1.0.0
 * @since 2025-11-22
 * @feature Phase 3-3 Firestore Hook 라이브러리
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - TypeScript Generic 활용
 * - 타입 안전성 100%
 * - React Query 패턴 준수
 * - 에러 핸들링 통합
 */

import type { DocumentData, QueryConstraint, Query } from 'firebase/firestore';

/**
 * Firestore Hook 공통 상태
 *
 * @description
 * 모든 Firestore Hook이 공유하는 기본 상태 인터페이스입니다.
 */
export interface FirestoreHookState {
  /** 로딩 상태 */
  loading: boolean;

  /** 에러 객체 */
  error: Error | null;
}

/**
 * 컬렉션 Hook 반환 타입
 *
 * @template T - 문서 데이터 타입
 */
export interface FirestoreCollectionResult<T> extends FirestoreHookState {
  /** 컬렉션 문서 배열 */
  data: T[];

  /** 데이터 다시 가져오기 */
  refetch: () => void;
}

/**
 * 단일 문서 Hook 반환 타입
 *
 * @template T - 문서 데이터 타입
 */
export interface FirestoreDocumentResult<T> extends FirestoreHookState {
  /** 문서 데이터 (없으면 null) */
  data: T | null;

  /** 문서 업데이트 함수 */
  update: (data: Partial<T>) => Promise<void>;

  /** 데이터 다시 가져오기 */
  refetch: () => void;
}

/**
 * 쿼리 Hook 반환 타입
 *
 * @template T - 문서 데이터 타입
 */
export interface FirestoreQueryResult<T> extends FirestoreHookState {
  /** 쿼리 결과 문서 배열 */
  data: T[];

  /** 데이터 다시 가져오기 */
  refetch: () => void;
}

/**
 * Mutation Hook 반환 타입
 *
 * @template T - 문서 데이터 타입
 */
export interface FirestoreMutationResult<T> {
  /** 문서 생성 */
  create: (collectionPath: string, data: T) => Promise<string>;

  /** 문서 업데이트 */
  update: (docPath: string, data: Partial<T>) => Promise<void>;

  /** 문서 삭제 */
  delete: (docPath: string) => Promise<void>;

  /** Mutation 진행 중 여부 */
  loading: boolean;

  /** Mutation 에러 */
  error: Error | null;
}

/**
 * Firestore 문서 타입
 *
 * @description
 * Firestore에서 가져온 문서는 항상 id 필드를 포함합니다.
 *
 * @template T - 원본 문서 데이터 타입
 */
export type FirestoreDocument<T> = T & {
  /** Firestore 문서 ID */
  id: string;
};

/**
 * Firestore Hook 옵션
 *
 * @description
 * Hook 동작을 제어하는 공통 옵션입니다.
 */
export interface FirestoreHookOptions {
  /** 자동 구독 활성화 여부 (기본값: true) */
  enabled?: boolean;

  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;

  /** 성공 시 콜백 */
  onSuccess?: () => void;

  /** 의존성 배열 (useEffect deps와 동일) */
  deps?: React.DependencyList;
}

/**
 * 컬렉션 Hook 옵션
 */
export interface CollectionHookOptions extends FirestoreHookOptions {
  /** 쿼리 제약 조건 */
  queryConstraints?: QueryConstraint[];
}

/**
 * 문서 Hook 옵션
 */
export interface DocumentHookOptions extends FirestoreHookOptions {
  /** 문서가 없을 때 에러로 처리할지 여부 (기본값: false) */
  errorOnNotFound?: boolean;
}

/**
 * 쿼리 Hook 옵션
 */
export interface QueryHookOptions extends FirestoreHookOptions {
  /** 쿼리 객체 */
  query: Query<DocumentData> | null;
}

/**
 * Mutation Hook 옵션
 */
export interface MutationHookOptions {
  /** 성공 시 콜백 */
  onSuccess?: () => void;

  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;
}

/**
 * Firestore 에러 타입
 *
 * @description
 * Firestore 작업 중 발생할 수 있는 에러 타입입니다.
 */
export type FirestoreError = Error & {
  /** Firestore 에러 코드 */
  code?: string;

  /** 에러 상세 메시지 */
  message: string;
};

/**
 * 구독 정리 함수 타입
 *
 * @description
 * onSnapshot 구독을 정리하는 함수 타입입니다.
 */
export type Unsubscribe = () => void;

/**
 * 문서 변환 함수 타입
 *
 * @description
 * Firestore DocumentSnapshot을 앱 데이터 타입으로 변환하는 함수입니다.
 *
 * @template T - 변환될 데이터 타입
 */
export type DocumentConverter<T> = (
  id: string,
  data: DocumentData
) => FirestoreDocument<T>;

/**
 * 기본 문서 변환 함수
 *
 * @description
 * DocumentSnapshot을 FirestoreDocument로 변환하는 기본 함수입니다.
 * 모든 Hook에서 공통으로 사용됩니다.
 *
 * @template T - 문서 데이터 타입
 * @param id - 문서 ID
 * @param data - 문서 데이터
 * @returns FirestoreDocument<T>
 *
 * @example
 * ```typescript
 * const staff = convertDocument<Staff>(doc.id, doc.data());
 * ```
 */
export function convertDocument<T>(
  id: string,
  data: DocumentData
): FirestoreDocument<T> {
  return {
    id,
    ...data,
  } as FirestoreDocument<T>;
}

/**
 * Firestore 경로 유틸리티
 *
 * @description
 * Firestore 경로를 파싱하고 검증하는 유틸리티입니다.
 */
export interface FirestorePath {
  /** 컬렉션 경로 */
  collection: string;

  /** 문서 ID (있는 경우) */
  documentId?: string;

  /** 전체 경로 */
  fullPath: string;
}

/**
 * Firestore 경로 파싱
 *
 * @param path - Firestore 경로 (예: 'users/abc/posts/123')
 * @returns FirestorePath 객체
 *
 * @example
 * ```typescript
 * parsePath('users/abc'); // { collection: 'users', documentId: 'abc', fullPath: 'users/abc' }
 * parsePath('users'); // { collection: 'users', fullPath: 'users' }
 * ```
 */
export function parsePath(path: string): FirestorePath {
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Invalid Firestore path: empty path');
  }

  if (parts.length % 2 === 0) {
    // 짝수: 문서 경로 (collection/doc)
    const documentId = parts[parts.length - 1];
    const collection = parts.slice(0, -1).join('/');
    return { collection, documentId, fullPath: path };
  } else {
    // 홀수: 컬렉션 경로 (collection)
    return { collection: path, fullPath: path };
  }
}

/**
 * Firestore 경로 검증
 *
 * @param path - 검증할 경로
 * @returns 유효 여부
 */
export function isValidPath(path: string): boolean {
  try {
    parsePath(path);
    return true;
  } catch {
    return false;
  }
}
