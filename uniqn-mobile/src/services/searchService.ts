/**
 * UNIQN Mobile - 검색 서비스 추상화 레이어
 *
 * @description 검색 기능 추상화 - 향후 Algolia/Typesense 전환 용이
 * @version 1.0.0
 */

import { logger } from '@/utils/logger';
import type { JobPosting } from '@/types';

// ============================================================================
// Types
// ============================================================================

/** 검색 결과 */
export interface SearchResult<T> {
  items: T[];
  totalCount: number;
  /** 검색 소요 시간 (ms) */
  searchTime?: number;
}

/** 검색 옵션 */
export interface SearchOptions {
  /** 최대 결과 개수 */
  limit?: number;
  /** 검색 필드 지정 (미지정시 전체) */
  fields?: string[];
  /** 정렬 기준 */
  sortBy?: 'relevance' | 'date' | 'popularity';
}

/** 검색 프로바이더 인터페이스 */
export interface SearchProvider<T> {
  /** 검색 실행 */
  search(query: string, options?: SearchOptions): Promise<SearchResult<T>>;
  /** 프로바이더 이름 */
  readonly name: string;
}

// ============================================================================
// Client-Side Search Provider (현재 구현)
// ============================================================================

/**
 * 클라이언트 사이드 검색 프로바이더
 *
 * @description Firestore 데이터를 메모리에서 필터링
 * @limitation 전문 검색 불가, 대용량 데이터에서 성능 저하
 */
export class ClientSideSearchProvider implements SearchProvider<JobPosting> {
  readonly name = 'ClientSide';

  constructor(
    private readonly dataFetcher: () => Promise<JobPosting[]>
  ) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResult<JobPosting>> {
    const startTime = Date.now();
    const limit = options?.limit ?? 20;

    try {
      logger.info('클라이언트 사이드 검색', { query, limit, provider: this.name });

      // 데이터 가져오기
      const allItems = await this.dataFetcher();

      // 검색어 정규화
      const normalizedQuery = query.toLowerCase().trim();

      if (!normalizedQuery) {
        return {
          items: allItems.slice(0, limit),
          totalCount: allItems.length,
          searchTime: Date.now() - startTime,
        };
      }

      // 필터링
      const filteredItems = allItems.filter((item) => {
        const searchableText = this.getSearchableText(item, options?.fields);
        return searchableText.includes(normalizedQuery);
      });

      // 정렬
      const sortedItems = this.sortResults(filteredItems, options?.sortBy);

      const searchTime = Date.now() - startTime;
      logger.info('클라이언트 사이드 검색 완료', {
        query,
        totalCount: filteredItems.length,
        returnedCount: Math.min(filteredItems.length, limit),
        searchTime,
      });

      return {
        items: sortedItems.slice(0, limit),
        totalCount: filteredItems.length,
        searchTime,
      };
    } catch (error) {
      logger.error('검색 실패', error instanceof Error ? error : new Error(String(error)), {
        query,
        provider: this.name,
      });
      throw error;
    }
  }

  /** 검색 가능한 텍스트 추출 */
  private getSearchableText(item: JobPosting, fields?: string[]): string {
    const defaultFields = ['title', 'location.name', 'description', 'ownerName'];
    const targetFields = fields ?? defaultFields;

    const texts: string[] = [];

    for (const field of targetFields) {
      const value = this.getNestedValue(item, field);
      if (typeof value === 'string') {
        texts.push(value.toLowerCase());
      }
    }

    return texts.join(' ');
  }

  /** 중첩 객체에서 값 추출 */
  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /** 결과 정렬 */
  private sortResults(items: JobPosting[], sortBy?: SearchOptions['sortBy']): JobPosting[] {
    if (!sortBy || sortBy === 'relevance') {
      // 기본: 원본 순서 유지 (이미 필터링됨)
      return items;
    }

    const sorted = [...items];

    switch (sortBy) {
      case 'date':
        return sorted.sort((a, b) => {
          const dateA = a.workDate ?? '';
          const dateB = b.workDate ?? '';
          return dateB.localeCompare(dateA); // 최신순
        });
      case 'popularity':
        return sorted.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
      default:
        return sorted;
    }
  }
}

// ============================================================================
// Algolia Search Provider (향후 구현용 스텁)
// ============================================================================

/**
 * Algolia 검색 프로바이더 (스텁)
 *
 * @description 향후 Algolia 연동 시 구현
 * @todo Algolia SDK 연동
 */
export class AlgoliaSearchProvider implements SearchProvider<JobPosting> {
  readonly name = 'Algolia';
  private indexName: string;

  constructor(
    appId: string,
    apiKey: string,
    indexName: string
  ) {
    // 향후 Algolia 클라이언트 초기화 시 사용
    this.indexName = indexName;
    logger.info('Algolia 프로바이더 초기화 (스텁)', { appId: appId.slice(0, 4) + '***', indexName });
    // apiKey는 민감 정보이므로 로깅하지 않음
    void apiKey; // 사용 예정 표시
  }

  async search(_query: string, _options?: SearchOptions): Promise<SearchResult<JobPosting>> {
    // TODO: Algolia 검색 구현
    throw new Error(`Algolia 프로바이더(${this.indexName})는 아직 구현되지 않았습니다.`);
  }
}

// ============================================================================
// Search Service Factory
// ============================================================================

/** 검색 서비스 설정 */
export interface SearchServiceConfig {
  provider: 'client-side' | 'algolia';
  algolia?: {
    appId: string;
    apiKey: string;
    indexName: string;
  };
}

/**
 * 검색 서비스 팩토리
 *
 * @description 설정에 따라 적절한 검색 프로바이더 생성
 */
export function createSearchProvider(
  config: SearchServiceConfig,
  dataFetcher: () => Promise<JobPosting[]>
): SearchProvider<JobPosting> {
  switch (config.provider) {
    case 'algolia':
      if (!config.algolia) {
        throw new Error('Algolia 설정이 필요합니다.');
      }
      return new AlgoliaSearchProvider(
        config.algolia.appId,
        config.algolia.apiKey,
        config.algolia.indexName
      );
    case 'client-side':
    default:
      return new ClientSideSearchProvider(dataFetcher);
  }
}

// ============================================================================
// Default Export
// ============================================================================

/** 현재 검색 프로바이더 타입 */
export const CURRENT_SEARCH_PROVIDER = 'client-side' as const;

export default {
  ClientSideSearchProvider,
  AlgoliaSearchProvider,
  createSearchProvider,
  CURRENT_SEARCH_PROVIDER,
};
