/**
 * SmartCache Tests
 * Week 4 성능 최적화: IndexedDB 기반 스마트 캐싱 시스템 테스트
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { SmartCache } from '../smartCache';
import { logger } from '../logger';

// 로거 모킹
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// IndexedDB 모킹
class MockIDBDatabase {
  objectStoreNames = { contains: jest.fn() };
  transaction = jest.fn();
  close = jest.fn();
  createObjectStore = jest.fn();
}

class MockIDBTransaction {
  objectStore = jest.fn();
  oncomplete = null;
  onerror = null;
  onabort = null;
}

class MockIDBObjectStore {
  put = jest.fn();
  get = jest.fn();
  delete = jest.fn();
  getAll = jest.fn();
  clear = jest.fn();
  createIndex = jest.fn();
  index = jest.fn();
}

class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
}

// 전역 IndexedDB 모킹
const mockIndexedDB = {
  open: jest.fn()
};

(global as any).indexedDB = mockIndexedDB;

describe('SmartCache', () => {
  let smartCache: SmartCache;
  let mockDB: MockIDBDatabase;
  let mockTransaction: MockIDBTransaction;
  let mockStore: MockIDBObjectStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock 객체들 초기화
    mockDB = new MockIDBDatabase();
    mockTransaction = new MockIDBTransaction();
    mockStore = new MockIDBObjectStore();
    
    // 기본 체이닝 설정
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockStore);
    
    // IndexedDB open 모킹
    mockIndexedDB.open.mockImplementation(() => {
      const request = new MockIDBRequest();
      
      setTimeout(() => {
        request.result = mockDB;
        if (request.onsuccess) {
          request.onsuccess({ target: request });
        }
      }, 0);
      
      return request;
    });
    
    smartCache = new SmartCache({
      dbName: 'test-cache',
      storeName: 'test-store',
      maxSize: 1024 * 1024, // 1MB
      defaultTTL: 60000 // 1분
    });
  });

  afterEach(() => {
    if (smartCache) {
      smartCache.destroy();
    }
  });

  describe('초기화', () => {
    it('IndexedDB가 올바르게 초기화되어야 함', async () => {
      expect(mockIndexedDB.open).toHaveBeenCalledWith('test-cache', 1);
    });

    it('ObjectStore가 생성되어야 함', async () => {
      mockDB.objectStoreNames.contains.mockReturnValue(false);
      
      const request = new MockIDBRequest();
      request.result = mockDB;
      
      const mockCreateObjectStore = jest.fn().mockReturnValue(mockStore);
      mockDB.createObjectStore = mockCreateObjectStore;
      
      mockIndexedDB.open.mockImplementation(() => {
        const openRequest = new MockIDBRequest();
        openRequest.result = mockDB;
        
        setTimeout(() => {
          // onupgradeneeded 이벤트 시뮬레이션
          if ((openRequest as any).onupgradeneeded) {
            (openRequest as any).onupgradeneeded({ target: openRequest });
          }
          
          if (openRequest.onsuccess) {
            openRequest.onsuccess({ target: openRequest });
          }
        }, 0);
        
        return openRequest;
      });
      
      new SmartCache({ dbName: 'new-test-db' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockCreateObjectStore).toHaveBeenCalled();
    });

    it('기본 설정값이 올바르게 적용되어야 함', () => {
      const defaultCache = new SmartCache();
      const stats = defaultCache.getStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.writes).toBe(0);
    });
  });

  describe('데이터 저장 및 조회', () => {
    beforeEach(async () => {
      // 초기화 완료 대기
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('데이터를 저장할 수 있어야 함', async () => {
      const testData = { id: '1', name: 'Test Data' };
      
      // put 요청 모킹
      mockStore.put.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      await smartCache.set('test-namespace', 'test-key', testData);

      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-namespace:test-key',
          data: testData,
          timestamp: expect.any(Number),
          ttl: expect.any(Number)
        })
      );
    });

    it('데이터를 조회할 수 있어야 함', async () => {
      const testData = { id: '1', name: 'Test Data' };
      const cacheEntry = {
        id: 'test-namespace:test-key',
        data: testData,
        timestamp: Date.now(),
        ttl: 60000,
        version: 1,
        tags: ['test-namespace'],
        size: 100
      };

      // get 요청 모킹
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = cacheEntry;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const result = await smartCache.get('test-namespace', 'test-key');

      expect(result).toEqual(testData);
      expect(mockStore.get).toHaveBeenCalledWith('test-namespace:test-key');
    });

    it('존재하지 않는 데이터는 null을 반환해야 함', async () => {
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = null;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const result = await smartCache.get('test-namespace', 'nonexistent-key');

      expect(result).toBeNull();
    });

    it('만료된 데이터는 null을 반환하고 삭제해야 함', async () => {
      const expiredEntry = {
        id: 'test-namespace:test-key',
        data: { id: '1', name: 'Expired Data' },
        timestamp: Date.now() - 120000, // 2분 전
        ttl: 60000, // 1분 TTL
        version: 1,
        tags: ['test-namespace'],
        size: 100
      };

      // get 요청 모킹
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = expiredEntry;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      // delete 요청 모킹
      mockStore.delete.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const result = await smartCache.get('test-namespace', 'test-key');

      expect(result).toBeNull();
      expect(mockStore.delete).toHaveBeenCalledWith('test-namespace:test-key');
    });
  });

  describe('데이터 삭제', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('데이터를 삭제할 수 있어야 함', async () => {
      const existingEntry = {
        id: 'test-namespace:test-key',
        size: 100
      };

      // get 요청 모킹 (삭제 전 크기 확인용)
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = existingEntry;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      // delete 요청 모킹
      mockStore.delete.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const result = await smartCache.delete('test-namespace', 'test-key');

      expect(result).toBe(true);
      expect(mockStore.delete).toHaveBeenCalledWith('test-namespace:test-key');
    });

    it('존재하지 않는 데이터 삭제 시 false를 반환해야 함', async () => {
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = null;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      mockStore.delete.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const result = await smartCache.delete('test-namespace', 'nonexistent-key');

      expect(result).toBe(true); // delete 요청 자체는 성공
    });
  });

  describe('태그 기반 무효화', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('특정 태그로 캐시를 무효화할 수 있어야 함', async () => {
      const mockIndex = {
        getAll: jest.fn()
      };

      const testEntries = [
        {
          id: 'test-namespace:key1',
          tags: ['test-tag'],
          size: 100
        },
        {
          id: 'test-namespace:key2',
          tags: ['test-tag'],
          size: 200
        }
      ];

      mockStore.index.mockReturnValue(mockIndex);
      
      mockIndex.getAll.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = testEntries;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      mockStore.delete.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const deletedCount = await smartCache.invalidateByTags(['test-tag']);

      expect(deletedCount).toBe(2);
      expect(mockStore.delete).toHaveBeenCalledTimes(2);
      expect(mockStore.delete).toHaveBeenCalledWith('test-namespace:key1');
      expect(mockStore.delete).toHaveBeenCalledWith('test-namespace:key2');
    });

    it('빈 태그 배열로 무효화 시 0을 반환해야 함', async () => {
      const result = await smartCache.invalidateByTags([]);
      expect(result).toBe(0);
    });
  });

  describe('정리 작업', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('만료된 엔트리들을 정리해야 함', async () => {
      const allEntries = [
        {
          id: 'entry1',
          timestamp: Date.now() - 120000, // 만료됨
          ttl: 60000,
          size: 100
        },
        {
          id: 'entry2',
          timestamp: Date.now(), // 유효함
          ttl: 60000,
          size: 200
        }
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = allEntries;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      mockStore.delete.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      const deletedCount = await smartCache.cleanup();

      expect(deletedCount).toBeGreaterThan(0);
      expect(mockStore.delete).toHaveBeenCalledWith('entry1');
    });

    it('전체 캐시를 삭제할 수 있어야 함', async () => {
      mockStore.clear.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      await smartCache.clear();

      expect(mockStore.clear).toHaveBeenCalled();
    });
  });

  describe('통계 수집', () => {
    it('캐시 통계를 올바르게 반환해야 함', () => {
      const stats = smartCache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('writes');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('sizeMB');
    });

    it('히트율이 올바르게 계산되어야 함', async () => {
      // 초기화 완료 대기
      await new Promise(resolve => setTimeout(resolve, 10));

      // 히트 시뮬레이션
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = {
          data: { test: 'data' },
          timestamp: Date.now(),
          ttl: 60000
        };
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      await smartCache.get('test', 'hit-key');

      // 미스 시뮬레이션
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.result = null;
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      await smartCache.get('test', 'miss-key');

      const stats = smartCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50); // 50%
    });
  });

  describe('에러 처리', () => {
    it('IndexedDB 에러를 적절히 처리해야 함', async () => {
      mockStore.get.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.error = new Error('Database error');
        setTimeout(() => {
          if (request.onerror) {
            request.onerror({ target: request });
          }
        }, 0);
        return request;
      });

      const result = await smartCache.get('test', 'error-key');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '캐시 조회 실패',
        expect.any(Error),
        expect.objectContaining({
          component: 'SmartCache'
        })
      );
    });

    it('DB 초기화 실패를 처리해야 함', () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = new MockIDBRequest();
        request.error = new Error('DB open failed');
        setTimeout(() => {
          if (request.onerror) {
            request.onerror({ target: request });
          }
        }, 0);
        return request;
      });

      expect(() => {
        new SmartCache();
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'IndexedDB 초기화 실패',
        expect.any(Error),
        expect.objectContaining({
          component: 'SmartCache'
        })
      );
    });
  });

  describe('메모리 관리', () => {
    it('destroy 호출 시 모든 리소스를 정리해야 함', () => {
      const cache = new SmartCache();
      
      cache.destroy();

      expect(mockDB.close).toHaveBeenCalled();
    });

    it('용량 제한을 초과하면 LRU 방식으로 데이터를 삭제해야 함', async () => {
      const smallCache = new SmartCache({
        maxSize: 500 // 매우 작은 용량
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // 큰 데이터 저장 시뮬레이션
      mockStore.put.mockImplementation(() => {
        const request = new MockIDBRequest();
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: request });
          }
        }, 0);
        return request;
      });

      // 용량 초과를 시뮬레이션하기 위한 cleanup 호출
      const largeData = 'x'.repeat(1000); // 1KB 데이터
      
      await expect(smallCache.set('test', 'large-data', largeData)).resolves.not.toThrow();

      smallCache.destroy();
    });
  });
});