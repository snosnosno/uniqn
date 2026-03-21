import type { CreateJobPostingInput, JobPosting, StaffRole, UpdateJobPostingInput } from '@/types';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types';
import {
  bulkUpdateJobPostingStatus,
  closeJobPosting,
  createJobPosting,
  deleteJobPosting,
  getMyJobPostingStats,
  reopenJobPosting,
  updateJobPosting,
} from '@/services/jobs/jobManagementService';

const mockCreateWithTransaction = jest.fn();
const mockUpdateWithTransaction = jest.fn();
const mockDeleteWithTransaction = jest.fn();
const mockCloseWithTransaction = jest.fn();
const mockReopenWithTransaction = jest.fn();
const mockGetStatsByOwnerId = jest.fn();
const mockBulkUpdateStatus = jest.fn();
const mockGetById = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    updateWithTransaction: (...args: unknown[]) => mockUpdateWithTransaction(...args),
    deleteWithTransaction: (...args: unknown[]) => mockDeleteWithTransaction(...args),
    closeWithTransaction: (...args: unknown[]) => mockCloseWithTransaction(...args),
    reopenWithTransaction: (...args: unknown[]) => mockReopenWithTransaction(...args),
    getStatsByOwnerId: (...args: unknown[]) => mockGetStatsByOwnerId(...args),
    bulkUpdateStatus: (...args: unknown[]) => mockBulkUpdateStatus(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  },
}));

jest.mock('@/lib/firebase', () => ({
  db: {},
  getFirebaseDb: () => ({}),
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => ({
      toMillis: () => Date.now(),
      toDate: () => new Date(),
    }),
  },
  serverTimestamp: () => ({ _serverTimestamp: true }),
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
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

function createInput(overrides: Partial<CreateJobPostingInput> = {}): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: 'Dealer Hiring',
    description: 'Canonical job posting',
    location: {
      name: 'Seoul Gangnam',
      address: 'Teheran-ro',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-01',
      allDates: ['2026-04-01'],
      requirements: [
        {
          date: '2026-04-01',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [
                { role: 'dealer' as StaffRole, count: 2, filled: 0 },
                { role: 'manager' as StaffRole, count: 1, filled: 0 },
              ],
            },
          ],
        },
      ],
    },
    roleCatalog: [
      {
        role: 'dealer' as StaffRole,
        salary: { type: 'hourly', amount: 15000 },
      },
      {
        role: 'manager' as StaffRole,
        salary: { type: 'hourly', amount: 18000 },
      },
    ],
    compensation: {
      mode: 'by_role',
    },
    questions: {
      items: [],
    },
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
    workDate: input.schedule.kind === 'dated' ? input.schedule.primaryDate : '2026-04-01',
    workDates: input.schedule.kind === 'dated' ? input.schedule.allDates : undefined,
    roleKeys: ['dealer', 'manager'],
    totalPositions: 3,
    filledPositions: 0,
    applicationCount: 0,
    viewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    location: input.location,
    schedule: input.schedule,
    roleCatalog: input.roleCatalog,
    compensation: input.compensation,
    questions: input.questions,
    ...overrides,
  };
}

describe('jobManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJobPosting', () => {
    it('creates a single posting with canonical input', async () => {
      const input = createInput();
      const created = { id: 'job-1', jobPosting: createPosting() };
      mockCreateWithTransaction.mockResolvedValue(created);

      const result = await createJobPosting(input, 'employer-1', 'Owner');

      expect(Array.isArray(result)).toBe(false);
      expect(mockCreateWithTransaction).toHaveBeenCalledWith(input, {
        ownerId: 'employer-1',
        ownerName: 'Owner',
      });
    });

    it('splits regular multi-date postings by date and filters roleCatalog per requirement', async () => {
      const input = createInput({
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            {
              date: '2026-04-01',
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [{ role: 'dealer' as StaffRole, count: 2, filled: 0 }],
                },
              ],
            },
            {
              date: '2026-04-02',
              timeSlots: [
                {
                  startTime: '19:00',
                  roles: [{ role: 'manager' as StaffRole, count: 1, filled: 0 }],
                },
              ],
            },
          ],
        },
      });

      mockCreateWithTransaction.mockImplementation(
        async (payload: CreateJobPostingInput, context: { ownerId: string; ownerName: string }) => {
          const date = payload.schedule.kind === 'dated' ? payload.schedule.primaryDate : 'fixed';

          return {
            id: `job-${date}`,
            jobPosting: createPosting({
              id: `job-${date}`,
              ownerId: context.ownerId,
              ownerName: context.ownerName,
              workDate: date,
              workDates: payload.schedule.kind === 'dated' ? payload.schedule.allDates : undefined,
              schedule: payload.schedule,
              roleCatalog: payload.roleCatalog,
            }),
          };
        }
      );

      const result = await createJobPosting(input, 'employer-1', 'Owner');

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result).toHaveLength(2);
      }

      expect(mockCreateWithTransaction).toHaveBeenCalledTimes(2);

      const firstPayload = mockCreateWithTransaction.mock.calls[0]?.[0] as CreateJobPostingInput;
      const secondPayload = mockCreateWithTransaction.mock.calls[1]?.[0] as CreateJobPostingInput;

      expect(firstPayload.schedule).toEqual({
        kind: 'dated',
        primaryDate: '2026-04-01',
        allDates: ['2026-04-01'],
        requirements: [
          input.schedule.kind === 'dated' ? input.schedule.requirements[0] : undefined,
        ].filter(Boolean),
      });
      expect(firstPayload.roleCatalog).toEqual([
        { role: 'dealer', salary: { type: 'hourly', amount: 15000 } },
      ]);
      expect(secondPayload.roleCatalog).toEqual([
        { role: 'manager', salary: { type: 'hourly', amount: 18000 } },
      ]);
    });

    it('does not split tournament postings even if dated schedule has multiple requirements', async () => {
      const input = createInput({
        postingType: 'tournament',
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            { date: '2026-04-01', timeSlots: [] },
            { date: '2026-04-02', timeSlots: [] },
          ],
        },
      });

      mockCreateWithTransaction.mockResolvedValue({
        id: 'job-1',
        jobPosting: createPosting({
          postingType: 'tournament',
          schedule: input.schedule,
          workDates: ['2026-04-01', '2026-04-02'],
        }),
      });

      const result = await createJobPosting(input, 'employer-1', 'Owner');

      expect(Array.isArray(result)).toBe(false);
      expect(mockCreateWithTransaction).toHaveBeenCalledTimes(1);
    });

    it('keeps custom roles intact in canonical multi-date payloads', async () => {
      const input = createInput({
        roleCatalog: [
          {
            role: 'other',
            customRole: 'MC',
            salary: { type: 'hourly', amount: 20000 },
          },
        ],
        compensation: {
          mode: 'by_role',
        },
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            {
              date: '2026-04-01',
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [{ role: 'other', customRole: 'MC', count: 1, filled: 0 }],
                },
              ],
            },
            {
              date: '2026-04-02',
              timeSlots: [
                {
                  startTime: '18:00',
                  roles: [{ role: 'other', customRole: 'MC', count: 1, filled: 0 }],
                },
              ],
            },
          ],
        },
      });

      mockCreateWithTransaction.mockResolvedValue({
        id: 'custom-1',
        jobPosting: createPosting({
          id: 'custom-1',
          roleCatalog: input.roleCatalog,
          schedule: input.schedule,
        }),
      });

      await createJobPosting(input, 'employer-1', 'Owner');

      const firstPayload = mockCreateWithTransaction.mock.calls[0]?.[0] as CreateJobPostingInput;
      expect(firstPayload.roleCatalog).toEqual(input.roleCatalog);
      expect(firstPayload.schedule.kind).toBe('dated');
    });

    it('rolls back previously created postings if a later split write fails', async () => {
      const input = createInput({
        schedule: {
          kind: 'dated',
          primaryDate: '2026-04-01',
          allDates: ['2026-04-01', '2026-04-02'],
          requirements: [
            { date: '2026-04-01', timeSlots: [] },
            { date: '2026-04-02', timeSlots: [] },
          ],
        },
      });

      mockCreateWithTransaction
        .mockResolvedValueOnce({ id: 'job-2026-04-01', jobPosting: createPosting() })
        .mockRejectedValueOnce(new Error('write failed'));
      mockGetById.mockResolvedValue({ status: 'active' });
      mockUpdateStatus.mockResolvedValue(undefined);

      await expect(createJobPosting(input, 'employer-1', 'Owner')).rejects.toThrow('write failed');

      expect(mockUpdateStatus).toHaveBeenCalledWith('job-2026-04-01', 'cancelled');
    });
  });

  describe('updateJobPosting', () => {
    it('passes canonical update payloads through to the repository', async () => {
      const update: UpdateJobPostingInput = {
        compensation: {
          mode: 'shared',
          defaultSalary: { type: 'hourly', amount: 20000 },
        },
        questions: {
          items: [],
        },
      };
      const updated = createPosting({
        compensation: update.compensation!,
        questions: update.questions!,
      });
      mockUpdateWithTransaction.mockResolvedValue(updated);

      const result = await updateJobPosting('job-1', update, 'employer-1');

      expect(mockUpdateWithTransaction).toHaveBeenCalledWith('job-1', update, 'employer-1');
      expect(result.compensation.defaultSalary?.amount).toBe(20000);
    });

    it('supports canonical fixed schedule updates', async () => {
      const update: UpdateJobPostingInput = {
        schedule: {
          kind: 'fixed',
          roleRequirements: [{ role: 'dealer', count: 5, filled: 2 }],
        },
        roleCatalog: [{ role: 'dealer' }],
      };
      mockUpdateWithTransaction.mockResolvedValue(
        createPosting({
          schedule: update.schedule!,
          roleCatalog: update.roleCatalog!,
          filledPositions: 2,
        })
      );

      const result = await updateJobPosting('job-1', update, 'employer-1');

      expect(result.schedule.kind).toBe('fixed');
      if (result.schedule.kind === 'fixed') {
        expect(result.schedule.roleRequirements?.[0]?.filled).toBe(2);
      }
    });
  });

  describe('passthrough repository actions', () => {
    it('delegates delete/close/reopen', async () => {
      mockDeleteWithTransaction.mockResolvedValue(undefined);
      mockCloseWithTransaction.mockResolvedValue(undefined);
      mockReopenWithTransaction.mockResolvedValue(undefined);

      await deleteJobPosting('job-1', 'employer-1');
      await closeJobPosting('job-1', 'employer-1');
      await reopenJobPosting('job-1', 'employer-1');

      expect(mockDeleteWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
      expect(mockCloseWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
      expect(mockReopenWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
    });

    it('delegates stats and bulk status queries', async () => {
      mockGetStatsByOwnerId.mockResolvedValue({ total: 4, active: 2, closed: 1, cancelled: 1 });
      mockBulkUpdateStatus.mockResolvedValue(2);

      const stats = await getMyJobPostingStats('employer-1');
      const count = await bulkUpdateJobPostingStatus(['job-1', 'job-2'], 'closed', 'employer-1');

      expect(stats.total).toBe(4);
      expect(count).toBe(2);
      expect(mockGetStatsByOwnerId).toHaveBeenCalledWith('employer-1');
      expect(mockBulkUpdateStatus).toHaveBeenCalledWith(['job-1', 'job-2'], 'closed', 'employer-1');
    });
  });
});
