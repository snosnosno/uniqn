/**
 * T-B8 회귀: jobManagementService → schedule_board_sync_outbox enqueue 검증
 *
 * 기존 syncScheduleBoardSafely (fire-and-forget)가 outbox insert로 교체되었음을 확인.
 * 6개 mutation이 각각 올바른 action으로 outbox에 row를 enqueue하는지 검증.
 */

import {
  bulkUpdateJobPostingStatus,
  closeJobPosting,
  createJobPosting,
  deleteJobPosting,
  reopenJobPosting,
  updateJobPosting,
} from '@/services/jobs/jobManagementService';
import type { CreateJobPostingInput, JobPosting, StaffRole } from '@/types';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';

const mockCreateWithTransaction = jest.fn();
const mockUpdateWithTransaction = jest.fn();
const mockDeleteWithTransaction = jest.fn();
const mockCloseWithTransaction = jest.fn();
const mockReopenWithTransaction = jest.fn();
const mockBulkUpdateStatus = jest.fn();
const mockOutboxInsert = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    updateWithTransaction: (...args: unknown[]) => mockUpdateWithTransaction(...args),
    deleteWithTransaction: (...args: unknown[]) => mockDeleteWithTransaction(...args),
    closeWithTransaction: (...args: unknown[]) => mockCloseWithTransaction(...args),
    reopenWithTransaction: (...args: unknown[]) => mockReopenWithTransaction(...args),
    bulkUpdateStatus: (...args: unknown[]) => mockBulkUpdateStatus(...args),
    getStatsByOwnerId: jest.fn(),
    getById: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

// Phase 0 N1 hotfix: createJobPosting 이 workspace lookup 을 먼저 호출
jest.mock('@/services/workspace', () => ({
  workspaceService: {
    getDefaultWorkspaceIdForOwner: jest.fn().mockResolvedValue('workspace-uuid-default'),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'schedule_board_sync_outbox') {
        return {
          insert: (...args: unknown[]) => {
            mockOutboxInsert(...args);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };
    }),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

function createInput(): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: 'Test Job',
    description: 'Description',
    location: { name: 'Seoul', address: '강남' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-15',
      allDates: ['2026-04-15'],
      requirements: [
        {
          date: '2026-04-15',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer' as StaffRole, count: 1 }],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' as StaffRole, salary: { type: 'hourly', amount: 15000 } }],
    compensation: { mode: 'by_role' },
    questions: { items: [] },
  };
}

function createPosting(): JobPosting {
  return {
    id: 'job-test-1',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: 'Test Job',
    description: 'Description',
    status: 'active',
    ownerId: 'employer-1',
    ownerName: 'Owner',
    postingType: 'regular',
    workDate: '2026-04-15',
    workDates: ['2026-04-15'],
    roleKeys: ['dealer'],
    totalPositions: 1,
    filledPositions: 0,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    location: { name: 'Seoul', address: '강남' },
    schedule: createInput().schedule,
    roleCatalog: createInput().roleCatalog,
    compensation: createInput().compensation,
    questions: createInput().questions,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('jobManagementService — outbox enqueue', () => {
  it('createJobPosting → enqueue create', async () => {
    mockCreateWithTransaction.mockResolvedValue({ id: 'job-1', jobPosting: createPosting() });
    await createJobPosting(createInput(), 'employer-1', 'Owner');

    expect(mockOutboxInsert).toHaveBeenCalledTimes(1);
    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        job_posting_id: 'job-1',
        action: 'create',
        status: 'pending',
        retry_count: 0,
      })
    );
  });

  it('updateJobPosting → enqueue update', async () => {
    mockUpdateWithTransaction.mockResolvedValue(createPosting());
    await updateJobPosting('job-2', {} as never, 'employer-1');

    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-2', action: 'update' })
    );
  });

  it('deleteJobPosting → enqueue delete', async () => {
    mockDeleteWithTransaction.mockResolvedValue(undefined);
    await deleteJobPosting('job-3', 'employer-1');

    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-3', action: 'delete' })
    );
  });

  it('closeJobPosting → enqueue close', async () => {
    mockCloseWithTransaction.mockResolvedValue(undefined);
    await closeJobPosting('job-4', 'employer-1');

    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-4', action: 'close' })
    );
  });

  it('reopenJobPosting → enqueue reopen', async () => {
    mockReopenWithTransaction.mockResolvedValue(undefined);
    await reopenJobPosting('job-5', 'employer-1');

    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-5', action: 'reopen' })
    );
  });

  it('bulkUpdateJobPostingStatus(closed) → enqueue close per id', async () => {
    mockBulkUpdateStatus.mockResolvedValue(2);
    await bulkUpdateJobPostingStatus(['job-a', 'job-b'], 'closed', 'employer-1');

    expect(mockOutboxInsert).toHaveBeenCalledTimes(2);
    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-a', action: 'close' })
    );
    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-b', action: 'close' })
    );
  });

  it('bulkUpdateJobPostingStatus(active) → enqueue reopen per id', async () => {
    mockBulkUpdateStatus.mockResolvedValue(1);
    await bulkUpdateJobPostingStatus(['job-c'], 'active', 'employer-1');

    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-c', action: 'reopen' })
    );
  });

  it('bulkUpdateJobPostingStatus(draft) → enqueue update per id', async () => {
    mockBulkUpdateStatus.mockResolvedValue(1);
    await bulkUpdateJobPostingStatus(['job-d'], 'draft', 'employer-1');

    expect(mockOutboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-d', action: 'update' })
    );
  });
});
