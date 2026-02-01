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
  // normalizeUserId 테스트
  // ============================================================================
  describe('normalizeUserId', () => {
    it('staffId 우선 반환', () => {
      expect(
        IdNormalizer.normalizeUserId({
          staffId: 'STAFF123',
          applicantId: 'APP456',
        })
      ).toBe('STAFF123');
    });

    it('staffId 없으면 applicantId 반환', () => {
      expect(
        IdNormalizer.normalizeUserId({
          applicantId: 'APP456',
        })
      ).toBe('APP456');
    });

    it('applicantId 없으면 userId 반환 (레거시)', () => {
      expect(
        IdNormalizer.normalizeUserId({
          userId: 'USER789',
        })
      ).toBe('USER789');
    });

    it('모두 없으면 빈 문자열 반환', () => {
      expect(IdNormalizer.normalizeUserId({})).toBe('');
    });
  });

  // ============================================================================
  // generateApplicationId / parseApplicationId 테스트
  // ============================================================================
  describe('generateApplicationId / parseApplicationId', () => {
    it('생성 후 파싱하면 원본 복원', () => {
      const jobPostingId = 'JOB123';
      const applicantId = 'USER456';

      const applicationId = IdNormalizer.generateApplicationId(jobPostingId, applicantId);
      const parsed = IdNormalizer.parseApplicationId(applicationId);

      expect(parsed.jobPostingId).toBe(jobPostingId);
      expect(parsed.applicantId).toBe(applicantId);
    });

    it('복합 키 형식 확인', () => {
      const applicationId = IdNormalizer.generateApplicationId('JOB123', 'USER456');
      expect(applicationId).toBe('JOB123_USER456');
    });

    it('applicantId에 언더스코어 포함 가능', () => {
      const jobPostingId = 'JOB123';
      const applicantId = 'USER_456_789';

      const applicationId = IdNormalizer.generateApplicationId(jobPostingId, applicantId);
      const parsed = IdNormalizer.parseApplicationId(applicationId);

      expect(parsed.jobPostingId).toBe(jobPostingId);
      expect(parsed.applicantId).toBe(applicantId);
    });

    it('언더스코어 없는 ID 파싱', () => {
      const parsed = IdNormalizer.parseApplicationId('SIMPLEAPP');

      expect(parsed.jobPostingId).toBe('SIMPLEAPP');
      expect(parsed.applicantId).toBe('');
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

  // ============================================================================
  // 배치 정규화 테스트
  // ============================================================================
  describe('normalizeWorkLogs', () => {
    it('WorkLog 배열에 normalizedJobPostingId 추가', () => {
      const workLogs = [
        { jobPostingId: 'JOB1' },
        { jobPostingId: 'JOB2' },
      ];

      const normalized = IdNormalizer.normalizeWorkLogs(workLogs);

      expect(normalized[0].normalizedJobPostingId).toBe('JOB1');
      expect(normalized[1].normalizedJobPostingId).toBe('JOB2');
    });

    it('원본 객체의 속성 유지', () => {
      const workLogs = [{ jobPostingId: 'JOB1' }];

      const normalized = IdNormalizer.normalizeWorkLogs(workLogs);

      expect(normalized[0].jobPostingId).toBe('JOB1');
      expect(normalized[0].normalizedJobPostingId).toBe('JOB1');
    });
  });

  // ============================================================================
  // extractJobIds / extractUserIds 테스트
  // ============================================================================
  describe('extractJobIds', () => {
    it('문서 배열에서 중복 없이 공고 ID 추출', () => {
      const docs = [
        { jobPostingId: 'JOB1' },
        { jobPostingId: 'JOB2' },
        { jobPostingId: 'JOB1' }, // 중복
      ];

      const ids = IdNormalizer.extractJobIds(docs);

      expect(ids).toHaveLength(2);
      expect(ids).toContain('JOB1');
      expect(ids).toContain('JOB2');
    });
  });

  describe('extractUserIds', () => {
    it('문서 배열에서 중복 없이 사용자 ID 추출', () => {
      const docs = [{ staffId: 'USER1' }, { applicantId: 'USER2' }, { staffId: 'USER1' }];

      const ids = IdNormalizer.extractUserIds(docs);

      expect(ids).toHaveLength(2);
      expect(ids).toContain('USER1');
      expect(ids).toContain('USER2');
    });
  });

  // ============================================================================
  // 변환 함수 테스트
  // ============================================================================
  describe('변환 함수', () => {
    it('toStaffId는 동일한 값 반환', () => {
      expect(IdNormalizer.toStaffId('APP123')).toBe('APP123');
    });

    it('toApplicantId는 동일한 값 반환', () => {
      expect(IdNormalizer.toApplicantId('STAFF123')).toBe('STAFF123');
    });
  });
});
