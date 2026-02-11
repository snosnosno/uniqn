/**
 * UNIQN Mobile - ReportService Tests
 *
 * @description reportService 단위 테스트
 * @version 1.0.0
 */

import {
  createReport,
  getReportsByJobPosting,
  getReportsByStaff,
  getMyReports,
  getReportById,
  reviewReport,
  getReportCountByStaff,
  getAllReports,
} from '../reportService';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/firebase');

const mockCurrentUser = { uid: 'user-1', email: 'test@test.com' };

// Override auth mock to provide currentUser
jest.mock('@/lib/firebase', () => ({
  ...jest.requireActual('@/lib/firebase'),
  auth: { currentUser: null },
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('@/repositories', () => ({
  reportRepository: {
    createWithTransaction: jest.fn(),
    getByJobPostingId: jest.fn(),
    getByTargetId: jest.fn(),
    getByReporterId: jest.fn(),
    getById: jest.fn(),
    reviewWithTransaction: jest.fn(),
    getCountsByTargetId: jest.fn(),
    getAll: jest.fn(),
  },
  userRepository: {
    getById: jest.fn(),
  },
}));

jest.mock('@/schemas', () => ({
  createReportInputSchema: {
    safeParse: jest.fn(),
  },
  reviewReportInputSchema: {
    safeParse: jest.fn(),
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
  toError: jest.fn((err: unknown) => {
    if (err instanceof Error) return err;
    return new Error(String(err));
  }),
}));

// ============================================================================
// Import mocked modules
// ============================================================================

import { auth } from '@/lib/firebase';
import { reportRepository, userRepository } from '@/repositories';
import { createReportInputSchema, reviewReportInputSchema } from '@/schemas';

const mockAuth = auth as jest.Mocked<typeof auth>;
const mockReportRepo = reportRepository as jest.Mocked<typeof reportRepository>;
const mockUserRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockCreateReportSchema = createReportInputSchema as jest.Mocked<typeof createReportInputSchema>;
const mockReviewReportSchema = reviewReportInputSchema as jest.Mocked<typeof reviewReportInputSchema>;

// ============================================================================
// Tests
// ============================================================================

describe('reportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user is authenticated
    (mockAuth as unknown as Record<string, unknown>).currentUser = mockCurrentUser;
  });

  // --------------------------------------------------------------------------
  // createReport
  // --------------------------------------------------------------------------

  describe('createReport', () => {
    const mockInput = {
      type: 'no_show',
      reporterType: 'employer',
      targetId: 'target-user-1',
      jobPostingId: 'job-1',
      description: '무단 결근',
    };

    it('신고를 생성하고 ID를 반환해야 한다', async () => {
      mockCreateReportSchema.safeParse.mockReturnValue({
        success: true,
        data: mockInput,
      } as never);
      mockUserRepo.getById.mockResolvedValue({
        name: '테스트 유저',
        nickname: '닉네임',
      } as never);
      mockReportRepo.createWithTransaction.mockResolvedValue('report-1');

      const result = await createReport(mockInput as never);

      expect(result).toBe('report-1');
      expect(mockReportRepo.createWithTransaction).toHaveBeenCalledWith(
        mockInput,
        {
          reporterId: 'user-1',
          reporterName: '테스트 유저',
        }
      );
    });

    it('인증되지 않은 사용자면 AuthError를 던져야 한다', async () => {
      (mockAuth as unknown as Record<string, unknown>).currentUser = null;

      await expect(createReport(mockInput as never)).rejects.toThrow();
    });

    it('검증 실패 시 ValidationError를 던져야 한다', async () => {
      mockCreateReportSchema.safeParse.mockReturnValue({
        success: false,
        error: {
          issues: [{ message: '필수 항목입니다' }],
          flatten: () => ({ fieldErrors: { type: ['필수 항목입니다'] } }),
        },
      } as never);

      await expect(createReport(mockInput as never)).rejects.toThrow();
    });

    it('프로필 조회 실패 시 익명으로 진행해야 한다', async () => {
      mockCreateReportSchema.safeParse.mockReturnValue({
        success: true,
        data: mockInput,
      } as never);
      mockUserRepo.getById.mockRejectedValue(new Error('프로필 조회 실패'));
      mockReportRepo.createWithTransaction.mockResolvedValue('report-1');

      const result = await createReport(mockInput as never);

      expect(result).toBe('report-1');
      expect(mockReportRepo.createWithTransaction).toHaveBeenCalledWith(
        mockInput,
        {
          reporterId: 'user-1',
          reporterName: '익명',
        }
      );
    });

    it('프로필에 name이 없으면 nickname을 사용해야 한다', async () => {
      mockCreateReportSchema.safeParse.mockReturnValue({
        success: true,
        data: mockInput,
      } as never);
      mockUserRepo.getById.mockResolvedValue({
        name: null,
        nickname: '닉네임유저',
      } as never);
      mockReportRepo.createWithTransaction.mockResolvedValue('report-1');

      await createReport(mockInput as never);

      expect(mockReportRepo.createWithTransaction).toHaveBeenCalledWith(
        mockInput,
        {
          reporterId: 'user-1',
          reporterName: '닉네임유저',
        }
      );
    });

    it('프로필이 없으면 익명으로 처리해야 한다', async () => {
      mockCreateReportSchema.safeParse.mockReturnValue({
        success: true,
        data: mockInput,
      } as never);
      mockUserRepo.getById.mockResolvedValue(null);
      mockReportRepo.createWithTransaction.mockResolvedValue('report-1');

      await createReport(mockInput as never);

      expect(mockReportRepo.createWithTransaction).toHaveBeenCalledWith(
        mockInput,
        {
          reporterId: 'user-1',
          reporterName: '익명',
        }
      );
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockCreateReportSchema.safeParse.mockReturnValue({
        success: true,
        data: mockInput,
      } as never);
      mockUserRepo.getById.mockResolvedValue({ name: '유저' } as never);
      mockReportRepo.createWithTransaction.mockRejectedValue(
        new Error('트랜잭션 실패')
      );

      await expect(createReport(mockInput as never)).rejects.toThrow(
        '트랜잭션 실패'
      );
    });
  });

  // --------------------------------------------------------------------------
  // getReportsByJobPosting
  // --------------------------------------------------------------------------

  describe('getReportsByJobPosting', () => {
    it('공고별 신고 목록을 조회해야 한다', async () => {
      const mockReports = [
        { id: 'report-1', jobPostingId: 'job-1' },
        { id: 'report-2', jobPostingId: 'job-1' },
      ];
      mockReportRepo.getByJobPostingId.mockResolvedValue(mockReports as never);

      const result = await getReportsByJobPosting('job-1');

      expect(mockReportRepo.getByJobPostingId).toHaveBeenCalledWith('job-1');
      expect(result).toEqual(mockReports);
    });

    it('신고가 없으면 빈 배열을 반환해야 한다', async () => {
      mockReportRepo.getByJobPostingId.mockResolvedValue([]);

      const result = await getReportsByJobPosting('job-1');

      expect(result).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getReportsByStaff
  // --------------------------------------------------------------------------

  describe('getReportsByStaff', () => {
    it('스태프별 신고 목록을 조회해야 한다', async () => {
      const mockReports = [{ id: 'report-1', targetId: 'staff-1' }];
      mockReportRepo.getByTargetId.mockResolvedValue(mockReports as never);

      const result = await getReportsByStaff('staff-1');

      expect(mockReportRepo.getByTargetId).toHaveBeenCalledWith('staff-1');
      expect(result).toEqual(mockReports);
    });
  });

  // --------------------------------------------------------------------------
  // getMyReports
  // --------------------------------------------------------------------------

  describe('getMyReports', () => {
    it('내가 신고한 목록을 조회해야 한다', async () => {
      const mockReports = [
        { id: 'report-1', reporterId: 'user-1' },
      ];
      mockReportRepo.getByReporterId.mockResolvedValue(mockReports as never);

      const result = await getMyReports();

      expect(mockReportRepo.getByReporterId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockReports);
    });

    it('인증되지 않은 사용자면 AuthError를 던져야 한다', async () => {
      (mockAuth as unknown as Record<string, unknown>).currentUser = null;

      await expect(getMyReports()).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // getReportById
  // --------------------------------------------------------------------------

  describe('getReportById', () => {
    it('신고 상세를 조회해야 한다', async () => {
      const mockReport = {
        id: 'report-1',
        type: 'no_show',
        status: 'pending',
      };
      mockReportRepo.getById.mockResolvedValue(mockReport as never);

      const result = await getReportById('report-1');

      expect(mockReportRepo.getById).toHaveBeenCalledWith('report-1');
      expect(result).toEqual(mockReport);
    });

    it('존재하지 않는 신고는 null을 반환해야 한다', async () => {
      mockReportRepo.getById.mockResolvedValue(null);

      const result = await getReportById('non-existent');

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // reviewReport
  // --------------------------------------------------------------------------

  describe('reviewReport', () => {
    const mockInput = {
      reportId: 'report-1',
      status: 'resolved',
      adminNote: '처리 완료',
    };

    it('신고를 처리해야 한다', async () => {
      mockReviewReportSchema.safeParse.mockReturnValue({
        success: true,
        data: mockInput,
      } as never);
      mockReportRepo.reviewWithTransaction.mockResolvedValue(undefined);

      await reviewReport(mockInput as never);

      expect(mockReportRepo.reviewWithTransaction).toHaveBeenCalledWith(
        mockInput,
        'user-1'
      );
    });

    it('인증되지 않은 사용자면 AuthError를 던져야 한다', async () => {
      (mockAuth as unknown as Record<string, unknown>).currentUser = null;

      await expect(reviewReport(mockInput as never)).rejects.toThrow();
    });

    it('검증 실패 시 ValidationError를 던져야 한다', async () => {
      mockReviewReportSchema.safeParse.mockReturnValue({
        success: false,
        error: {
          issues: [{ message: '필수 항목입니다' }],
          flatten: () => ({ fieldErrors: {} }),
        },
      } as never);

      await expect(reviewReport(mockInput as never)).rejects.toThrow();
    });

    it('repository 에러 시 에러를 던져야 한다', async () => {
      mockReviewReportSchema.safeParse.mockReturnValue({
        success: true,
        data: mockInput,
      } as never);
      mockReportRepo.reviewWithTransaction.mockRejectedValue(
        new Error('처리 실패')
      );

      await expect(reviewReport(mockInput as never)).rejects.toThrow(
        '처리 실패'
      );
    });
  });

  // --------------------------------------------------------------------------
  // getReportCountByStaff
  // --------------------------------------------------------------------------

  describe('getReportCountByStaff', () => {
    it('스태프별 신고 횟수를 반환해야 한다', async () => {
      const mockCounts = {
        total: 5,
        critical: 1,
        high: 2,
        medium: 1,
        low: 1,
      };
      mockReportRepo.getCountsByTargetId.mockResolvedValue(mockCounts);

      const result = await getReportCountByStaff('staff-1');

      expect(mockReportRepo.getCountsByTargetId).toHaveBeenCalledWith('staff-1');
      expect(result).toEqual(mockCounts);
    });

    it('신고가 없으면 모두 0을 반환해야 한다', async () => {
      const mockCounts = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
      mockReportRepo.getCountsByTargetId.mockResolvedValue(mockCounts);

      const result = await getReportCountByStaff('staff-1');

      expect(result.total).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // getAllReports
  // --------------------------------------------------------------------------

  describe('getAllReports', () => {
    it('전체 신고 목록을 조회해야 한다', async () => {
      const mockReports = [
        { id: 'report-1', status: 'pending' },
        { id: 'report-2', status: 'resolved' },
      ];
      mockReportRepo.getAll.mockResolvedValue(mockReports as never);

      const result = await getAllReports();

      expect(mockReportRepo.getAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockReports);
    });

    it('필터를 적용하여 조회할 수 있어야 한다', async () => {
      mockReportRepo.getAll.mockResolvedValue([]);

      const filters = { status: 'pending' as const, severity: 'high' as const };
      await getAllReports(filters);

      expect(mockReportRepo.getAll).toHaveBeenCalledWith(filters);
    });

    it('인증되지 않은 사용자면 AuthError를 던져야 한다', async () => {
      (mockAuth as unknown as Record<string, unknown>).currentUser = null;

      await expect(getAllReports()).rejects.toThrow();
    });
  });
});
