import { normalizePostingType } from '@/utils/jobPosting/jobPostingHelpers';
import { JobPosting } from '@/types/jobPosting/jobPosting';

describe('normalizePostingType', () => {
  describe('새 필드 (postingType) 사용', () => {
    it('postingType이 있으면 그대로 반환', () => {
      const posting: Partial<JobPosting> = {
        postingType: 'fixed',
      };

      expect(normalizePostingType(posting)).toBe('fixed');
    });

    it('postingType이 regular이면 regular 반환', () => {
      const posting: Partial<JobPosting> = {
        postingType: 'regular',
      };

      expect(normalizePostingType(posting)).toBe('regular');
    });

    it('postingType이 tournament이면 tournament 반환', () => {
      const posting: Partial<JobPosting> = {
        postingType: 'tournament',
      };

      expect(normalizePostingType(posting)).toBe('tournament');
    });

    it('postingType이 urgent이면 urgent 반환', () => {
      const posting: Partial<JobPosting> = {
        postingType: 'urgent',
      };

      expect(normalizePostingType(posting)).toBe('urgent');
    });
  });

  describe('레거시 필드 (type) 변환', () => {
    it('type이 application이면 regular로 변환', () => {
      const posting: Partial<JobPosting> = {
        type: 'application',
      };

      expect(normalizePostingType(posting)).toBe('regular');
    });

    it('type이 fixed이면 fixed로 변환', () => {
      const posting: Partial<JobPosting> = {
        type: 'fixed',
      };

      expect(normalizePostingType(posting)).toBe('fixed');
    });

    it('postingType과 type 둘 다 있으면 postingType 우선', () => {
      const posting: Partial<JobPosting> = {
        postingType: 'tournament',
        type: 'application',
      };

      expect(normalizePostingType(posting)).toBe('tournament');
    });
  });

  describe('레거시 필드 (recruitmentType) 변환', () => {
    it('recruitmentType이 application이면 regular로 변환', () => {
      const posting: Partial<JobPosting> = {
        recruitmentType: 'application',
      };

      expect(normalizePostingType(posting)).toBe('regular');
    });

    it('recruitmentType이 fixed이면 fixed로 변환', () => {
      const posting: Partial<JobPosting> = {
        recruitmentType: 'fixed',
      };

      expect(normalizePostingType(posting)).toBe('fixed');
    });

    it('type과 recruitmentType 둘 다 있으면 type 우선', () => {
      const posting: Partial<JobPosting> = {
        type: 'fixed',
        recruitmentType: 'application',
      };

      expect(normalizePostingType(posting)).toBe('fixed');
    });
  });

  describe('필드 없음 또는 잘못된 값', () => {
    it('모든 필드가 없으면 regular 기본값 반환', () => {
      const posting: Partial<JobPosting> = {};

      expect(normalizePostingType(posting)).toBe('regular');
    });

    it('postingType이 잘못된 값이면 regular 기본값 반환', () => {
      const posting: Partial<JobPosting> = {
        postingType: 'invalid' as any,
      };

      expect(normalizePostingType(posting)).toBe('regular');
    });

    it('type이 잘못된 값이면 regular 기본값 반환', () => {
      const posting: Partial<JobPosting> = {
        type: 'invalid' as any,
      };

      expect(normalizePostingType(posting)).toBe('regular');
    });

    it('recruitmentType이 잘못된 값이면 regular 기본값 반환', () => {
      const posting: Partial<JobPosting> = {
        recruitmentType: 'invalid' as any,
      };

      expect(normalizePostingType(posting)).toBe('regular');
    });
  });

  describe('우선순위 검증', () => {
    it('postingType > type > recruitmentType 순서', () => {
      const posting: Partial<JobPosting> = {
        postingType: 'urgent',
        type: 'fixed',
        recruitmentType: 'application',
      };

      expect(normalizePostingType(posting)).toBe('urgent');
    });

    it('postingType 없고 type만 있으면 type 사용', () => {
      const posting: Partial<JobPosting> = {
        type: 'fixed',
        recruitmentType: 'application',
      };

      expect(normalizePostingType(posting)).toBe('fixed');
    });

    it('postingType과 type 없고 recruitmentType만 있으면 recruitmentType 사용', () => {
      const posting: Partial<JobPosting> = {
        recruitmentType: 'fixed',
      };

      expect(normalizePostingType(posting)).toBe('fixed');
    });
  });
});
