/**
 * UNIQN Mobile - Firestore 쿼리 빌더 유틸리티
 *
 * @description 조건부 쿼리 조합을 위한 타입 안전한 빌더
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * const q = new QueryBuilder(jobsRef)
 *   .whereEqual('status', 'active')
 *   .whereIf(!!filters?.district, 'location.district', '==', filters?.district)
 *   .whereArrayContainsAny('roles', filters?.roles?.slice(0, 10))
 *   .orderByDesc('createdAt')
 *   .paginate(pageSize, lastDoc)
 *   .build();
 *
 * const snapshot = await getDocs(q);
 * const result = processPaginatedResults(snapshot.docs, pageSize, mapDoc);
 * ```
 */

import {
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type CollectionReference,
  type Query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type WhereFilterOp,
  type OrderByDirection,
} from 'firebase/firestore';

// ============================================================================
// Types
// ============================================================================

/**
 * 페이지네이션 결과
 */
export interface PaginatedResult<T> {
  /** 조회된 아이템 목록 */
  items: T[];
  /** 마지막 문서 (다음 페이지 조회용) */
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  /** 다음 페이지 존재 여부 */
  hasMore: boolean;
}

/**
 * 날짜 범위 필터
 */
export interface DateRange {
  start: string;
  end: string;
}

// ============================================================================
// QueryBuilder Class
// ============================================================================

/**
 * Firestore 쿼리 빌더
 *
 * @description 조건부 where/orderBy/limit을 체이닝하여 쿼리 구성
 * 기존 constraints 배열 패턴을 대체하여 가독성과 재사용성 향상
 *
 * @example
 * ```typescript
 * const q = new QueryBuilder(jobsRef)
 *   .whereEqual('status', 'active')
 *   .whereIf(filters?.district, 'location.district', '==', filters?.district)
 *   .orderByDesc('createdAt')
 *   .paginate(20, lastDoc)
 *   .build();
 * ```
 */
export class QueryBuilder<T = DocumentData> {
  private collectionRef: CollectionReference<T>;
  private constraints: QueryConstraint[] = [];

  constructor(collectionRef: CollectionReference<T>) {
    this.collectionRef = collectionRef;
  }

  /**
   * where 조건 추가
   */
  where(field: string, operator: WhereFilterOp, value: unknown): this {
    this.constraints.push(where(field, operator, value));
    return this;
  }

  /**
   * 조건부 where (condition이 truthy이고 value가 유효할 때만 추가)
   *
   * @example
   * .whereIf(!!filters?.status, 'status', '==', filters?.status)
   */
  whereIf(
    condition: boolean | unknown,
    field: string,
    operator: WhereFilterOp,
    value: unknown
  ): this {
    if (condition && value !== undefined && value !== null) {
      this.constraints.push(where(field, operator, value));
    }
    return this;
  }

  /**
   * == 연산 단축
   */
  whereEqual(field: string, value: unknown): this {
    if (value !== undefined && value !== null) {
      this.constraints.push(where(field, '==', value));
    }
    return this;
  }

  /**
   * != 연산
   */
  whereNotEqual(field: string, value: unknown): this {
    if (value !== undefined && value !== null) {
      this.constraints.push(where(field, '!=', value));
    }
    return this;
  }

  /**
   * in 연산 (최대 30개)
   */
  whereIn(field: string, values?: unknown[]): this {
    if (values && values.length > 0) {
      // Firestore in 연산자는 최대 30개까지
      this.constraints.push(where(field, 'in', values.slice(0, 30)));
    }
    return this;
  }

  /**
   * not-in 연산 (최대 10개)
   */
  whereNotIn(field: string, values?: unknown[]): this {
    if (values && values.length > 0) {
      // Firestore not-in 연산자는 최대 10개까지
      this.constraints.push(where(field, 'not-in', values.slice(0, 10)));
    }
    return this;
  }

  /**
   * array-contains 연산
   */
  whereArrayContains(field: string, value?: unknown): this {
    if (value !== undefined && value !== null) {
      this.constraints.push(where(field, 'array-contains', value));
    }
    return this;
  }

  /**
   * array-contains-any 연산 (최대 10개)
   */
  whereArrayContainsAny(field: string, values?: unknown[]): this {
    if (values && values.length > 0) {
      // Firestore array-contains-any 연산자는 최대 10개까지
      this.constraints.push(where(field, 'array-contains-any', values.slice(0, 10)));
    }
    return this;
  }

  /**
   * 날짜 범위 필터 (>= start && <= end)
   *
   * @example
   * .whereDateRange('workDate', { start: '2025-01-01', end: '2025-01-31' })
   */
  whereDateRange(field: string, range?: DateRange): this {
    if (range && range.start && range.end) {
      this.constraints.push(where(field, '>=', range.start));
      this.constraints.push(where(field, '<=', range.end));
    }
    return this;
  }

  /**
   * >= 연산 (날짜, 숫자 등)
   */
  whereGreaterOrEqual(field: string, value?: unknown): this {
    if (value !== undefined && value !== null) {
      this.constraints.push(where(field, '>=', value));
    }
    return this;
  }

  /**
   * <= 연산 (날짜, 숫자 등)
   */
  whereLessOrEqual(field: string, value?: unknown): this {
    if (value !== undefined && value !== null) {
      this.constraints.push(where(field, '<=', value));
    }
    return this;
  }

  /**
   * > 연산
   */
  whereGreaterThan(field: string, value?: unknown): this {
    if (value !== undefined && value !== null) {
      this.constraints.push(where(field, '>', value));
    }
    return this;
  }

  /**
   * < 연산
   */
  whereLessThan(field: string, value?: unknown): this {
    if (value !== undefined && value !== null) {
      this.constraints.push(where(field, '<', value));
    }
    return this;
  }

  /**
   * orderBy 추가
   */
  orderBy(field: string, direction: OrderByDirection = 'asc'): this {
    this.constraints.push(orderBy(field, direction));
    return this;
  }

  /**
   * orderBy desc 단축
   */
  orderByDesc(field: string): this {
    return this.orderBy(field, 'desc');
  }

  /**
   * orderBy asc 단축
   */
  orderByAsc(field: string): this {
    return this.orderBy(field, 'asc');
  }

  /**
   * limit 추가
   */
  limit(count: number): this {
    this.constraints.push(limit(count));
    return this;
  }

  /**
   * startAfter 추가 (커서 기반 페이지네이션)
   */
  startAfter(doc?: QueryDocumentSnapshot): this {
    if (doc) {
      this.constraints.push(startAfter(doc));
    }
    return this;
  }

  /**
   * 페이지네이션 (startAfter + limit(pageSize + 1))
   *
   * @description limit(pageSize + 1)로 다음 페이지 존재 여부를 확인
   *
   * @example
   * .paginate(20, lastDoc)
   */
  paginate(pageSize: number, lastDoc?: QueryDocumentSnapshot): this {
    if (lastDoc) {
      this.constraints.push(startAfter(lastDoc));
    }
    // +1로 다음 페이지 존재 여부 확인
    this.constraints.push(limit(pageSize + 1));
    return this;
  }

  /**
   * 최종 쿼리 빌드
   */
  build(): Query<T> {
    return query(this.collectionRef, ...this.constraints) as Query<T>;
  }

  /**
   * constraints 배열 반환 (디버깅/테스트용)
   */
  getConstraints(): QueryConstraint[] {
    return [...this.constraints];
  }

  /**
   * constraints 개수 반환
   */
  getConstraintCount(): number {
    return this.constraints.length;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 페이지네이션 결과 처리
 *
 * @description limit(pageSize + 1) 패턴의 hasMore 판정 자동화
 *
 * @example
 * ```typescript
 * const snapshot = await getDocs(q);
 * const result = processPaginatedResults(
 *   snapshot.docs,
 *   pageSize,
 *   (doc) => ({ id: doc.id, ...doc.data() } as JobPosting)
 * );
 * // { items: JobPosting[], lastDoc: DocumentSnapshot | null, hasMore: boolean }
 * ```
 */
export function processPaginatedResults<T>(
  docs: QueryDocumentSnapshot<DocumentData>[],
  pageSize: number,
  mapper: (doc: QueryDocumentSnapshot<DocumentData>) => T
): PaginatedResult<T> {
  const hasMore = docs.length > pageSize;
  const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const items = resultDocs.map(mapper);
  const lastDoc = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

  return { items, lastDoc, hasMore };
}

/**
 * 페이지네이션 결과 처리 (필터 포함)
 *
 * @description 클라이언트 사이드 필터링이 필요한 경우
 * 주의: 필터링 후 pageSize보다 적을 수 있음
 */
export function processPaginatedResultsWithFilter<T>(
  docs: QueryDocumentSnapshot<DocumentData>[],
  pageSize: number,
  mapper: (doc: QueryDocumentSnapshot<DocumentData>) => T | null,
  filter?: (item: T) => boolean
): PaginatedResult<T> {
  // 먼저 매핑 (null 반환 시 제외)
  const mappedItems = docs.map(mapper).filter((item): item is T => item !== null);

  // 필터 적용
  const filteredItems = filter ? mappedItems.filter(filter) : mappedItems;

  // hasMore는 원본 docs 기준
  const hasMore = docs.length > pageSize;
  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

  return {
    items: filteredItems.slice(0, pageSize),
    lastDoc,
    hasMore,
  };
}

/**
 * 함수형 쿼리 빌더 (클래스 대안)
 *
 * @description 더 간단한 사용 패턴이 필요할 때
 *
 * @example
 * ```typescript
 * const q = buildQuery(jobsRef, (qb) =>
 *   qb.whereEqual('status', 'active')
 *     .orderByDesc('createdAt')
 *     .paginate(20)
 * );
 * ```
 */
export function buildQuery<T = DocumentData>(
  collectionRef: CollectionReference<T>,
  builder: (qb: QueryBuilder<T>) => QueryBuilder<T>
): Query<T> {
  const qb = new QueryBuilder(collectionRef);
  return builder(qb).build();
}

// ============================================================================
// Exports
// ============================================================================

export type {
  QueryConstraint,
  CollectionReference,
  Query,
  DocumentData,
  QueryDocumentSnapshot,
  WhereFilterOp,
  OrderByDirection,
};
