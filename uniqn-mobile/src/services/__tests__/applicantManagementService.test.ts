/**
 * UNIQN Mobile - Applicant Management Service Tests
 *
 * @description 지원자 관리 서비스 테스트 (구인자용)
 * @version 2.0.0 - Repository 패턴 + Assignment v2.0
 */

import type {
  Application,
  ApplicationStats,
  ConfirmApplicationInput,
  RejectApplicationInput,
  StaffRole,
} from '@/types';
import type { ApplicantListWithStats } from '@/repositories';

// ============================================================================
// Mock Setup (호이스팅을 위해 파일 최상단에 배치)
// ============================================================================

const mockFindByJobPostingWithStats = jest.fn();
const mockGetById = jest.fn();
const mockRejectWithTransaction = jest.fn();
const mockMarkAsRead = jest.fn();
const mockSubscribeByJobPosting = jest.fn();
const mockVerifyOwnership = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    findByJobPostingWithStats: (...args: unknown[]) => mockFindByJobPostingWithStats(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    rejectWithTransaction: (...args: unknown[]) => mockRejectWithTransaction(...args),
    markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
    subscribeByJobPosting: (...args: unknown[]) => mockSubscribeByJobPosting(...args),
  },
  jobPostingRepository: {
    verifyOwnership: (...args: unknown[]) => mockVerifyOwnership(...args),
  },
}));

const mockConfirmApplicationWithHistory = jest.fn();

jest.mock('@/services/applicationHistoryService', () => ({
  confirmApplicationWithHistory: (...args: unknown[]) => mockConfirmApplicationWithHistory(...args),
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

jest.mock('@/errors', () => {
  class BusinessError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = message;
    }
  }
  class PermissionError extends Error {
    public userMessage: string;
    public code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'PermissionError';
      this.code = code;
      this.userMessage = message;
    }
  }
  return {
    isAppError: (error: unknown) =>
      error instanceof BusinessError || error instanceof PermissionError,
    ERROR_CODES: {
      FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
      FIREBASE_PERMISSION_DENIED: 'E4001',
      BUSINESS_ALREADY_APPLIED: 'E6001',
      BUSINESS_MAX_CAPACITY_REACHED: 'E6003',
    },
    BusinessError,
    PermissionError,
  };
});

jest.mock('@/constants/statusConfig', () => ({
  STATUS_TO_STATS_KEY: {
    applied: 'applied',
    pending: 'pending',
    confirmed: 'confirmed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    completed: 'completed',
    cancellationPending: 'cancellationPending',
  },
}));

// Import after mocks
import {
  getApplicantsByJobPosting,
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  markApplicationAsRead,
  getApplicantStatsByRole,
  verifyJobPostingOwnership,
  subscribeToApplicants,
  subscribeToApplicantsAsync,
} from '@/services/applicantManagementService';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    jobPostingId: 'job-1',
    applicantId: 'user-1',
    applicantName: '김스태프',
    applicantPhone: '010-1234-5678',
    status: 'applied',
    assignments: [
      {
        dates: ['2024-02-01'],
        roleIds: ['dealer' as StaffRole],
        timeSlot: '09:00-18:00',
      },
    ],
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    ...overrides,
  } as Application;
}

function createMockStats(overrides: Partial<ApplicationStats> = {}): ApplicationStats {
  return {
    total: 0,
    applied: 0,
    pending: 0,
    confirmed: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    cancellationPending: 0,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('applicantManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getApplicantsByJobPosting
  // ==========================================================================

  describe('getApplicantsByJobPosting', () => {
    it('공고별 지원자 목록을 조회해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({ id: 'app-1' }),
          createMockApplication({ id: 'app-2', applicantName: '이스태프' }),
        ],
        stats: createMockStats({ total: 2, applied: 2 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantsByJobPosting('job-1', 'employer-1');

      expect(result.applicants).toHaveLength(2);
      expect(result.stats.total).toBe(2);
      expect(result.stats.applied).toBe(2);
      expect(mockFindByJobPostingWithStats).toHaveBeenCalledWith('job-1', 'employer-1', undefined);
    });

    it('상태 필터를 적용하여 조회해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [createMockApplication({ status: 'confirmed' })],
        stats: createMockStats({ total: 1, confirmed: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantsByJobPosting('job-1', 'employer-1', 'confirmed');

      expect(result.applicants).toHaveLength(1);
      expect(result.applicants[0]?.status).toBe('confirmed');
      expect(mockFindByJobPostingWithStats).toHaveBeenCalledWith('job-1', 'employer-1', 'confirmed');
    });

    it('다중 상태 필터를 적용하여 조회해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({ id: 'app-1', status: 'confirmed' }),
          createMockApplication({ id: 'app-2', status: 'pending' }),
        ],
        stats: createMockStats({ total: 2, confirmed: 1, pending: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantsByJobPosting('job-1', 'employer-1', ['confirmed', 'pending']);

      expect(result.applicants).toHaveLength(2);
      expect(mockFindByJobPostingWithStats).toHaveBeenCalledWith('job-1', 'employer-1', [
        'confirmed',
        'pending',
      ]);
    });

    it('지원자가 없으면 빈 배열과 0 통계를 반환해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [],
        stats: createMockStats(),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantsByJobPosting('job-1', 'employer-1');

      expect(result.applicants).toHaveLength(0);
      expect(result.stats.total).toBe(0);
    });

    it('Repository 에러를 전파해야 함', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockFindByJobPostingWithStats.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '권한이 없습니다',
        })
      );

      await expect(getApplicantsByJobPosting('job-1', 'employer-1')).rejects.toThrow('권한이 없습니다');
    });
  });

  // ==========================================================================
  // confirmApplication
  // ==========================================================================

  describe('confirmApplication', () => {
    it('지원을 확정해야 함 (v1 형식)', async () => {
      const input: ConfirmApplicationInput = {
        applicationId: 'app-1',
      };

      mockGetById.mockResolvedValue(createMockApplication({ id: 'app-1' }));

      mockConfirmApplicationWithHistory.mockResolvedValue({
        applicationId: 'app-1',
        workLogIds: ['work-1'],
        message: '김스태프님의 지원이 확정되었습니다',
        historyEntry: {},
      });

      const result = await confirmApplication(input, 'employer-1');

      expect(result.applicationId).toBe('app-1');
      expect(result.workLogId).toBe('work-1');
      expect(mockConfirmApplicationWithHistory).toHaveBeenCalled();
    });

    it('지원을 확정해야 함 (v2 형식, selectedAssignments 포함)', async () => {
      const mockApplication = createMockApplication({
        id: 'app-1',
        assignments: [
          {
            dates: ['2024-02-01', '2024-02-02'],
            roleIds: ['dealer' as StaffRole],
            timeSlot: '09:00-18:00',
          },
        ],
      });

      mockGetById.mockResolvedValue(mockApplication);

      const input = {
        applicationId: 'app-1',
        selectedAssignments: [
          {
            dates: ['2024-02-01'],
            roleIds: ['dealer' as StaffRole],
            timeSlot: '09:00-18:00',
          },
        ],
      };

      mockConfirmApplicationWithHistory.mockResolvedValue({
        applicationId: 'app-1',
        workLogIds: ['work-1'],
        message: '김스태프님의 지원이 확정되었습니다',
        historyEntry: {},
      });

      const result = await confirmApplication(input, 'employer-1');

      expect(result.applicationId).toBe('app-1');
      expect(mockConfirmApplicationWithHistory).toHaveBeenCalledWith(
        'app-1',
        input.selectedAssignments,
        'employer-1',
        undefined
      );
    });

    it('notes를 포함하여 확정해야 함', async () => {
      const input = {
        applicationId: 'app-1',
        notes: '경력자로 확정',
      };

      mockGetById.mockResolvedValue(createMockApplication({ id: 'app-1' }));

      mockConfirmApplicationWithHistory.mockResolvedValue({
        applicationId: 'app-1',
        workLogIds: ['work-1'],
        message: '김스태프님의 지원이 확정되었습니다',
        historyEntry: {},
      });

      await confirmApplication(input, 'employer-1');

      expect(mockConfirmApplicationWithHistory).toHaveBeenCalledWith(
        'app-1',
        expect.anything(),
        'employer-1',
        '경력자로 확정'
      );
    });

    it('존재하지 않는 지원서는 에러를 발생시켜야 함', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      const input: ConfirmApplicationInput = {
        applicationId: 'non-existent',
      };

      mockGetById.mockResolvedValue(null);

      await expect(confirmApplication(input, 'employer-1')).rejects.toThrow(BusinessError);
    });

    it('정원 초과 시 에러를 발생시켜야 함', async () => {
      const input: ConfirmApplicationInput = {
        applicationId: 'app-1',
      };

      mockGetById.mockResolvedValue(createMockApplication({ id: 'app-1' }));

      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockConfirmApplicationWithHistory.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED, {
          userMessage: '모집 인원이 마감되었습니다',
        })
      );

      await expect(confirmApplication(input, 'employer-1')).rejects.toThrow('모집 인원이 마감되었습니다');
    });

    it('다중 WorkLog를 생성하면 첫 번째 ID를 반환해야 함', async () => {
      const input: ConfirmApplicationInput = {
        applicationId: 'app-1',
      };

      mockGetById.mockResolvedValue(createMockApplication({ id: 'app-1' }));

      mockConfirmApplicationWithHistory.mockResolvedValue({
        applicationId: 'app-1',
        workLogIds: ['work-1', 'work-2', 'work-3'],
        message: '김스태프님의 지원이 확정되었습니다',
        historyEntry: {},
      });

      const result = await confirmApplication(input, 'employer-1');

      expect(result.workLogId).toBe('work-1');
    });
  });

  // ==========================================================================
  // rejectApplication
  // ==========================================================================

  describe('rejectApplication', () => {
    it('지원을 거절해야 함', async () => {
      const input: RejectApplicationInput = {
        applicationId: 'app-1',
        reason: '경력 부족',
      };

      mockRejectWithTransaction.mockResolvedValue(undefined);

      await rejectApplication(input, 'employer-1');

      expect(mockRejectWithTransaction).toHaveBeenCalledWith(input, 'employer-1');
    });

    it('거절 사유 없이도 거절 가능해야 함', async () => {
      const input: RejectApplicationInput = {
        applicationId: 'app-1',
      };

      mockRejectWithTransaction.mockResolvedValue(undefined);

      await rejectApplication(input, 'employer-1');

      expect(mockRejectWithTransaction).toHaveBeenCalledWith(input, 'employer-1');
    });

    it('권한이 없으면 에러를 발생시켜야 함', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      const input: RejectApplicationInput = {
        applicationId: 'app-1',
        reason: '경력 부족',
      };

      mockRejectWithTransaction.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        })
      );

      await expect(rejectApplication(input, 'employer-1')).rejects.toThrow(
        '본인의 공고만 관리할 수 있습니다'
      );
    });

    it('존재하지 않는 지원서는 에러를 발생시켜야 함', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      const input: RejectApplicationInput = {
        applicationId: 'non-existent',
        reason: '경력 부족',
      };

      mockRejectWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 지원입니다',
        })
      );

      await expect(rejectApplication(input, 'employer-1')).rejects.toThrow('존재하지 않는 지원입니다');
    });
  });

  // ==========================================================================
  // bulkConfirmApplications
  // ==========================================================================

  describe('bulkConfirmApplications', () => {
    it('여러 지원을 일괄 확정해야 함', async () => {
      mockGetById.mockImplementation(async (id: string) => {
        return createMockApplication({ id });
      });

      mockConfirmApplicationWithHistory.mockImplementation(async (id: string) => ({
        applicationId: id,
        workLogIds: [`work-${id}`],
        message: '확정 완료',
        historyEntry: {},
      }));

      const result = await bulkConfirmApplications(['app-1', 'app-2', 'app-3'], 'employer-1');

      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.workLogIds).toHaveLength(3);
      expect(result.failedIds).toHaveLength(0);
    });

    it('일부 실패 시 성공/실패 카운트를 반환해야 함', async () => {
      mockGetById.mockImplementation(async (id: string) => {
        if (id === 'app-2') {
          return null; // app-2는 존재하지 않음
        }
        return createMockApplication({ id });
      });

      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');

      mockConfirmApplicationWithHistory.mockImplementation(async (id: string) => {
        if (id === 'app-2') {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '존재하지 않는 지원입니다',
          });
        }
        return {
          applicationId: id,
          workLogIds: [`work-${id}`],
          message: '확정 완료',
          historyEntry: {},
        };
      });

      const result = await bulkConfirmApplications(['app-1', 'app-2', 'app-3'], 'employer-1');

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.failedIds).toContain('app-2');
      expect(result.workLogIds).toHaveLength(2);
    });

    it('모두 실패 시 빈 workLogIds를 반환해야 함', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');

      mockGetById.mockResolvedValue(null);
      mockConfirmApplicationWithHistory.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 지원입니다',
        })
      );

      const result = await bulkConfirmApplications(['app-1', 'app-2'], 'employer-1');

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(2);
      expect(result.workLogIds).toHaveLength(0);
    });

    it('빈 배열을 전달하면 성공 카운트 0을 반환해야 함', async () => {
      const result = await bulkConfirmApplications([], 'employer-1');

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.workLogIds).toHaveLength(0);
    });
  });

  // ==========================================================================
  // markApplicationAsRead
  // ==========================================================================

  describe('markApplicationAsRead', () => {
    it('지원서를 읽음 처리해야 함', async () => {
      mockMarkAsRead.mockResolvedValue(undefined);

      await markApplicationAsRead('app-1', 'employer-1');

      expect(mockMarkAsRead).toHaveBeenCalledWith('app-1', 'employer-1');
    });

    it('권한이 없으면 에러를 발생시켜야 함', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockMarkAsRead.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        })
      );

      await expect(markApplicationAsRead('app-1', 'employer-1')).rejects.toThrow(
        '본인의 공고만 관리할 수 있습니다'
      );
    });

    it('존재하지 않는 지원서는 에러를 발생시켜야 함', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockMarkAsRead.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 지원입니다',
        })
      );

      await expect(markApplicationAsRead('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 지원입니다'
      );
    });
  });

  // ==========================================================================
  // getApplicantStatsByRole
  // ==========================================================================

  describe('getApplicantStatsByRole', () => {
    it('역할별 통계를 집계해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({
            id: 'app-1',
            status: 'applied',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['dealer'], timeSlot: '09:00-18:00' }],
          }),
          createMockApplication({
            id: 'app-2',
            status: 'confirmed',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['dealer'], timeSlot: '09:00-18:00' }],
          }),
          createMockApplication({
            id: 'app-3',
            status: 'applied',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['manager'], timeSlot: '09:00-18:00' }],
          }),
        ] as Application[],
        stats: createMockStats({ total: 3, applied: 2, confirmed: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect(result.dealer).toBeDefined();
      expect(result.dealer.total).toBe(2);
      expect(result.dealer.applied).toBe(1);
      expect(result.dealer.confirmed).toBe(1);

      expect(result.manager).toBeDefined();
      expect(result.manager.total).toBe(1);
      expect(result.manager.applied).toBe(1);
    });

    it('커스텀 역할을 지원해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({
            id: 'app-1',
            status: 'applied',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['other'], timeSlot: '09:00-18:00' }],
            customRole: '사회자',
          }),
          createMockApplication({
            id: 'app-2',
            status: 'confirmed',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['other'], timeSlot: '09:00-18:00' }],
            customRole: '사회자',
          }),
        ] as Application[],
        stats: createMockStats({ total: 2, applied: 1, confirmed: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect(result['사회자']).toBeDefined();
      expect(result['사회자'].total).toBe(2);
      expect(result['사회자'].applied).toBe(1);
      expect(result['사회자'].confirmed).toBe(1);
    });

    it('지원자가 없으면 빈 객체를 반환해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [],
        stats: createMockStats(),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('여러 역할의 통계를 정확히 집계해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({
            id: 'app-1',
            status: 'confirmed',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['dealer'], timeSlot: '09:00-18:00' }],
          }),
          createMockApplication({
            id: 'app-2',
            status: 'confirmed',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['dealer'], timeSlot: '09:00-18:00' }],
          }),
          createMockApplication({
            id: 'app-3',
            status: 'rejected',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['dealer'], timeSlot: '09:00-18:00' }],
          }),
          createMockApplication({
            id: 'app-4',
            status: 'confirmed',
            assignments: [{ dates: ['2024-02-01'], roleIds: ['chiprunner'], timeSlot: '09:00-18:00' }],
          }),
        ] as Application[],
        stats: createMockStats({ total: 4, confirmed: 3, rejected: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect(result.dealer.total).toBe(3);
      expect(result.dealer.confirmed).toBe(2);
      expect(result.dealer.rejected).toBe(1);

      expect(result.chiprunner.total).toBe(1);
      expect(result.chiprunner.confirmed).toBe(1);
    });
  });

  // ==========================================================================
  // verifyJobPostingOwnership
  // ==========================================================================

  describe('verifyJobPostingOwnership', () => {
    it('소유자이면 true를 반환해야 함', async () => {
      mockVerifyOwnership.mockResolvedValue(true);

      const result = await verifyJobPostingOwnership('job-1', 'employer-1');

      expect(result).toBe(true);
      expect(mockVerifyOwnership).toHaveBeenCalledWith('job-1', 'employer-1');
    });

    it('소유자가 아니면 false를 반환해야 함', async () => {
      mockVerifyOwnership.mockResolvedValue(false);

      const result = await verifyJobPostingOwnership('job-1', 'employer-2');

      expect(result).toBe(false);
    });

    it('공고가 없으면 false를 반환해야 함', async () => {
      mockVerifyOwnership.mockResolvedValue(false);

      const result = await verifyJobPostingOwnership('non-existent', 'employer-1');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // subscribeToApplicants
  // ==========================================================================

  describe('subscribeToApplicants', () => {
    it('실시간 구독을 시작해야 함', () => {
      const mockUnsubscribe = jest.fn();
      mockSubscribeByJobPosting.mockReturnValue(mockUnsubscribe);

      const callbacks = {
        onUpdate: jest.fn(),
        onError: jest.fn(),
      };

      const unsubscribe = subscribeToApplicants('job-1', 'employer-1', callbacks);

      expect(mockSubscribeByJobPosting).toHaveBeenCalledWith('job-1', 'employer-1', expect.any(Object));
      expect(typeof unsubscribe).toBe('function');
    });

    it('업데이트 콜백을 호출해야 함', () => {
      let capturedCallbacks: { onUpdate: (result: ApplicantListWithStats) => void } | null = null;

      mockSubscribeByJobPosting.mockImplementation(
        (_jobPostingId: string, _ownerId: string, callbacks: unknown) => {
          capturedCallbacks = callbacks as { onUpdate: (result: ApplicantListWithStats) => void };
          return jest.fn();
        }
      );

      const onUpdate = jest.fn();
      const callbacks = {
        onUpdate,
        onError: jest.fn(),
      };

      subscribeToApplicants('job-1', 'employer-1', callbacks);

      const mockResult: ApplicantListWithStats = {
        applications: [createMockApplication()],
        stats: createMockStats({ total: 1 }),
      };

      capturedCallbacks?.onUpdate(mockResult);

      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ applicants: expect.any(Array) }));
    });

    it('에러 콜백을 호출해야 함', () => {
      let capturedCallbacks: { onError?: (error: Error) => void } | null = null;

      mockSubscribeByJobPosting.mockImplementation(
        (_jobPostingId: string, _ownerId: string, callbacks: unknown) => {
          capturedCallbacks = callbacks as { onError?: (error: Error) => void };
          return jest.fn();
        }
      );

      const onError = jest.fn();
      const callbacks = {
        onUpdate: jest.fn(),
        onError,
      };

      subscribeToApplicants('job-1', 'employer-1', callbacks);

      const error = new Error('구독 에러');
      capturedCallbacks?.onError?.(error);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  // ==========================================================================
  // subscribeToApplicantsAsync
  // ==========================================================================

  describe('subscribeToApplicantsAsync', () => {
    it('권한 확인 후 구독을 시작해야 함', async () => {
      mockVerifyOwnership.mockResolvedValue(true);

      const mockUnsubscribe = jest.fn();
      mockSubscribeByJobPosting.mockReturnValue(mockUnsubscribe);

      const callbacks = {
        onUpdate: jest.fn(),
        onError: jest.fn(),
      };

      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'employer-1', callbacks);

      expect(mockVerifyOwnership).toHaveBeenCalledWith('job-1', 'employer-1');
      expect(mockSubscribeByJobPosting).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('권한이 없으면 에러를 호출하고 빈 unsubscribe를 반환해야 함', async () => {
      mockVerifyOwnership.mockResolvedValue(false);

      const onError = jest.fn();
      const callbacks = {
        onUpdate: jest.fn(),
        onError,
      };

      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'employer-1', callbacks);

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: 'PermissionError' }));
      expect(mockSubscribeByJobPosting).not.toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');

      // 빈 unsubscribe는 호출해도 아무 일도 일어나지 않아야 함
      expect(() => unsubscribe()).not.toThrow();
    });

    it('onError 콜백이 없어도 동작해야 함', async () => {
      mockVerifyOwnership.mockResolvedValue(false);

      const callbacks = {
        onUpdate: jest.fn(),
      };

      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'employer-1', callbacks);

      expect(mockSubscribeByJobPosting).not.toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
