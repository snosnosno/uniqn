/**
 * B4: 비-대회 공고 생성 시 기본 지점(venue 컨테이너) 자동 연결 검증(grid-auto-sync D1).
 *
 * 계약:
 * - 비-대회 + venueId 미지정 + 지점 1개 → 그 지점 id 로 자동 연결한다.
 * - 지점 0개 → 기본 지점을 생성(get-or-create)해 그 id 로 연결한다.
 * - 지점 2개 이상 → 자동 연결하지 않는다(폼 선택칩=B5 담당). venueId 미지정 유지.
 * - 대회 공고 → 분기 진입하지 않는다(venue_id NULL 유지, 관련 리포 미호출).
 * - venueId 가 이미 지정됐으면 자동 연결 로직에 진입하지 않는다(그대로 사용).
 * - 지점 조회/생성 실패는 공고 생성을 실패시키지 않는다(non-blocking, 기존 동작 보존).
 */

import type { CreateJobPostingInput, JobPosting, StaffRole } from '@/types';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { createJobPosting } from '@/services/jobs/jobManagementService';

const mockCreateWithTransaction = jest.fn();
const mockEnqueueScheduleBoardSync = jest.fn();
const mockGetVenueContainers = jest.fn();
const mockGetOrCreateVenueContainer = jest.fn();
const mockGetDefaultWorkspaceIdForOwner = jest.fn();
const mockIsMemberOfWorkspace = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    enqueueScheduleBoardSync: (...args: unknown[]) => mockEnqueueScheduleBoardSync(...args),
    getVenueContainers: (...args: unknown[]) => mockGetVenueContainers(...args),
    getOrCreateVenueContainer: (...args: unknown[]) => mockGetOrCreateVenueContainer(...args),
  },
}));

jest.mock('@/services/auth/authCoreService', () => ({
  requireCurrentUser: jest.fn(),
}));

jest.mock('@/services/workspace', () => ({
  workspaceService: {
    getDefaultWorkspaceIdForOwner: (...args: unknown[]) =>
      mockGetDefaultWorkspaceIdForOwner(...args),
    isMemberOfWorkspace: (...args: unknown[]) => mockIsMemberOfWorkspace(...args),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

function createInput(overrides: Partial<CreateJobPostingInput> = {}): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: 'Dealer Hiring',
    description: 'Canonical job posting',
    location: { name: 'Seoul Gangnam', address: 'Teheran-ro' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-01',
      allDates: ['2026-04-01'],
      requirements: [
        {
          date: '2026-04-01',
          timeSlots: [{ startTime: '18:00', roles: [{ role: 'dealer' as StaffRole, count: 2 }] }],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' as StaffRole, salary: { type: 'hourly', amount: 15000 } }],
    compensation: { mode: 'by_role' },
    questions: { items: [] },
    ...overrides,
  };
}

function createPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  const input = createInput();
  return {
    id: 'job-1',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: input.title,
    description: input.description,
    status: 'active',
    ownerId: 'employer-1',
    ownerName: 'Owner',
    postingType: input.postingType,
    workDate: '2026-04-01',
    workDates: ['2026-04-01'],
    roleKeys: ['dealer'],
    totalPositions: 2,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: input.location,
    schedule: input.schedule,
    roleCatalog: input.roleCatalog,
    compensation: input.compensation,
    questions: input.questions,
    ...overrides,
  };
}

function venueContainer(id: string, name = '기본 지점') {
  return {
    id,
    name,
    workspaceId: 'workspace-1',
    ownerId: 'employer-1',
    venueId: id,
    kind: 'dated',
    softTargets: {},
  };
}

/** createWithTransaction 로 전달된 input(1번째 인자)을 회수한다. */
function passedInput(): CreateJobPostingInput {
  return mockCreateWithTransaction.mock.calls[0][0] as CreateJobPostingInput;
}

describe('jobManagementService — 비-대회 공고 기본 지점 자동 연결(B4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMemberOfWorkspace.mockResolvedValue(true);
    mockEnqueueScheduleBoardSync.mockResolvedValue(undefined);
    mockCreateWithTransaction.mockResolvedValue({ id: 'job-1', jobPosting: createPosting() });
  });

  it('비-대회 + venueId 미지정 + 지점 1개 → 그 지점 id 로 연결한다', async () => {
    mockGetVenueContainers.mockResolvedValue([venueContainer('venue-1')]);

    await createJobPosting(createInput(), 'employer-1', 'Owner', 'workspace-1');

    expect(mockGetVenueContainers).toHaveBeenCalledWith('workspace-1');
    expect(mockGetOrCreateVenueContainer).not.toHaveBeenCalled();
    expect(passedInput().venueId).toBe('venue-1');
  });

  it('지점 0개 → 기본 지점을 생성(get-or-create)해 그 id 로 연결한다', async () => {
    mockGetVenueContainers.mockResolvedValue([]);
    mockGetOrCreateVenueContainer.mockResolvedValue(venueContainer('venue-new'));

    await createJobPosting(createInput(), 'employer-1', 'Owner', 'workspace-1');

    expect(mockGetOrCreateVenueContainer).toHaveBeenCalledWith('workspace-1', {
      name: '기본 지점',
      kind: 'dated',
    });
    expect(passedInput().venueId).toBe('venue-new');
  });

  it('지점 2개 이상 → 자동 연결하지 않는다(venueId 미지정, get-or-create 미호출)', async () => {
    mockGetVenueContainers.mockResolvedValue([
      venueContainer('venue-1'),
      venueContainer('venue-2'),
    ]);

    await createJobPosting(createInput(), 'employer-1', 'Owner', 'workspace-1');

    expect(mockGetOrCreateVenueContainer).not.toHaveBeenCalled();
    expect(passedInput().venueId).toBeUndefined();
  });

  it('대회 공고 → 분기 진입 안 함(venue_id NULL, 관련 리포 미호출)', async () => {
    await createJobPosting(
      createInput({ postingType: 'tournament' }),
      'employer-1',
      'Owner',
      'workspace-1'
    );

    expect(mockGetVenueContainers).not.toHaveBeenCalled();
    expect(mockGetOrCreateVenueContainer).not.toHaveBeenCalled();
    expect(passedInput().venueId).toBeUndefined();
  });

  it('venueId 가 이미 지정됐으면 자동 연결 로직에 진입하지 않는다(그대로 사용)', async () => {
    await createJobPosting(
      createInput({ venueId: 'venue-explicit' }),
      'employer-1',
      'Owner',
      'workspace-1'
    );

    expect(mockGetVenueContainers).not.toHaveBeenCalled();
    expect(mockGetOrCreateVenueContainer).not.toHaveBeenCalled();
    expect(passedInput().venueId).toBe('venue-explicit');
  });

  it('지점 조회 실패는 공고 생성을 실패시키지 않는다(non-blocking, venueId 미지정)', async () => {
    mockGetVenueContainers.mockRejectedValue(new Error('네트워크 오류'));

    await expect(
      createJobPosting(createInput(), 'employer-1', 'Owner', 'workspace-1')
    ).resolves.toMatchObject({ id: 'job-1' });

    expect(mockCreateWithTransaction).toHaveBeenCalledTimes(1);
    expect(passedInput().venueId).toBeUndefined();
  });
});
