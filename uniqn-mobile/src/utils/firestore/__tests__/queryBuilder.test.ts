/**
 * queryBuilder 테스트
 *
 * @description Firestore 쿼리 빌더 유틸리티 테스트
 * - QueryBuilder 클래스: where, orderBy, limit, paginate, build 등
 * - processPaginatedResults: 페이지네이션 결과 처리
 * - processPaginatedResultsWithFilter: 필터 포함 페이지네이션 결과
 * - buildQuery: 함수형 쿼리 빌더
 */

// ============================================================================
// Firebase Firestore Mocks
// ============================================================================

jest.mock('firebase/firestore', () => {
  const mockQuery = jest.fn((...args: unknown[]) => ({ __type: 'query', args }));
  const mockWhere = jest.fn((...args: unknown[]) => ({ __type: 'where', args }));
  const mockOrderBy = jest.fn((...args: unknown[]) => ({ __type: 'orderBy', args }));
  const mockLimit = jest.fn((n: number) => ({ __type: 'limit', n }));
  const mockStartAfter = jest.fn((doc: unknown) => ({ __type: 'startAfter', doc }));

  return {
    query: mockQuery,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    startAfter: mockStartAfter,
  };
});

import {
  QueryBuilder,
  processPaginatedResults,
  processPaginatedResultsWithFilter,
  buildQuery,
} from '../queryBuilder';
import type { CollectionReference, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  query as mockQuery,
  where as mockWhere,
  orderBy as mockOrderBy,
  limit as mockLimit,
  startAfter as mockStartAfter,
} from 'firebase/firestore';

// ============================================================================
// Helpers
// ============================================================================

function createMockCollectionRef(): CollectionReference<DocumentData> {
  return { __type: 'collectionRef' } as unknown as CollectionReference<DocumentData>;
}

function createMockDoc(id: string, data: Record<string, unknown> = {}): QueryDocumentSnapshot<DocumentData> {
  return {
    id,
    data: () => data,
    exists: () => true,
  } as unknown as QueryDocumentSnapshot<DocumentData>;
}

// ============================================================================
// QueryBuilder Class
// ============================================================================

describe('QueryBuilder', () => {
  let collectionRef: CollectionReference<DocumentData>;

  beforeEach(() => {
    collectionRef = createMockCollectionRef();
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Basic where
  // --------------------------------------------------------------------------

  describe('where', () => {
    it('where 조건을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      const result = qb.where('status', '==', 'active');

      expect(result).toBe(qb); // chaining
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active');
      expect(qb.getConstraintCount()).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // whereIf
  // --------------------------------------------------------------------------

  describe('whereIf', () => {
    it('condition이 truthy이고 value가 유효하면 where를 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereIf(true, 'status', '==', 'active');

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active');
      expect(qb.getConstraintCount()).toBe(1);
    });

    it('condition이 falsy이면 where를 추가하지 않는다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereIf(false, 'status', '==', 'active');

      expect(mockWhere).not.toHaveBeenCalled();
      expect(qb.getConstraintCount()).toBe(0);
    });

    it('value가 null이면 where를 추가하지 않는다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereIf(true, 'status', '==', null);

      expect(mockWhere).not.toHaveBeenCalled();
    });

    it('value가 undefined이면 where를 추가하지 않는다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereIf(true, 'status', '==', undefined);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // whereEqual
  // --------------------------------------------------------------------------

  describe('whereEqual', () => {
    it('== 연산을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereEqual('status', 'active');

      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active');
    });

    it('value가 null이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereEqual('status', null);

      expect(mockWhere).not.toHaveBeenCalled();
    });

    it('value가 undefined이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereEqual('status', undefined);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // whereNotEqual
  // --------------------------------------------------------------------------

  describe('whereNotEqual', () => {
    it('!= 연산을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereNotEqual('status', 'closed');

      expect(mockWhere).toHaveBeenCalledWith('status', '!=', 'closed');
    });

    it('value가 null이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereNotEqual('status', null);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // whereIn
  // --------------------------------------------------------------------------

  describe('whereIn', () => {
    it('in 연산을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereIn('status', ['active', 'closed']);

      expect(mockWhere).toHaveBeenCalledWith('status', 'in', ['active', 'closed']);
    });

    it('최대 30개까지 잘라낸다', () => {
      const values = Array.from({ length: 35 }, (_, i) => `val-${i}`);
      const qb = new QueryBuilder(collectionRef);
      qb.whereIn('field', values);

      expect(mockWhere).toHaveBeenCalledWith('field', 'in', values.slice(0, 30));
    });

    it('빈 배열이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereIn('status', []);

      expect(mockWhere).not.toHaveBeenCalled();
    });

    it('undefined이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereIn('status', undefined);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // whereNotIn
  // --------------------------------------------------------------------------

  describe('whereNotIn', () => {
    it('not-in 연산을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereNotIn('status', ['cancelled']);

      expect(mockWhere).toHaveBeenCalledWith('status', 'not-in', ['cancelled']);
    });

    it('최대 10개까지 잘라낸다', () => {
      const values = Array.from({ length: 15 }, (_, i) => `val-${i}`);
      const qb = new QueryBuilder(collectionRef);
      qb.whereNotIn('field', values);

      expect(mockWhere).toHaveBeenCalledWith('field', 'not-in', values.slice(0, 10));
    });

    it('빈 배열이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereNotIn('status', []);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // whereArrayContains / whereArrayContainsAny
  // --------------------------------------------------------------------------

  describe('whereArrayContains', () => {
    it('array-contains 연산을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereArrayContains('tags', 'urgent');

      expect(mockWhere).toHaveBeenCalledWith('tags', 'array-contains', 'urgent');
    });

    it('value가 null이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereArrayContains('tags', null);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  describe('whereArrayContainsAny', () => {
    it('array-contains-any 연산을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereArrayContainsAny('tags', ['urgent', 'regular']);

      expect(mockWhere).toHaveBeenCalledWith('tags', 'array-contains-any', ['urgent', 'regular']);
    });

    it('최대 10개까지 잘라낸다', () => {
      const values = Array.from({ length: 15 }, (_, i) => `tag-${i}`);
      const qb = new QueryBuilder(collectionRef);
      qb.whereArrayContainsAny('tags', values);

      expect(mockWhere).toHaveBeenCalledWith('tags', 'array-contains-any', values.slice(0, 10));
    });

    it('빈 배열이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereArrayContainsAny('tags', []);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // whereDateRange
  // --------------------------------------------------------------------------

  describe('whereDateRange', () => {
    it('>= start, <= end 조건 2개를 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereDateRange('workDate', { start: '2025-01-01', end: '2025-01-31' });

      expect(mockWhere).toHaveBeenCalledTimes(2);
      expect(mockWhere).toHaveBeenCalledWith('workDate', '>=', '2025-01-01');
      expect(mockWhere).toHaveBeenCalledWith('workDate', '<=', '2025-01-31');
    });

    it('range가 undefined이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereDateRange('workDate', undefined);

      expect(mockWhere).not.toHaveBeenCalled();
    });

    it('start가 빈 문자열이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereDateRange('workDate', { start: '', end: '2025-01-31' });

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Comparison operators
  // --------------------------------------------------------------------------

  describe('comparison operators', () => {
    it('whereGreaterOrEqual: >= 조건 추가', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereGreaterOrEqual('amount', 100);

      expect(mockWhere).toHaveBeenCalledWith('amount', '>=', 100);
    });

    it('whereLessOrEqual: <= 조건 추가', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereLessOrEqual('amount', 1000);

      expect(mockWhere).toHaveBeenCalledWith('amount', '<=', 1000);
    });

    it('whereGreaterThan: > 조건 추가', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereGreaterThan('count', 0);

      expect(mockWhere).toHaveBeenCalledWith('count', '>', 0);
    });

    it('whereLessThan: < 조건 추가', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereLessThan('count', 100);

      expect(mockWhere).toHaveBeenCalledWith('count', '<', 100);
    });

    it('null 값은 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereGreaterOrEqual('a', null);
      qb.whereLessOrEqual('b', undefined);
      qb.whereGreaterThan('c', null);
      qb.whereLessThan('d', undefined);

      expect(mockWhere).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // orderBy
  // --------------------------------------------------------------------------

  describe('orderBy', () => {
    it('기본 direction은 asc이다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.orderBy('createdAt');

      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'asc');
    });

    it('desc를 지정할 수 있다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.orderBy('createdAt', 'desc');

      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('orderByDesc는 desc로 호출한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.orderByDesc('createdAt');

      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('orderByAsc는 asc로 호출한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.orderByAsc('createdAt');

      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'asc');
    });
  });

  // --------------------------------------------------------------------------
  // limit
  // --------------------------------------------------------------------------

  describe('limit', () => {
    it('limit 조건을 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.limit(20);

      expect(mockLimit).toHaveBeenCalledWith(20);
    });
  });

  // --------------------------------------------------------------------------
  // startAfter
  // --------------------------------------------------------------------------

  describe('startAfter', () => {
    it('doc이 있으면 startAfter를 추가한다', () => {
      const doc = createMockDoc('doc-1');
      const qb = new QueryBuilder(collectionRef);
      qb.startAfter(doc);

      expect(mockStartAfter).toHaveBeenCalledWith(doc);
    });

    it('doc이 undefined이면 무시한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.startAfter(undefined);

      expect(mockStartAfter).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // paginate
  // --------------------------------------------------------------------------

  describe('paginate', () => {
    it('lastDoc이 없으면 limit(pageSize+1)만 추가한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.paginate(20);

      expect(mockStartAfter).not.toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(21);
    });

    it('lastDoc이 있으면 startAfter + limit(pageSize+1)을 추가한다', () => {
      const doc = createMockDoc('last-doc');
      const qb = new QueryBuilder(collectionRef);
      qb.paginate(20, doc);

      expect(mockStartAfter).toHaveBeenCalledWith(doc);
      expect(mockLimit).toHaveBeenCalledWith(21);
    });
  });

  // --------------------------------------------------------------------------
  // build
  // --------------------------------------------------------------------------

  describe('build', () => {
    it('collectionRef와 모든 constraints를 query()에 전달한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereEqual('status', 'active');
      qb.orderByDesc('createdAt');
      qb.limit(20);

      qb.build();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const callArgs = (mockQuery as jest.Mock).mock.calls[0]!;
      expect(callArgs[0]).toBe(collectionRef);
      expect(callArgs.length).toBe(4); // collectionRef + 3 constraints
    });
  });

  // --------------------------------------------------------------------------
  // getConstraints / getConstraintCount
  // --------------------------------------------------------------------------

  describe('getConstraints / getConstraintCount', () => {
    it('getConstraints는 constraints 복사본을 반환한다', () => {
      const qb = new QueryBuilder(collectionRef);
      qb.whereEqual('status', 'active');

      const constraints = qb.getConstraints();
      expect(constraints).toHaveLength(1);

      // 원본에 영향을 주지 않는다
      constraints.push({} as any);
      expect(qb.getConstraintCount()).toBe(1);
    });

    it('getConstraintCount는 constraints 수를 반환한다', () => {
      const qb = new QueryBuilder(collectionRef);
      expect(qb.getConstraintCount()).toBe(0);

      qb.whereEqual('status', 'active');
      expect(qb.getConstraintCount()).toBe(1);

      qb.orderByDesc('createdAt');
      expect(qb.getConstraintCount()).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Method chaining
  // --------------------------------------------------------------------------

  describe('method chaining', () => {
    it('모든 메서드가 this를 반환하여 체이닝이 가능하다', () => {
      const qb = new QueryBuilder(collectionRef);

      const result = qb
        .whereEqual('status', 'active')
        .whereIf(true, 'district', '==', '강남구')
        .whereIn('type', ['regular', 'urgent'])
        .whereNotIn('excludeType', ['draft'])
        .whereArrayContains('tags', 'hot')
        .whereArrayContainsAny('roles', ['dealer', 'floor'])
        .whereDateRange('date', { start: '2025-01-01', end: '2025-01-31' })
        .whereGreaterOrEqual('salary', 10000)
        .whereLessOrEqual('salary', 50000)
        .whereGreaterThan('count', 0)
        .whereLessThan('count', 100)
        .whereNotEqual('status', 'deleted')
        .orderByDesc('createdAt')
        .orderByAsc('title')
        .paginate(20);

      expect(result).toBe(qb);
      expect(qb.getConstraintCount()).toBeGreaterThan(10);
    });
  });
});

// ============================================================================
// processPaginatedResults
// ============================================================================

describe('processPaginatedResults', () => {
  it('docs가 pageSize보다 많으면 hasMore: true', () => {
    const docs = [
      createMockDoc('1', { name: 'a' }),
      createMockDoc('2', { name: 'b' }),
      createMockDoc('3', { name: 'c' }),
    ];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data(),
    });

    const result = processPaginatedResults(docs, 2, mapper);

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.lastDoc).toBe(docs[1]);
  });

  it('docs가 pageSize 이하이면 hasMore: false', () => {
    const docs = [
      createMockDoc('1', { name: 'a' }),
      createMockDoc('2', { name: 'b' }),
    ];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
    });

    const result = processPaginatedResults(docs, 2, mapper);

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.lastDoc).toBe(docs[1]);
  });

  it('빈 docs이면 items: [], lastDoc: null, hasMore: false', () => {
    const result = processPaginatedResults([], 20, () => ({}));

    expect(result.items).toEqual([]);
    expect(result.lastDoc).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it('mapper로 문서 데이터를 변환한다', () => {
    const docs = [createMockDoc('1', { title: '공고1' })];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      title: doc.data().title,
    });

    const result = processPaginatedResults(docs, 10, mapper);
    expect(result.items[0]).toEqual({ id: '1', title: '공고1' });
  });
});

// ============================================================================
// processPaginatedResultsWithFilter
// ============================================================================

describe('processPaginatedResultsWithFilter', () => {
  it('mapper가 null을 반환하면 해당 항목을 제외한다', () => {
    const docs = [
      createMockDoc('1', { valid: true }),
      createMockDoc('2', { valid: false }),
    ];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      return data.valid ? { id: doc.id } : null;
    };

    const result = processPaginatedResultsWithFilter(docs, 10, mapper);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe('1');
  });

  it('filter 함수로 추가 필터링을 적용한다', () => {
    const docs = [
      createMockDoc('1', { name: 'a' }),
      createMockDoc('2', { name: 'b' }),
      createMockDoc('3', { name: 'c' }),
    ];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      name: doc.data().name as string,
    });
    const filter = (item: { id: string; name: string }) => item.name !== 'b';

    const result = processPaginatedResultsWithFilter(docs, 10, mapper, filter);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.name)).toEqual(['a', 'c']);
  });

  it('filter가 없으면 모든 매핑 결과를 반환한다', () => {
    const docs = [
      createMockDoc('1', {}),
      createMockDoc('2', {}),
    ];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id });

    const result = processPaginatedResultsWithFilter(docs, 10, mapper);
    expect(result.items).toHaveLength(2);
  });

  it('hasMore는 원본 docs 기준으로 판단한다', () => {
    const docs = [
      createMockDoc('1', {}),
      createMockDoc('2', {}),
      createMockDoc('3', {}),
    ];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id });

    const result = processPaginatedResultsWithFilter(docs, 2, mapper);
    expect(result.hasMore).toBe(true);
  });

  it('결과를 pageSize로 자른다', () => {
    const docs = Array.from({ length: 5 }, (_, i) => createMockDoc(`${i}`, {}));
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id });

    const result = processPaginatedResultsWithFilter(docs, 3, mapper);
    expect(result.items).toHaveLength(3);
  });

  it('lastDoc은 원본 docs의 마지막 문서이다', () => {
    const docs = [
      createMockDoc('1', {}),
      createMockDoc('2', {}),
    ];
    const mapper = (doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id });

    const result = processPaginatedResultsWithFilter(docs, 10, mapper);
    expect(result.lastDoc).toBe(docs[1]);
  });

  it('빈 docs이면 lastDoc: null', () => {
    const result = processPaginatedResultsWithFilter([], 10, () => ({}));
    expect(result.lastDoc).toBeNull();
  });
});

// ============================================================================
// buildQuery (함수형)
// ============================================================================

describe('buildQuery', () => {
  it('콜백에 QueryBuilder를 전달하고 build 결과를 반환한다', () => {
    const collectionRef = createMockCollectionRef();
    const result = buildQuery(collectionRef, (qb) =>
      qb.whereEqual('status', 'active').orderByDesc('createdAt')
    );

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });
});
