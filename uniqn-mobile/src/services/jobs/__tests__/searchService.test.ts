/**
 * UNIQN Mobile - Search Service Tests
 *
 * @description 검색 서비스 추상화 레이어 테스트
 * @version 1.0.0
 */

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => {
  class MockBusinessError extends Error {
    code: string;
    userMessage: string;
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage ?? 'Business error');
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = options?.userMessage ?? 'Business error';
    }
  }
  return {
    ...jest.requireActual('@/errors'),
    BusinessError: MockBusinessError,
    ERROR_CODES: { UNKNOWN: 'E7001' },
    isAppError: jest.fn(() => false),
  };
});

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  ClientSideSearchProvider,
  AlgoliaSearchProvider,
  createSearchProvider,
  CURRENT_SEARCH_PROVIDER,
} from '../searchService';
import type { JobPosting } from '@/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockJobPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    title: '강남 홀덤펍 딜러 모집',
    description: '경험자 우대합니다',
    ownerId: 'owner-1',
    ownerName: '홀덤킹',
    location: { name: '서울 강남구', address: '강남구 테헤란로 123' } as any,
    status: 'active',
    roles: [],
    filledPositions: 0,
    viewCount: 100,
    workDate: '2025-01-20',
    createdAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    updatedAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    ...overrides,
  } as JobPosting;
}

// ============================================================================
// Tests
// ============================================================================

describe('SearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // ClientSideSearchProvider
  // ==========================================================================
  describe('ClientSideSearchProvider', () => {
    let provider: ClientSideSearchProvider;
    let mockFetcher: jest.Mock;

    const sampleJobs: JobPosting[] = [
      createMockJobPosting({
        id: 'job-1',
        title: '강남 홀덤펍 딜러 모집',
        ownerName: '홀덤킹',
        viewCount: 100,
        workDate: '2025-01-20',
      }),
      createMockJobPosting({
        id: 'job-2',
        title: '역삼 포커룸 플로어 구인',
        ownerName: '포커하우스',
        location: { name: '서울 역삼동', address: '역삼동 456' } as any,
        viewCount: 50,
        workDate: '2025-01-22',
      }),
      createMockJobPosting({
        id: 'job-3',
        title: '잠실 딜러 급구',
        ownerName: '잠실펍',
        location: { name: '서울 잠실', address: '잠실동 789' } as any,
        viewCount: 200,
        workDate: '2025-01-18',
      }),
    ];

    beforeEach(() => {
      mockFetcher = jest.fn().mockResolvedValue(sampleJobs);
      provider = new ClientSideSearchProvider(mockFetcher);
    });

    it('should have name "ClientSide"', () => {
      expect(provider.name).toBe('ClientSide');
    });

    describe('search', () => {
      it('should return all items when query is empty', async () => {
        const result = await provider.search('');

        expect(result.totalCount).toBe(3);
        expect(result.items).toHaveLength(3);
        expect(result.searchTime).toBeDefined();
      });

      it('should return all items when query is whitespace', async () => {
        const result = await provider.search('   ');

        expect(result.totalCount).toBe(3);
      });

      it('should filter items by title', async () => {
        const result = await provider.search('딜러');

        expect(result.totalCount).toBe(2);
        expect(result.items.map((i) => i.id)).toContain('job-1');
        expect(result.items.map((i) => i.id)).toContain('job-3');
      });

      it('should filter items by ownerName', async () => {
        const result = await provider.search('홀덤킹');

        expect(result.totalCount).toBe(1);
        expect(result.items[0].id).toBe('job-1');
      });

      it('should be case-insensitive', async () => {
        const result = await provider.search('강남');

        expect(result.totalCount).toBe(1);
        expect(result.items[0].id).toBe('job-1');
      });

      it('should respect limit option', async () => {
        const result = await provider.search('', { limit: 2 });

        expect(result.items).toHaveLength(2);
        expect(result.totalCount).toBe(3); // total is still 3
      });

      it('should default limit to 20', async () => {
        const manyJobs = Array.from({ length: 25 }, (_, i) =>
          createMockJobPosting({ id: `job-${i}`, title: `공고 ${i}` })
        );
        mockFetcher.mockResolvedValue(manyJobs);

        const result = await provider.search('');

        expect(result.items).toHaveLength(20);
        expect(result.totalCount).toBe(25);
      });

      it('should return no items when nothing matches', async () => {
        const result = await provider.search('존재하지않는검색어');

        expect(result.totalCount).toBe(0);
        expect(result.items).toHaveLength(0);
      });

      it('should include searchTime in results', async () => {
        const result = await provider.search('딜러');

        expect(typeof result.searchTime).toBe('number');
        expect(result.searchTime).toBeGreaterThanOrEqual(0);
      });
    });

    describe('search with fields option', () => {
      it('should search only specified fields', async () => {
        const result = await provider.search('홀덤킹', { fields: ['title'] });

        // ownerName '홀덤킹' should not match when searching only 'title'
        expect(result.totalCount).toBe(0);
      });

      it('should find results in specified fields', async () => {
        const result = await provider.search('딜러', { fields: ['title'] });

        expect(result.totalCount).toBe(2);
      });
    });

    describe('search with sortBy option', () => {
      it('should sort by date (newest first)', async () => {
        // Use a query that matches all items (all descriptions contain '우대')
        mockFetcher.mockResolvedValue(
          sampleJobs.map((j) => ({
            ...j,
            description: '경험자 우대합니다',
          }))
        );
        const result = await provider.search('우대', { sortBy: 'date' });

        expect(result.totalCount).toBe(3);
        expect(result.items[0].workDate).toBe('2025-01-22');
        expect(result.items[1].workDate).toBe('2025-01-20');
        expect(result.items[2].workDate).toBe('2025-01-18');
      });

      it('should sort by popularity (highest viewCount first)', async () => {
        mockFetcher.mockResolvedValue(
          sampleJobs.map((j) => ({
            ...j,
            description: '경험자 우대합니다',
          }))
        );
        const result = await provider.search('우대', { sortBy: 'popularity' });

        expect(result.totalCount).toBe(3);
        expect(result.items[0].viewCount).toBe(200);
        expect(result.items[1].viewCount).toBe(100);
        expect(result.items[2].viewCount).toBe(50);
      });

      it('should maintain original order with relevance sort', async () => {
        mockFetcher.mockResolvedValue(
          sampleJobs.map((j) => ({
            ...j,
            description: '경험자 우대합니다',
          }))
        );
        const result = await provider.search('우대', { sortBy: 'relevance' });

        expect(result.items[0].id).toBe('job-1');
        expect(result.items[1].id).toBe('job-2');
        expect(result.items[2].id).toBe('job-3');
      });
    });

    describe('search error handling', () => {
      it('should propagate data fetcher errors', async () => {
        mockFetcher.mockRejectedValue(new Error('Fetch failed'));

        await expect(provider.search('test')).rejects.toThrow('Fetch failed');
      });
    });

    describe('nested value extraction', () => {
      it('should search nested location.name field', async () => {
        const result = await provider.search('강남');

        expect(result.totalCount).toBe(1);
        expect(result.items[0].id).toBe('job-1');
      });
    });

    describe('edge cases', () => {
      it('should handle items with missing optional fields', async () => {
        const jobsWithMissing = [
          createMockJobPosting({
            id: 'job-x',
            title: 'Test',
            workDate: undefined,
            viewCount: undefined,
          }),
        ];
        mockFetcher.mockResolvedValue(jobsWithMissing);

        const result = await provider.search('', { sortBy: 'date' });
        expect(result.items).toHaveLength(1);

        const result2 = await provider.search('', { sortBy: 'popularity' });
        expect(result2.items).toHaveLength(1);
      });

      it('should handle empty data set', async () => {
        mockFetcher.mockResolvedValue([]);

        const result = await provider.search('test');

        expect(result.totalCount).toBe(0);
        expect(result.items).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // AlgoliaSearchProvider
  // ==========================================================================
  describe('AlgoliaSearchProvider', () => {
    it('should throw BusinessError on search (not implemented)', async () => {
      const provider = new AlgoliaSearchProvider('app-id', 'api-key', 'jobs');

      await expect(provider.search('test')).rejects.toThrow();
    });

    it('should have name "Algolia"', () => {
      const provider = new AlgoliaSearchProvider('app-id', 'api-key', 'jobs');

      expect(provider.name).toBe('Algolia');
    });
  });

  // ==========================================================================
  // createSearchProvider
  // ==========================================================================
  describe('createSearchProvider', () => {
    it('should create ClientSideSearchProvider for client-side config', () => {
      const fetcher = jest.fn();
      const provider = createSearchProvider({ provider: 'client-side' }, fetcher);

      expect(provider).toBeInstanceOf(ClientSideSearchProvider);
      expect(provider.name).toBe('ClientSide');
    });

    it('should create AlgoliaSearchProvider for algolia config', () => {
      const fetcher = jest.fn();
      const provider = createSearchProvider(
        {
          provider: 'algolia',
          algolia: { appId: 'app-id', apiKey: 'api-key', indexName: 'jobs' },
        },
        fetcher
      );

      expect(provider).toBeInstanceOf(AlgoliaSearchProvider);
      expect(provider.name).toBe('Algolia');
    });

    it('should throw when algolia config is missing', () => {
      const fetcher = jest.fn();

      expect(() => createSearchProvider({ provider: 'algolia' }, fetcher)).toThrow();
    });

    it('should default to ClientSideSearchProvider for unknown provider', () => {
      const fetcher = jest.fn();
      const provider = createSearchProvider({ provider: 'unknown' as any }, fetcher);

      expect(provider).toBeInstanceOf(ClientSideSearchProvider);
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================
  describe('CURRENT_SEARCH_PROVIDER', () => {
    it('should be "client-side"', () => {
      expect(CURRENT_SEARCH_PROVIDER).toBe('client-side');
    });
  });
});
