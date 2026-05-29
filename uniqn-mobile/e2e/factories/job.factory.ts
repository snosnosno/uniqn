/**
 * Job Posting test data factory
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

function getRelativeDate(daysOffset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

function normalizeUrgentWorkDate(workDate?: string): string {
  if (!workDate) {
    return getRelativeDate(2);
  }

  const parsed = new Date(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return getRelativeDate(2);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.floor((parsed.getTime() - today.getTime()) / 86_400_000);

  return diffDays >= 0 && diffDays <= 7 ? workDate : getRelativeDate(2);
}

/**
 * Create a canonical V3 job posting document for Firestore-backed E2E flows.
 */
export function createTestJob(options: JobFactoryOptions = {}) {
  jobCounter++;

  const id = `test-job-${Date.now()}-${jobCounter}`;
  const postingType = options.postingType ?? 'regular';
  const roles = options.roles ?? [
    { role: 'dealer', count: 2, filled: 0 },
    { role: 'floor', count: 1, filled: 0 },
  ];
  const createdAt = new Date();
  const updatedAt = new Date(createdAt);
  const defaultSalary = { type: 'daily' as const, amount: 150000 };
  const workDate =
    postingType === 'urgent'
      ? normalizeUrgentWorkDate(options.workDate)
      : (options.workDate ?? getRelativeDate(10));

  const totalPositions = roles.reduce((sum, role) => sum + role.count, 0);
  const filledPositions = roles.reduce((sum, role) => sum + (role.filled ?? 0), 0);

  const datedRequirements = [
    {
      date: workDate,
      timeSlots: [
        {
          startTime: '18:00',
          roles: roles.map((role) => ({
            role: role.role,
            count: role.count,
            filled: role.filled ?? 0,
          })),
        },
      ],
    },
  ];

  const fixedRoleRequirements = roles.map((role) => ({
    role: role.role,
    count: role.count,
    filled: role.filled ?? 0,
  }));

  const schedule =
    postingType === 'fixed'
      ? {
          kind: 'fixed' as const,
          daysPerWeek: 5,
          startTime: '18:00',
          roleRequirements: fixedRoleRequirements,
        }
      : {
          kind: 'dated' as const,
          primaryDate: workDate,
          allDates: [workDate],
          requirements: datedRequirements,
        };

  const baseDocument = {
    id,
    schemaVersion: 3 as const,
    title: options.title ?? `테스트공고 ${jobCounter}`,
    description: `테스트 공고 설명 ${jobCounter}`,
    status: options.status ?? 'active',
    ownerId: options.ownerId ?? 'test-employer-uid-001',
    ownerName: options.ownerName ?? '테스트구인자',
    postingType,
    workDate: postingType === 'fixed' ? '' : workDate,
    ...(postingType !== 'fixed' ? { workDates: [workDate] } : {}),
    totalPositions,
    filledPositions,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions,
    },
    createdAt,
    updatedAt,
    contactPhone: '+82101234567',
    location: {
      name: options.locationName ?? '테스트홀덤펍',
      district: '강남구',
      detailedAddress: '테스트로 123',
    },
    schedule,
    roleCatalog: roles.map((role) => ({
      role: role.role,
      salary: defaultSalary,
    })),
    compensation: {
      mode: 'shared' as const,
      defaultSalary,
    },
    questions: {
      items: [],
    },
  };

  if (postingType === 'fixed') {
    return {
      ...baseDocument,
      fixedConfig: {
        durationDays: 7 as const,
        expiresAt: new Date(createdAt.getTime() + 7 * 86_400_000),
        createdAt,
      },
      ...(baseDocument.status === 'closed'
        ? {
            closedAt: updatedAt,
            closedReason: 'manual' as const,
          }
        : {}),
    };
  }

  return {
    ...baseDocument,
    ...(postingType === 'tournament'
      ? {
          tournamentConfig: {
            approvalStatus: 'approved' as const,
            approvedBy: 'test-admin-uid-001',
            approvedAt: updatedAt,
            submittedAt: createdAt,
          },
        }
      : {}),
    ...(postingType === 'urgent'
      ? {
          urgentConfig: {
            createdAt,
            priority: 'high' as const,
          },
        }
      : {}),
    ...(baseDocument.status === 'closed'
      ? {
          closedAt: updatedAt,
          closedReason: 'manual' as const,
        }
      : {}),
  };
}

/**
 * Create a closed posting.
 */
export function createClosedJob(options: JobFactoryOptions = {}) {
  return createTestJob({
    ...options,
    status: 'closed',
    title: options.title ?? `마감공고 ${jobCounter + 1}`,
  });
}

/**
 * Create a fully staffed posting.
 */
export function createFullJob(options: JobFactoryOptions = {}) {
  return createTestJob({
    ...options,
    title: options.title ?? `정원마감공고 ${jobCounter + 1}`,
    roles: [{ role: 'dealer', count: 1, filled: 1 }],
  });
}
