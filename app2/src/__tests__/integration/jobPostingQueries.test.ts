import { normalizePostingType } from '../../utils/jobPosting/jobPostingHelpers';
import { JobPosting } from '../../types/jobPosting/jobPosting';

/**
 * Firestore 타입별 쿼리 통합 테스트
 *
 * 실제 Firestore 연결 없이 타입 변환 로직 테스트
 */
describe('Firestore 타입별 쿼리 통합 테스트', () => {
  describe('타입별 쿼리 시뮬레이션', () => {
    // 모의 Firestore 데이터
    const mockFirestoreData: Partial<JobPosting>[] = [
      {
        id: '1',
        title: '새 공고 (postingType)',
        postingType: 'regular',
      },
      {
        id: '2',
        title: '레거시 공고 (type)',
        type: 'fixed',
      },
      {
        id: '3',
        title: '레거시 공고 (recruitmentType)',
        recruitmentType: 'application',
      },
      {
        id: '4',
        title: '대회 공고',
        postingType: 'tournament',
      },
      {
        id: '5',
        title: '긴급 공고',
        postingType: 'urgent',
      },
    ];

    it('regular 타입 공고 필터링', () => {
      const regularPostings = mockFirestoreData.filter(
        (posting) => normalizePostingType(posting) === 'regular'
      );

      expect(regularPostings).toHaveLength(2); // id 1, 3
      expect(regularPostings.map((p) => p.id)).toContain('1');
      expect(regularPostings.map((p) => p.id)).toContain('3');
    });

    it('fixed 타입 공고 필터링', () => {
      const fixedPostings = mockFirestoreData.filter(
        (posting) => normalizePostingType(posting) === 'fixed'
      );

      expect(fixedPostings).toHaveLength(1); // id 2
      expect(fixedPostings[0]?.id).toBe('2');
    });

    it('tournament 타입 공고 필터링', () => {
      const tournamentPostings = mockFirestoreData.filter(
        (posting) => normalizePostingType(posting) === 'tournament'
      );

      expect(tournamentPostings).toHaveLength(1); // id 4
      expect(tournamentPostings[0]?.id).toBe('4');
    });

    it('urgent 타입 공고 필터링', () => {
      const urgentPostings = mockFirestoreData.filter(
        (posting) => normalizePostingType(posting) === 'urgent'
      );

      expect(urgentPostings).toHaveLength(1); // id 5
      expect(urgentPostings[0]?.id).toBe('5');
    });
  });

  describe('normalizePostingType 자동 적용', () => {
    it('Firestore에서 가져온 데이터에 자동 적용', () => {
      // Firestore에서 가져온 것처럼 시뮬레이션
      const rawData: Partial<JobPosting>[] = [
        { id: '1', type: 'application' },
        { id: '2', postingType: 'fixed' },
        { id: '3', recruitmentType: 'fixed' },
      ];

      // 클라이언트에서 정규화
      const normalized = rawData.map((data) => ({
        ...data,
        normalizedType: normalizePostingType(data),
      }));

      expect(normalized[0]?.normalizedType).toBe('regular');
      expect(normalized[1]?.normalizedType).toBe('fixed');
      expect(normalized[2]?.normalizedType).toBe('fixed');
    });

    it('여러 필드가 혼재된 경우 우선순위 적용', () => {
      const mixedData: Partial<JobPosting>[] = [
        {
          postingType: 'urgent',
          type: 'fixed',
          recruitmentType: 'application',
        },
        {
          type: 'fixed',
          recruitmentType: 'application',
        },
        {
          recruitmentType: 'fixed',
        },
      ];

      expect(normalizePostingType(mixedData[0] ?? {})).toBe('urgent');
      expect(normalizePostingType(mixedData[1] ?? {})).toBe('fixed');
      expect(normalizePostingType(mixedData[2] ?? {})).toBe('fixed');
    });
  });

  describe('타입별 그룹화', () => {
    it('postingType별로 그룹화', () => {
      const mockData: Partial<JobPosting>[] = [
        { id: '1', postingType: 'regular' },
        { id: '2', postingType: 'fixed' },
        { id: '3', postingType: 'regular' },
        { id: '4', postingType: 'tournament' },
        { id: '5', postingType: 'urgent' },
        { id: '6', type: 'fixed' },
      ];

      // 타입별 그룹화
      const grouped = mockData.reduce(
        (acc, posting) => {
          const type = normalizePostingType(posting);
          if (!acc[type]) acc[type] = [];
          acc[type]?.push(posting);
          return acc;
        },
        {} as Record<string, Partial<JobPosting>[]>
      );

      expect(grouped.regular).toHaveLength(2);
      expect(grouped.fixed).toHaveLength(2);
      expect(grouped.tournament).toHaveLength(1);
      expect(grouped.urgent).toHaveLength(1);
    });
  });

  describe('복합 쿼리 시뮬레이션', () => {
    it('타입 + 상태 복합 필터링', () => {
      const mockData: Partial<JobPosting>[] = [
        { id: '1', postingType: 'regular', status: 'open' },
        { id: '2', postingType: 'fixed', status: 'open' },
        { id: '3', postingType: 'regular', status: 'closed' },
        { id: '4', postingType: 'tournament', status: 'open' },
      ];

      const openRegular = mockData.filter(
        (p) => normalizePostingType(p) === 'regular' && p.status === 'open'
      );

      expect(openRegular).toHaveLength(1);
      expect(openRegular[0]?.id).toBe('1');
    });

    it('타입 + 작성자 복합 필터링', () => {
      const mockData: Partial<JobPosting>[] = [
        { id: '1', postingType: 'tournament', createdBy: 'user1' },
        { id: '2', postingType: 'tournament', createdBy: 'user2' },
        { id: '3', postingType: 'regular', createdBy: 'user1' },
      ];

      const user1Tournaments = mockData.filter(
        (p) => normalizePostingType(p) === 'tournament' && p.createdBy === 'user1'
      );

      expect(user1Tournaments).toHaveLength(1);
      expect(user1Tournaments[0]?.id).toBe('1');
    });
  });
});
