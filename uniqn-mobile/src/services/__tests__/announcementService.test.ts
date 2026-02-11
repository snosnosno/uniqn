/**
 * UNIQN Mobile - AnnouncementService Tests
 *
 * @description announcementService 단위 테스트
 * @version 1.0.0
 */

import {
  fetchPublishedAnnouncements,
  fetchAllAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
  incrementViewCount,
  getAnnouncementCountByStatus,
} from '../announcementService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/firebase');

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

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  ...jest.requireActual('@/errors'),
  isAppError: jest.fn(),
  normalizeError: jest.fn((err: unknown) => {
    if (err instanceof Error) return err;
    return new Error(String(err));
  }),
}));

// ============================================================================
// Import mocked modules
// ============================================================================

import { announcementRepository } from '@/repositories';

const mockRepo = announcementRepository as jest.Mocked<typeof announcementRepository>;

// ============================================================================
// Tests
// ============================================================================

describe('announcementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // fetchPublishedAnnouncements
  // --------------------------------------------------------------------------

  describe('fetchPublishedAnnouncements', () => {
    const mockResult = {
      announcements: [
        { id: 'ann-1', title: '공지1', status: 'published' },
        { id: 'ann-2', title: '공지2', status: 'published' },
      ],
      lastDoc: null,
      hasMore: false,
    };

    it('발행된 공지사항 목록을 조회해야 한다', async () => {
      mockRepo.getPublished.mockResolvedValue(mockResult as never);

      const result = await fetchPublishedAnnouncements('staff');

      expect(mockRepo.getPublished).toHaveBeenCalledWith('staff', {});
      expect(result).toEqual(mockResult);
    });

    it('옵션을 전달하여 조회할 수 있어야 한다', async () => {
      mockRepo.getPublished.mockResolvedValue(mockResult as never);

      const options = { pageSize: 10 };
      await fetchPublishedAnnouncements('admin', options);

      expect(mockRepo.getPublished).toHaveBeenCalledWith('admin', options);
    });

    it('userRole이 null이어도 조회할 수 있어야 한다', async () => {
      mockRepo.getPublished.mockResolvedValue(mockResult as never);

      await fetchPublishedAnnouncements(null);

      expect(mockRepo.getPublished).toHaveBeenCalledWith(null, {});
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.getPublished.mockRejectedValue(new Error('DB 오류'));

      await expect(fetchPublishedAnnouncements('staff')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // fetchAllAnnouncements
  // --------------------------------------------------------------------------

  describe('fetchAllAnnouncements', () => {
    const mockResult = {
      announcements: [{ id: 'ann-1', title: '공지1' }],
      lastDoc: null,
      hasMore: false,
    };

    it('전체 공지사항 목록을 조회해야 한다', async () => {
      mockRepo.getAll.mockResolvedValue(mockResult as never);

      const result = await fetchAllAnnouncements();

      expect(mockRepo.getAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResult);
    });

    it('옵션을 전달하여 조회할 수 있어야 한다', async () => {
      mockRepo.getAll.mockResolvedValue(mockResult as never);

      const options = { pageSize: 5 };
      await fetchAllAnnouncements(options);

      expect(mockRepo.getAll).toHaveBeenCalledWith(options);
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.getAll.mockRejectedValue(new Error('DB 오류'));

      await expect(fetchAllAnnouncements()).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getAnnouncement
  // --------------------------------------------------------------------------

  describe('getAnnouncement', () => {
    const mockAnnouncement = {
      id: 'ann-1',
      title: '테스트 공지',
      status: 'published',
    };

    it('공지사항 상세를 조회해야 한다', async () => {
      mockRepo.getById.mockResolvedValue(mockAnnouncement as never);

      const result = await getAnnouncement('ann-1');

      expect(mockRepo.getById).toHaveBeenCalledWith('ann-1');
      expect(result).toEqual(mockAnnouncement);
    });

    it('존재하지 않는 공지사항은 null을 반환해야 한다', async () => {
      mockRepo.getById.mockResolvedValue(null as never);

      const result = await getAnnouncement('non-existent');

      expect(result).toBeNull();
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.getById.mockRejectedValue(new Error('DB 오류'));

      await expect(getAnnouncement('ann-1')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // createAnnouncement
  // --------------------------------------------------------------------------

  describe('createAnnouncement', () => {
    const mockInput = {
      title: '새 공지사항',
      content: '공지 내용',
      targetRoles: ['staff' as const],
      priority: 'normal' as const,
    };

    it('공지사항을 생성하고 ID를 반환해야 한다', async () => {
      mockRepo.create.mockResolvedValue('new-ann-id' as never);

      const result = await createAnnouncement(
        'author-1',
        '관리자',
        mockInput as never
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        'author-1',
        '관리자',
        mockInput
      );
      expect(result).toBe('new-ann-id');
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.create.mockRejectedValue(new Error('생성 실패'));

      await expect(
        createAnnouncement('author-1', '관리자', mockInput as never)
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // updateAnnouncement
  // --------------------------------------------------------------------------

  describe('updateAnnouncement', () => {
    const mockInput = {
      title: '수정된 공지',
    };

    it('공지사항을 수정해야 한다', async () => {
      mockRepo.update.mockResolvedValue(undefined as never);

      await updateAnnouncement('ann-1', mockInput as never);

      expect(mockRepo.update).toHaveBeenCalledWith('ann-1', mockInput);
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.update.mockRejectedValue(new Error('수정 실패'));

      await expect(
        updateAnnouncement('ann-1', mockInput as never)
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // publishAnnouncement
  // --------------------------------------------------------------------------

  describe('publishAnnouncement', () => {
    it('공지사항을 발행해야 한다', async () => {
      mockRepo.publish.mockResolvedValue(undefined as never);

      await publishAnnouncement('ann-1');

      expect(mockRepo.publish).toHaveBeenCalledWith('ann-1');
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.publish.mockRejectedValue(new Error('발행 실패'));

      await expect(publishAnnouncement('ann-1')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // archiveAnnouncement
  // --------------------------------------------------------------------------

  describe('archiveAnnouncement', () => {
    it('공지사항을 보관해야 한다', async () => {
      mockRepo.archive.mockResolvedValue(undefined as never);

      await archiveAnnouncement('ann-1');

      expect(mockRepo.archive).toHaveBeenCalledWith('ann-1');
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.archive.mockRejectedValue(new Error('보관 실패'));

      await expect(archiveAnnouncement('ann-1')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // deleteAnnouncement
  // --------------------------------------------------------------------------

  describe('deleteAnnouncement', () => {
    it('공지사항을 삭제해야 한다', async () => {
      mockRepo.delete.mockResolvedValue(undefined as never);

      await deleteAnnouncement('ann-1');

      expect(mockRepo.delete).toHaveBeenCalledWith('ann-1');
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.delete.mockRejectedValue(new Error('삭제 실패'));

      await expect(deleteAnnouncement('ann-1')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // incrementViewCount
  // --------------------------------------------------------------------------

  describe('incrementViewCount', () => {
    it('조회수를 증가시켜야 한다', async () => {
      mockRepo.incrementViewCount.mockResolvedValue(undefined as never);

      await incrementViewCount('ann-1');

      expect(mockRepo.incrementViewCount).toHaveBeenCalledWith('ann-1');
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.incrementViewCount.mockRejectedValue(new Error('조회수 증가 실패'));

      await expect(incrementViewCount('ann-1')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getAnnouncementCountByStatus
  // --------------------------------------------------------------------------

  describe('getAnnouncementCountByStatus', () => {
    const mockCounts = {
      draft: 2,
      published: 5,
      archived: 3,
    };

    it('상태별 공지사항 수를 반환해야 한다', async () => {
      mockRepo.getCountByStatus.mockResolvedValue(mockCounts as never);

      const result = await getAnnouncementCountByStatus();

      expect(mockRepo.getCountByStatus).toHaveBeenCalled();
      expect(result).toEqual(mockCounts);
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockRepo.getCountByStatus.mockRejectedValue(new Error('통계 조회 실패'));

      await expect(getAnnouncementCountByStatus()).rejects.toThrow();
    });
  });
});
