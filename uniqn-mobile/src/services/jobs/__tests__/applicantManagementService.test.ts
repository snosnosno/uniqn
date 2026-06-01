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
  JobPosting,
  RejectApplicationInput,
  StaffRole,
} from '@/types';
import type { ApplicantListWithStats } from '@/repositories/interfaces';

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
} from '@/services/jobs/applicantManagementService';
import { PermissionError, ERROR_CODES } from '@/errors';

// ============================================================================
// Mock Setup (호이스팅을 위해 파일 최상단에 배치)
// ============================================================================

const mockFindByJobPostingWithStats = jest.fn();
const mockGetById = jest.fn();
const mockRejectWithTransaction = jest.fn();
const mockMarkAsRead = jest.fn();
const mockSubscribeByJobPosting = jest.fn();
const mockVerifyOwnership = jest.fn();
const mockRealtimeSubscribe = jest.fn();
const mockLoadAndVerifyJobPostingAccess = jest.fn();

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

jest.mock('@/repositories/supabase/ApplicationRepositoryHelpers', () => ({
  loadAndVerifyJobPostingAccess: (...args: unknown[]) => mockLoadAndVerifyJobPostingAccess(...args),
}));

const mockConfirmApplicationWithHistory = jest.fn();

jest.mock('@/services/jobs/applicationHistoryService', () => ({
  confirmApplicationWithHistory: (...args: unknown[]) => mockConfirmApplicationWithHistory(...args),
}));

jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    Keys: {
      applicants: (jobPostingId: string) => `applicants:${jobPostingId}`,
    },
    subscribe: (...args: unknown[]) => mockRealtimeSubscribe(...args),
  },
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
      INFRA_NOT_FOUND: 'E4002',
      INFRA_PERMISSION_DENIED: 'E4001',
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
    confirmed: 'confirmed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    completed: 'completed',
    cancellationPending: 'cancellationPending',
  },
}));

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
    assignments: [{ isGrouped: false }],
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 },
    ...overrides,
  } as Application;
}

function createMockStats(overrides: Partial<ApplicationStats> = {}): ApplicationStats {
  return {
    total: 0,
    applied: 0,
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
    mockRealtimeSubscribe.mockImplementation((_key: string, subscribeFn: () => () => void) =>
      subscribeFn()
    );
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
      expect(mockFindByJobPostingWithStats).toHaveBeenCalledWith(
        'job-1',
        'employer-1',
        'confirmed'
      );
    });

    it('다중 상태 필터를 적용하여 조회해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({ id: 'app-1', status: 'confirmed' }),
          createMockApplication({ id: 'app-2', status: 'applied' }),
        ],
        stats: createMockStats({ total: 2, confirmed: 1, applied: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantsByJobPosting('job-1', 'employer-1', [
        'confirmed',
        'applied',
      ]);

      expect(result.applicants).toHaveLength(2);
      expect(mockFindByJobPostingWithStats).toHaveBeenCalledWith('job-1', 'employer-1', [
        'confirmed',
        'applied',
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
        new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: '권한이 없습니다',
        })
      );

      await expect(getApplicantsByJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '권한이 없습니다'
      );
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
            isGrouped: false,
          },
        ],
      });

      mockGetById.mockResolvedValue(mockApplication);

      const input = {
        applicationId: 'app-1',
        selectedAssignments: [{ isGrouped: false }],
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
      const { BusinessError } = jest.requireMock('@/errors');
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

      await expect(confirmApplication(input, 'employer-1')).rejects.toThrow(
        '모집 인원이 마감되었습니다'
      );
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
    it('rejects unsafe rejection reasons before the repository call', async () => {
      await expect(
        rejectApplication(
          {
            applicationId: 'app-1',
            reason: '<script>alert(1)</script>',
          },
          'employer-1'
        )
      ).rejects.toThrow();

      expect(mockRejectWithTransaction).not.toHaveBeenCalled();
    });

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
        new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
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
        new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '존재하지 않는 지원입니다',
        })
      );

      await expect(rejectApplication(input, 'employer-1')).rejects.toThrow(
        '존재하지 않는 지원입니다'
      );
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
          throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
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

      // U3: 실패 항목별 사유 구조화 (code/reason 캡처)
      // app-2는 getById가 null → confirmApplication이 INFRA_NOT_FOUND로 throw
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({
        applicationId: 'app-2',
        code: ERROR_CODES.INFRA_NOT_FOUND,
        reason: '존재하지 않는 지원자입니다.',
      });
    });

    it('정원 마감 실패 사유를 code로 구분할 수 있어야 함', async () => {
      const { BusinessError, ERROR_CODES: MockCodes } = jest.requireMock('@/errors');

      mockGetById.mockImplementation(async (id: string) => createMockApplication({ id }));
      mockConfirmApplicationWithHistory.mockImplementation(async (id: string) => {
        if (id === 'app-2') {
          throw new BusinessError(MockCodes.BUSINESS_MAX_CAPACITY_REACHED, {
            userMessage: '모집 인원이 마감되었습니다',
          });
        }
        return {
          applicationId: id,
          workLogIds: [`work-${id}`],
          message: '확정 완료',
          historyEntry: {},
        };
      });

      const result = await bulkConfirmApplications(['app-1', 'app-2'], 'employer-1');

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      const capacityFailures = result.failed.filter(
        (f) => f.code === MockCodes.BUSINESS_MAX_CAPACITY_REACHED
      );
      expect(capacityFailures).toHaveLength(1);
      expect(capacityFailures[0]?.applicationId).toBe('app-2');
      expect(capacityFailures[0]?.reason).toBe('모집 인원이 마감되었습니다');
    });

    it('모두 실패 시 빈 workLogIds를 반환해야 함', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');

      mockGetById.mockResolvedValue(null);
      mockConfirmApplicationWithHistory.mockRejectedValue(
        new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
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
        new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
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
        new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
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
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
          createMockApplication({
            id: 'app-2',
            status: 'confirmed',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
          createMockApplication({
            id: 'app-3',
            status: 'applied',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['manager'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
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
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['other'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
            customRole: '사회자',
          }),
          createMockApplication({
            id: 'app-2',
            status: 'confirmed',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['other'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
            customRole: '사회자',
          }),
        ] as Application[],
        stats: createMockStats({ total: 2, applied: 1, confirmed: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect((result as Record<string, ApplicationStats>)['사회자']).toBeDefined();
      expect((result as Record<string, ApplicationStats>)['사회자'].total).toBe(2);
      expect((result as Record<string, ApplicationStats>)['사회자'].applied).toBe(1);
      expect((result as Record<string, ApplicationStats>)['사회자'].confirmed).toBe(1);
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
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
          createMockApplication({
            id: 'app-2',
            status: 'confirmed',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
          createMockApplication({
            id: 'app-3',
            status: 'rejected',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
          createMockApplication({
            id: 'app-4',
            status: 'confirmed',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['floor'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
        ] as Application[],
        stats: createMockStats({ total: 4, confirmed: 3, rejected: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect(result.dealer.total).toBe(3);
      expect(result.dealer.confirmed).toBe(2);
      expect(result.dealer.rejected).toBe(1);

      expect((result as Record<string, ApplicationStats>).floor.total).toBe(1);
      expect((result as Record<string, ApplicationStats>).floor.confirmed).toBe(1);
    });

    it('한 지원자가 여러 역할을 선택하면 각 역할에 모두 집계해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({
            id: 'app-1',
            status: 'confirmed',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer', 'floor'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
        ] as Application[],
        stats: createMockStats({ total: 1, confirmed: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      // dealer/floor 각각 1건씩 집계되어야 함 (primaryRole만 보던 기존 버그 회귀 가드)
      expect(result.dealer.total).toBe(1);
      expect(result.dealer.confirmed).toBe(1);
      expect((result as Record<string, ApplicationStats>).floor.total).toBe(1);
      expect((result as Record<string, ApplicationStats>).floor.confirmed).toBe(1);
    });

    it('여러 assignment에 걸친 역할을 모두 집계해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({
            id: 'app-1',
            status: 'applied',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
              {
                dates: ['2024-02-02'],
                roleIds: ['manager'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
            ],
          }),
        ] as Application[],
        stats: createMockStats({ total: 1, applied: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect(result.dealer.total).toBe(1);
      expect(result.dealer.applied).toBe(1);
      expect(result.manager.total).toBe(1);
      expect(result.manager.applied).toBe(1);
    });

    it('동일 역할이 여러 assignment에 중복되면 1회만 집계해야 함', async () => {
      const mockResult: ApplicantListWithStats = {
        applications: [
          createMockApplication({
            id: 'app-1',
            status: 'confirmed',
            assignments: [
              {
                dates: ['2024-02-01'],
                roleIds: ['dealer'],
                timeSlot: '09:00-18:00',
                isGrouped: false,
              },
              {
                dates: ['2024-02-02'],
                roleIds: ['dealer'],
                timeSlot: '19:00-22:00',
                isGrouped: false,
              },
            ],
          }),
        ] as Application[],
        stats: createMockStats({ total: 1, confirmed: 1 }),
      };

      mockFindByJobPostingWithStats.mockResolvedValue(mockResult);

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      // 중복 역할은 지원자 단위로 1회만 집계 (총합 왜곡 방지)
      expect(result.dealer.total).toBe(1);
      expect(result.dealer.confirmed).toBe(1);
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

      expect(mockSubscribeByJobPosting).toHaveBeenCalledWith(
        'job-1',
        'employer-1',
        expect.any(Object),
        { verifyOwnership: true }
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('업데이트 콜백을 호출해야 함', () => {
      let capturedCallbacks: { onUpdate: (result: ApplicantListWithStats) => void } | null =
        null as { onUpdate: (result: ApplicantListWithStats) => void } | null;

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

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ applicants: expect.any(Array) })
      );
    });

    it('에러 콜백을 호출해야 함', () => {
      let capturedCallbacks: { onError?: (error: Error) => void } | null = null as {
        onError?: (error: Error) => void;
      } | null;

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
    const fakeJobPosting = {
      id: 'job-1',
      ownerId: 'employer-1',
      workspaceId: 'ws-1',
      title: '테스트 공고',
    } as unknown as JobPosting;

    it('owner 본인 호출 시 권한 통과 후 구독을 시작해야 함', async () => {
      mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

      const mockUnsubscribe = jest.fn();
      mockSubscribeByJobPosting.mockReturnValue(mockUnsubscribe);

      const callbacks = {
        onUpdate: jest.fn(),
        onError: jest.fn(),
      };

      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'employer-1', callbacks);

      expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
        'job-1',
        'employer-1',
        '지원자 구독'
      );
      expect(mockSubscribeByJobPosting).toHaveBeenCalledWith(
        'job-1',
        'employer-1',
        expect.any(Object),
        { verifyOwnership: false }
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('워크스페이스 멤버 호출 시 통과 (helper 가 통과하면 구독 시작)', async () => {
      mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

      const mockUnsubscribe = jest.fn();
      mockSubscribeByJobPosting.mockReturnValue(mockUnsubscribe);

      const callbacks = {
        onUpdate: jest.fn(),
        onError: jest.fn(),
      };

      // 호출자는 owner 가 아닌 워크스페이스 멤버 (helper 가 통과 처리)
      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'member-uid', callbacks);

      expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalledWith(
        'job-1',
        'member-uid',
        '지원자 구독'
      );
      expect(mockSubscribeByJobPosting).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('admin 호출 시 통과 (helper 가 통과하면 구독 시작)', async () => {
      mockLoadAndVerifyJobPostingAccess.mockResolvedValue(fakeJobPosting);

      const mockUnsubscribe = jest.fn();
      mockSubscribeByJobPosting.mockReturnValue(mockUnsubscribe);

      const callbacks = {
        onUpdate: jest.fn(),
        onError: jest.fn(),
      };

      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'admin-uid', callbacks);

      expect(mockLoadAndVerifyJobPostingAccess).toHaveBeenCalled();
      expect(mockSubscribeByJobPosting).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('외부인 호출 시 PermissionError 를 onError 로 호출하고 빈 unsubscribe 반환', async () => {
      const permissionError = new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
        userMessage: '워크스페이스 멤버만 관리할 수 있습니다: 지원자 구독',
      });
      mockLoadAndVerifyJobPostingAccess.mockRejectedValue(permissionError);

      const onError = jest.fn();
      const callbacks = {
        onUpdate: jest.fn(),
        onError,
      };

      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'stranger-uid', callbacks);

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ name: 'PermissionError' }));
      expect(mockSubscribeByJobPosting).not.toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');

      // 빈 unsubscribe는 호출해도 아무 일도 일어나지 않아야 함
      expect(() => unsubscribe()).not.toThrow();
    });

    it('onError 콜백이 없어도 권한 거절 시 빈 unsubscribe 반환', async () => {
      const permissionError = new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
        userMessage: '워크스페이스 멤버만 관리할 수 있습니다: 지원자 구독',
      });
      mockLoadAndVerifyJobPostingAccess.mockRejectedValue(permissionError);

      const callbacks = {
        onUpdate: jest.fn(),
      };

      const unsubscribe = await subscribeToApplicantsAsync('job-1', 'stranger-uid', callbacks);

      expect(mockSubscribeByJobPosting).not.toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('PermissionError 가 아닌 에러는 propagate (onError 로 위임 안 함)', async () => {
      // helper 내부 supabase RPC 에러 등은 callbacks.onError 가 아니라 throw 로 전달
      const otherError = new Error('네트워크 에러');
      mockLoadAndVerifyJobPostingAccess.mockRejectedValue(otherError);

      const onError = jest.fn();
      const callbacks = {
        onUpdate: jest.fn(),
        onError,
      };

      await expect(subscribeToApplicantsAsync('job-1', 'employer-1', callbacks)).rejects.toThrow(
        '네트워크 에러'
      );

      expect(onError).not.toHaveBeenCalled();
      expect(mockSubscribeByJobPosting).not.toHaveBeenCalled();
    });
  });
});
