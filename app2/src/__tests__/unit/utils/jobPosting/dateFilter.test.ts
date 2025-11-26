import {
  generateDateRange,
  filterPostingsByDate,
  isToday,
  isYesterday,
} from '@/utils/jobPosting/dateFilter';
import { JobPosting } from '@/types/jobPosting/jobPosting';
import { Timestamp } from 'firebase/firestore';
import { addDays, subDays } from 'date-fns';

describe('dateFilter 유틸리티', () => {
  describe('generateDateRange', () => {
    it('시작일과 날짜 수로 날짜 범위 배열 생성', () => {
      const startDate = new Date('2025-01-01');
      const result = generateDateRange(startDate, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Date('2025-01-01'));
      expect(result[1]).toEqual(new Date('2025-01-02'));
      expect(result[2]).toEqual(new Date('2025-01-03'));
    });

    it('단일 날짜 생성 (dayCount = 1)', () => {
      const startDate = new Date('2025-01-01');
      const result = generateDateRange(startDate, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(new Date('2025-01-01'));
    });

    it('7일 범위 생성', () => {
      const startDate = new Date('2025-01-01');
      const result = generateDateRange(startDate, 7);

      expect(result).toHaveLength(7);
      expect(result[0]).toEqual(new Date('2025-01-01'));
      expect(result[6]).toEqual(new Date('2025-01-07'));
    });

    it('월을 넘어가는 범위 처리', () => {
      const startDate = new Date('2025-01-30');
      const result = generateDateRange(startDate, 4);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(new Date('2025-01-30'));
      expect(result[3]).toEqual(new Date('2025-02-02'));
    });
  });

  describe('filterPostingsByDate', () => {
    const now = Timestamp.now();
    const mockPostings: JobPosting[] = [
      {
        id: '1',
        title: '테스트 공고 1',
        description: '설명',
        location: '서울',
        createdBy: 'user1',
        createdAt: now,
        isChipDeducted: false,
        status: 'open',
        postingType: 'regular',
        dateSpecificRequirements: [{ date: '2025-01-01', timeSlots: [] }],
      },
      {
        id: '2',
        title: '테스트 공고 2',
        description: '설명',
        location: '서울',
        createdBy: 'user1',
        createdAt: now,
        isChipDeducted: false,
        status: 'open',
        postingType: 'regular',
        dateSpecificRequirements: [{ date: '2025-01-05', timeSlots: [] }],
      },
      {
        id: '3',
        title: '테스트 공고 3',
        description: '설명',
        location: '서울',
        createdBy: 'user1',
        createdAt: now,
        isChipDeducted: false,
        status: 'open',
        postingType: 'regular',
        dateSpecificRequirements: [{ date: '2025-01-10', timeSlots: [] }],
      },
    ];

    it('특정 날짜로 공고 필터링', () => {
      const selectedDate = new Date('2025-01-01');
      const result = filterPostingsByDate(mockPostings, selectedDate);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('1');
    });

    it('null 날짜면 모든 공고 반환', () => {
      const result = filterPostingsByDate(mockPostings, null);
      expect(result).toEqual(mockPostings);
    });

    it('빈 공고 배열은 빈 배열 반환', () => {
      const result = filterPostingsByDate([], new Date('2025-01-01'));
      expect(result).toEqual([]);
    });

    it('매칭되는 공고가 없으면 빈 배열', () => {
      const result = filterPostingsByDate(mockPostings, new Date('2025-12-01'));
      expect(result).toEqual([]);
    });

    it('Timestamp 타입 날짜도 필터링 가능', () => {
      const postingWithTimestamp: JobPosting = {
        id: '4',
        title: '타임스탬프 공고',
        description: '설명',
        location: '서울',
        createdBy: 'user1',
        createdAt: now,
        isChipDeducted: false,
        status: 'open',
        postingType: 'regular',
        dateSpecificRequirements: [
          {
            date: Timestamp.fromDate(new Date('2025-01-05')),
            timeSlots: [],
          },
        ],
      };

      const result = filterPostingsByDate([postingWithTimestamp], new Date('2025-01-05'));

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('4');
    });
  });

  describe('isToday', () => {
    it('오늘 날짜는 true 반환', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it('어제 날짜는 false 반환', () => {
      const yesterday = subDays(new Date(), 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it('내일 날짜는 false 반환', () => {
      const tomorrow = addDays(new Date(), 1);
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  describe('isYesterday', () => {
    it('어제 날짜는 true 반환', () => {
      const yesterday = subDays(new Date(), 1);
      expect(isYesterday(yesterday)).toBe(true);
    });

    it('오늘 날짜는 false 반환', () => {
      const today = new Date();
      expect(isYesterday(today)).toBe(false);
    });

    it('그저께 날짜는 false 반환', () => {
      const dayBeforeYesterday = subDays(new Date(), 2);
      expect(isYesterday(dayBeforeYesterday)).toBe(false);
    });
  });

  describe('엣지 케이스', () => {
    it('dateSpecificRequirements가 빈 배열인 공고는 제외', () => {
      const now = Timestamp.now();
      const postingWithoutDates: JobPosting = {
        id: '5',
        title: '날짜 없는 공고',
        description: '설명',
        location: '서울',
        createdBy: 'user1',
        createdAt: now,
        isChipDeducted: false,
        status: 'open',
        postingType: 'regular',
        dateSpecificRequirements: [],
      };

      const result = filterPostingsByDate([postingWithoutDates], new Date('2025-01-01'));
      expect(result).toEqual([]);
    });
  });
});
