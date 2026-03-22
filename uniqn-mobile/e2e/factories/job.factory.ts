/**
 * Job Posting 테스트 데이터 팩토리
 */

interface JobFactoryOptions {
  title?: string;
  status?: 'active' | 'closed' | 'cancelled';
  postingType?: 'regular' | 'fixed' | 'tournament' | 'urgent';
  ownerId?: string;
  ownerName?: string;
  locationName?: string;
  workDate?: string;
  roles?: Array<{ role: string; count: number; filled?: number }>;
}

let jobCounter = 0;

/**
 * 테스트용 공고 Firestore 문서 데이터 생성
 */
export function createTestJob(options: JobFactoryOptions = {}) {
  jobCounter++;
  const id = `test-job-${Date.now()}-${jobCounter}`;
  const workDate = options.workDate ?? '2026-04-01';

  const roles = options.roles ?? [
    { role: 'dealer', count: 2, filled: 0 },
    { role: 'floor', count: 1, filled: 0 },
  ];

  return {
    id,
    title: options.title ?? `테스트공고${jobCounter}`,
    description: `테스트 공고 설명 ${jobCounter}`,
    status: options.status ?? 'active',
    postingType: options.postingType ?? 'urgent',
    location: {
      name: options.locationName ?? '테스트포커룸',
      address: '서울시 강남구 테스트동 123',
      district: '강남구',
    },
    workDate,
    timeSlot: '18:00 - 02:00',
    roles: roles.map((r) => ({
      role: r.role,
      count: r.count,
      filled: r.filled ?? 0,
      salary: { type: 'daily', amount: 150000 },
    })),
    totalPositions: roles.reduce((sum, r) => sum + r.count, 0),
    filledPositions: roles.reduce((sum, r) => sum + (r.filled ?? 0), 0),
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: roles.reduce((sum, r) => sum + (r.filled ?? 0), 0),
    },
    defaultSalary: { type: 'daily', amount: 150000 },
    useSameSalary: true,
    ownerId: options.ownerId ?? 'test-employer-uid-001',
    ownerName: options.ownerName ?? '테스트구인자',
    viewCount: 0,
    dateSpecificRequirements: [
      {
        date: workDate,
        timeSlots: [
          {
            startTime: '18:00',
            roles: roles.map((r) => ({
              role: r.role,
              headcount: r.count,
              filled: r.filled ?? 0,
              salary: { type: 'daily', amount: 150000 },
            })),
          },
        ],
      },
    ],
    workDates: [workDate],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 마감된 공고 데이터 생성
 */
export function createClosedJob(options: JobFactoryOptions = {}) {
  return createTestJob({
    ...options,
    status: 'closed',
    title: options.title ?? `마감된 공고${jobCounter + 1}`,
  });
}

/**
 * 정원 마감 공고 데이터 생성
 */
export function createFullJob(options: JobFactoryOptions = {}) {
  return createTestJob({
    ...options,
    title: options.title ?? `정원마감 공고${jobCounter + 1}`,
    roles: [{ role: 'dealer', count: 1, filled: 1 }],
  });
}
