/**
 * UNIQN Mobile - Tournament Approval Service Tests
 *
 * @description 대회공고 승인 서비스 테스트
 * @version 1.0.0
 */

import {
  approveTournamentPosting,
  rejectTournamentPosting,
  resubmitTournamentPosting,
  getPendingTournamentPostings,
  getTournamentPostingsByStatus,
  getMyPendingTournamentPostings,
  getTournamentPostingById,
} from '../tournamentApprovalService';
import type { JobPosting } from '@/types';

// ============================================================================
// Mock Repository
// ============================================================================

const mockGetByPostingTypeAndApprovalStatus = jest.fn();
const mockGetByOwnerAndPostingType = jest.fn();
const mockGetById = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getByPostingTypeAndApprovalStatus: (...args: unknown[]) =>
      mockGetByPostingTypeAndApprovalStatus(...args),
    getByOwnerAndPostingType: (...args: unknown[]) => mockGetByOwnerAndPostingType(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockHttpsCallable),
}));

const mockGetFirebaseFunctions = jest.fn(() => ({} as unknown));

jest.mock('@/lib/firebase', () => ({
  getFirebaseFunctions: () => mockGetFirebaseFunctions(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

jest.mock('@/constants', () => ({
  STATUS: {
    TOURNAMENT: {
      PENDING: 'pending' as const,
      APPROVED: 'approved' as const,
      REJECTED: 'rejected' as const,
    },
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe('TournamentApprovalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('approveTournamentPosting', () => {
    const postingId = 'tournament-1';
    const approvedBy = 'admin-1';
    const approvedAt = '2026-02-12T00:00:00.000Z';

    it('성공: 대회공고 승인', async () => {
      const mockResponse = {
        success: true,
        postingId,
        approvedBy,
        approvedAt,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await approveTournamentPosting({ postingId });

      expect(result).toEqual(mockResponse);
      expect(mockHttpsCallable).toHaveBeenCalledWith({ postingId });
    });

    it('실패: 권한 없음 (unauthenticated)', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'unauthenticated',
        message: 'Unauthenticated',
      });

      await expect(approveTournamentPosting({ postingId })).rejects.toThrow('로그인이 필요합니다');
    });

    it('실패: 관리자 권한 없음 (permission-denied)', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'permission-denied',
        message: 'Permission denied',
      });

      await expect(approveTournamentPosting({ postingId })).rejects.toThrow('권한이 없습니다');
    });

    it('실패: 공고를 찾을 수 없음 (not-found)', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'not-found',
        message: 'Document not found',
      });

      await expect(approveTournamentPosting({ postingId })).rejects.toThrow(
        '공고를 찾을 수 없습니다'
      );
    });

    it('실패: 이미 처리된 공고 (failed-precondition)', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'failed-precondition',
        message: 'Already processed',
      });

      await expect(approveTournamentPosting({ postingId })).rejects.toThrow('Already processed');
    });

    it('실패: 잘못된 요청 (invalid-argument)', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'invalid-argument',
        message: 'Invalid posting ID',
      });

      await expect(approveTournamentPosting({ postingId })).rejects.toThrow();
    });

    it('실패: 네트워크 에러', async () => {
      mockHttpsCallable.mockRejectedValue(new Error('Network error'));

      await expect(approveTournamentPosting({ postingId })).rejects.toThrow();
    });
  });

  describe('rejectTournamentPosting', () => {
    const postingId = 'tournament-1';
    const reason = '대회 정보가 부정확합니다. 재제출 시 참가 인원 및 일정을 확인해주세요.';
    const rejectedBy = 'admin-1';
    const rejectedAt = '2026-02-12T00:00:00.000Z';

    it('성공: 대회공고 거부', async () => {
      const mockResponse = {
        success: true,
        postingId,
        rejectedBy,
        rejectedAt,
        reason,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await rejectTournamentPosting({ postingId, reason });

      expect(result).toEqual(mockResponse);
      expect(mockHttpsCallable).toHaveBeenCalledWith({ postingId, reason });
    });

    it('성공: 긴 거부 사유', async () => {
      const longReason = '거부 사유 내용입니다. '.repeat(30);
      const mockResponse = {
        success: true,
        postingId,
        rejectedBy,
        rejectedAt,
        reason: longReason,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await rejectTournamentPosting({ postingId, reason: longReason });

      expect(result).toEqual(mockResponse);
    });

    it('실패: 권한 없음', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'permission-denied',
        message: 'Permission denied',
      });

      await expect(rejectTournamentPosting({ postingId, reason })).rejects.toThrow(
        '권한이 없습니다'
      );
    });

    it('실패: 공고를 찾을 수 없음', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'not-found',
        message: 'Posting not found',
      });

      await expect(rejectTournamentPosting({ postingId, reason })).rejects.toThrow(
        '공고를 찾을 수 없습니다'
      );
    });

    it('실패: 이미 처리된 공고', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'failed-precondition',
        message: 'Already approved',
      });

      await expect(rejectTournamentPosting({ postingId, reason })).rejects.toThrow(
        'Already approved'
      );
    });

    it('실패: 잘못된 거부 사유 (invalid-argument)', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'invalid-argument',
        message: 'Reason too short',
      });

      await expect(rejectTournamentPosting({ postingId, reason: 'too short' })).rejects.toThrow();
    });
  });

  describe('resubmitTournamentPosting', () => {
    const postingId = 'tournament-1';
    const resubmittedBy = 'employer-1';
    const resubmittedAt = '2026-02-12T00:00:00.000Z';

    it('성공: 대회공고 재제출', async () => {
      const mockResponse = {
        success: true,
        postingId,
        resubmittedBy,
        resubmittedAt,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await resubmitTournamentPosting({ postingId });

      expect(result).toEqual(mockResponse);
      expect(mockHttpsCallable).toHaveBeenCalledWith({ postingId });
    });

    it('실패: 로그인 필요', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'unauthenticated',
        message: 'Unauthenticated',
      });

      await expect(resubmitTournamentPosting({ postingId })).rejects.toThrow(
        '로그인이 필요합니다'
      );
    });

    it('실패: 권한 없음 (공고 소유자가 아님)', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'permission-denied',
        message: 'Not owner',
      });

      await expect(resubmitTournamentPosting({ postingId })).rejects.toThrow('권한이 없습니다');
    });

    it('실패: 공고를 찾을 수 없음', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'not-found',
        message: 'Posting not found',
      });

      await expect(resubmitTournamentPosting({ postingId })).rejects.toThrow(
        '공고를 찾을 수 없습니다'
      );
    });

    it('실패: rejected 상태가 아님', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'failed-precondition',
        message: 'Not in rejected status',
      });

      await expect(resubmitTournamentPosting({ postingId })).rejects.toThrow(
        'Not in rejected status'
      );
    });

    it('실패: 이미 재제출됨', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'failed-precondition',
        message: 'Already resubmitted',
      });

      await expect(resubmitTournamentPosting({ postingId })).rejects.toThrow();
    });
  });

  describe('getPendingTournamentPostings', () => {
    it('성공: 승인 대기 목록 조회 (빈 목록)', async () => {
      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue([]);

      const result = await getPendingTournamentPostings();

      expect(result).toEqual([]);
      expect(mockGetByPostingTypeAndApprovalStatus).toHaveBeenCalledWith('tournament', 'pending');
    });

    it('성공: 승인 대기 목록 조회 (1개)', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          ownerId: 'employer-1',
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
      ];

      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue(mockPostings);

      const result = await getPendingTournamentPostings();

      expect(result).toEqual(mockPostings);
      expect(result).toHaveLength(1);
      expect(result[0]?.postingType).toBe('tournament');
      expect(result[0]?.tournamentConfig?.approvalStatus).toBe('pending');
    });

    it('성공: 승인 대기 목록 조회 (여러 개)', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          ownerId: 'employer-1',
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
        {
          id: 'tournament-2',
          title: '부산 홀덤 챔피언십',
          ownerId: 'employer-2',
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
      ];

      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue(mockPostings);

      const result = await getPendingTournamentPostings();

      expect(result).toEqual(mockPostings);
      expect(result).toHaveLength(2);
    });

    it('실패: Repository 에러', async () => {
      const error = new Error('Database error');
      mockGetByPostingTypeAndApprovalStatus.mockRejectedValue(error);

      await expect(getPendingTournamentPostings()).rejects.toThrow();
    });
  });

  describe('getTournamentPostingsByStatus', () => {
    it('성공: pending 상태 목록 조회', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
      ];

      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue(mockPostings);

      const result = await getTournamentPostingsByStatus('pending');

      expect(result).toEqual(mockPostings);
      expect(mockGetByPostingTypeAndApprovalStatus).toHaveBeenCalledWith('tournament', 'pending');
    });

    it('성공: approved 상태 목록 조회', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          postingType: 'tournament',
          tournamentConfig: {
            approvalStatus: 'approved',
            approvedBy: 'admin-1',
            approvedAt: '2026-02-12T00:00:00.000Z',
          },
        } as JobPosting,
      ];

      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue(mockPostings);

      const result = await getTournamentPostingsByStatus('approved');

      expect(result).toEqual(mockPostings);
      expect(mockGetByPostingTypeAndApprovalStatus).toHaveBeenCalledWith('tournament', 'approved');
    });

    it('성공: rejected 상태 목록 조회', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          postingType: 'tournament',
          tournamentConfig: {
            approvalStatus: 'rejected',
            rejectedBy: 'admin-1',
            rejectionReason: '대회 정보 부정확',
          },
        } as JobPosting,
      ];

      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue(mockPostings);

      const result = await getTournamentPostingsByStatus('rejected');

      expect(result).toEqual(mockPostings);
      expect(mockGetByPostingTypeAndApprovalStatus).toHaveBeenCalledWith('tournament', 'rejected');
    });

    it('성공: 빈 목록', async () => {
      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue([]);

      const result = await getTournamentPostingsByStatus('approved');

      expect(result).toEqual([]);
    });

    it('실패: Repository 에러', async () => {
      mockGetByPostingTypeAndApprovalStatus.mockRejectedValue(new Error('Query failed'));

      await expect(getTournamentPostingsByStatus('pending')).rejects.toThrow();
    });
  });

  describe('getMyPendingTournamentPostings', () => {
    const ownerId = 'employer-1';

    it('성공: 내 대회공고 조회 (빈 목록)', async () => {
      mockGetByOwnerAndPostingType.mockResolvedValue([]);

      const result = await getMyPendingTournamentPostings(ownerId);

      expect(result).toEqual([]);
      expect(mockGetByOwnerAndPostingType).toHaveBeenCalledWith(ownerId, 'tournament', [
        'pending',
        'rejected',
      ]);
    });

    it('성공: pending 상태 공고 포함', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          ownerId,
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
      ];

      mockGetByOwnerAndPostingType.mockResolvedValue(mockPostings);

      const result = await getMyPendingTournamentPostings(ownerId);

      expect(result).toEqual(mockPostings);
      expect(result).toHaveLength(1);
      expect(result[0]?.tournamentConfig?.approvalStatus).toBe('pending');
    });

    it('성공: rejected 상태 공고 포함', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          ownerId,
          postingType: 'tournament',
          tournamentConfig: {
            approvalStatus: 'rejected',
            rejectionReason: '대회 정보 부정확',
          },
        } as JobPosting,
      ];

      mockGetByOwnerAndPostingType.mockResolvedValue(mockPostings);

      const result = await getMyPendingTournamentPostings(ownerId);

      expect(result).toEqual(mockPostings);
      expect(result[0]?.tournamentConfig?.approvalStatus).toBe('rejected');
    });

    it('성공: pending + rejected 혼합', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          ownerId,
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
        {
          id: 'tournament-2',
          title: '부산 홀덤 챔피언십',
          ownerId,
          postingType: 'tournament',
          tournamentConfig: {
            approvalStatus: 'rejected',
            rejectionReason: '대회 일정 확인 필요',
          },
        } as JobPosting,
      ];

      mockGetByOwnerAndPostingType.mockResolvedValue(mockPostings);

      const result = await getMyPendingTournamentPostings(ownerId);

      expect(result).toEqual(mockPostings);
      expect(result).toHaveLength(2);
    });

    it('실패: Repository 에러', async () => {
      mockGetByOwnerAndPostingType.mockRejectedValue(new Error('Query failed'));

      await expect(getMyPendingTournamentPostings(ownerId)).rejects.toThrow();
    });
  });

  describe('getTournamentPostingById', () => {
    const postingId = 'tournament-1';

    it('성공: 대회공고 조회', async () => {
      const mockPosting: JobPosting = {
        id: postingId,
        title: '서울 홀덤 토너먼트',
        postingType: 'tournament',
        tournamentConfig: { approvalStatus: 'pending' },
      } as JobPosting;

      mockGetById.mockResolvedValue(mockPosting);

      const result = await getTournamentPostingById(postingId);

      expect(result).toEqual(mockPosting);
      expect(mockGetById).toHaveBeenCalledWith(postingId);
    });

    it('성공: 공고를 찾을 수 없음 (null 반환)', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await getTournamentPostingById(postingId);

      expect(result).toBeNull();
    });

    it('성공: 대회공고가 아닌 경우 (null 반환)', async () => {
      const mockPosting: JobPosting = {
        id: postingId,
        title: '일반 공고',
        postingType: 'regular',
      } as JobPosting;

      mockGetById.mockResolvedValue(mockPosting);

      const result = await getTournamentPostingById(postingId);

      expect(result).toBeNull();
    });

    it('성공: postingType이 undefined인 경우 (null 반환)', async () => {
      const mockPosting: JobPosting = {
        id: postingId,
        title: '레거시 공고',
        postingType: undefined,
      } as JobPosting;

      mockGetById.mockResolvedValue(mockPosting);

      const result = await getTournamentPostingById(postingId);

      expect(result).toBeNull();
    });

    it('실패: Repository 에러', async () => {
      mockGetById.mockRejectedValue(new Error('Database error'));

      await expect(getTournamentPostingById(postingId)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('approveTournamentPosting: 빈 postingId', async () => {
      mockHttpsCallable.mockRejectedValue({
        code: 'invalid-argument',
        message: 'Empty posting ID',
      });

      await expect(approveTournamentPosting({ postingId: '' })).rejects.toThrow();
    });

    it('rejectTournamentPosting: 특수문자 포함 사유', async () => {
      const reason = '대회 내용에 <script> 태그가 포함되어 있습니다. 제거 후 재제출해주세요.';
      const mockResponse = {
        success: true,
        postingId: 'tournament-1',
        rejectedBy: 'admin-1',
        rejectedAt: '2026-02-12T00:00:00.000Z',
        reason,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await rejectTournamentPosting({ postingId: 'tournament-1', reason });

      expect(result.reason).toBe(reason);
    });

    it('getTournamentPostingById: approved 상태 공고', async () => {
      const mockPosting: JobPosting = {
        id: 'tournament-1',
        title: '서울 홀덤 토너먼트',
        postingType: 'tournament',
        tournamentConfig: {
          approvalStatus: 'approved',
          approvedBy: 'admin-1',
          approvedAt: '2026-02-12T00:00:00.000Z',
        },
      } as JobPosting;

      mockGetById.mockResolvedValue(mockPosting);

      const result = await getTournamentPostingById('tournament-1');

      expect(result).toEqual(mockPosting);
      expect(result?.tournamentConfig?.approvalStatus).toBe('approved');
    });

    it('getPendingTournamentPostings: 다양한 대회 공고', async () => {
      const mockPostings: JobPosting[] = [
        {
          id: 'tournament-1',
          title: '서울 홀덤 토너먼트',
          ownerId: 'employer-1',
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
        {
          id: 'tournament-2',
          title: '부산 홀덤 챔피언십',
          ownerId: 'employer-2',
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
        {
          id: 'tournament-3',
          title: '대구 포커 대회',
          ownerId: 'employer-3',
          postingType: 'tournament',
          tournamentConfig: { approvalStatus: 'pending' },
        } as JobPosting,
      ];

      mockGetByPostingTypeAndApprovalStatus.mockResolvedValue(mockPostings);

      const result = await getPendingTournamentPostings();

      expect(result).toHaveLength(3);
      expect(result.every((p) => p.postingType === 'tournament')).toBe(true);
      expect(result.every((p) => p.tournamentConfig?.approvalStatus === 'pending')).toBe(true);
    });
  });
});
