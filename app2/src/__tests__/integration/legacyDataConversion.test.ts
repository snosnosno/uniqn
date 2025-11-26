/**
 * @file legacyDataConversion.test.ts
 * @description 레거시 데이터 변환 통합 테스트
 *
 * 테스트 시나리오:
 * 1. type='application' → postingType='regular'
 * 2. recruitmentType='fixed' → postingType='fixed'
 * 3. 필드 없음 → postingType='regular' + 경고 로그
 * 4. 레거시 공고 수정 시 새 필드 저장
 */

import { normalizePostingType } from '../../utils/jobPosting/jobPostingHelpers';
import { JobPosting, PostingType } from '../../types/jobPosting';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('레거시 데이터 변환 통합 테스트', () => {
  beforeEach(() => {
    // 각 테스트 전에 mock 초기화
    jest.clearAllMocks();
  });

  /**
   * 시나리오 1: type='application' → postingType='regular'
   */
  describe('시나리오 1: type="application" 변환', () => {
    it('type이 "application"인 레거시 공고는 "regular"로 변환되어야 함', () => {
      // Given: 레거시 공고 (type='application')
      const legacyPosting: Partial<JobPosting> = {
        id: 'legacy-001',
        title: '레거시 지원 공고',
        type: 'application',
        status: 'open',
      };

      // When: normalizePostingType 호출
      const result = normalizePostingType(legacyPosting);

      // Then: 'regular'로 변환됨
      expect(result).toBe('regular');

      // Then: 경고 로그 출력 확인
      expect(logger.warn).toHaveBeenCalledWith(
        '레거시 application 타입을 regular로 변환',
        expect.objectContaining({
          component: 'jobPostingHelpers',
          operation: 'normalizePostingType',
        })
      );
    });

    it('새 postingType 필드가 있으면 우선 사용해야 함', () => {
      // Given: postingType 필드가 있는 공고
      const modernPosting: Partial<JobPosting> = {
        id: 'modern-001',
        postingType: 'urgent',
        type: 'application', // 레거시 필드도 있지만 무시됨
      };

      // When
      const result = normalizePostingType(modernPosting);

      // Then: postingType 우선
      expect(result).toBe('urgent');

      // Then: 경고 로그 없음
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  /**
   * 시나리오 2: recruitmentType='fixed' → postingType='fixed'
   */
  describe('시나리오 2: recruitmentType="fixed" 변환', () => {
    it('recruitmentType이 "fixed"인 레거시 공고는 "fixed"로 변환되어야 함', () => {
      // Given: 레거시 공고 (recruitmentType='fixed')
      const legacyFixedPosting: Partial<JobPosting> = {
        id: 'legacy-fixed-001',
        title: '레거시 고정 공고',
        recruitmentType: 'fixed',
        status: 'open',
      };

      // When
      const result = normalizePostingType(legacyFixedPosting);

      // Then: 'fixed'로 변환됨
      expect(result).toBe('fixed');

      // Then: 경고 로그 출력 확인
      expect(logger.warn).toHaveBeenCalledWith(
        '레거시 fixed 타입을 fixed로 유지',
        expect.objectContaining({
          component: 'jobPostingHelpers',
          operation: 'normalizePostingType',
        })
      );
    });

    it('type과 recruitmentType 모두 있으면 type 우선 사용', () => {
      // Given: type, recruitmentType 모두 있는 공고
      const legacyPosting: Partial<JobPosting> = {
        id: 'legacy-002',
        type: 'application',
        recruitmentType: 'fixed',
      };

      // When
      const result = normalizePostingType(legacyPosting);

      // Then: type이 우선 (application → regular)
      expect(result).toBe('regular');
    });
  });

  /**
   * 시나리오 3: 필드 없음 → postingType='regular' + 에러 로그
   */
  describe('시나리오 3: 필드 없음 처리', () => {
    it('postingType, type, recruitmentType 모두 없으면 "regular" 기본값 사용', () => {
      // Given: 타입 필드가 전혀 없는 공고
      const emptyPosting: Partial<JobPosting> = {
        id: 'no-type-001',
        title: '타입 필드 없는 공고',
        status: 'open',
      };

      // When
      const result = normalizePostingType(emptyPosting);

      // Then: 'regular' 기본값
      expect(result).toBe('regular');

      // Then: 에러 로그 출력 확인
      expect(logger.error).toHaveBeenCalledWith(
        'postingType 필드 없음, regular로 기본 설정',
        expect.any(Error),
        expect.objectContaining({
          component: 'jobPostingHelpers',
          operation: 'normalizePostingType',
        })
      );
    });

    it('빈 객체도 "regular" 기본값 반환', () => {
      // Given: 빈 객체
      const emptyObject: Partial<JobPosting> = {};

      // When
      const result = normalizePostingType(emptyObject);

      // Then: 'regular' 기본값
      expect(result).toBe('regular');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  /**
   * 시나리오 4: 모든 타입 변환 매핑 검증
   */
  describe('시나리오 4: 전체 타입 변환 매핑', () => {
    const testCases: Array<{
      description: string;
      input: Partial<JobPosting>;
      expected: PostingType;
    }> = [
      {
        description: 'postingType="regular"',
        input: { postingType: 'regular' },
        expected: 'regular',
      },
      {
        description: 'postingType="fixed"',
        input: { postingType: 'fixed' },
        expected: 'fixed',
      },
      {
        description: 'postingType="tournament"',
        input: { postingType: 'tournament' },
        expected: 'tournament',
      },
      {
        description: 'postingType="urgent"',
        input: { postingType: 'urgent' },
        expected: 'urgent',
      },
      {
        description: 'type="application" (레거시)',
        input: { type: 'application' },
        expected: 'regular',
      },
      {
        description: 'recruitmentType="application" (레거시)',
        input: { recruitmentType: 'application' },
        expected: 'regular',
      },
      {
        description: 'type="fixed" (레거시)',
        input: { type: 'fixed' },
        expected: 'fixed',
      },
      {
        description: 'recruitmentType="fixed" (레거시)',
        input: { recruitmentType: 'fixed' },
        expected: 'fixed',
      },
    ];

    testCases.forEach(({ description, input, expected }) => {
      it(`${description} → "${expected}"`, () => {
        const result = normalizePostingType(input);
        expect(result).toBe(expected);
      });
    });
  });

  /**
   * 시나리오 5: 잘못된 값 처리
   */
  describe('시나리오 5: 잘못된 값 처리', () => {
    it('잘못된 type 값은 기본값 "regular" 반환', () => {
      // Given: 잘못된 type 값
      const invalidPosting: Partial<JobPosting> = {
        type: 'invalid-type' as any,
      };

      // When
      const result = normalizePostingType(invalidPosting);

      // Then: 기본값 'regular'
      expect(result).toBe('regular');
      expect(logger.error).toHaveBeenCalled();
    });

    it('undefined type은 기본값 "regular" 반환', () => {
      // Given: undefined
      const undefinedPosting: Partial<JobPosting> = {};

      // When
      const result = normalizePostingType(undefinedPosting);

      // Then: 기본값 'regular'
      expect(result).toBe('regular');
    });

    it('null 값도 기본값 "regular" 반환', () => {
      // Given: null
      const nullPosting: Partial<JobPosting> = {
        type: null as any,
      };

      // When
      const result = normalizePostingType(nullPosting);

      // Then: 기본값 'regular'
      expect(result).toBe('regular');
    });
  });
});
