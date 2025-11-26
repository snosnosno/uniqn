import { Timestamp } from 'firebase/firestore';

// JobPosting 인터페이스 (기존 타입과 동일)
export interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  district: string;
  status: 'open' | 'closed';
  createdBy: string;
  postingType: 'regular' | 'fixed' | 'tournament' | 'urgent';
  dateSpecificRequirements: DateSpecificRequirement[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isChipDeducted: boolean;
  chipCost?: number;
  contactPhone?: string;
  applicationCount?: number;
}

export interface DateSpecificRequirement {
  date: string; // YYYY-MM-DD 형식
  roles: RoleRequirement[];
}

export interface RoleRequirement {
  role: string; // 역할명 (딜러, 칩러너 등)
  count: number; // 필요 인원
  salary: number; // 시급
}

/**
 * Mock JobPosting Factory 함수
 * @param overrides - 기본값을 덮어쓸 속성들
 * @returns JobPosting 객체
 */
export const createMockJobPosting = (overrides: Partial<JobPosting> = {}): JobPosting => ({
  id: `job-${Math.random().toString(36).substr(2, 9)}`,
  title: '테스트 구인공고',
  description: '테스트 설명입니다.',
  location: '서울',
  district: '강남구',
  status: 'open',
  createdBy: 'user-1',
  postingType: 'regular',
  dateSpecificRequirements: [],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  isChipDeducted: false,
  ...overrides,
});

// 사전 정의된 JobPosting Fixtures
export const mockJobPostings = {
  // 일반 공고 (모집중)
  regular: createMockJobPosting({
    id: 'job-1',
    title: '강남 홀덤펍 딜러 모집',
    description: '경험자 우대, 신규 교육 가능',
    postingType: 'regular',
    status: 'open',
    location: '서울',
    district: '강남구',
    dateSpecificRequirements: [
      {
        date: '2025-11-15',
        roles: [
          { role: '딜러', count: 2, salary: 50000 },
          { role: '칩러너', count: 1, salary: 30000 },
        ],
      },
    ],
  }),

  // 고정 공고 (상단 고정)
  fixed: createMockJobPosting({
    id: 'job-2',
    title: '⭐ 정규직 딜러 채용 (상시모집)',
    description: '정규직 딜러를 상시 모집합니다.',
    postingType: 'fixed',
    status: 'open',
    chipCost: 3,
    contactPhone: '010-1234-5678',
  }),

  // 토너먼트 공고
  tournament: createMockJobPosting({
    id: 'job-3',
    title: '🏆 대형 토너먼트 스태프 모집',
    description: '12월 대형 토너먼트 스태프 모집합니다.',
    postingType: 'tournament',
    status: 'open',
    chipCost: 5,
    dateSpecificRequirements: [
      {
        date: '2025-12-01',
        roles: [
          { role: '딜러', count: 10, salary: 80000 },
          { role: '플로어 매니저', count: 2, salary: 100000 },
        ],
      },
    ],
  }),

  // 긴급 공고
  urgent: createMockJobPosting({
    id: 'job-4',
    title: '🚨 긴급! 오늘 저녁 딜러 필요',
    description: '오늘 저녁 근무 가능한 딜러를 급하게 찾습니다.',
    postingType: 'urgent',
    status: 'open',
    dateSpecificRequirements: [
      {
        date: '2025-11-06',
        roles: [{ role: '딜러', count: 1, salary: 60000 }],
      },
    ],
  }),

  // 마감된 공고
  closed: createMockJobPosting({
    id: 'job-5',
    title: '마감된 공고',
    description: '이미 마감된 공고입니다.',
    status: 'closed',
    postingType: 'regular',
  }),

  // 지원자 수 포함 공고
  withApplications: createMockJobPosting({
    id: 'job-6',
    title: '인기 공고',
    description: '많은 지원자가 있는 공고입니다.',
    postingType: 'regular',
    status: 'open',
    applicationCount: 15,
  }),
};
