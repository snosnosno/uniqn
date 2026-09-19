/**
 * IdNormalizer 테스트
 *
 * @description ID 정규화 유틸리티 테스트
 */

import { IdNormalizer } from '../id/IdNormalizer';

describe('IdNormalizer', () => {
  // ============================================================================
  // normalizeJobId 테스트
  // ============================================================================
  describe('normalizeJobId', () => {
    it('jobPostingId 반환', () => {
      expect(
        IdNormalizer.normalizeJobId({
          jobPostingId: 'JOB123',
        })
      ).toBe('JOB123');
    });

    it('jobPostingId 없으면 빈 문자열 반환', () => {
      expect(IdNormalizer.normalizeJobId({})).toBe('');
    });

    it('undefined 값은 무시', () => {
      expect(
        IdNormalizer.normalizeJobId({
          jobPostingId: undefined,
        })
      ).toBe('');
    });

    it('빈 문자열도 falsy로 처리', () => {
      expect(
        IdNormalizer.normalizeJobId({
          jobPostingId: '',
        })
      ).toBe('');
    });
  });

  // ============================================================================
  // extractUnifiedIds 테스트
  // ============================================================================
  describe('extractUnifiedIds', () => {
    it('WorkLog + Application에서 중복 없이 ID 추출', () => {
      // Phase 2: jobPostingId만 사용
      const workLogs = [{ jobPostingId: 'JOB1' }, { jobPostingId: 'JOB2' }];
      const applications = [
        { jobPostingId: 'JOB2' }, // 중복
        { jobPostingId: 'JOB3' },
      ];

      const ids = IdNormalizer.extractUnifiedIds(workLogs, applications);

      expect(ids.size).toBe(3);
      expect(ids.has('JOB1')).toBe(true);
      expect(ids.has('JOB2')).toBe(true);
      expect(ids.has('JOB3')).toBe(true);
    });

    it('빈 배열 처리', () => {
      const ids = IdNormalizer.extractUnifiedIds([], []);
      expect(ids.size).toBe(0);
    });

    it('빈 문자열 무시', () => {
      const workLogs = [
        { jobPostingId: 'JOB1' },
        { jobPostingId: '' }, // 빈 문자열 - 무시
      ];
      const applications: { jobPostingId: string }[] = [];

      const ids = IdNormalizer.extractUnifiedIds(workLogs, applications);

      expect(ids.size).toBe(1);
      expect(ids.has('JOB1')).toBe(true);
    });
  });
});
