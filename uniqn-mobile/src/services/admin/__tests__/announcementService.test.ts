import {
  archiveAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  fetchAllAnnouncements,
  fetchPublishedAnnouncements,
  getAnnouncement,
  getAnnouncementCountByStatus,
  incrementViewCount,
  publishAnnouncement,
  updateAnnouncement,
} from '../announcementService';

import { ERROR_CODES } from '@/errors';
import { announcementRepository } from '@/repositories';
import { requireAdminUser } from '@/services/auth';

jest.mock('@/repositories', () => ({
  announcementRepository: {
    getPublished: jest.fn(),
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
    archive: jest.fn(),
    delete: jest.fn(),
    incrementViewCount: jest.fn(),
    getCountByStatus: jest.fn(),
  },
}));

jest.mock('@/services/auth', () => ({
  requireAdminUser: jest.fn(async () => ({ id: 'admin-1' })),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockRepo = announcementRepository as jest.Mocked<typeof announcementRepository>;
const mockRequireAdminUser = requireAdminUser as jest.MockedFunction<typeof requireAdminUser>;

describe('announcementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminUser.mockResolvedValue({ id: 'admin-1' } as never);
  });

  it('fetches published announcements', async () => {
    const result = { announcements: [{ id: 'ann-1' }], lastDoc: null, hasMore: false };
    mockRepo.getPublished.mockResolvedValue(result as never);

    await expect(fetchPublishedAnnouncements('staff')).resolves.toEqual(result);
    expect(mockRepo.getPublished).toHaveBeenCalledWith('staff', {});
  });

  it('fetches all announcements with options', async () => {
    const result = { announcements: [{ id: 'ann-1' }], lastDoc: null, hasMore: false };
    mockRepo.getAll.mockResolvedValue(result as never);

    await expect(fetchAllAnnouncements({ pageSize: 10 })).resolves.toEqual(result);
    expect(mockRepo.getAll).toHaveBeenCalledWith({ pageSize: 10 });
  });

  it('gets a single announcement', async () => {
    const announcement = { id: 'ann-1', title: 'Notice' };
    mockRepo.getById.mockResolvedValue(announcement as never);

    await expect(getAnnouncement('ann-1')).resolves.toEqual(announcement);
    expect(mockRepo.getById).toHaveBeenCalledWith('ann-1');
  });

  it('creates an announcement when the current user matches the author', async () => {
    const input = {
      title: 'Launch update',
      content: 'Detailed launch note body',
      category: 'notice' as const,
      priority: 0 as const,
      targetAudience: {
        type: 'roles' as const,
        roles: ['staff' as const],
      },
    };
    mockRepo.create.mockResolvedValue('ann-new' as never);

    await expect(createAnnouncement('admin-1', 'Admin', input)).resolves.toBe('ann-new');
    expect(mockRepo.create).toHaveBeenCalledWith(
      'admin-1',
      'Admin',
      expect.objectContaining({
        ...input,
        isPinned: false,
      })
    );
  });

  it('rejects announcement creation when the author id does not match the session user', async () => {
    const input = {
      title: 'Launch update',
      content: 'Detailed launch note body',
      category: 'notice' as const,
      priority: 0 as const,
      targetAudience: {
        type: 'roles' as const,
        roles: ['staff' as const],
      },
    };

    mockRequireAdminUser.mockRejectedValueOnce(
      Object.assign(new Error('unauthorized'), {
        code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
      })
    );

    await expect(createAnnouncement('someone-else', 'Admin', input)).rejects.toEqual(
      expect.objectContaining({
        code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
      })
    );
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('rejects admin-only announcement queries for non-admin users', async () => {
    mockRequireAdminUser.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), {
        code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
      })
    );

    await expect(fetchAllAnnouncements({ pageSize: 10 })).rejects.toEqual(
      expect.objectContaining({
        code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS,
      })
    );
    expect(mockRepo.getAll).not.toHaveBeenCalled();
  });

  it('updates, publishes, archives, deletes, and increments view count', async () => {
    mockRepo.update.mockResolvedValue(undefined as never);
    mockRepo.publish.mockResolvedValue(undefined as never);
    mockRepo.archive.mockResolvedValue(undefined as never);
    mockRepo.delete.mockResolvedValue(undefined as never);
    mockRepo.incrementViewCount.mockResolvedValue(undefined as never);

    await expect(updateAnnouncement('ann-1', { title: 'Updated title' })).resolves.toBeUndefined();
    await expect(publishAnnouncement('ann-1')).resolves.toBeUndefined();
    await expect(archiveAnnouncement('ann-1')).resolves.toBeUndefined();
    await expect(deleteAnnouncement('ann-1')).resolves.toBeUndefined();
    await expect(incrementViewCount('ann-1')).resolves.toBeUndefined();

    expect(mockRepo.update).toHaveBeenCalledWith('ann-1', { title: 'Updated title' });
    expect(mockRepo.publish).toHaveBeenCalledWith('ann-1');
    expect(mockRepo.archive).toHaveBeenCalledWith('ann-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('ann-1');
    expect(mockRepo.incrementViewCount).toHaveBeenCalledWith('ann-1');
  });

  it('returns announcement counts by status', async () => {
    const counts = { draft: 1, published: 2, archived: 3 };
    mockRepo.getCountByStatus.mockResolvedValue(counts as never);

    await expect(getAnnouncementCountByStatus()).resolves.toEqual(counts);
    expect(mockRepo.getCountByStatus).toHaveBeenCalledTimes(1);
  });
});
