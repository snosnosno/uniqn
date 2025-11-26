/**
 * @file legacyJobPostingQuery.test.ts
 * @description 레거시 공고 데이터 처리 로직 테스트
 *
 * 테스트 시나리오:
 * 1. 레거시 공고 배열 정규화 로직
 * 2. 타입별 필터링 로직
 * 3. 레거시 필드와 새 필드 혼합 처리
 */

import { normalizePostingType } from '../../utils/jobPosting/jobPostingHelpers';
import { JobPosting, PostingType } from '../../types/jobPosting';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

/**
 * 공고 배열을 정규화하는 헬퍼 함수 (Hook 로직 시뮬레이션)
 */
const normalizeJobPostings = (jobs: Partial<JobPosting>[]): JobPosting[] => {
  return jobs.map((job) => ({
    ...job,
    postingType: normalizePostingType(job),
  })) as JobPosting[];
};

/**
 * postingType으로 필터링하는 헬퍼 함수 (Hook 로직 시뮬레이션)
 */
const filterByPostingType = (
  jobs: JobPosting[],
  postingType?: PostingType | 'all'
): JobPosting[] => {
  if (!postingType || postingType === 'all') {
    return jobs;
  }
  return jobs.filter((job) => job.postingType === postingType);
};

describe('레거시 공고 조회 로직 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 시나리오 1: 레거시 공고 배열 정규화
   */
  describe('시나리오 1: 공고 배열 정규화', () => {
    it('type="application" 공고는 postingType="regular"로 정규화되어야 함', () => {
      // Given: 레거시 공고 데이터 (type='application')
      const mockLegacyPostings: Partial<JobPosting>[] = [
        {
          id: 'legacy-001',
          title: '레거시 지원 공고 1',
          type: 'application',
          status: 'open',
        },
        {
          id: 'legacy-002',
          title: '레거시 지원 공고 2',
          type: 'application',
          status: 'open',
        },
      ];

      // When: 정규화 함수 호출 (Hook 로직 시뮬레이션)
      const normalized = normalizeJobPostings(mockLegacyPostings);

      // Then: postingType이 'regular'로 정규화됨
      expect(normalized).toHaveLength(2);
      expect(normalized[0]?.postingType).toBe('regular');
      expect(normalized[1]?.postingType).toBe('regular');
    });

    it('recruitmentType="fixed" 공고는 postingType="fixed"로 정규화되어야 함', () => {
      // Given: 레거시 고정 공고
      const mockLegacyFixed: Partial<JobPosting>[] = [
        {
          id: 'legacy-fixed-001',
          title: '레거시 고정 공고',
          recruitmentType: 'fixed',
          status: 'open',
        },
      ];

      // When
      const normalized = normalizeJobPostings(mockLegacyFixed);

      // Then
      expect(normalized).toHaveLength(1);
      expect(normalized[0]?.postingType).toBe('fixed');
    });

    it('여러 타입의 레거시 공고가 올바르게 정규화되어야 함', () => {
      // Given: 다양한 레거시 타입
      const mockMixedLegacy: Partial<JobPosting>[] = [
        { id: 'post-001', type: 'application', status: 'open' },
        { id: 'post-002', recruitmentType: 'application', status: 'open' },
        { id: 'post-003', type: 'fixed', status: 'open' },
        { id: 'post-004', recruitmentType: 'fixed', status: 'open' },
      ];

      // When
      const normalized = normalizeJobPostings(mockMixedLegacy);

      // Then
      expect(normalized).toHaveLength(4);
      expect(normalized[0]?.postingType).toBe('regular'); // type='application'
      expect(normalized[1]?.postingType).toBe('regular'); // recruitmentType='application'
      expect(normalized[2]?.postingType).toBe('fixed'); // type='fixed'
      expect(normalized[3]?.postingType).toBe('fixed'); // recruitmentType='fixed'
    });
  });

  /**
   * 시나리오 2: 타입별 필터링
   */
  describe('시나리오 2: 타입별 필터링', () => {
    it('postingType="regular" 필터로 지원 공고만 조회', () => {
      // Given: 여러 타입의 공고 (정규화 완료)
      const mockMixedPostings: Partial<JobPosting>[] = [
        { id: 'post-001', postingType: 'regular', status: 'open' },
        { id: 'post-002', type: 'application', status: 'open' }, // 레거시
        { id: 'post-003', postingType: 'fixed', status: 'open' },
        { id: 'post-004', postingType: 'urgent', status: 'open' },
      ];

      // When: 정규화 후 필터링
      const normalized = normalizeJobPostings(mockMixedPostings);
      const filtered = filterByPostingType(normalized, 'regular');

      // Then: regular 타입만 반환
      expect(filtered).toHaveLength(2); // 새 regular + 레거시 application
      expect(filtered.every((job) => job.postingType === 'regular')).toBe(true);
      expect(filtered.map((j) => j.id)).toEqual(['post-001', 'post-002']);
    });

    it('postingType="fixed" 필터로 고정 공고만 조회', () => {
      // Given: 여러 타입의 공고
      const mockMixedPostings: Partial<JobPosting>[] = [
        { id: 'post-001', postingType: 'regular', status: 'open' },
        { id: 'post-002', postingType: 'fixed', status: 'open' },
        { id: 'post-003', recruitmentType: 'fixed', status: 'open' }, // 레거시
      ];

      // When: 정규화 후 필터링
      const normalized = normalizeJobPostings(mockMixedPostings);
      const filtered = filterByPostingType(normalized, 'fixed');

      // Then: fixed 타입만 반환
      expect(filtered).toHaveLength(2); // 새 fixed + 레거시 fixed
      expect(filtered.every((job) => job.postingType === 'fixed')).toBe(true);
      expect(filtered.map((j) => j.id)).toEqual(['post-002', 'post-003']);
    });

    it('postingType="tournament" 필터로 대회 공고만 조회', () => {
      // Given
      const mockPostings: Partial<JobPosting>[] = [
        { id: 'post-001', postingType: 'regular', status: 'open' },
        { id: 'post-002', postingType: 'tournament', status: 'open' },
        { id: 'post-003', postingType: 'tournament', status: 'open' },
      ];

      // When
      const normalized = normalizeJobPostings(mockPostings);
      const filtered = filterByPostingType(normalized, 'tournament');

      // Then
      expect(filtered).toHaveLength(2);
      expect(filtered.every((job) => job.postingType === 'tournament')).toBe(true);
    });

    it('postingType="urgent" 필터로 긴급 공고만 조회', () => {
      // Given
      const mockPostings: Partial<JobPosting>[] = [
        { id: 'post-001', postingType: 'regular', status: 'open' },
        { id: 'post-002', postingType: 'urgent', status: 'open' },
      ];

      // When
      const normalized = normalizeJobPostings(mockPostings);
      const filtered = filterByPostingType(normalized, 'urgent');

      // Then
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.postingType).toBe('urgent');
    });
  });

  /**
   * 시나리오 3: 레거시/신규 필드 혼합
   */
  describe('시나리오 3: 레거시/신규 필드 혼합', () => {
    it('postingType이 있는 공고는 레거시 필드 무시', () => {
      // Given: postingType과 type 모두 있는 공고
      const mockMixedFieldPosting: Partial<JobPosting>[] = [
        {
          id: 'mixed-001',
          postingType: 'urgent', // 새 필드
          type: 'application', // 레거시 필드 (무시됨)
          status: 'open',
        },
      ];

      // When
      const normalized = normalizeJobPostings(mockMixedFieldPosting);

      // Then: postingType 우선 사용
      expect(normalized).toHaveLength(1);
      expect(normalized[0]?.postingType).toBe('urgent'); // type='application' 무시
    });

    it('빈 배열 처리', () => {
      // Given: 빈 배열
      const mockEmpty: Partial<JobPosting>[] = [];

      // When
      const normalized = normalizeJobPostings(mockEmpty);
      const filtered = filterByPostingType(normalized, 'tournament');

      // Then: 빈 배열 반환
      expect(normalized).toEqual([]);
      expect(filtered).toEqual([]);
    });

    it('필터 없으면 모든 공고 반환', () => {
      // Given: 다양한 타입의 공고
      const mockAllPostings: Partial<JobPosting>[] = [
        { id: 'post-001', postingType: 'regular', status: 'open' },
        { id: 'post-002', postingType: 'fixed', status: 'open' },
        { id: 'post-003', postingType: 'tournament', status: 'open' },
      ];

      // When: 필터 없음
      const normalized = normalizeJobPostings(mockAllPostings);
      const filtered = filterByPostingType(normalized, 'all');

      // Then: 모든 공고 반환
      expect(filtered).toHaveLength(3);
    });
  });

  /**
   * 시나리오 4: 전체 공고 조회 (레거시 + 신규 혼합)
   */
  describe('시나리오 4: 전체 공고 조회', () => {
    it('postingType 필터 없으면 모든 타입 반환 (레거시 포함)', () => {
      // Given: 다양한 타입의 공고 (레거시 포함)
      const mockAllPostings: Partial<JobPosting>[] = [
        { id: 'post-001', postingType: 'regular', status: 'open' },
        { id: 'post-002', postingType: 'fixed', status: 'open' },
        { id: 'post-003', postingType: 'tournament', status: 'open' },
        { id: 'post-004', postingType: 'urgent', status: 'open' },
        { id: 'post-005', type: 'application', status: 'open' }, // 레거시
      ];

      // When: 필터 없음
      const normalized = normalizeJobPostings(mockAllPostings);

      // Then: 모든 공고 반환
      expect(normalized).toHaveLength(5);

      // postingType 정규화 확인
      expect(normalized[0]?.postingType).toBe('regular');
      expect(normalized[1]?.postingType).toBe('fixed');
      expect(normalized[2]?.postingType).toBe('tournament');
      expect(normalized[3]?.postingType).toBe('urgent');
      expect(normalized[4]?.postingType).toBe('regular'); // 레거시 정규화
    });

    it('모든 레거시 타입이 올바르게 처리됨', () => {
      // Given: 모든 레거시 조합
      const mockLegacy: Partial<JobPosting>[] = [
        { id: 'legacy-001', type: 'application' },
        { id: 'legacy-002', recruitmentType: 'application' },
        { id: 'legacy-003', type: 'fixed' },
        { id: 'legacy-004', recruitmentType: 'fixed' },
        { id: 'legacy-005' }, // 필드 없음
        { id: 'modern-001', postingType: 'urgent' }, // 신규
      ];

      // When
      const normalized = normalizeJobPostings(mockLegacy);

      // Then
      expect(normalized).toHaveLength(6);
      expect(normalized[0]?.postingType).toBe('regular'); // type='application'
      expect(normalized[1]?.postingType).toBe('regular'); // recruitmentType='application'
      expect(normalized[2]?.postingType).toBe('fixed'); // type='fixed'
      expect(normalized[3]?.postingType).toBe('fixed'); // recruitmentType='fixed'
      expect(normalized[4]?.postingType).toBe('regular'); // 필드 없음
      expect(normalized[5]?.postingType).toBe('urgent'); // 신규 필드
    });
  });
});
